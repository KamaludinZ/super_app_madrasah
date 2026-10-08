"""API Masterplan / Denah Sekolah: gambar denah aktif + penanda ruang dari master ruangan (rooms).

Semua pengguna login dapat melihat; unggah/ganti/hapus denah dan kelola penanda khusus admin.
Gambar disimpan di penyimpanan unggahan terpusat (folder `masterplan`) dan dikirim lewat endpoint
ber-autentikasi. Posisi penanda dalam persen (0–100) terhadap gambar denah.
"""
import io
import os
import re
import uuid
from datetime import datetime, timezone
from typing import Dict, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, Field

from core import db, get_current_user, log_audit, require_role
from penyimpanan import folder_unggahan

router = APIRouter()

KOLEKSI_DENAH = 'masterplan_denah'
KOLEKSI_MARKER = 'masterplan_marker'
ID_DENAH_AKTIF = 'aktif'  # satu denah aktif untuk madrasah
MAKS_UKURAN = 5 * 1024 * 1024
FORMAT_DIIZINKAN = {'PNG': 'png', 'JPEG': 'jpg', 'WEBP': 'webp'}
FOLDER = 'masterplan'


def _sekarang() -> str:
    return datetime.now(timezone.utc).isoformat()


def _path_gambar(nama_berkas: Optional[str]) -> Optional[str]:
    if not nama_berkas:
        return None
    return os.path.join(folder_unggahan(FOLDER), os.path.basename(nama_berkas))


def _denah_tampil(doc: Optional[Dict]) -> Optional[Dict]:
    if not doc:
        return None
    return {
        'id': doc['id'],
        # versi di query mencegah cache gambar lama setelah denah diganti
        'image_url': f"/api/masterplan/denah/gambar?v={doc.get('updated_at', '')}",
        'lebar': doc.get('lebar'),
        'tinggi': doc.get('tinggi'),
        'updated_at': doc.get('updated_at'),
    }


async def _denah_aktif() -> Optional[Dict]:
    return await db[KOLEKSI_DENAH].find_one({'id': ID_DENAH_AKTIF}, {'_id': 0})


@router.get("/masterplan")
async def lihat_masterplan(user: Dict = Depends(get_current_user)):
    """Denah aktif + penanda ruang (semua peran, read-only)."""
    denah = await _denah_aktif()
    markers = await db[KOLEKSI_MARKER].find({'denah_id': ID_DENAH_AKTIF}, {'_id': 0}).to_list(500) if denah else []
    # Nama ruang selalu mengikuti master ruangan terkini (bila ruang diganti namanya).
    ids = list({m.get('room_id') for m in markers if m.get('room_id')})
    nama = {r['id']: r.get('name') for r in await db.rooms.find({'id': {'$in': ids}}, {'_id': 0, 'id': 1, 'name': 1}).to_list(len(ids) or 1)}
    for m in markers:
        m['nama_ruang'] = nama.get(m.get('room_id')) or m.get('nama_ruang')
    markers.sort(key=lambda m: (m.get('kode_ruang') or '~', m.get('nama_ruang') or ''))
    return {'denah': _denah_tampil(denah), 'markers': markers}


@router.get("/masterplan/denah/gambar")
async def gambar_denah(user: Dict = Depends(get_current_user)):
    denah = await _denah_aktif()
    path = _path_gambar((denah or {}).get('berkas'))
    if not path or not os.path.isfile(path):
        raise HTTPException(404, "Gambar denah tidak ditemukan")
    return FileResponse(path, media_type=denah.get('media_type') or None)


def _periksa_gambar(isi: bytes) -> Dict:
    """Validasi berkas denah -> {ext, lebar, tinggi, media_type}; 400 bila bukan PNG/JPG/WEBP atau rusak."""
    if not isi:
        raise HTTPException(400, "Berkas kosong")
    if len(isi) > MAKS_UKURAN:
        raise HTTPException(400, "Ukuran berkas melebihi batas 5 MB")
    try:
        with Image.open(io.BytesIO(isi)) as img:
            img.verify()
        with Image.open(io.BytesIO(isi)) as img:
            fmt, (lebar, tinggi) = img.format, img.size
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise HTTPException(400, "Berkas bukan gambar yang valid")
    if fmt not in FORMAT_DIIZINKAN:
        raise HTTPException(400, "Format tidak didukung. Gunakan gambar PNG, JPG, atau WEBP.")
    ext = FORMAT_DIIZINKAN[fmt]
    return {'ext': ext, 'lebar': lebar, 'tinggi': tinggi, 'media_type': f"image/{'jpeg' if ext == 'jpg' else ext}"}


