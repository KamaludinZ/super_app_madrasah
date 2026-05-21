"""
Router untuk manajemen Tahun Takwim (Calendar Year).
Tahun Takwim mengatur kalender umum aplikasi (Januari - Desember).
"""
from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_current_user, log_audit, require_role, serialize_doc
from models import TahunTakwimModel

router = APIRouter()


# ============================================================================
# GET ALL TAHUN TAKWIM
# ============================================================================
@router.get("/tahun-takwim")
async def get_all_tahun_takwim(user: Dict = Depends(get_current_user)):
    """
    Get all Tahun Takwim (for all users).
    Sorted by year descending (terbaru di atas).
    """
    items = await db.tahun_takwim.find({}, {'_id': 0}).sort('year', -1).to_list(None)
    return [serialize_doc(item) for item in items]


# ============================================================================
# GET ACTIVE TAHUN TAKWIM
# ============================================================================
@router.get("/tahun-takwim/active")
async def get_active_tahun_takwim(user: Dict = Depends(get_current_user)):
    """
    Get currently active Tahun Takwim.
    Returns None if no active tahun takwim.
    """
    item = await db.tahun_takwim.find_one({'is_active': True}, {'_id': 0})
    return serialize_doc(item) if item else None


# ============================================================================
# GET TAHUN TAKWIM BY ID
# ============================================================================
@router.get("/tahun-takwim/{tahun_takwim_id}")
async def get_tahun_takwim_by_id(tahun_takwim_id: str, user: Dict = Depends(get_current_user)):
    """Get a specific Tahun Takwim by ID."""
    item = await db.tahun_takwim.find_one({'id': tahun_takwim_id}, {'_id': 0})
    if not item:
        raise HTTPException(status_code=404, detail="Tahun Takwim tidak ditemukan")
    return serialize_doc(item)


# ============================================================================
# CREATE TAHUN TAKWIM
# ============================================================================
@router.post("/tahun-takwim")
async def create_tahun_takwim(
    payload: TahunTakwimModel,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """
    Create a new Tahun Takwim.
    Admin only.

    Validasi:
    - Year harus unique
    - start_date dan end_date harus dalam tahun yang sama
    - start_date harus sebelum end_date
    """
    # Validasi: Tahun sudah ada atau belum
    existing = await db.tahun_takwim.find_one({'year': payload.year})
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Tahun Takwim {payload.year} sudah ada"
        )

    # Validasi: start_date dan end_date harus dalam tahun yang sama
    start_year = int(payload.start_date[:4])
    end_year = int(payload.end_date[:4])

    if start_year != payload.year or end_year != payload.year:
        raise HTTPException(
            status_code=400,
            detail=f"start_date dan end_date harus dalam tahun {payload.year}"
        )

    # Validasi: start_date harus sebelum end_date
    if payload.start_date >= payload.end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date harus sebelum end_date"
        )

    # Jika is_active = True, set yang lain jadi False
    if payload.is_active:
        await db.tahun_takwim.update_many(
            {'is_active': True},
            {'$set': {'is_active': False, 'updated_at': datetime.utcnow().isoformat()}}
        )

    # Insert
    doc = payload.model_dump()
    doc['created_at'] = datetime.utcnow().isoformat()
    doc['updated_at'] = datetime.utcnow().isoformat()

    await db.tahun_takwim.insert_one(doc)
    await log_audit(user, 'create', 'tahun_takwim', payload.id, request=request)

    return serialize_doc(doc)


