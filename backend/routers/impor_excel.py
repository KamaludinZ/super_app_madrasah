"""Jalur cadangan impor Excel admin (/admin/import): berkas dikirim sebagai JSON base64, bukan multipart.

Unggahan multipart dari Chrome Android kadang batal di browser tanpa pernah terkirim (berkas dari WhatsApp/Drive/folder
yang disinkron berubah atau izinnya habis saat dibaca -> "Network Error"). Frontend sudah membaca berkas ke memori
terlebih dahulu; bila multipart tetap gagal tanpa jawaban, frontend mengulang lewat jalur ini. Isi & aturan impor sama
persis karena memanggil fungsi impor yang sama.
"""
import base64
import binascii
import io
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field

from core import require_role
from routers.classes import classes_import
from routers.rooms import rooms_import
from routers.students import students_combined_import
from routers.subjects import subjects_import
from routers.users import users_gtk_combined_import

router = APIRouter()

MAKS_BERKAS = 10 * 1024 * 1024  # sama dengan batas di halaman Import
IMPOR = {
    'gtk-combined': users_gtk_combined_import,
    'students-combined': students_combined_import,
    'rooms': rooms_import,
    'classes': classes_import,
    'subjects': subjects_import,
}


class ImporJsonIn(BaseModel):
    nama_berkas: str = Field(..., min_length=1, max_length=200)
    isi_base64: str = Field(..., min_length=1, max_length=(MAKS_BERKAS * 4) // 3 + 8)


@router.post("/impor-excel/{jenis}/json")
async def impor_excel_json(jenis: str, body: ImporJsonIn, request: Request, user: Dict = Depends(require_role('admin'))):
    fungsi = IMPOR.get(jenis)
    if not fungsi:
        raise HTTPException(404, "Jenis impor tidak dikenal")
    isi = body.isi_base64.split(',', 1)[1] if body.isi_base64.startswith('data:') else body.isi_base64
    try:
        data = base64.b64decode(isi, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "Isi berkas tidak valid. Pilih ulang berkas .xlsx lalu coba lagi.")
    if len(data) > MAKS_BERKAS:
        raise HTTPException(413, "Ukuran berkas maksimal 10 MB")
    return await fungsi(file=UploadFile(file=io.BytesIO(data), filename=body.nama_berkas), request=request, user=user)