@router.post("/masterplan/denah")
async def unggah_denah(request: Request, berkas: UploadFile = File(...), user: Dict = Depends(require_role('admin'))):
    """Unggah / ganti denah aktif (admin). Penanda dipertahankan (posisi dalam persen)."""
    isi = await berkas.read(MAKS_UKURAN + 1)
    info = _periksa_gambar(isi)
    nama = f"denah_{uuid.uuid4().hex}.{info['ext']}"
    with open(_path_gambar(nama), 'wb') as f:
        f.write(isi)
    lama = await _denah_aktif()
    sekarang = _sekarang()
    await db[KOLEKSI_DENAH].update_one(
        {'id': ID_DENAH_AKTIF},
        {'$set': {'berkas': nama, 'media_type': info['media_type'], 'lebar': info['lebar'], 'tinggi': info['tinggi'],
                  'diunggah_oleh': user['id'], 'updated_at': sekarang},
         '$setOnInsert': {'id': ID_DENAH_AKTIF, 'created_at': sekarang}},
        upsert=True,
    )
    path_lama = _path_gambar((lama or {}).get('berkas'))
    if path_lama and os.path.isfile(path_lama):
        os.remove(path_lama)
    await log_audit(user, 'masterplan_denah_unggah', 'masterplan_denah', ID_DENAH_AKTIF,
                    details={'ganti': bool(lama), 'lebar': info['lebar'], 'tinggi': info['tinggi']}, request=request)
    return _denah_tampil(await _denah_aktif())


@router.delete("/masterplan/denah")
async def hapus_denah(request: Request, user: Dict = Depends(require_role('admin'))):
    """Hapus denah aktif beserta seluruh penandanya (admin)."""
    denah = await _denah_aktif()
    if not denah:
        raise HTTPException(404, "Belum ada denah")
    path = _path_gambar(denah.get('berkas'))
    await db[KOLEKSI_MARKER].delete_many({'denah_id': ID_DENAH_AKTIF})
    await db[KOLEKSI_DENAH].delete_one({'id': ID_DENAH_AKTIF})
    if path and os.path.isfile(path):
        os.remove(path)
    await log_audit(user, 'masterplan_denah_hapus', 'masterplan_denah', ID_DENAH_AKTIF, request=request)
    return {'ok': True}


# ============================================================
# PENANDA RUANG (admin)
# ============================================================

class MarkerRequest(BaseModel):
    room_id: Optional[str] = None
    kode_ruang: Optional[str] = Field(None, max_length=20)
    posisi_x: Optional[float] = Field(None, ge=0, le=100)
    posisi_y: Optional[float] = Field(None, ge=0, le=100)


POLA_KODE = re.compile(r'^[A-Z0-9][A-Z0-9.-]{0,11}$')


def _kode_ruang(kode: Optional[str]) -> str:
    """Kode ruang pada penanda: huruf besar/angka/titik/tanda hubung, maks 12 karakter (mis. R-07A)."""
    kode = re.sub(r'\s+', '', (kode or '')).upper()
    if not POLA_KODE.match(kode):
        raise HTTPException(400, "Kode ruang wajib diisi: 1–12 karakter huruf/angka, boleh titik atau tanda hubung (mis. R-07A)")
    return kode


async def _cek_kode_unik(kode: str, kecuali_id: Optional[str] = None) -> None:
    ada = await db[KOLEKSI_MARKER].find_one({'denah_id': ID_DENAH_AKTIF, 'kode_ruang': kode}, {'_id': 0, 'id': 1})
    if ada and ada['id'] != kecuali_id:
        raise HTTPException(409, f"Kode ruang {kode} sudah dipakai penanda lain")


