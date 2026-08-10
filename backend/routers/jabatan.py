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


@router.get("/jabatan/diagnostic/check-role-names")
async def diagnostic_check_role_names(user: Dict = Depends(require_role('admin'))):
    """Diagnostic endpoint to check if jabatan master data contains role names."""

    # Role names that should NOT appear in jabatan master data
    ROLE_NAMES = [
        'Administrator',
        'Guru Mata Pelajaran',
        'Wali Kelas',
        'Guru BK',
        'Tenaga Kependidikan',
        'Kepala Sekolah',
        'Wakil Kepala Sekolah',
        'Siswa'
    ]

    # Get all jabatan entries
    jabatan_list = await db.jabatan.find({}, {'_id': 0}).to_list(1000)

    # Categorize jabatan
    role_based_jabatan = []
    proper_jabatan = []

    for jab in jabatan_list:
        name = jab.get('name', '')

        # For each jabatan, get count of users assigned
        user_count = await db.users.count_documents({'jabatan_ids': jab.get('id')})
        jab['user_count'] = user_count

        # Get sample users (max 3)
        if user_count > 0:
            sample_users = await db.users.find(
                {'jabatan_ids': jab.get('id')},
                {'_id': 0, 'full_name': 1, 'nip': 1}
            ).limit(3).to_list(3)
            jab['sample_users'] = sample_users
        else:
            jab['sample_users'] = []

        if name in ROLE_NAMES:
            role_based_jabatan.append(jab)
        else:
            proper_jabatan.append(jab)

    # Get users without jabatan
    users_no_jabatan_count = await db.users.count_documents({
        '$or': [
            {'jabatan_ids': {'$exists': False}},
            {'jabatan_ids': []},
            {'jabatan_ids': None}
        ],
        'roles': {'$nin': ['siswa', 'admin']}
    })

    sample_users_no_jabatan = []
    if users_no_jabatan_count > 0:
        sample_users_no_jabatan = await db.users.find(
            {
                '$or': [
                    {'jabatan_ids': {'$exists': False}},
                    {'jabatan_ids': []},
                    {'jabatan_ids': None}
                ],
                'roles': {'$nin': ['siswa', 'admin']}
            },
            {'_id': 0, 'full_name': 1, 'nip': 1, 'roles': 1}
        ).limit(5).to_list(5)

    return {
        'total_jabatan': len(jabatan_list),
        'role_based_jabatan': {
            'count': len(role_based_jabatan),
            'items': role_based_jabatan
        },
        'proper_jabatan': {
            'count': len(proper_jabatan),
            'items': proper_jabatan
        },
        'users_without_jabatan': {
            'count': users_no_jabatan_count,
            'sample': sample_users_no_jabatan
        },
        'has_issues': len(role_based_jabatan) > 0 or users_no_jabatan_count > 0,
        'recommendations': [
            'Hapus jabatan dengan nama role (seperti "Guru Mata Pelajaran")',
            'Buat jabatan baru dengan nama posisi yang sesuai (seperti "Wakil Kepala Kurikulum")',
            'Edit pengguna dan pilihkan jabatan yang tepat'
        ] if len(role_based_jabatan) > 0 else ['Data jabatan sudah baik!']
    }


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
