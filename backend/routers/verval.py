"""
Verval (Verifikasi & Validasi) Router
Mengelola request perubahan data siswa/guru/tendik yang perlu approval admin.
"""
from datetime import datetime
from typing import Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_current_user, require_role, serialize_doc, log_audit
from models import VervalRequestModel

router = APIRouter()


@router.get("/verval-requests")
async def list_verval_requests(
    user_type: Optional[str] = None,
    status: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    """
    List verval requests.
    - Admin: bisa filter by user_type (siswa/guru/tenaga_kependidikan) dan status
    - User biasa: hanya melihat request mereka sendiri
    """
    query = {}

    # Non-admin hanya bisa lihat request sendiri
    if 'admin' not in user.get('roles', []):
        query['user_id'] = user['id']
    else:
        # Admin bisa filter
        if user_type:
            query['user_type'] = user_type
        if status:
            query['status'] = status

    requests = await db.verval_requests.find(query, {'_id': 0}).sort('created_at', -1).to_list(500)
    return [serialize_doc(r) for r in requests]


@router.get("/verval-requests/{request_id}")
async def get_verval_request(request_id: str, user: Dict = Depends(get_current_user)):
    """Get single verval request detail."""
    req = await db.verval_requests.find_one({'id': request_id}, {'_id': 0})
    if not req:
        raise HTTPException(404, "Request tidak ditemukan")

    # Check permission: admin atau owner
    if 'admin' not in user.get('roles', []) and req['user_id'] != user['id']:
        raise HTTPException(403, "Tidak ada akses")

    return serialize_doc(req)


@router.post("/verval-requests")
async def create_verval_request(
    payload: Dict,
    request: Request,
    user: Dict = Depends(get_current_user)
):
    """
    Create verval request. Dipanggil saat user (siswa/guru/tendik)
    mengajukan perubahan data mereka.

    Payload:
    - user_id: ID user yang datanya mau diubah
    - user_type: 'siswa' | 'guru' | 'tenaga_kependidikan'
    - old_data: snapshot data lama
    - new_data: data perubahan yang diajukan
    """
    # Hanya bisa submit untuk diri sendiri (kecuali admin)
    if 'admin' not in user.get('roles', []) and payload.get('user_id') != user['id']:
        raise HTTPException(403, "Anda hanya bisa mengajukan perubahan data sendiri")

    # Cek apakah ada pending request untuk user ini
    existing = await db.verval_requests.find_one({
        'user_id': payload.get('user_id'),
        'status': 'pending'
    })
    if existing:
        raise HTTPException(400, "Masih ada request pending yang belum diproses. Tunggu admin mereview terlebih dahulu.")

    verval_req = VervalRequestModel(
        user_id=payload['user_id'],
        user_type=payload['user_type'],
        old_data=payload.get('old_data', {}),
        new_data=payload.get('new_data', {}),
        submitted_by=user['id'],
        submitted_by_name=user.get('full_name'),
        status='pending'
    )

    doc = verval_req.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.verval_requests.insert_one(doc)
    await log_audit(user, 'create', 'verval_request', verval_req.id,
                   details={'user_type': verval_req.user_type}, request=request)

    return serialize_doc(doc)


@router.post("/verval-requests/{request_id}/approve")
async def approve_verval_request(
    request_id: str,
    payload: Dict,
    req: Request,
    user: Dict = Depends(require_role('admin'))
):
    """
    Approve verval request dan apply perubahan ke user doc.

    Payload:
    - admin_notes: Optional catatan dari admin
    """
    verval_req = await db.verval_requests.find_one({'id': request_id}, {'_id': 0})
    if not verval_req:
        raise HTTPException(404, "Request tidak ditemukan")

    if verval_req['status'] != 'pending':
        raise HTTPException(400, f"Request sudah {verval_req['status']}")

    # Apply perubahan ke user doc
    new_data = verval_req['new_data']
    user_id = verval_req['user_id']

    # Update user dengan new_data
    await db.users.update_one(
        {'id': user_id},
        {'$set': new_data}
    )

    # Update verval request status
    await db.verval_requests.update_one(
        {'id': request_id},
        {'$set': {
            'status': 'approved',
            'reviewed_at': datetime.utcnow().isoformat(),
            'reviewed_by': user['id'],
            'reviewed_by_name': user.get('full_name'),
            'admin_notes': payload.get('admin_notes', '')
        }}
    )

    await log_audit(user, 'approve', 'verval_request', request_id,
                   details={'user_id': user_id}, request=req)

    updated = await db.verval_requests.find_one({'id': request_id}, {'_id': 0})
    return serialize_doc(updated)


@router.post("/verval-requests/{request_id}/reject")
async def reject_verval_request(
    request_id: str,
    payload: Dict,
    req: Request,
    user: Dict = Depends(require_role('admin'))
):
    """
    Reject verval request dengan catatan.

    Payload:
    - admin_notes: REQUIRED - alasan penolakan
    """
    if not payload.get('admin_notes'):
        raise HTTPException(400, "Catatan penolakan wajib diisi")

    verval_req = await db.verval_requests.find_one({'id': request_id}, {'_id': 0})
    if not verval_req:
        raise HTTPException(404, "Request tidak ditemukan")

    if verval_req['status'] != 'pending':
        raise HTTPException(400, f"Request sudah {verval_req['status']}")

    # Update verval request status
    await db.verval_requests.update_one(
        {'id': request_id},
        {'$set': {
            'status': 'rejected',
            'reviewed_at': datetime.utcnow().isoformat(),
            'reviewed_by': user['id'],
            'reviewed_by_name': user.get('full_name'),
            'admin_notes': payload['admin_notes']
        }}
    )

    await log_audit(user, 'reject', 'verval_request', request_id,
                   details={'user_id': verval_req['user_id']}, request=req)

    updated = await db.verval_requests.find_one({'id': request_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/verval-requests/{request_id}")
async def delete_verval_request(
    request_id: str,
    req: Request,
    user: Dict = Depends(require_role('admin'))
):
    """Delete verval request (admin only)."""
    verval_req = await db.verval_requests.find_one({'id': request_id}, {'_id': 0})
    if not verval_req:
        raise HTTPException(404, "Request tidak ditemukan")

    await db.verval_requests.delete_one({'id': request_id})
    await log_audit(user, 'delete', 'verval_request', request_id, request=req)

    return {'message': 'Request berhasil dihapus'}


@router.get("/verval-requests/stats/summary")
async def get_verval_stats(user: Dict = Depends(require_role('admin'))):
    """Get statistics summary untuk admin dashboard."""
    total = await db.verval_requests.count_documents({})
    pending = await db.verval_requests.count_documents({'status': 'pending'})
    approved = await db.verval_requests.count_documents({'status': 'approved'})
    rejected = await db.verval_requests.count_documents({'status': 'rejected'})

    # By user_type
    siswa_pending = await db.verval_requests.count_documents({'user_type': 'siswa', 'status': 'pending'})
    gtk_pending = await db.verval_requests.count_documents({
        'user_type': {'$in': ['guru', 'tenaga_kependidikan']},
        'status': 'pending'
    })

    return {
        'total': total,
        'pending': pending,
        'approved': approved,
        'rejected': rejected,
        'siswa_pending': siswa_pending,
        'gtk_pending': gtk_pending
    }
