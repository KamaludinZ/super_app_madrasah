"""API publik TANPA login Portal Ujian: jadwal mapel per jenjang dan status tombol "Mengerjakan" menurut waktu server.

Akses hanya lewat token tautan acak jenis `portal` (ujian_tautan_publik) — rute dan token TERPISAH dari halaman info
(`/publik/info-ujian/{token}`): token info tidak membuka portal dan sebaliknya. Validator Token + Jendela Waktu dipakai
bersama (routers.ujian_info_publik.tautan_berlaku); jendela tautan portal = masa ujian, di luar itu atau saat ditutup
admin permintaan DITOLAK (403) dan halaman tidak dirender — detail penolakan memuat `jadwal_berikutnya`.

Isolasi data: payload portal tidak memuat kisi-kisi, berkas, tata tertib, monitoring, maupun data pribadi siswa, dan
TIDAK PERNAH memuat `url` tautan soal (keluar hanya lewat rute kerjakan saat mapel berlangsung). Kontrak sama dengan
frontend/src/lib/ujianPortalPublik.js. Pembukaan dicatat ke ujian_akses_log (aksi buka_tautan; muat ulang otomatis
?segarkan=1 memperbarui entri sesi yang sama, seperti halaman monitoring).
"""
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query, Request, Response

from core import db
from routers.ujian_formulir import jadwal_ujian
from routers.ujian_info_publik import TANPA_CACHE, madrasah_publik, tautan_berlaku
from ujian import sekarang_wib
from ujian_info import cari_tautan, catat_segarkan, mapel_semua_jenjang
from ujian_portal import KOLEKSI_LINK_SOAL, jadwal_berikutnya, soal_portal

router = APIRouter()


async def soal_ujian(ujian_id: str, sekarang) -> list:
    """Daftar mapel portal satu ujian pada waktu server `sekarang` (lihat ujian_portal.soal_portal)."""
    docs = await db[KOLEKSI_LINK_SOAL].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(500)
    return soal_portal(docs, await mapel_semua_jenjang(db), await jadwal_ujian(ujian_id), sekarang)


async def portal_berlaku(token: str, request: Optional[Request] = None, catat=True,
                         sesi: Optional[str] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Validator token portal -> (tautan, ujian). 404 token tidak dikenal; 403 { alasan, pesan, mulai_at, selesai_at,
    madrasah, jadwal_berikutnya } bila portal ditutup admin / di luar masa ujian (jadwal_berikutnya None bila sudah
    berakhir atau jadwal belum disusun)."""
    try:
        return await tautan_berlaku(token, 'portal', request, catat=catat, sesi=sesi)
    except HTTPException as e:
        if e.status_code == 403 and isinstance(e.detail, dict):
            tautan = await cari_tautan(db, token, 'portal')
            berikut = None
            if tautan and e.detail.get('alasan') != 'sudah_selesai':
                kini = sekarang_wib()
                berikut = jadwal_berikutnya(await soal_ujian(tautan['ujian_id'], kini), kini)
            e.detail = {**e.detail, 'jadwal_berikutnya': berikut}
        raise


@router.get("/publik/portal-ujian/{token}")
async def portal_ujian_publik(token: str, request: Request, response: Response, segarkan: bool = Query(False),
                              sesi: Optional[str] = Query(None, max_length=40)):
    """Portal ujian (tanpa login): madrasah, ujian, jendela tautan portal, waktu server, mapel baku per jenjang, dan
    `soal` — jadwal tiap mapel dengan status (belum_dimulai/berlangsung/ditutup menurut waktu server), siap/ditahan,
    dan penghitung klik. Tanpa tautan soal."""
    tautan, ujian = await portal_berlaku(token, request, catat=not segarkan, sesi=sesi)
    if segarkan:
        await catat_segarkan(db, tautan, sesi)
    kini = sekarang_wib()
    response.headers.update(TANPA_CACHE)
    return {
        'madrasah': await madrasah_publik(),
        'ujian': {k: ujian.get(k) for k in ('nama', 'jenis', 'tahun_pelajaran', 'mulai', 'selesai')},
        'tautan': {'jenis': tautan['jenis'], 'mulai_at': tautan.get('mulai_at'), 'selesai_at': tautan.get('selesai_at')},
        'waktu_server': kini.isoformat(),
        'mapel': await mapel_semua_jenjang(db),
        'soal': await soal_ujian(ujian['id'], kini),
    }
