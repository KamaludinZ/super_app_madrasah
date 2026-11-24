"""Menu Link Soal (ber-login; key `link_soal`): tautan soal eksternal (aplikasi CBT) dan jendela waktu tombol
"Mengerjakan" per jenjang per mapel untuk Portal Ujian siswa (koleksi `ujian_link_soal`, skema di ujian_portal.py).
Daftar mapel MENGIKUTI JADWAL SESI ujian (menu Pengaturan Formulir; ujian_portal.mapel_link_soal) — termasuk mapel di luar
15 mapel baku seperti "Simulasi". Kontrak sama dengan frontend/src/lib/ujianLinkSoal.js.

Akses: admin (pengelola) mengubah; kepala madrasah, waka kurikulum, serta ketua & sekretaris panitia ujian itu melihat
(boleh_ubah = false) TANPA alamat soal lengkap (hanya nama host). Simpan per baris (jenjang × mapel) MENIMPA dokumen
lama dengan cek versi (409 bila admin lain baru mengubah baris itu) — pola PUT /ujian/{id}/info-konten. Penghitung klik
(jumlah_klik, klik_terakhir_at) tidak pernah ditulis saat menyimpan: klik siswa dapat menaikkannya kapan saja; cache itu
hanya dapat dihitung ulang dari jejak audit lewat POST /ujian/{id}/link-soal/bangun-ulang-klik.
"""
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from pymongo.errors import DuplicateKeyError

from core import db, get_current_user, log_audit
from routers.ujian import akses_ujian
from routers.ujian_formulir import jadwal_ujian
from ujian import PERAN_BUKAN_PANITIA, sekarang_wib
from ujian_info import (
    JENJANG_UJIAN, KOLEKSI_AKSES_LOG, galat_saringan_audit, inisialisasi_tautan, kueri_saringan_audit, mapel_semua_jenjang,
)
from ujian_portal import (
    KOLEKSI_LINK_SOAL, KUERI_KLIK, LOG_KLIK_MAKS, LinkSoalIn, bangun_ulang_klik, dokumen_link_soal, host_url, jendela_jadwal,
    id_soal_layak, mapel_link_soal, peringatan_link, rincian_klik, ringkas_link_admin, ringkas_tautan_portal, susun_intensitas,
    susun_link_admin,
)

router = APIRouter()

MENU = 'link_soal'
PESAN_HANYA_ADMIN = "Link soal hanya dapat diatur admin."
PESAN_VERSI = "Link soal ini baru saja diubah admin lain. Muat ulang halaman untuk melihat isian terbaru, lalu simpan lagi."
TANPA_CACHE = {'Cache-Control': 'no-store'}
# Field yang ditulis saat menyimpan — TANPA jumlah_klik & klik_terakhir_at (cache klik dinaikkan atomik oleh rute kerjakan).
FIELD_SIMPAN = ('nama_mapel', 'url', 'mulai_at', 'selesai_at', 'aktif', 'diperbarui_pada', 'diperbarui_oleh', 'diperbarui_oleh_nama')


def _ringkas_ujian(u: Dict) -> Dict:
    return {k: u.get(k) for k in ('id', 'nama', 'jenis', 'mulai', 'selesai', 'tahun_pelajaran')}


def _boleh_ubah(a: Dict, user: Dict) -> bool:
    return bool(a['pengelola']) and user.get('active_role') not in PERAN_BUKAN_PANITIA


async def mapel_dan_jadwal(ujian_id: str, docs: List[Dict]) -> Tuple[Dict[str, List[Dict]], List[Dict]]:
    """(mapel Link Soal per jenjang mengikuti jadwal sesi + link tersimpan, jadwal sesi) satu ujian."""
    jadwal = await jadwal_ujian(ujian_id)
    return mapel_link_soal(jadwal, await mapel_semua_jenjang(db), docs), jadwal


@router.get("/ujian/{ujian_id}/link-soal")
async def link_soal_ujian(ujian_id: str, response: Response, user: Dict = Depends(get_current_user)):
    """Link soal satu ujian: { ujian, boleh_ubah, tautan_portal, mapel: { '7': [{ kode, nama, di_jadwal, jumlah_sesi }] },
    link: [LinkSoal] } — satu entri per jenjang × mapel di jadwal sesi (yang belum diatur: id None, url '', jendela dari
    jadwal), ditambah link tersimpan yang mapelnya sudah tidak ada di jadwal (di_jadwal False). Tautan publik yang belum
    ada dibuat tertutup."""
    a = await akses_ujian(user, ujian_id, MENU)
    tautan = await inisialisasi_tautan(db, ujian_id, user)
    boleh = _boleh_ubah(a, user)
    docs = await db[KOLEKSI_LINK_SOAL].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(500)
    mapel, jadwal = await mapel_dan_jadwal(ujian_id, docs)
    response.headers.update(TANPA_CACHE)
    return {'ujian': _ringkas_ujian(a['ujian']), 'boleh_ubah': boleh,
            'tautan_portal': ringkas_tautan_portal(tautan['portal'], a['ujian'], sekarang_wib()),
            'mapel': mapel, 'link': susun_link_admin(docs, mapel, jadwal, tampil_url=boleh)}


