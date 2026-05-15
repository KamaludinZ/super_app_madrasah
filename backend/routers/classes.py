"""Classes CRUD + Excel import + Token generation."""
import io
import random
import string
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


def _generate_class_token(class_name: str, ay_name: Optional[str] = None) -> str:
    """Generate a short class token like '7A-2526-X9K2'.

    Used as fallback for QR scan: teachers/students can input this token manually.
    """
    # Year part: take last 2 digits of each year in TP, e.g. "2025/2026" -> "2526"
    year_part = ''
    if ay_name:
        digits = ''.join(c for c in ay_name if c.isdigit())
        if len(digits) >= 8:
            year_part = digits[2:4] + digits[6:8]
        elif len(digits) >= 4:
            year_part = digits[-4:]
    if not year_part:
        year_part = datetime.utcnow().strftime('%y')
    # Class part: take alnum from name (e.g. "7A" -> "7A")
    class_part = ''.join(c for c in class_name if c.isalnum()).upper() or 'CLS'
    # Random suffix
    rand = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    rand = rand.replace('O', 'X').replace('0', '2').replace('I', 'K').replace('1', 'L')
    return f"{class_part}-{year_part}-{rand}"


async def _ensure_unique_token(token: str) -> str:
    """Regenerate suffix if collision."""
    for _ in range(5):
        existing = await db.classes.find_one({'token': token})
        if not existing:
            return token
        # Replace last 4 chars
        rand = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        rand = rand.replace('O', 'X').replace('0', '2').replace('I', 'K').replace('1', 'L')
        token = token.rsplit('-', 1)[0] + '-' + rand
    return token  # accept after 5 tries (extremely unlikely)


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
        # Curriculum enrichment (from class.curriculum_id, fallback to TP.curriculum_id)
        ay = await db.academic_years.find_one({'id': c.get('academic_year_id')}, {'_id': 0, 'curriculum_id': 1, 'active_semester': 1, 'name': 1})
        cur_id = c.get('curriculum_id') or (ay.get('curriculum_id') if ay else None)
        if cur_id:
            cur = await db.curriculums.find_one({'id': cur_id}, {'_id': 0, 'name': 1, 'code': 1})
            c['curriculum_name'] = cur.get('name') if cur else None
            c['curriculum_code'] = cur.get('code') if cur else None
        if ay:
            c['ay_name'] = ay.get('name')
            # Effective semester: class.semester if set, else TP.active_semester
            c['effective_semester'] = c.get('semester') or ay.get('active_semester')
        enriched.append(serialize_doc(c))
    return enriched


@router.post("/classes")
async def create_class(payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    # Auto-fill curriculum/semester from TP if not provided
    if not payload.get('curriculum_id') or not payload.get('semester'):
        ay = await db.academic_years.find_one({'id': payload.get('academic_year_id')}, {'_id': 0})
        if ay:
            if not payload.get('curriculum_id'):
                payload['curriculum_id'] = ay.get('curriculum_id')
            if not payload.get('semester'):
                payload['semester'] = ay.get('active_semester')
    cls = ClassModel(**payload)
    # Auto-generate token if not provided
    if not cls.token:
        ay = await db.academic_years.find_one({'id': cls.academic_year_id}, {'_id': 0, 'name': 1})
        token = _generate_class_token(cls.name, ay.get('name') if ay else None)
        token = await _ensure_unique_token(token)
        cls.token = token
    doc = cls.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.classes.insert_one(doc)
    await log_audit(user, 'create', 'class', cls.id, details={'name': cls.name, 'token': cls.token}, request=request)
    return serialize_doc(doc)


@router.put("/classes/{cid}")
async def update_class(cid: str, payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    payload.pop('token', None)  # token tidak boleh diubah via update; gunakan regenerate-token
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


@router.post("/classes/{cid}/regenerate-token")
async def regenerate_class_token(cid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    """Generate ulang token kelas. Token lama tidak bisa digunakan lagi setelah ini."""
    cls = await db.classes.find_one({'id': cid}, {'_id': 0})
    if not cls:
        raise HTTPException(404, "Kelas tidak ditemukan")
    ay = await db.academic_years.find_one({'id': cls.get('academic_year_id')}, {'_id': 0, 'name': 1})
    new_token = _generate_class_token(cls['name'], ay.get('name') if ay else None)
    new_token = await _ensure_unique_token(new_token)
    await db.classes.update_one({'id': cid}, {'$set': {'token': new_token}})
    await log_audit(user, 'regenerate_token', 'class', cid, details={'new_token': new_token}, request=request)
    return {'token': new_token, 'message': 'Token baru dibuat. Token lama tidak berlaku lagi.'}


# Backfill: ensure every class has a token (run once on first access)
@router.post("/classes/backfill-tokens")
async def backfill_tokens(request: Request, user: Dict = Depends(require_role('admin'))):
    """Bulk: generate token untuk semua kelas yang belum punya."""
    classes = await db.classes.find({'$or': [{'token': None}, {'token': {'$exists': False}}]},
                                    {'_id': 0}).to_list(500)
    updated = 0
    for c in classes:
        ay = await db.academic_years.find_one({'id': c.get('academic_year_id')}, {'_id': 0, 'name': 1})
        token = _generate_class_token(c['name'], ay.get('name') if ay else None)
        token = await _ensure_unique_token(token)
        await db.classes.update_one({'id': c['id']}, {'$set': {'token': token}})
        updated += 1
    await log_audit(user, 'backfill_tokens', 'class', None, details={'count': updated}, request=request)
    return {'updated': updated}


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
