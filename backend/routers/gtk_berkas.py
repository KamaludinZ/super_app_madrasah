"""Unggah berkas GTK (Arsip Berkas & File SK PNS di halaman detail GTK).

File diunggah lepas lalu URL-nya disimpan ke field users (berkas_*/file_sk_pns) saat form disimpan —
langsung oleh admin, atau lewat draft verval untuk GTK yang mengubah profilnya sendiri.
Disimpan per GTK: uploads/gtk_berkas/{user_id}/{jenis}_{nama}_{uuid8}.{ext}
Akses: admin & kepala madrasah untuk semua GTK; GTK hanya berkas miliknya sendiri.
"""
import os
import re
import uuid
from typing import Dict

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse

from core import db, get_current_user
from penyimpanan import folder_unggahan

router = APIRouter()

UPLOAD_DIR = folder_unggahan('gtk_berkas')
EKSTENSI = {'.pdf', '.jpg', '.jpeg', '.png'}
MAKS_UKURAN = 2 * 1024 * 1024  # 2MB

# jenis -> field users yang menyimpan URL berkasnya
JENIS_BERKAS_GTK = {
    'sk_pns': 'file_sk_pns',
    'ktp': 'berkas_ktp', 'kk': 'berkas_kk', 'ijazah': 'berkas_ijazah', 'sk': 'berkas_sk', 'npwp': 'berkas_npwp',
    'absensi': 'berkas_absensi', 'skbk': 'berkas_skbk', 'skakpt': 'berkas_skakpt', 'tunjangan': 'berkas_tunjangan',
}
PERAN_LIHAT_SEMUA = ('admin', 'kepala_sekolah')
_POLA_ID = re.compile(r'^[A-Za-z0-9-]{1,64}$')


def _boleh(user: Dict, gtk_id: str, ubah: bool) -> bool:
    roles = user.get('roles') or []
    if 'admin' in roles or user.get('id') == gtk_id:
        return True
    return not ubah and any(r in roles for r in PERAN_LIHAT_SEMUA)


def _nama_aman(teks: str) -> str:
    return re.sub(r'[^A-Za-z0-9_-]', '', re.sub(r'\s+', '_', (teks or '').strip()))[:40] or 'gtk'


@router.post("/gtk/berkas/upload/{jenis}")
async def unggah_berkas_gtk(jenis: str, file: UploadFile = File(...), gtk_id: str = Form(...),
                            user: Dict = Depends(get_current_user)):
    """Unggah satu berkas GTK (PDF/JPG/PNG, maks. 2MB). -> {url, field} untuk disertakan pada payload simpan."""
    if jenis not in JENIS_BERKAS_GTK:
        raise HTTPException(400, f"Jenis berkas tidak valid: {jenis}")
    if not _POLA_ID.match(gtk_id or ''):
        raise HTTPException(400, "ID GTK tidak valid")
    if not _boleh(user, gtk_id, ubah=True):
        raise HTTPException(403, "Tidak diizinkan mengunggah berkas GTK ini")
    gtk = await db.users.find_one({'id': gtk_id}, {'_id': 0, 'full_name': 1, 'roles': 1})
    if not gtk or 'siswa' in (gtk.get('roles') or []):
        raise HTTPException(404, "GTK tidak ditemukan")
    ext = os.path.splitext((file.filename or '').lower())[1]
    if ext not in EKSTENSI:
        raise HTTPException(400, "Berkas harus PDF, JPG, atau PNG")
    isi = await file.read(MAKS_UKURAN + 1)
    if len(isi) > MAKS_UKURAN:
        raise HTTPException(400, "Ukuran berkas maksimal 2MB")
    if not isi:
        raise HTTPException(400, "Berkas kosong")
    folder = os.path.join(UPLOAD_DIR, gtk_id)
    os.makedirs(folder, exist_ok=True)
    nama = f"{jenis}_{_nama_aman(gtk.get('full_name'))}_{uuid.uuid4().hex[:8]}{ext}"
    with open(os.path.join(folder, nama), 'wb') as f:
        f.write(isi)
    return {'url': f"/api/gtk/berkas/{gtk_id}/{nama}", 'field': JENIS_BERKAS_GTK[jenis], 'jenis': jenis}


@router.get("/gtk/berkas/{gtk_id}/{filename}")
async def lihat_berkas_gtk(gtk_id: str, filename: str, user: Dict = Depends(get_current_user)):
    """Tampilkan berkas GTK: admin & kepala madrasah, atau GTK pemilik berkas."""
    if not _POLA_ID.match(gtk_id or ''):
        raise HTTPException(400, "ID GTK tidak valid")
    if not _boleh(user, gtk_id, ubah=False):
        raise HTTPException(403, "Tidak diizinkan melihat berkas ini")
    path = os.path.join(UPLOAD_DIR, gtk_id, os.path.basename(filename))
    if not os.path.isfile(path):
        raise HTTPException(404, "Berkas tidak ditemukan")
    return FileResponse(path)
