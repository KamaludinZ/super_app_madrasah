"""
Semesters Router - CRUD untuk Semester (terpisah dari Academic Year)
"""
from datetime import datetime
from typing import Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_current_user, require_role, serialize_doc, log_audit
from models import SemesterModel

router = APIRouter()


@router.get("/semesters")
async def list_semesters(
    academic_year_id: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """
    List all semesters, optionally filtered by academic year.
    Sorted by academic year and semester code.
    """
    query = {}
    if academic_year_id:
        query['academic_year_id'] = academic_year_id

    semesters = await db.semesters.find(query, {'_id': 0}).sort([
        ('academic_year_id', 1),
        ('code', 1)
    ]).to_list(500)

    # Enrich with academic year name and curriculum
    enriched = []
    for sem in semesters:
        ay = await db.academic_years.find_one({'id': sem.get('academic_year_id')}, {'_id': 0, 'name': 1})
        if ay:
            sem['academic_year_name'] = ay.get('name')

        # Enrich curriculum
        if sem.get('curriculum_id'):
            cur = await db.curriculums.find_one({'id': sem.get('curriculum_id')}, {'_id': 0, 'name': 1, 'code': 1})
            if cur:
                sem['curriculum_name'] = cur.get('name')
                sem['curriculum_code'] = cur.get('code')

        enriched.append(serialize_doc(sem))

    return enriched


@router.get("/semesters/active")
async def get_active_semester(user: Dict = Depends(get_current_user)):
    """Get currently active semester."""
    sem = await db.semesters.find_one({'is_active': True}, {'_id': 0})
    if not sem:
        raise HTTPException(404, "Tidak ada semester aktif")

    # Enrich with academic year info
    ay = await db.academic_years.find_one({'id': sem.get('academic_year_id')}, {'_id': 0})
    if ay:
        sem['academic_year_name'] = ay.get('name')
        sem['academic_year'] = serialize_doc(ay)

    return serialize_doc(sem)


@router.get("/semesters/{sem_id}")
async def get_semester(sem_id: str, user: Dict = Depends(get_current_user)):
    """Get single semester by ID."""
    sem = await db.semesters.find_one({'id': sem_id}, {'_id': 0})
    if not sem:
        raise HTTPException(404, "Semester tidak ditemukan")

    # Enrich with academic year
    ay = await db.academic_years.find_one({'id': sem.get('academic_year_id')}, {'_id': 0})
    if ay:
        sem['academic_year_name'] = ay.get('name')

    return serialize_doc(sem)


@router.post("/semesters")
async def create_semester(
    payload: Dict,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """Create new semester."""
    # Validate academic year exists
    ay = await db.academic_years.find_one({'id': payload.get('academic_year_id')}, {'_id': 0})
    if not ay:
        raise HTTPException(400, "Tahun pelajaran tidak ditemukan")

    # Check if code already exists for this academic year
    existing = await db.semesters.find_one({
        'academic_year_id': payload.get('academic_year_id'),
        'code': payload.get('code')
    })
    if existing:
        raise HTTPException(400, f"Semester dengan kode '{payload.get('code')}' sudah ada untuk TP {ay.get('name')}")

    # Prevent manual activation - must use /activate endpoint
    if payload.get('is_active'):
        raise HTTPException(400, "Gunakan endpoint /semesters/{id}/activate untuk mengaktifkan semester")

    sem = SemesterModel(**payload)
    doc = sem.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.semesters.insert_one(doc)
    await log_audit(user, 'create', 'semester', sem.id, details={'name': sem.name}, request=request)

    return serialize_doc(doc)


@router.put("/semesters/{sem_id}")
async def update_semester(
    sem_id: str,
    payload: Dict,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """Update semester."""
    existing = await db.semesters.find_one({'id': sem_id}, {'_id': 0})
    if not existing:
        raise HTTPException(404, "Semester tidak ditemukan")

    # Prevent manual activation via update - must use /activate endpoint
    if 'is_active' in payload and payload['is_active'] != existing.get('is_active'):
        if payload['is_active']:
            raise HTTPException(400, "Gunakan endpoint /semesters/{id}/activate untuk mengaktifkan semester")

    # If updating code, check uniqueness
    if 'code' in payload and payload['code'] != existing.get('code'):
        ay_id = payload.get('academic_year_id', existing.get('academic_year_id'))
        conflict = await db.semesters.find_one({
            'academic_year_id': ay_id,
            'code': payload['code'],
            'id': {'$ne': sem_id}
        })
        if conflict:
            raise HTTPException(400, "Kode semester sudah digunakan untuk TP ini")

    # Remove fields that shouldn't be updated
    payload.pop('id', None)
    payload.pop('created_at', None)

    res = await db.semesters.update_one({'id': sem_id}, {'$set': payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Semester tidak ditemukan")

    await log_audit(user, 'update', 'semester', sem_id, details=payload, request=request)

    updated = await db.semesters.find_one({'id': sem_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/semesters/{sem_id}")
async def delete_semester(
    sem_id: str,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """Delete semester."""
    sem = await db.semesters.find_one({'id': sem_id}, {'_id': 0})
    if not sem:
        raise HTTPException(404, "Semester tidak ditemukan")

    # Check if active
    if sem.get('is_active'):
        raise HTTPException(400, "Tidak bisa hapus semester yang sedang aktif")

    # Check if used by any classes
    classes_count = await db.classes.count_documents({'semester_id': sem_id})
    if classes_count > 0:
        raise HTTPException(400, f"Tidak bisa hapus semester yang digunakan oleh {classes_count} kelas")

    await db.semesters.delete_one({'id': sem_id})
    await log_audit(user, 'delete', 'semester', sem_id, details={'name': sem.get('name')}, request=request)

    return {'message': 'Semester berhasil dihapus'}


@router.post("/semesters/{sem_id}/activate")
async def activate_semester(
    sem_id: str,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """
    Activate a semester. This will:
    1. Deactivate all other semesters
    2. Activate the selected semester
    3. Optionally activate its academic year if not active
    """
    sem = await db.semesters.find_one({'id': sem_id}, {'_id': 0})
    if not sem:
        raise HTTPException(404, "Semester tidak ditemukan")

    # Deactivate all semesters
    await db.semesters.update_many({}, {'$set': {'is_active': False}})

    # Activate this semester
    await db.semesters.update_one({'id': sem_id}, {'$set': {'is_active': True}})

    # Activate its academic year if not active
    ay = await db.academic_years.find_one({'id': sem.get('academic_year_id')}, {'_id': 0})
    if ay and not ay.get('is_active'):
        await db.academic_years.update_many({}, {'$set': {'is_active': False}})
        await db.academic_years.update_one(
            {'id': sem.get('academic_year_id')},
            {'$set': {'is_active': True}}
        )

    await log_audit(user, 'activate', 'semester', sem_id, details={'name': sem.get('name')}, request=request)

    updated = await db.semesters.find_one({'id': sem_id}, {'_id': 0})
    return serialize_doc(updated)