# ============================================================================
# UPDATE TAHUN TAKWIM
# ============================================================================
@router.put("/tahun-takwim/{tahun_takwim_id}")
async def update_tahun_takwim(
    tahun_takwim_id: str,
    payload: Dict,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """
    Update Tahun Takwim.
    Admin only.

    Validasi sama seperti create.
    """
    # Check exists
    existing = await db.tahun_takwim.find_one({'id': tahun_takwim_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Tahun Takwim tidak ditemukan")

    # Validasi: Jika year diubah, pastikan tidak duplicate
    if 'year' in payload and payload['year'] != existing['year']:
        duplicate = await db.tahun_takwim.find_one({'year': payload['year']})
        if duplicate:
            raise HTTPException(
                status_code=400,
                detail=f"Tahun Takwim {payload['year']} sudah ada"
            )

    # Validasi: start_date dan end_date harus konsisten dengan year
    year = payload.get('year', existing['year'])
    start_date = payload.get('start_date', existing['start_date'])
    end_date = payload.get('end_date', existing['end_date'])

    start_year = int(start_date[:4])
    end_year = int(end_date[:4])

    if start_year != year or end_year != year:
        raise HTTPException(
            status_code=400,
            detail=f"start_date dan end_date harus dalam tahun {year}"
        )

    # Validasi: start_date harus sebelum end_date
    if start_date >= end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date harus sebelum end_date"
        )

    # Jika is_active diubah jadi True, set yang lain jadi False
    if payload.get('is_active'):
        await db.tahun_takwim.update_many(
            {'id': {'$ne': tahun_takwim_id}, 'is_active': True},
            {'$set': {'is_active': False, 'updated_at': datetime.utcnow().isoformat()}}
        )

    # Update
    payload['updated_at'] = datetime.utcnow().isoformat()
    await db.tahun_takwim.update_one({'id': tahun_takwim_id}, {'$set': payload})
    await log_audit(user, 'update', 'tahun_takwim', tahun_takwim_id, request=request)

    # Return updated document
    updated = await db.tahun_takwim.find_one({'id': tahun_takwim_id}, {'_id': 0})
    return serialize_doc(updated)


# ============================================================================
# DELETE TAHUN TAKWIM
# ============================================================================
@router.delete("/tahun-takwim/{tahun_takwim_id}")
async def delete_tahun_takwim(
    tahun_takwim_id: str,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """
    Delete Tahun Takwim.
    Admin only.

    Validasi:
    - Tidak bisa delete jika masih ada Academic Year yang terkait
    - Tidak bisa delete Tahun Takwim yang sedang aktif
    """
    # Check exists
    existing = await db.tahun_takwim.find_one({'id': tahun_takwim_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Tahun Takwim tidak ditemukan")

    # Validasi: Tidak bisa delete yang aktif
    if existing.get('is_active'):
        raise HTTPException(
            status_code=400,
            detail="Tidak bisa menghapus Tahun Takwim yang sedang aktif"
        )

    # Validasi: Check apakah ada Academic Year yang masih menggunakan
    ay_count = await db.academic_years.count_documents({
        'tahun_takwim_ids': {'$in': [tahun_takwim_id]}
    })

    if ay_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Tidak bisa menghapus. Masih ada {ay_count} Tahun Pelajaran yang menggunakan Tahun Takwim ini"
        )

    # Delete
    await db.tahun_takwim.delete_one({'id': tahun_takwim_id})
    await log_audit(user, 'delete', 'tahun_takwim', tahun_takwim_id, request=request)

    return {'message': 'Tahun Takwim berhasil dihapus', 'id': tahun_takwim_id}


# ============================================================================
# SET ACTIVE TAHUN TAKWIM
# ============================================================================
@router.post("/tahun-takwim/{tahun_takwim_id}/set-active")
async def set_active_tahun_takwim(
    tahun_takwim_id: str,
    request: Request,
    user: Dict = Depends(require_role('admin'))
):
    """
    Set a Tahun Takwim as active (and deactivate others).
    Admin only.
    """
    # Check exists
    existing = await db.tahun_takwim.find_one({'id': tahun_takwim_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Tahun Takwim tidak ditemukan")

    # Deactivate all others
    await db.tahun_takwim.update_many(
        {'is_active': True},
        {'$set': {'is_active': False, 'updated_at': datetime.utcnow().isoformat()}}
    )

    # Activate this one
    await db.tahun_takwim.update_one(
        {'id': tahun_takwim_id},
        {'$set': {'is_active': True, 'updated_at': datetime.utcnow().isoformat()}}
    )

    await log_audit(user, 'set_active', 'tahun_takwim', tahun_takwim_id, request=request)

    # Return updated document
    updated = await db.tahun_takwim.find_one({'id': tahun_takwim_id}, {'_id': 0})
    return serialize_doc(updated)
