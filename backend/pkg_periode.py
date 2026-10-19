"""Service periode PKG (dikelola kepala madrasah). Skema: lihat pkg_skema.

Aturan:
    - Periode baru berstatus 'draf'; status hanya maju draf -> berjalan -> ditutup (TRANSISI_PERIODE).
    - Hanya satu periode 'berjalan' (dicek di sini dan dijaga index unik parsial).
    - Periode yang sudah ditutup tidak dapat diubah.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List

from fastapi import HTTPException

from pkg_skema import KOLEKSI_PERIODE, TRANSISI_PERIODE, PeriodeRequest


def _sekarang() -> str:
    return datetime.now(timezone.utc).isoformat()


def periode_tampil(p: Dict[str, Any]) -> Dict[str, Any]:
    kunci = ('id', 'nama_periode', 'semester_id', 'tahun_pelajaran', 'semester', 'tanggal_buka', 'tanggal_tutup',
             'status', 'created_at', 'updated_at')
    return {k: p.get(k) for k in kunci}


async def daftar_periode(db) -> List[Dict[str, Any]]:
    daftar = await db[KOLEKSI_PERIODE].find({}, {'_id': 0}).to_list(500)
    daftar.sort(key=lambda p: (p.get('tanggal_buka') or '', p.get('created_at') or ''), reverse=True)
    return [periode_tampil(p) for p in daftar]


async def ambil_periode(db, periode_id: str) -> Dict[str, Any]:
    p = await db[KOLEKSI_PERIODE].find_one({'id': periode_id}, {'_id': 0})
    if not p:
        raise HTTPException(404, 'Periode PKG tidak ditemukan.')
    return p


async def buat_periode(db, data: PeriodeRequest, kepala: Dict[str, Any]) -> Dict[str, Any]:
    sekarang = _sekarang()
    p = {'id': str(uuid.uuid4()), **data.model_dump(), 'status': 'draf', 'dibuat_oleh': kepala.get('id'),
         'created_at': sekarang, 'updated_at': sekarang}
    await db[KOLEKSI_PERIODE].insert_one(dict(p))
    return p


async def ubah_periode(db, periode_id: str, data: PeriodeRequest) -> Dict[str, Any]:
    p = await ambil_periode(db, periode_id)
    if p.get('status') == 'ditutup':
        raise HTTPException(409, 'Periode yang sudah ditutup tidak dapat diubah.')
    perubahan = {**data.model_dump(), 'updated_at': _sekarang()}
    await db[KOLEKSI_PERIODE].update_one({'id': periode_id}, {'$set': perubahan})
    return {**p, **perubahan}


async def ubah_status_periode(db, periode_id: str, status: str) -> Dict[str, Any]:
    p = await ambil_periode(db, periode_id)
    if TRANSISI_PERIODE.get(p.get('status')) != status:
        raise HTTPException(409, f"Status periode tidak dapat diubah dari '{p.get('status')}' ke '{status}'.")
    if status == 'berjalan':
        lain = await db[KOLEKSI_PERIODE].find_one({'status': 'berjalan', 'id': {'$ne': periode_id}}, {'_id': 0, 'nama_periode': 1})
        if lain:
            raise HTTPException(409, f"Periode \"{lain.get('nama_periode')}\" masih berjalan. Tutup periode tersebut lebih dahulu.")
    perubahan = {'status': status, 'updated_at': _sekarang()}
    # Filter status lama mencegah dua permintaan bersamaan mengubah status yang sama dua kali.
    hasil = await db[KOLEKSI_PERIODE].update_one({'id': periode_id, 'status': p.get('status')}, {'$set': perubahan})
    if getattr(hasil, 'matched_count', 1) == 0:
        raise HTTPException(409, 'Status periode baru saja berubah. Muat ulang halaman.')
    return {**p, **perubahan}
