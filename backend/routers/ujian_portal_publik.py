"""API publik TANPA login Portal Ujian: jadwal mapel per jenjang dan status tombol "Mengerjakan" menurut waktu server.

Akses hanya lewat token tautan acak jenis `portal` (ujian_tautan_publik) — rute dan token TERPISAH dari halaman info
(`/publik/info-ujian/{token}`): token info tidak membuka portal dan sebaliknya. Validator Token + Jendela Waktu sama
dengan halaman info (ujian_info.cek_tautan), dengan jendela efektif = jendela tautan portal, dan batas yang kosong
diganti MASA UJIAN — di luar itu atau saat ditutup admin permintaan DITOLAK (403) dan halaman tidak dirender; detail
penolakan memuat `jadwal_berikutnya`.

Isolasi data: payload portal tidak memuat kisi-kisi, berkas, tata tertib, monitoring, maupun data pribadi siswa, dan
TIDAK PERNAH memuat `url` tautan soal — tautan soal keluar hanya lewat rute kerjakan
(`/publik/portal-ujian/{token}/kerjakan/{soal_id}`), yang memeriksa portal & jendela mapel menurut waktu server, mencatat
klik ke ujian_akses_log (aksi klik_mengerjakan), menaikkan penghitung klik sah secara atomik, lalu mengalihkan (302). Kontrak sama dengan
frontend/src/lib/ujianPortalPublik.js. Pembukaan dicatat ke ujian_akses_log (aksi buka_tautan; muat ulang otomatis
?segarkan=1 memperbarui entri sesi yang sama, seperti halaman monitoring).
"""
import html
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse

from core import db
from routers.ujian_formulir import jadwal_ujian
from routers.ujian_info_publik import TANPA_CACHE, madrasah_publik
from ujian import KOLEKSI_UJIAN, sekarang_wib
from ujian_info import (
    PESAN_TOKEN, cari_tautan, catat_akses, catat_klik, catat_segarkan, cek_tautan, mapel_semua_jenjang, token_layak,
)
from ujian_portal import (
    FIELD_UJIAN_PUBLIK, KOLEKSI_LINK_SOAL, batas_berikutnya, cek_masa_portal, id_soal_layak, jadwal_berikutnya, naikkan_klik,
    nilai_klik, ringkas_link_log, soal_portal, url_soal_aman,
)

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
        'ujian': {k: ujian.get(k) for k in FIELD_UJIAN_PUBLIK},
        'tautan': {'jenis': tautan['jenis'], 'mulai_at': tautan.get('mulai_at'), 'selesai_at': tautan.get('selesai_at')},  # tanpa token
        'waktu_server': kini.isoformat(),
        'mapel': await mapel_semua_jenjang(db),
        'soal': (soal := await soal_ujian(ujian['id'], kini)),
        'batas_berikutnya_at': batas_berikutnya(soal, kini),
    }


HEADER_KERJAKAN = {'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow'}


def halaman_tolak(status: int, pesan: str) -> HTMLResponse:
    """Jawaban klik yang ditolak: halaman HTML kecil (bukan JSON) karena rute kerjakan dibuka siswa di tab baru."""
    isi = f"""<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer"><meta name="robots" content="noindex,nofollow"><title>Soal belum dapat dibuka</title></head>
<body style="font-family:system-ui,sans-serif;max-width:30rem;margin:3rem auto;padding:0 1rem;color:#0f172a;text-align:center">
<p style="color:#006837;font-weight:600;font-size:.8rem;letter-spacing:.05em;text-transform:uppercase">Portal Ujian</p>
<h1 style="font-size:1.3rem;margin:.25rem 0 .75rem">Soal belum dapat dibuka</h1>
<p>{html.escape(pesan or 'Permintaan ditolak.')}</p>
<p style="color:#64748b;font-size:.85rem">Tutup tab ini, lalu kembali ke portal ujian.</p></body></html>"""
    return HTMLResponse(isi, status_code=status, headers=HEADER_KERJAKAN)


@router.get("/publik/portal-ujian/{token}/kerjakan/{soal_id}")
async def kerjakan_soal(token: str, soal_id: str, request: Request, sesi: Optional[str] = Query(None, max_length=40)):
    """Tombol "Mengerjakan" (tanpa login): portal harus berlaku (token, sakelar, masa ujian) dan mapel siap & sedang
    berlangsung menurut WAKTU SERVER. Klik dicatat ke ujian_akses_log (aksi klik_mengerjakan, sah maupun ditolak). Klik
    sah menaikkan jumlah_klik & klik_terakhir_at secara atomik lalu dialihkan 302 ke tautan soal (Referrer-Policy:
    no-referrer). Klik yang ditolak tidak dihitung dan dijawab halaman HTML berisi alasannya (403/404)."""
    try:
        tautan, ujian = await portal_berlaku(token, request, catat=False)
    except HTTPException as e:
        if token_layak(token):
            if isinstance(e.detail, dict):  # portal dikenal tetapi ditutup / di luar masa ujian
                await catat_klik(db, await cari_tautan(db, token, 'portal'), token, None, e.detail.get('alasan'), request, sesi=sesi)
            else:  # token tidak dikenal: pencatat akses menggabungkan tebakan token dari IP yang sama
                await catat_akses(db, None, token, 'tidak_dikenal', request)
        pesan = e.detail.get('pesan') if isinstance(e.detail, dict) else e.detail
        return halaman_tolak(e.status_code, pesan)
    doc = await db[KOLEKSI_LINK_SOAL].find_one({'id': soal_id, 'ujian_id': ujian['id']}, {'_id': 0}) if id_soal_layak(soal_id) else None
    kini = sekarang_wib()
    nilai = nilai_klik(doc, kini)
    await catat_klik(db, tautan, token, ringkas_link_log(doc), nilai['hasil'], request, sesi=sesi, waktu=kini)
    tujuan = url_soal_aman((doc or {}).get('url'))
    if nilai['hasil'] != 'ok' or not tujuan:
        return halaman_tolak(nilai['status_http'] if nilai['hasil'] != 'ok' else 403, nilai['pesan'])
    await naikkan_klik(db, doc['id'], kini)
    return RedirectResponse(tujuan, status_code=302, headers=HEADER_KERJAKAN)
