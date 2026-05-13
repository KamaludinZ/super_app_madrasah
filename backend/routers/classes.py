"""Classes CRUD + Excel import."""
import io
from datetime import datetime
from typing import Dict, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from core import (
    db,
    get_active_academic_year,
    get_current_user,
    log_audit,
    require_role,
    serialize_doc,
)
from excel_io import class_template, parse_class_rows
from models import ClassModel

router = APIRouter()


@router.get("/classes")
async def list_classes(academic_year_id: Optional[str] = None, user: Dict = Depends(get_current_user)):
    q = {}
    if academic_year_id:
        q['academic_year_id'] = academic_year_id
    items = await db.classes.find(q, {'_id': 0}).sort('name', 1).to_list(500)
    enriched = []
    for c in items:
        c['student_count'] = await db.users.count_documents({
            'roles': 'siswa', 'student_class_id': c['id'], 'is_active': True
        })
        c.setdefault('capacity', 40)
        if c.get('homeroom_teacher_id'):
            t = await db.users.find_one({'id': c['homeroom_teacher_id']}, {'_id': 0, 'full_name': 1})
            c['homeroom_teacher_name'] = t.get('full_name') if t else None
        if c.get('room_id'):
            r = await db.rooms.find_one({'id': c['room_id']}, {'_id': 0, 'name': 1})
            c['room_name'] = r.get('name') if r else None
        enriched.append(serialize_doc(c))
    return enriched


@router.post("/classes")
async def create_class(payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    cls = ClassModel(**payload)
    doc = cls.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.classes.insert_one(doc)
    await log_audit(user, 'create', 'class', cls.id, details={'name': cls.name}, request=request)
    return serialize_doc(doc)


@router.put("/classes/{cid}")
async def update_class(cid: str, payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    res = await db.classes.update_one({'id': cid}, {'$set': payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Kelas tidak ditemukan")
    await log_audit(user, 'update', 'class', cid, details=payload, request=request)
    doc = await db.classes.find_one({'id': cid}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/classes/{cid}")
async def delete_class(cid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    await db.classes.delete_one({'id': cid})
    await log_audit(user, 'delete', 'class', cid, request=request)
    return {'message': 'Dihapus'}


@router.get("/classes/excel-template")
async def classes_template_dl(user: Dict = Depends(require_role('admin'))):
    return StreamingResponse(
        io.BytesIO(class_template()),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename="template_kelas_matsandatama.xlsx"'},
    )


@router.post("/classes/import-excel")
async def classes_import(file: UploadFile = File(...), request: Request = None,
                         user: Dict = Depends(require_role('admin'))):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(400, "Hanya .xlsx")
    contents = await file.read()
    rows = parse_class_rows(contents)
    ay = await get_active_academic_year()
    if not ay:
        raise HTTPException(400, "Tidak ada TP aktif")
    users_map = {u['username']: u['id'] for u in await db.users.find({}, {'_id': 0, 'username': 1, 'id': 1}).to_list(2000)}
    rooms_map = {r['name']: r['id'] for r in await db.rooms.find({}, {'_id': 0, 'name': 1, 'id': 1}).to_list(500)}
    success = 0
    errors = []
    new_docs = []
    for r in rows:
        try:
            if not r['name']:
                errors.append(f"Baris {r['_row']}: nama kelas wajib"); continue
            existing = await db.classes.find_one({'name': r['name'], 'academic_year_id': ay['id']})
            if existing:
                errors.append(f"Baris {r['_row']}: kelas '{r['name']}' sudah ada di TP aktif"); continue
            homeroom_id = users_map.get(r.get('wali_kelas_username')) if r.get('wali_kelas_username') else None
            room_id = rooms_map.get(r.get('ruang_kode')) if r.get('ruang_kode') else None
            cls = ClassModel(
                name=r['name'], grade=r['grade'], parallel=r['parallel'],
                academic_year_id=ay['id'],
                homeroom_teacher_id=homeroom_id, room_id=room_id,
                is_accelerated=r.get('is_accelerated', False),
            )
            doc = cls.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            new_docs.append(doc)
            success += 1
        except Exception as e:
            errors.append(f"Baris {r['_row']}: {e}")
    if new_docs:
        await db.classes.insert_many(new_docs)
    await log_audit(user, 'import_excel', 'class', None, details={'success': success, 'errors': len(errors)}, request=request)
    return {'success': success, 'errors': errors, 'total_rows': len(rows)}
