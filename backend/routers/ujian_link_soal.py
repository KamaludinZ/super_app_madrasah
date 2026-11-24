"""Menu Link Soal (ber-login; key `link_soal`): tautan soal eksternal (aplikasi CBT) dan jendela waktu tombol
"Mengerjakan" per jenjang per mapel baku untuk Portal Ujian siswa (koleksi `ujian_link_soal`, skema di ujian_portal.py).
Kontrak sama dengan frontend/src/lib/ujianLinkSoal.js.

Akses: admin (pengelola) mengubah; kepala madrasah, waka kurikulum, serta ketua & sekretaris panitia ujian itu melihat
(boleh_ubah = false) TANPA alamat soal lengkap (hanya nama host). Simpan per baris (jenjang × mapel) MENIMPA dokumen
lama dengan cek versi (409 bila admin lain baru mengubah baris itu) — pola PUT /ujian/{id}/info-konten. Penghitung klik
(jumlah_klik, klik_terakhir_at) tidak pernah ditulis saat menyimpan: klik siswa dapat menaikkannya kapan saja; cache itu
hanya dapat dihitung ulang dari jejak audit lewat POST /ujian/{id}/link-soal/bangun-ulang-klik.
"""
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pymongo.errors import DuplicateKeyError

from core import db, get_current_user, log_audit
from routers.ujian import akses_ujian
from routers.ujian_formulir import jadwal_ujian
from ujian import PERAN_BUKAN_PANITIA, sekarang_wib
from ujian_info import JENJANG_UJIAN, inisialisasi_tautan, mapel_jenjang, mapel_semua_jenjang
from ujian_portal import (
    KOLEKSI_LINK_SOAL, LinkSoalIn, bangun_ulang_klik, dokumen_link_soal, host_url, jendela_jadwal, peringatan_link,
    ringkas_link_admin, ringkas_tautan_portal, susun_link_admin,
)

router = APIRouter()

MENU = 'link_soal'
PESAN_HANYA_ADMIN = "Link soal hanya dapat diatur admin."
PESAN_VERSI = "Link soal ini baru saja diubah admin lain. Muat ulang halaman untuk melihat isian terbaru, lalu simpan lagi."
TANPA_CACHE = {'Cache-Control': 'no-store'}
# Field yang ditulis saat menyimpan — TANPA jumlah_klik & klik_terakhir_at (cache klik dinaikkan atomik oleh rute kerjakan).
FIELD_SIMPAN = ('url', 'mulai_at', 'selesai_at', 'aktif', 'diperbarui_pada', 'diperbarui_oleh', 'diperbarui_oleh_nama')


def _ringkas_ujian(u: Dict) -> Dict:
    return {k: u.get(k) for k in ('id', 'nama', 'jenis', 'mulai', 'selesai', 'tahun_pelajaran')}


def _boleh_ubah(a: Dict, user: Dict) -> bool:
    return bool(a['pengelola']) and user.get('active_role') not in PERAN_BUKAN_PANITIA


@router.get("/ujian/{ujian_id}/link-soal")
async def link_soal_ujian(ujian_id: str, response: Response, user: Dict = Depends(get_current_user)):
    """Link soal satu ujian: { ujian, boleh_ubah, tautan_portal, mapel, link: [LinkSoal] } — satu entri per jenjang × mapel
    baku aktif (yang belum diatur: id None, url '', jendela dari jadwal). Tautan publik yang belum ada dibuat tertutup."""
    a = await akses_ujian(user, ujian_id, MENU)
    tautan = await inisialisasi_tautan(db, ujian_id, user)
    boleh = _boleh_ubah(a, user)
    mapel = await mapel_semua_jenjang(db)
    docs = await db[KOLEKSI_LINK_SOAL].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(500)
    response.headers.update(TANPA_CACHE)
    return {'ujian': _ringkas_ujian(a['ujian']), 'boleh_ubah': boleh,
            'tautan_portal': ringkas_tautan_portal(tautan['portal'], a['ujian'], sekarang_wib()),
            'mapel': mapel, 'link': susun_link_admin(docs, mapel, await jadwal_ujian(ujian_id), tampil_url=boleh)}