def _persen(v: float) -> float:
    return round(min(100.0, max(0.0, float(v))), 1)


async def _ruang(room_id: str) -> Dict:
    ruang = await db.rooms.find_one({'id': room_id}, {'_id': 0, 'id': 1, 'name': 1})
    if not ruang:
        raise HTTPException(404, "Ruang tidak ada di master ruangan")
    return ruang


async def _cek_ruang_belum_ditandai(room_id: str, kecuali_id: Optional[str] = None) -> None:
    ada = await db[KOLEKSI_MARKER].find_one({'denah_id': ID_DENAH_AKTIF, 'room_id': room_id}, {'_id': 0, 'id': 1})
    if ada and ada['id'] != kecuali_id:
        raise HTTPException(409, "Ruang ini sudah punya penanda di denah")


@router.post("/masterplan/markers")
async def tambah_marker(req: MarkerRequest, request: Request, user: Dict = Depends(require_role('admin'))):
    if not await _denah_aktif():
        raise HTTPException(400, "Unggah denah terlebih dahulu")
    if not req.room_id or req.posisi_x is None or req.posisi_y is None:
        raise HTTPException(400, "Ruang dan posisi penanda wajib diisi")
    ruang = await _ruang(req.room_id)
    await _cek_ruang_belum_ditandai(ruang['id'])
    kode = _kode_ruang(req.kode_ruang)
    await _cek_kode_unik(kode)
    doc = {'id': str(uuid.uuid4()), 'denah_id': ID_DENAH_AKTIF, 'room_id': ruang['id'], 'nama_ruang': ruang.get('name'),
           'kode_ruang': kode,
           'posisi_x': _persen(req.posisi_x), 'posisi_y': _persen(req.posisi_y), 'created_at': _sekarang(), 'updated_at': _sekarang()}
    await db[KOLEKSI_MARKER].insert_one(doc)
    doc.pop('_id', None)
    await log_audit(user, 'masterplan_marker_tambah', 'masterplan_marker', doc['id'], details={'room_id': ruang['id']}, request=request)
    return doc


@router.put("/masterplan/markers/{marker_id}")
async def ubah_marker(marker_id: str, req: MarkerRequest, request: Request, user: Dict = Depends(require_role('admin'))):
    """Geser posisi, ganti ruang, dan/atau ubah kode ruang penanda."""
    marker = await db[KOLEKSI_MARKER].find_one({'id': marker_id}, {'_id': 0})
    if not marker:
        raise HTTPException(404, "Penanda tidak ditemukan")
    ubah: Dict = {'updated_at': _sekarang()}
    if req.room_id and req.room_id != marker.get('room_id'):
        ruang = await _ruang(req.room_id)
        await _cek_ruang_belum_ditandai(ruang['id'], kecuali_id=marker_id)
        ubah.update({'room_id': ruang['id'], 'nama_ruang': ruang.get('name')})
    if req.kode_ruang is not None:
        kode = _kode_ruang(req.kode_ruang)
        if kode != marker.get('kode_ruang'):
            await _cek_kode_unik(kode, kecuali_id=marker_id)
        ubah['kode_ruang'] = kode
    if req.posisi_x is not None:
        ubah['posisi_x'] = _persen(req.posisi_x)
    if req.posisi_y is not None:
        ubah['posisi_y'] = _persen(req.posisi_y)
    await db[KOLEKSI_MARKER].update_one({'id': marker_id}, {'$set': ubah})
    await log_audit(user, 'masterplan_marker_ubah', 'masterplan_marker', marker_id, request=request)
    return await db[KOLEKSI_MARKER].find_one({'id': marker_id}, {'_id': 0})


@router.delete("/masterplan/markers/{marker_id}")
async def hapus_marker(marker_id: str, request: Request, user: Dict = Depends(require_role('admin'))):
    hasil = await db[KOLEKSI_MARKER].delete_one({'id': marker_id})
    if not getattr(hasil, 'deleted_count', 0):
        raise HTTPException(404, "Penanda tidak ditemukan")
    await log_audit(user, 'masterplan_marker_hapus', 'masterplan_marker', marker_id, request=request)
    return {'ok': True}