@router.put("/ujian/{ujian_id}/link-soal/{jenjang}/{mapel}")
async def simpan_link_soal(ujian_id: str, jenjang: int, mapel: str, body: LinkSoalIn, request: Request,
                           user: Dict = Depends(get_current_user)):
    """Simpan tautan soal & jendela tombol "Mengerjakan" satu mapel satu jenjang (admin; menimpa). 422 tautan bukan
    http/https, waktu tutup ≤ mulai, jenjang tidak dikenal, mapel tidak ada di jadwal sesi jenjang itu (dan belum pernah
    disimpan); 409 bila `versi` berbeda dengan yang tersimpan.
    -> { link: LinkSoal, peringatan: [teks] }"""
    a = await akses_ujian(user, ujian_id, MENU)
    if not _boleh_ubah(a, user):
        raise HTTPException(403, PESAN_HANYA_ADMIN)
    if jenjang not in JENJANG_UJIAN:
        raise HTTPException(422, 'Jenjang harus 7, 8, atau 9.')
    kunci = {'ujian_id': ujian_id, 'jenjang': jenjang, 'mapel': mapel}
    lama = await db[KOLEKSI_LINK_SOAL].find_one(kunci, {'_id': 0})
    peta_mapel, jadwal = await mapel_dan_jadwal(ujian_id, [lama] if lama else [])
    daftar = peta_mapel[str(jenjang)]
    entri = next((m for m in daftar if m['kode'] == mapel), None)
    if not entri:
        raise HTTPException(422, f'Mata pelajaran ini tidak dikenal atau tidak ada di jadwal sesi kelas {jenjang}. '
                                 'Tambahkan dulu ke jadwal sesi di menu Pengaturan Formulir.')
    if (body.versi or None) != ((lama or {}).get('diperbarui_pada') or None):
        raise HTTPException(409, PESAN_VERSI)
    baru = dokumen_link_soal(ujian_id, jenjang, mapel, body, user, lama, sekarang_wib(), nama=entri['nama'])
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
    jd = jendela_jadwal(jadwal, jenjang, daftar).get(mapel)
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
    mapel, jadwal = await mapel_dan_jadwal(ujian_id, docs)
    response.headers.update(TANPA_CACHE)
    return {**{k: hasil[k] for k in ('diperiksa', 'diperbaiki', 'selisih', 'berubah', 'waktu')},
            'link': susun_link_admin(docs, mapel, jadwal, tampil_url=True)}


@router.get("/ujian/{ujian_id}/link-soal/intensitas")
async def intensitas_klik(ujian_id: str, response: Response, dari: Optional[str] = Query(None, max_length=10),
                          sampai: Optional[str] = Query(None, max_length=10), user: Dict = Depends(get_current_user)):
    """Intensitas klik "Mengerjakan" per jenjang per mapel (admin & pemantau menu link_soal), diagregasi dari jejak audit
    (ujian_akses_log aksi=klik_mengerjakan, hasil=ok) — BUKAN dari cache jumlah_klik — dalam rentang tanggal WIB
    inklusif ?dari=&sampai= (YYYY-MM-DD; kosong = seluruhnya). -> { rentang, hari, ringkasan, intensitas }"""
    pesan = galat_saringan_audit(dari, sampai, None)
    if pesan:
        raise HTTPException(422, pesan)
    await akses_ujian(user, ujian_id, MENU)
    q = {**kueri_saringan_audit(ujian_id, dari, sampai), **KUERI_KLIK}
    log = await db[KOLEKSI_AKSES_LOG].find(q, {'_id': 0, 'link_soal_id': 1, 'waktu': 1}).to_list(LOG_KLIK_MAKS)
    docs = await db[KOLEKSI_LINK_SOAL].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(500)
    hasil = susun_intensitas(log, docs, *(await mapel_dan_jadwal(ujian_id, docs)))
    response.headers.update(TANPA_CACHE)
    return {'rentang': {'dari': dari or None, 'sampai': sampai or None}, **hasil}


@router.get("/ujian/{ujian_id}/link-soal/{link_soal_id}/klik")
async def rincian_klik_link_soal(ujian_id: str, link_soal_id: str, response: Response, batas: int = Query(200, ge=1, le=1000),
                                 user: Dict = Depends(get_current_user)):
    """Rincian klik "Mengerjakan" SAH satu link soal (admin & pemantau menu link_soal, seperti jejak audit tautan publik):
    { total, klik: [{ id, waktu, ip, perangkat, sesi }] (terbaru dulu, maks `batas`), per_ip, per_perangkat } — dari
    ujian_akses_log, untuk menelusuri sumber klik yang janggal. Tanpa token & tanpa tautan soal."""
    await akses_ujian(user, ujian_id, MENU)
    if not id_soal_layak(link_soal_id) or not await db[KOLEKSI_LINK_SOAL].find_one({'id': link_soal_id, 'ujian_id': ujian_id}, {'_id': 1}):
        raise HTTPException(404, 'Link soal tidak ditemukan pada ujian ini.')
    log = await (db[KOLEKSI_AKSES_LOG].find({'ujian_id': ujian_id, 'link_soal_id': link_soal_id, **KUERI_KLIK},
                                            {'_id': 0, 'id': 1, 'waktu': 1, 'ip': 1, 'perangkat': 1, 'sesi': 1})
                 .sort('waktu', -1).to_list(LOG_KLIK_MAKS))
    response.headers.update(TANPA_CACHE)
    return rincian_klik(log, batas)