@router.put("/ujian/{ujian_id}/link-soal/{jenjang}/{mapel}")
async def simpan_link_soal(ujian_id: str, jenjang: int, mapel: str, body: LinkSoalIn, request: Request,
                           user: Dict = Depends(get_current_user)):
    """Simpan tautan soal & jendela tombol "Mengerjakan" satu mapel satu jenjang (admin; menimpa). 422 tautan bukan
    http/https, waktu tutup ≤ mulai, jenjang/mapel tidak dikenal; 409 bila `versi` berbeda dengan yang tersimpan.
    -> { link: LinkSoal, peringatan: [teks] }"""
    a = await akses_ujian(user, ujian_id, MENU)
    if not _boleh_ubah(a, user):
        raise HTTPException(403, PESAN_HANYA_ADMIN)
    if jenjang not in JENJANG_UJIAN:
        raise HTTPException(422, 'Jenjang harus 7, 8, atau 9.')
    daftar = await mapel_jenjang(db, jenjang)
    if mapel not in {m['kode'] for m in daftar}:
        raise HTTPException(422, 'Mata pelajaran tidak dikenal pada jenjang ini. Pakai kode dari daftar mapel baku.')
    kunci = {'ujian_id': ujian_id, 'jenjang': jenjang, 'mapel': mapel}
    lama = await db[KOLEKSI_LINK_SOAL].find_one(kunci, {'_id': 0})
    if (body.versi or None) != ((lama or {}).get('diperbarui_pada') or None):
        raise HTTPException(409, PESAN_VERSI)
    baru = dokumen_link_soal(ujian_id, jenjang, mapel, body, user, lama, sekarang_wib())
    try:
        if lama:  # bersyarat versi: dua admin menyimpan bersamaan -> hanya satu yang berhasil
            hasil = await db[KOLEKSI_LINK_SOAL].update_one(
                {'id': lama['id'], 'diperbarui_pada': lama.get('diperbarui_pada')}, {'$set': {k: baru[k] for k in FIELD_SIMPAN}})
            if not hasil.matched_count:
                raise HTTPException(409, PESAN_VERSI)
        else:
            await db[KOLEKSI_LINK_SOAL].insert_one(dict(baru))
    except DuplicateKeyError:
        raise HTTPException(409, PESAN_VERSI)
    tersimpan = await db[KOLEKSI_LINK_SOAL].find_one(kunci, {'_id': 0})
    await log_audit(user, 'ujian_link_soal_ubah', KOLEKSI_LINK_SOAL, tersimpan['id'],
                    {'ujian_id': ujian_id, 'jenjang': jenjang, 'mapel': mapel, 'host': host_url(body.url) or None, 'aktif': body.aktif,
                     'mulai_at': body.mulai_at, 'selesai_at': body.selesai_at, 'baru': not lama}, request=request)
    jd = jendela_jadwal(await jadwal_ujian(ujian_id), jenjang, daftar).get(mapel)
    return {'link': ringkas_link_admin(tersimpan, jenjang, mapel, jd, tampil_url=True),
            'peringatan': peringatan_link(body, a['ujian'], jd)}


@router.post("/ujian/{ujian_id}/link-soal/bangun-ulang-klik")
async def bangun_ulang_penghitung_klik(ujian_id: str, request: Request, response: Response, user: Dict = Depends(get_current_user)):
    """Bangun ulang penghitung klik (admin): jumlah_klik & klik_terakhir_at tiap link soal dihitung ulang dari jejak audit
    (ujian_akses_log, klik sah saja) — log adalah sumber kebenaran, angka di portal hanya cache. Log tidak diubah; aman
    diulang. -> { diperiksa, diperbaiki, selisih, berubah, waktu, link: [LinkSoal] }"""
    a = await akses_ujian(user, ujian_id, MENU)
    if not _boleh_ubah(a, user):
        raise HTTPException(403, PESAN_HANYA_ADMIN)
    hasil = await bangun_ulang_klik(db, ujian_id, waktu=sekarang_wib())
    await log_audit(user, 'ujian_link_soal_bangun_ulang_klik', KOLEKSI_LINK_SOAL, ujian_id,
                    {'ujian_id': ujian_id, 'diperiksa': hasil['diperiksa'], 'diperbaiki': hasil['diperbaiki'],
                     'selisih': hasil['selisih'][:20], 'berubah': len(hasil['berubah'])}, request=request)
    docs = await db[KOLEKSI_LINK_SOAL].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(500)
    response.headers.update(TANPA_CACHE)
    return {**{k: hasil[k] for k in ('diperiksa', 'diperbaiki', 'selisih', 'berubah', 'waktu')},
            'link': susun_link_admin(docs, await mapel_semua_jenjang(db), await jadwal_ujian(ujian_id), tampil_url=True)}
