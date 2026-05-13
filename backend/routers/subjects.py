"""Subjects CRUD + Excel import."""
import io
from typing import Dict

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

from core import db, get_current_user, log_audit, require_role, serialize_doc
from excel_io import parse_subject_rows, subject_template
from models import SubjectModel

router = APIRouter()


@router.get("/subjects")
async def list_subjects(user: Dict = Depends(get_current_user)):
    items = await db.subjects.find({}, {'_id': 0}).sort('name', 1).to_list(500)
    return [serialize_doc(i) for i in items]


@router.post("/subjects")
async def create_subject(payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    sub = SubjectModel(**payload)
    doc = sub.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.subjects.insert_one(doc)
    await log_audit(user, 'create', 'subject', sub.id, details={'name': sub.name}, request=request)
    return serialize_doc(doc)


@router.put("/subjects/{sid}")
async def update_subject(sid: str, payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    res = await db.subjects.update_one({'id': sid}, {'$set': payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Mata pelajaran tidak ditemukan")
    await log_audit(user, 'update', 'subject', sid, details=payload, request=request)
    doc = await db.subjects.find_one({'id': sid}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/subjects/{sid}")
async def delete_subject(sid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    await db.subjects.delete_one({'id': sid})
    await log_audit(user, 'delete', 'subject', sid, request=request)
    return {'message': 'Dihapus'}


@router.get("/subjects/excel-template")
async def subjects_template_dl(user: Dict = Depends(require_role('admin'))):
    return StreamingResponse(
        io.BytesIO(subject_template()),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename="template_mapel_matsandatama.xlsx"'},
    )


@router.post("/subjects/import-excel")
async def subjects_import(file: UploadFile = File(...), request: Request = None,
                          user: Dict = Depends(require_role('admin'))):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(400, "Hanya .xlsx")
    contents = await file.read()
    rows = parse_subject_rows(contents)
    success = 0
    errors = []
    new_docs = []
    for r in rows:
        try:
            if not r['code'] or not r['name']:
                errors.append(f"Baris {r['_row']}: kode & nama wajib"); continue
            existing = await db.subjects.find_one({'code': r['code']})
            if existing:
                errors.append(f"Baris {r['_row']}: kode '{r['code']}' sudah ada"); continue
            s = SubjectModel(code=r['code'], name=r['name'])
            doc = s.model_dump()
            doc['created_at'] = doc['created_at'].isoformat()
            new_docs.append(doc)
            success += 1
        except Exception as e:
            errors.append(f"Baris {r['_row']}: {e}")
    if new_docs:
        await db.subjects.insert_many(new_docs)
    await log_audit(user, 'import_excel', 'subject', None, details={'success': success, 'errors': len(errors)}, request=request)
    return {'success': success, 'errors': errors, 'total_rows': len(rows)}
