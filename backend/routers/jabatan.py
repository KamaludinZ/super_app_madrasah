"""Jabatan (Staff Positions) CRUD endpoints."""
from datetime import datetime
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_current_user, log_audit, require_role, serialize_doc
from models import JabatanModel

router = APIRouter()


# ============================================================
# JABATAN (Staff Positions)
# ============================================================
@router.get("/jabatan")
async def list_jabatan(user: Dict = Depends(get_current_user)):
    """Get all jabatan positions."""
    items = await db.jabatan.find({}, {'_id': 0}).sort('name', 1).to_list(500)
    return [serialize_doc(i) for i in items]


@router.get("/jabatan/active")
async def list_active_jabatan(user: Dict = Depends(get_current_user)):
    """Get only active jabatan positions."""
    items = await db.jabatan.find({'is_active': True}, {'_id': 0}).sort('name', 1).to_list(500)
    return [serialize_doc(i) for i in items]


@router.get("/jabatan/{jid}")
async def get_jabatan(jid: str, user: Dict = Depends(get_current_user)):
    """Get a specific jabatan by ID."""
    doc = await db.jabatan.find_one({'id': jid}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Jabatan tidak ditemukan")
    return serialize_doc(doc)


@router.post("/jabatan")
async def create_jabatan(payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    """Create a new jabatan position."""
    jabatan = JabatanModel(**payload)
    doc = jabatan.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    if doc.get('updated_at'):
        doc['updated_at'] = doc['updated_at'].isoformat()

    await db.jabatan.insert_one(doc)
    await log_audit(user, 'create', 'jabatan', jabatan.id, details={'name': jabatan.name}, request=request)
    return serialize_doc(doc)


@router.put("/jabatan/{jid}")
async def update_jabatan(jid: str, payload: Dict, request: Request, user: Dict = Depends(require_role('admin'))):
    """Update an existing jabatan position."""
    payload['updated_at'] = datetime.utcnow().isoformat()

    res = await db.jabatan.update_one({'id': jid}, {'$set': payload})
    if res.matched_count == 0:
        raise HTTPException(404, "Jabatan tidak ditemukan")

    await log_audit(user, 'update', 'jabatan', jid, details=payload, request=request)
    doc = await db.jabatan.find_one({'id': jid}, {'_id': 0})
    return serialize_doc(doc)


@router.delete("/jabatan/{jid}")
async def delete_jabatan(jid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    """Delete a jabatan position."""
    # Check if any users have this jabatan
    users_with_jabatan = await db.users.count_documents({'jabatan_ids': jid})
    if users_with_jabatan > 0:
        raise HTTPException(400, f"Tidak dapat menghapus jabatan. Masih ada {users_with_jabatan} pengguna dengan jabatan ini.")

    res = await db.jabatan.delete_one({'id': jid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Jabatan tidak ditemukan")

    await log_audit(user, 'delete', 'jabatan', jid, request=request)
    return {'message': 'Jabatan berhasil dihapus'}


@router.post("/jabatan/{jid}/toggle-active")
async def toggle_jabatan_active(jid: str, request: Request, user: Dict = Depends(require_role('admin'))):
    """Toggle jabatan active status."""
    doc = await db.jabatan.find_one({'id': jid})
    if not doc:
        raise HTTPException(404, "Jabatan tidak ditemukan")

    new_status = not doc.get('is_active', True)
    await db.jabatan.update_one(
        {'id': jid},
        {'$set': {'is_active': new_status, 'updated_at': datetime.utcnow().isoformat()}}
    )

    await log_audit(user, 'update', 'jabatan', jid, details={'is_active': new_status}, request=request)
    return {'message': f"Status jabatan diubah menjadi {'aktif' if new_status else 'nonaktif'}", 'is_active': new_status}
