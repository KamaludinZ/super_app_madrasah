"""
Verval (Verifikasi & Validasi) Router
Mengelola request perubahan data siswa/guru/tendik yang perlu approval admin/wali kelas.
"""
from datetime import datetime
from typing import Dict, Optional, List

from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_current_user, require_role, serialize_doc, log_audit
from models import VervalRequestModel

router = APIRouter()


def _reviewer_role(user: Dict) -> Optional[str]:
    roles = user.get('roles', [])
    if 'admin' in roles:
        return 'admin'
    if 'wali_kelas' in roles:
        return 'wali_kelas'
    return None


async def _wali_kelas_student_ids(user: Dict) -> List[str]:
    cls_id = user.get('homeroom_class_id')
    if not cls_id:
        return []
    students = await db.users.find(
        {'roles': 'siswa', 'student_class_id': cls_id, 'is_active': {'$ne': False}},
        {'_id': 0, 'id': 1}
    ).to_list(2000)
    return [s['id'] for s in students if s.get('id')]


@router.get("/verval-requests")
async def list_verval_requests(
    user_type: Optional[str] = None,
    status: Optional[str] = None,
    request_type: Optional[str] = None,
    reviewer_view: bool = False,
    user: Dict = Depends(get_current_user)
):
    """
    List verval requests.
    - reviewer_view=true:
      - admin: semua request (dengan filter opsional)
      - wali_kelas: hanya request milik siswa di kelas binaannya
    - reviewer_view=false:
      - admin: semua request (dengan filter opsional)
      - user biasa: hanya request milik sendiri
    """
    query: Dict = {}

    role = _reviewer_role(user)
    if reviewer_view and role:
        if role == 'wali_kelas':
            student_ids = await _wali_kelas_student_ids(user)
            query['user_id'] = {'$in': student_ids}
            query['user_type'] = 'siswa'
    else:
        if 'admin' not in user.get('roles', []):
            query['user_id'] = user['id']

    if user_type:
        query['user_type'] = user_type
    if status:
        query['status'] = status
    if request_type:
        query['request_type'] = request_type

    requests = await db.verval_requests.find(query, {'_id': 0}).sort('created_at', -1).to_list(1000)
    return [serialize_doc(r) for r in requests]


@router.get("/verval-requests/{request_id}")
async def get_verval_request(request_id: str, user: Dict = Depends(get_current_user)):
    """Get single verval request detail."""
    req = await db.verval_requests.find_one({'id': request_id}, {'_id': 0})
    if not req:
        raise HTTPException(404, "Request tidak ditemukan")

    role = _reviewer_role(user)

    # owner
    if req['user_id'] == user['id']:
        return serialize_doc(req)

    # admin reviewer
    if role == 'admin':
        return serialize_doc(req)

    # wali kelas reviewer hanya untuk siswa binaannya
    if role == 'wali_kelas':
        if req.get('user_type') != 'siswa':
            raise HTTPException(403, "Wali kelas hanya dapat mereview request siswa")
        student_ids = await _wali_kelas_student_ids(user)
        if req['user_id'] in student_ids:
            return serialize_doc(req)

    raise HTTPException(403, "Tidak ada akses")


@router.post("/verval-requests")
async def create_verval_request(
    payload: Dict,
    request: Request,
    user: Dict = Depends(get_current_user)
):
    """
    Create verval request.
    Request type:
    - profile_update: perubahan data profil user
    - prestasi_create: pengajuan penambahan prestasi (old_data wajib kosong)
    """
    user_id = payload.get('user_id')
    request_type = payload.get('request_type', 'profile_update')

    if request_type not in ('profile_update', 'prestasi_create'):
        raise HTTPException(400, "request_type tidak valid")

    # Hanya bisa submit untuk diri sendiri (kecuali admin)
    if 'admin' not in user.get('roles', []) and user_id != user['id']:
        raise HTTPException(403, "Anda hanya bisa mengajukan perubahan data sendiri")

    # Cek pending request per user + request_type
    existing = await db.verval_requests.find_one({
        'user_id': user_id,
        'request_type': request_type,
        'status': 'pending'
    })
    if existing:
        raise HTTPException(400, "Masih ada request pending yang belum diproses untuk jenis pengajuan ini.")

    target_collection = 'users' if request_type == 'profile_update' else 'achievements'
    old_data = payload.get('old_data', {})
    new_data = payload.get('new_data', {})

    if request_type == 'prestasi_create':
        old_data = {}  # wajib kosong untuk create prestasi

    verval_req = VervalRequestModel(
        user_id=user_id,
        user_type=payload['user_type'],
        request_type=request_type,
        target_collection=target_collection,
        target_id=payload.get('target_id'),
        old_data=old_data,
        new_data=new_data,
        submitted_by=user['id'],
        submitted_by_name=user.get('full_name'),
        status='pending'
    )

    doc = verval_req.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()

    await db.verval_requests.insert_one(doc)
    await log_audit(
        user,
        'create',
        'verval_request',
        verval_req.id,
        details={'user_type': verval_req.user_type, 'request_type': request_type},
        request=request
    )

    return serialize_doc(doc)


