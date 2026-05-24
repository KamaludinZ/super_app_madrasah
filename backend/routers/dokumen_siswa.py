"""
Router untuk upload dan management dokumen siswa (EMIS).
Dokumen: Pas Foto, Akte, Ijazah SD/MI, KK, KIP, PKH, KKS, Ijazah MTs
"""
import os
import uuid
from datetime import datetime
from typing import Dict

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from core import db, get_current_user, log_audit, serialize_doc, require_role

router = APIRouter()

# Direktori untuk menyimpan dokumen siswa
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'uploads', 'dokumen_siswa')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mapping field dokumen ke field di UserModel
DOKUMEN_FIELDS = {
    'pas_foto': 'dokumen_pas_foto',
    'akte_kelahiran': 'dokumen_akte_kelahiran',
    'ijazah_sd': 'dokumen_ijazah_sd',
    'kartu_keluarga': 'dokumen_kartu_keluarga',
    'kip': 'dokumen_kip',
    'pkh': 'dokumen_pkh',
    'kks': 'dokumen_kks',
    'ijazah_mts': 'dokumen_ijazah_mts',
}

# Allowed file extensions
ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png'}


def allowed_file(filename: str) -> bool:
    """Check if file extension is allowed."""
    return os.path.splitext(filename.lower())[1] in ALLOWED_EXTENSIONS


@router.post("/students/{student_id}/dokumen/{jenis_dokumen}")
async def upload_dokumen(
    student_id: str,
    jenis_dokumen: str,
    file: UploadFile = File(...),
    user: Dict = Depends(get_current_user)
):
    """
    Upload dokumen siswa.
    jenis_dokumen: pas_foto | akte_kelahiran | ijazah_sd | kartu_keluarga | kip | pkh | kks | ijazah_mts
    """
    # Validasi jenis dokumen
    if jenis_dokumen not in DOKUMEN_FIELDS:
        raise HTTPException(400, f"Jenis dokumen tidak valid: {jenis_dokumen}")

    # Cek akses: admin atau siswa yang bersangkutan
    if 'admin' not in user.get('roles', []) and user['id'] != student_id:
        raise HTTPException(403, "Tidak diizinkan mengupload dokumen siswa lain")

    # Cek siswa exists
    siswa = await db.users.find_one({'id': student_id, 'roles': 'siswa'})
    if not siswa:
        raise HTTPException(404, "Siswa tidak ditemukan")

    # Validasi file extension
    if not file.filename or not allowed_file(file.filename):
        raise HTTPException(400, f"File harus berformat: {', '.join(ALLOWED_EXTENSIONS)}")

    # Generate unique filename
    ext = os.path.splitext(file.filename)[1].lower()
    new_filename = f"{student_id}_{jenis_dokumen}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, new_filename)

    # Save file
    try:
        content = await file.read()
        with open(file_path, 'wb') as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(500, f"Gagal menyimpan file: {str(e)}")

    # Hapus file lama jika ada
    field_name = DOKUMEN_FIELDS[jenis_dokumen]
    old_file_url = siswa.get(field_name)
    if old_file_url:
        old_filename = old_file_url.split('/')[-1]
        old_file_path = os.path.join(UPLOAD_DIR, old_filename)
        if os.path.exists(old_file_path):
            try:
                os.remove(old_file_path)
            except:
                pass  # Ignore error if file doesn't exist

    # Update URL di database
    file_url = f"/api/students/{student_id}/dokumen/{jenis_dokumen}/file/{new_filename}"
    await db.users.update_one(
        {'id': student_id},
        {'$set': {field_name: file_url}}
    )

    await log_audit(user['id'], 'upload_dokumen', {
        'student_id': student_id,
        'jenis_dokumen': jenis_dokumen,
        'filename': new_filename
    })

    return {
        'message': 'Dokumen berhasil diupload',
        'jenis_dokumen': jenis_dokumen,
        'url': file_url
    }


@router.get("/students/{student_id}/dokumen/{jenis_dokumen}/file/{filename}")
async def get_dokumen_file(
    student_id: str,
    jenis_dokumen: str,
    filename: str,
    user: Dict = Depends(get_current_user)
):
    """Download/view dokumen siswa."""
    # Validasi jenis dokumen
    if jenis_dokumen not in DOKUMEN_FIELDS:
        raise HTTPException(400, "Jenis dokumen tidak valid")

    # Cek akses: admin, guru, atau siswa yang bersangkutan
    if 'admin' not in user.get('roles', []) and \
       'guru' not in user.get('roles', []) and \
       'wali_kelas' not in user.get('roles', []) and \
       user['id'] != student_id:
        raise HTTPException(403, "Tidak diizinkan melihat dokumen siswa lain")

    # Cek file exists
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(404, "File tidak ditemukan")

    # Return file
    return FileResponse(file_path)


@router.delete("/students/{student_id}/dokumen/{jenis_dokumen}")
async def delete_dokumen(
    student_id: str,
    jenis_dokumen: str,
    user: Dict = Depends(get_current_user)
):
    """Hapus dokumen siswa."""
    # Validasi jenis dokumen
    if jenis_dokumen not in DOKUMEN_FIELDS:
        raise HTTPException(400, "Jenis dokumen tidak valid")

    # Cek akses: admin atau siswa yang bersangkutan
    if 'admin' not in user.get('roles', []) and user['id'] != student_id:
        raise HTTPException(403, "Tidak diizinkan menghapus dokumen siswa lain")

    # Cek siswa exists
    siswa = await db.users.find_one({'id': student_id, 'roles': 'siswa'})
    if not siswa:
        raise HTTPException(404, "Siswa tidak ditemukan")

    # Get file URL
    field_name = DOKUMEN_FIELDS[jenis_dokumen]
    file_url = siswa.get(field_name)

    if not file_url:
        raise HTTPException(404, "Dokumen tidak ditemukan")

    # Delete file from disk
    filename = file_url.split('/')[-1]
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            # Log error but continue to update DB
            print(f"Error deleting file {file_path}: {e}")

    # Remove URL from database
    await db.users.update_one(
        {'id': student_id},
        {'$unset': {field_name: ""}}
    )

    await log_audit(user['id'], 'delete_dokumen', {
        'student_id': student_id,
        'jenis_dokumen': jenis_dokumen
    })

    return {'message': 'Dokumen berhasil dihapus'}


@router.get("/students/{student_id}/dokumen")
async def get_all_dokumen(
    student_id: str,
    user: Dict = Depends(get_current_user)
):
    """Get list semua dokumen siswa."""
    # Cek akses
    if 'admin' not in user.get('roles', []) and \
       'guru' not in user.get('roles', []) and \
       'wali_kelas' not in user.get('roles', []) and \
       user['id'] != student_id:
        raise HTTPException(403, "Tidak diizinkan melihat dokumen siswa lain")

    # Get siswa
    siswa = await db.users.find_one({'id': student_id, 'roles': 'siswa'})
    if not siswa:
        raise HTTPException(404, "Siswa tidak ditemukan")

    # Compile dokumen list
    dokumen = {}
    for jenis, field in DOKUMEN_FIELDS.items():
        url = siswa.get(field)
        dokumen[jenis] = {
            'url': url,
            'uploaded': bool(url)
        }

    return {
        'student_id': student_id,
        'student_name': siswa.get('full_name'),
        'dokumen': dokumen
    }
