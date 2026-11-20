"""API Ujian Madrasah — Master Guru Pengawas: daftar pilihan nama pengawas pada berita acara publik.

Berlaku untuk semua ujian, TANPA plotting pengawas per ruang. Membaca: admin, serta ketua & sekretaris panitia ujian
semester konteks lihat. Mengubah: hanya admin. Pengawas yang sudah mengisi berita acara tidak dapat dihapus (cukup
dinonaktifkan) agar riwayat berita acara tetap utuh.
"""
from collections import Counter
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_active_context, get_current_user, log_audit
from routers.ujian import _akses_semester, wajib_pengelola
from ujian import AKSES_MENU_UJIAN, PROYEKSI_PEJABAT, akun_gtk_sah, identitas_pejabat, pesan_tolak_menu, sekarang_wib
from ujian_ruang import (
    KOLEKSI_BERITA_ACARA, KOLEKSI_PENGAWAS, PengawasAktifIn, PengawasTambahIn, dokumen_pengawas, ringkas_pengawas,
)

router = APIRouter()


async def _wajib_baca_pengawas(user: Dict[str, Any]) -> bool:
    """True bila pengelola; ketua/sekretaris semester konteks boleh membaca; selain itu 403."""
    ctx = await get_active_context(user)
    akses = await _akses_semester(user, ctx.get('semester_id'))
    if akses['pengelola']:
        return True
    if any(j in AKSES_MENU_UJIAN['pengawas']['jabatan'] for j in akses['jabatan']):
        return False
    raise HTTPException(403, pesan_tolak_menu('pengawas'))


async def _dipakai() -> Counter:
    return Counter(b.get('pengawas_id') for b in await db[KOLEKSI_BERITA_ACARA].find({}, {'_id': 0, 'pengawas_id': 1}).to_list(50000))


@router.get("/ujian/pengawas")
async def daftar_pengawas(user: Dict = Depends(get_current_user)):
    """Master guru pengawas (aktif dulu, lalu nama) beserta jumlah berita acara yang pernah diisi tiap pengawas."""
    boleh_ubah = await _wajib_baca_pengawas(user)
    docs = await db[KOLEKSI_PENGAWAS].find({}, {'_id': 0}).to_list(2000)
    akun = {u['id']: identitas_pejabat(u) for u in await db.users.find(
        {'id': {'$in': [d['user_id'] for d in docs]}}, PROYEKSI_PEJABAT).to_list(2000)} if docs else {}
    dipakai = await _dipakai()
    items = [ringkas_pengawas(d, dipakai.get(d['id'], 0), akun.get(d['user_id'])) for d in docs]
    items.sort(key=lambda p: (not p['aktif'], (p['nama'] or '').lower()))
    return {'boleh_ubah': boleh_ubah, 'items': items}


@router.post("/ujian/pengawas")
async def tambah_pengawas(body: PengawasTambahIn, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Tambah beberapa akun GTK aktif sebagai pengawas (admin). Yang sudah terdaftar atau bukan GTK dilewati."""
    ids = list(dict.fromkeys(i for i in body.user_ids if i))
    akun = {u['id']: u for u in await db.users.find({'id': {'$in': ids}}, PROYEKSI_PEJABAT).to_list(len(ids))}
    sudah = set(await db[KOLEKSI_PENGAWAS].distinct('user_id', {'user_id': {'$in': ids}}))
    dilewati, ditambahkan = [], []
    for uid in ids:
        if uid in sudah:
            dilewati.append({'user_id': uid, 'alasan': 'Sudah terdaftar sebagai pengawas'})
        elif not akun_gtk_sah(akun.get(uid)):
            dilewati.append({'user_id': uid, 'alasan': 'Bukan akun GTK aktif'})
        else:
            doc = dokumen_pengawas(identitas_pejabat(akun[uid]), user)
            await db[KOLEKSI_PENGAWAS].insert_one(dict(doc))
            ditambahkan.append(doc)
    if ditambahkan:
        await log_audit(user, 'ujian_pengawas_tambah', KOLEKSI_PENGAWAS, None,
                        {'user_ids': [d['user_id'] for d in ditambahkan]}, request=request)
    return {'ditambahkan': len(ditambahkan), 'dilewati': dilewati, 'items': [ringkas_pengawas(d) for d in ditambahkan]}


@router.patch("/ujian/pengawas/{pengawas_id}")
async def atur_aktif_pengawas(pengawas_id: str, body: PengawasAktifIn, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Aktifkan/nonaktifkan pengawas (admin). Pengawas nonaktif tidak muncul di pilihan berita acara publik."""
    doc = await db[KOLEKSI_PENGAWAS].find_one({'id': pengawas_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Pengawas tidak ditemukan")
    await db[KOLEKSI_PENGAWAS].update_one({'id': pengawas_id}, {'$set': {'aktif': body.aktif, 'diperbarui_pada': sekarang_wib().isoformat()}})
    await log_audit(user, 'ujian_pengawas_aktif', KOLEKSI_PENGAWAS, pengawas_id, {'aktif': body.aktif}, request=request)
    return ringkas_pengawas({**doc, 'aktif': body.aktif}, (await _dipakai()).get(pengawas_id, 0))


@router.delete("/ujian/pengawas/{pengawas_id}")
async def hapus_pengawas(pengawas_id: str, request: Request, user: Dict = Depends(wajib_pengelola)):
    """Hapus pengawas yang belum pernah mengisi berita acara (admin); yang sudah dipakai cukup dinonaktifkan (409)."""
    doc = await db[KOLEKSI_PENGAWAS].find_one({'id': pengawas_id}, {'_id': 0})
    if not doc:
        raise HTTPException(404, "Pengawas tidak ditemukan")
    n = await db[KOLEKSI_BERITA_ACARA].count_documents({'pengawas_id': pengawas_id})
    if n:
        raise HTTPException(409, f"{doc.get('nama')} sudah mengisi {n} berita acara; nonaktifkan saja agar riwayatnya tetap utuh")
    await db[KOLEKSI_PENGAWAS].delete_one({'id': pengawas_id})
    await log_audit(user, 'ujian_pengawas_hapus', KOLEKSI_PENGAWAS, pengawas_id, {'user_id': doc.get('user_id')}, request=request)
    return {'ok': True}