@router.post("/verval-requests/{request_id}/approve")
async def approve_verval_request(
    request_id: str,
    payload: Dict,
    req: Request,
    user: Dict = Depends(require_role('admin', 'wali_kelas'))
):
    """
    Approve verval request dan apply perubahan berdasarkan request_type.
    """
    verval_req = await db.verval_requests.find_one({'id': request_id}, {'_id': 0})
    if not verval_req:
        raise HTTPException(404, "Request tidak ditemukan")

    if verval_req['status'] != 'pending':
        raise HTTPException(400, f"Request sudah {verval_req['status']}")

    role = _reviewer_role(user)
    if role == 'wali_kelas':
        if verval_req.get('user_type') != 'siswa':
            raise HTTPException(403, "Wali kelas hanya dapat approve request siswa")
        student_ids = await _wali_kelas_student_ids(user)
        if verval_req['user_id'] not in student_ids:
            raise HTTPException(403, "Anda hanya bisa mereview siswa di kelas binaan Anda")

    request_type = verval_req.get('request_type', 'profile_update')

    if request_type == 'profile_update':
        # Apply perubahan ke user doc
        await db.users.update_one(
            {'id': verval_req['user_id']},
            {'$set': verval_req.get('new_data', {})}
        )
    elif request_type == 'prestasi_create':
        # Insert achievement baru dari payload new_data
        ach = dict(verval_req.get('new_data', {}))
        if not ach.get('id'):
            import uuid
            ach['id'] = str(uuid.uuid4())
        ach['submitted_by'] = verval_req.get('submitted_by')
        ach['submitted_at'] = datetime.utcnow().isoformat()
        ach['is_verified'] = True
        ach['verified_by'] = user['id']
        ach['verified_at'] = datetime.utcnow().isoformat()
        # fallback student ownership
        if not ach.get('student_id'):
            ach['student_id'] = verval_req.get('user_id')
        await db.achievements.insert_one(ach)
    else:
        raise HTTPException(400, "request_type tidak didukung")

    reviewed_by_role = role or 'admin'

    # Update verval request status
    await db.verval_requests.update_one(
        {'id': request_id},
        {'$set': {
            'status': 'approved',
            'reviewed_at': datetime.utcnow().isoformat(),
            'reviewed_by': user['id'],
            'reviewed_by_name': user.get('full_name'),
            'reviewed_by_role': reviewed_by_role,
            'admin_notes': payload.get('admin_notes', '')
        }}
    )

    await log_audit(
        user,
        'approve',
        'verval_request',
        request_id,
        details={'user_id': verval_req['user_id'], 'request_type': request_type},
        request=req
    )

    updated = await db.verval_requests.find_one({'id': request_id}, {'_id': 0})
    return serialize_doc(updated)


@router.post("/verval-requests/{request_id}/reject")
async def reject_verval_request(
    request_id: str,
    payload: Dict,
    req: Request,
    user: Dict = Depends(require_role('admin', 'wali_kelas'))
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

    role = _reviewer_role(user)
    if role == 'wali_kelas':
        if verval_req.get('user_type') != 'siswa':
            raise HTTPException(403, "Wali kelas hanya dapat reject request siswa")
        student_ids = await _wali_kelas_student_ids(user)
        if verval_req['user_id'] not in student_ids:
            raise HTTPException(403, "Anda hanya bisa mereview siswa di kelas binaan Anda")

    reviewed_by_role = role or 'admin'

    await db.verval_requests.update_one(
        {'id': request_id},
        {'$set': {
            'status': 'rejected',
            'reviewed_at': datetime.utcnow().isoformat(),
            'reviewed_by': user['id'],
            'reviewed_by_name': user.get('full_name'),
            'reviewed_by_role': reviewed_by_role,
            'admin_notes': payload['admin_notes']
        }}
    )

    await log_audit(
        user,
        'reject',
        'verval_request',
        request_id,
        details={'user_id': verval_req['user_id'], 'request_type': verval_req.get('request_type')},
        request=req
    )

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
async def get_verval_stats(user: Dict = Depends(require_role('admin', 'wali_kelas'))):
    """Get statistics summary untuk dashboard reviewer."""
    role = _reviewer_role(user)

    base_query: Dict = {}
    if role == 'wali_kelas':
        student_ids = await _wali_kelas_student_ids(user)
        base_query['user_id'] = {'$in': student_ids}
        base_query['user_type'] = 'siswa'

    total = await db.verval_requests.count_documents(base_query)
    pending = await db.verval_requests.count_documents({**base_query, 'status': 'pending'})
    approved = await db.verval_requests.count_documents({**base_query, 'status': 'approved'})
    rejected = await db.verval_requests.count_documents({**base_query, 'status': 'rejected'})

    siswa_pending = await db.verval_requests.count_documents({**base_query, 'user_type': 'siswa', 'status': 'pending'})
    gtk_pending = await db.verval_requests.count_documents({
        **base_query,
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
