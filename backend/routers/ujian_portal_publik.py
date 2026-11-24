"""API publik TANPA login Portal Ujian: jadwal mapel per jenjang dan status tombol "Mengerjakan" menurut waktu server.

Akses hanya lewat token tautan acak jenis `portal` (ujian_tautan_publik) — rute dan token TERPISAH dari halaman info
(`/publik/info-ujian/{token}`): token info tidak membuka portal dan sebaliknya. Validator Token + Jendela Waktu sama
dengan halaman info (ujian_info.cek_tautan), dengan jendela efektif = jendela tautan portal, dan batas yang kosong
diganti MASA UJIAN — di luar itu atau saat ditutup admin permintaan DITOLAK (403) dan halaman tidak dirender; detail
penolakan memuat `jadwal_berikutnya`.

Isolasi data: payload portal tidak memuat kisi-kisi, berkas, tata tertib, monitoring, maupun data pribadi siswa, dan
TIDAK PERNAH memuat `url` tautan soal (keluar hanya lewat rute kerjakan saat mapel berlangsung). Kontrak sama dengan
frontend/src/lib/ujianPortalPublik.js. Pembukaan dicatat ke ujian_akses_log (aksi buka_tautan; muat ulang otomatis
?segarkan=1 memperbarui entri sesi yang sama, seperti halaman monitoring).
"""
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query, Request, Response

from core import db
from routers.ujian_formulir import jadwal_ujian
from routers.ujian_info_publik import TANPA_CACHE, madrasah_publik
from ujian import KOLEKSI_UJIAN, sekarang_wib
from ujian_info import PESAN_TOKEN, cari_tautan, catat_akses, catat_segarkan, cek_tautan, mapel_semua_jenjang, token_layak
from ujian_portal import KOLEKSI_LINK_SOAL, batas_berikutnya, cek_masa_portal, jadwal_berikutnya, soal_portal

router = APIRouter()


async def soal_ujian(ujian_id: str, sekarang) -> list:
    """Daftar mapel portal satu ujian pada waktu server `sekarang` (lihat ujian_portal.soal_portal)."""
    docs = await db[KOLEKSI_LINK_SOAL].find({'ujian_id': ujian_id}, {'_id': 0}).to_list(500)
    return soal_portal(docs, await mapel_semua_jenjang(db), await jadwal_ujian(ujian_id), sekarang)


async def portal_berlaku(token: str, request: Optional[Request] = None, catat=True,
                         sesi: Optional[str] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Validator token + MASA UJIAN portal -> (tautan, ujian). Sama dengan tautan_berlaku halaman info, ditambah: batas
    jendela tautan portal yang kosong diganti masa ujian (ujian_portal.jendela_portal) sehingga di luar masa ujian portal
    selalu ditolak di server. 404 token tidak dikenal; 403 { alasan, pesan, mulai_at, selesai_at, madrasah,
    jadwal_berikutnya } bila ditutup admin / di luar jendela (jadwal_berikutnya None bila sudah berakhir atau jadwal
    belum disusun). Setiap percobaan ber-token sah dicatat sekali dengan hasil akhirnya (catat=False: tidak dicatat)."""
    tautan = await cari_tautan(db, token, 'portal')
    ujian = await db[KOLEKSI_UJIAN].find_one({'id': tautan['ujian_id']}, {'_id': 0}) if tautan else None
    if not ujian:
        tautan = None
    kini = sekarang_wib()
    cek = cek_masa_portal(tautan, ujian, kini) if tautan else cek_tautan(None, kini)
    if catat and token_layak(token):
        await catat_akses(db, tautan, token, cek['alasan'], request, sesi=sesi)
    if cek['alasan'] == 'tidak_dikenal':
        raise HTTPException(404, PESAN_TOKEN, headers=TANPA_CACHE)
    if not cek['berlaku']:
        berikut = None if cek['alasan'] == 'sudah_selesai' else jadwal_berikutnya(await soal_ujian(ujian['id'], kini), kini)
        raise HTTPException(403, {k: cek[k] for k in ('alasan', 'pesan', 'mulai_at', 'selesai_at')}
                            | {'madrasah': await madrasah_publik(), 'jadwal_berikutnya': berikut}, headers=TANPA_CACHE)
    return tautan, ujian


@router.get("/publik/portal-ujian/{token}")
async def portal_ujian_publik(token: str, request: Request, response: Response, segarkan: bool = Query(False),
                              sesi: Optional[str] = Query(None, max_length=40)):
    """Portal ujian (tanpa login): madrasah, ujian, jendela tautan portal, waktu server, mapel baku per jenjang,
    `soal` — jadwal tiap mapel dengan status (belum_dimulai/berlangsung/ditutup) & hitung mundur menurut WAKTU SERVER,
    siap/ditahan, dan penghitung klik — serta `batas_berikutnya_at` (perubahan status terdekat). Tanpa tautan soal."""
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
        'soal': (soal := await soal_ujian(ujian['id'], kini)),
        'batas_berikutnya_at': batas_berikutnya(soal, kini),
    }
