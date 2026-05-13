"""Academic years & Curriculums."""
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request

from core import (
    db,
    get_active_academic_year,
    get_current_user,
    log_audit,
    require_role,
    serialize_doc,
)
from models import AcademicYearModel, CurriculumModel

router = APIRouter()


# ============================================================
# ACADEMIC YEARS
# ============================================================
@router.get("/academic-years")
async def list_academic_years(user: Dict = Depends(get_current_user)):
    items = await db.academic_years.find({}, {'_id': 0}).sort('name', -1).to_list(100)
    return [serialize_doc(i) for i in items]


@router.get("/academic-years/active")
async def active_academic_year():
    ay = await get_active_academic_year()
    return ay or {}


@router.post("/academic-years")
async def create_academic_year(payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    ay = AcademicYearModel(**payload)
    doc = ay.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if ay.is_active:
        await db.academic_years.update_many({}, {'$set': {'is_active': False}})
    await db.academic_years.insert_one(doc)
    await log_audit(user, 'create', 'academic_year', ay.id, details={'name': ay.name}, request=request)
    return serialize_doc(doc)


@router.put("/academic-years/{ay_id}")
async def update_academic_year(ay_id: str, payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    """Edit TP - name, semester_type, semesters list, active_semester"""
    payload.pop('_id', None)
    payload.pop('id', None)
    if payload.get('is_active') is True:
        await db.academic_years.update_many({'id': {'$ne': ay_id}}, {'$set': {'is_active': False}})
    res = await db.academic_years.update_one({'id': ay_id}, {'$set': payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Tahun pelajaran tidak ditemukan")
    await log_audit(user, 'update', 'academic_year', ay_id, details={'keys': list(payload.keys())}, request=request)
    doc = await db.academic_years.find_one({'id': ay_id}, {'_id': 0})
    return serialize_doc(doc)


@router.put("/academic-years/{ay_id}/activate")
async def activate_academic_year(ay_id: str, request: Request, user: Dict = Depends(require_role('admin'))):
    await db.academic_years.update_many({}, {'$set': {'is_active': False}})
    res = await db.academic_years.update_one({'id': ay_id}, {'$set': {'is_active': True}})
    if res.matched_count == 0:
        raise HTTPException(404, "Tahun pelajaran tidak ditemukan")
    await log_audit(user, 'activate', 'academic_year', ay_id, request=request)
    return {'message': 'Aktif', 'id': ay_id}


@router.delete("/academic-years/{ay_id}")
async def delete_academic_year(ay_id: str, request: Request, user: Dict = Depends(require_role('admin'))):
    res = await db.academic_years.delete_one({'id': ay_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Tidak ditemukan")
    await log_audit(user, 'delete', 'academic_year', ay_id, request=request)
    return {'message': 'Dihapus'}


# ============================================================
# CURRICULUM
# ============================================================
@router.get("/curriculums")
async def list_curriculums(user: Dict = Depends(get_current_user)):
    items = await db.curriculums.find({}, {'_id': 0}).sort('name', 1).to_list(50)
    return [serialize_doc(i) for i in items]


@router.post("/curriculums")
async def create_curriculum(payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    if not payload.get('name') or not payload.get('code'):
        raise HTTPException(400, "Nama dan kode kurikulum wajib")
    existing = await db.curriculums.find_one({'code': payload['code']})
    if existing:
        raise HTTPException(400, f"Kode kurikulum {payload['code']} sudah ada")
    c = CurriculumModel(**payload)
    doc = c.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.curriculums.insert_one(doc)
    await log_audit(user, 'create', 'curriculum', c.id, details={'name': c.name}, request=request)
    return serialize_doc(doc)


@router.put("/curriculums/{cid}")
async def update_curriculum(cid: str, payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    payload.pop('id', None); payload.pop('_id', None)
    res = await db.curriculums.update_one({'id': cid}, {'$set': payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Tidak ditemukan")
    await log_audit(user, 'update', 'curriculum', cid, request=request)
    doc = await db.curriculums.find_one({'id': cid}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/curriculums/{cid}")
async def delete_curriculum(cid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    used_ay = await db.academic_years.count_documents({'curriculum_id': cid})
    used_sub = await db.subjects.count_documents({'curriculum_ids': cid})
    if used_ay > 0 or used_sub > 0:
        raise HTTPException(400, f"Kurikulum sedang dipakai di {used_ay} TP dan {used_sub} mapel. Lepas dulu sebelum hapus.")
    await db.curriculums.delete_one({'id': cid})
    await log_audit(user, 'delete', 'curriculum', cid, request=request)
    return {'message': 'Dihapus'}
