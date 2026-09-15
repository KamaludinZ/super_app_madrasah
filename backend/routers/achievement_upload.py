"""
Router untuk upload file terkait Prestasi (sertifikat & foto pemegang piala/sertifikat).
File diupload lepas (belum terikat ke achievement_id) karena untuk siswa/guru/tendik,
prestasi baru dibuat lewat alur verval-request (draft) sebelum record achievement final ada.
"""
import os
import uuid
from typing import Dict

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from core import get_current_user

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'uploads', 'achievements')
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {'.pdf', '.jpg', '.jpeg', '.png', '.webp'}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB

JENIS_VALID = {'certificate', 'photo'}


def allowed_file(filename: str) -> bool:
    return os.path.splitext(filename.lower())[1] in ALLOWED_EXTENSIONS


@router.post("/achievements/upload/{jenis}")
async def upload_achievement_file(
    jenis: str,
    file: UploadFile = File(...),
    user: Dict = Depends(get_current_user),
):
    """
    Upload file lepas untuk prestasi (sertifikat atau foto pemegang piala/sertifikat).
    jenis: certificate | photo
    Return: {url} yang lalu disertakan pada payload create/update achievement.
    """
    if jenis not in JENIS_VALID:
        raise HTTPException(400, f"Jenis file tidak valid: {jenis}")

    if not file.filename or not allowed_file(file.filename):
        raise HTTPException(400, f"File harus berformat: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "Ukuran file maksimal 2MB")

    ext = os.path.splitext(file.filename)[1].lower()
    new_filename = f"{jenis}_{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, new_filename)

    try:
        with open(file_path, 'wb') as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(500, f"Gagal menyimpan file: {str(e)}")

    file_url = f"/api/achievements/upload/{jenis}/file/{new_filename}"
    return {'url': file_url, 'jenis': jenis}


@router.get("/achievements/upload/{jenis}/file/{filename}")
async def get_achievement_file(
    jenis: str,
    filename: str,
    user: Dict = Depends(get_current_user),
):
    """Serve file sertifikat/foto prestasi. Semua user login boleh melihat (dipakai lintas role)."""
    if jenis not in JENIS_VALID:
        raise HTTPException(400, "Jenis file tidak valid")

    safe_name = os.path.basename(filename)
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    if not os.path.exists(file_path):
        raise HTTPException(404, "File tidak ditemukan")

    return FileResponse(file_path)
