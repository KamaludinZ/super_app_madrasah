"""
Router untuk upload file terkait Detail Data Siswa (Keahlian & Tahfidz).
File diupload lepas (belum terikat ke student_id) karena untuk siswa, perubahan detail
biasanya diajukan lewat alur verval-request (draft) sebelum tersimpan final ke student_details.
"""
import os
import uuid
from typing import Dict

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from core import get_current_user

router = APIRouter()

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'uploads', 'student_detail')
os.makedirs(UPLOAD_DIR, exist_ok=True)

PDF_ONLY_EXTENSIONS = {'.pdf'}
MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB

# Semua jenis upload di tab Detail Siswa kini PDF-only untuk konsistensi.
JENIS_VALID = {'keahlian', 'tahfidz_syahadah', 'tahfidz_tahsin'}
BERKAS_JENIS_VALID = {
    'berkas_kartu_keluarga', 'berkas_akta_kelahiran', 'berkas_ijazah_sd',
    'berkas_kip', 'berkas_pkh', 'berkas_kks', 'berkas_kartu_pelajar',
}


def allowed_file(filename: str, extensions=PDF_ONLY_EXTENSIONS) -> bool:
    return os.path.splitext(filename.lower())[1] in extensions


@router.post("/students/detail/upload/{jenis}")
async def upload_student_detail_file(
    jenis: str,
    file: UploadFile = File(...),
    user: Dict = Depends(get_current_user),
):
    """
    Upload file lepas untuk detail siswa (bukti sertifikat keahlian, syahadah/tahsin tahfidz,
    atau berkas dokumen di tab Upload Berkas). Semua jenis PDF-only, maks 2MB.
    jenis: keahlian | tahfidz_syahadah | tahfidz_tahsin | berkas_kartu_keluarga | berkas_akta_kelahiran |
           berkas_ijazah_sd | berkas_kip | berkas_pkh | berkas_kks | berkas_kartu_pelajar
    Return: {url} yang lalu disertakan pada payload update/verval-request detail siswa.
    """
    if jenis not in JENIS_VALID and jenis not in BERKAS_JENIS_VALID:
        raise HTTPException(400, f"Jenis file tidak valid: {jenis}")

    if not file.filename or not allowed_file(file.filename):
        raise HTTPException(400, f"File harus berformat: {', '.join(sorted(PDF_ONLY_EXTENSIONS))}")

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

    file_url = f"/api/students/detail/upload/{jenis}/file/{new_filename}"
    return {'url': file_url, 'jenis': jenis}


@router.get("/students/detail/upload/{jenis}/file/{filename}")
async def get_student_detail_file(
    jenis: str,
    filename: str,
    user: Dict = Depends(get_current_user),
):
    """Serve file bukti keahlian/tahfidz/berkas. Semua user login boleh melihat (dipakai lintas role)."""
    if jenis not in JENIS_VALID and jenis not in BERKAS_JENIS_VALID:
        raise HTTPException(400, "Jenis file tidak valid")

    safe_name = os.path.basename(filename)
    file_path = os.path.join(UPLOAD_DIR, safe_name)
    if not os.path.exists(file_path):
        raise HTTPException(404, "File tidak ditemukan")

    return FileResponse(file_path)
