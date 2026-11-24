"""API publik TANPA login halaman Info Ujian untuk siswa: jadwal, tata tertib, panduan CBT, dan kisi-kisi per jenjang.

Akses hanya lewat token tautan acak jenis `info` (ujian_tautan_publik). Setiap permintaan melewati Validator Token +
Jendela Waktu (ujian_info.cek_tautan) — satu-satunya jalur tanpa sesi — dan setiap pembukaan halaman dicatat ke
ujian_akses_log (berhasil maupun ditolak). Data ke publik dibatasi: tanpa lokasi berkas, tanpa identitas pengunggah,
dan tanpa kartu soal (rahasia). Kontrak respons sama dengan frontend/src/lib/ujianInfoPublik.js.
"""
import os
from typing import Any, Dict, List, Optional, Tuple, Union

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import FileResponse

from core import db, get_settings
from routers.ujian_formulir import jadwal_ujian
from ujian import KOLEKSI_UJIAN, sekarang_wib
from ujian_info import (
    KOLEKSI_BERKAS, KOLEKSI_INFO_KONTEN, PESAN_TOKEN, SUBFOLDER_BERKAS, SUBFOLDER_INFO, boleh_unduh_publik, catat_akses, catat_unduh, cari_tautan,
    cek_tautan, jalur_tautan, jalur_unggahan, mapel_jenjang, mapel_semua_jenjang, nama_mapel, ringkas_konten_publik, tambah_jumlah_unduh,
    token_layak,
)

router = APIRouter()

TANPA_CACHE = {'Cache-Control': 'no-store'}  # status tautan bisa berubah kapan saja (buka/tutup admin)


async def madrasah_publik() -> Dict[str, Any]:
    s = await get_settings()
    return {'nama': s.get('school_name'), 'logo_url': s.get('logo_url')}


async def tautan_berlaku(token: str, jenis: str, request: Optional[Request] = None,
                         catat: Union[bool, str] = True, sesi: Optional[str] = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Validator Token + Jendela Waktu untuk rute publik -> (tautan, ujian).
    404 bila token tidak dikenal (atau ujiannya sudah tidak ada); 403 { alasan, pesan, mulai_at, selesai_at, madrasah }
    bila tautan ditutup / di luar jendela waktu. Pencatatan ke ujian_akses_log untuk token berbentuk sah:
    catat=True semua percobaan (pembukaan halaman), 'gagal' hanya yang ditolak (unduhan — yang berhasil dicatat di
    ujian_unduh_log), False tidak dicatat."""
    tautan = await cari_tautan(db, token, jenis)
    ujian = await db[KOLEKSI_UJIAN].find_one({'id': tautan['ujian_id']}, {'_id': 0}) if tautan else None
    if not ujian:
        tautan = None
    cek = cek_tautan(tautan, sekarang_wib())
    if token_layak(token) and (catat is True or (catat == 'gagal' and not cek['berlaku'])):
        await catat_akses(db, tautan, token, cek['alasan'], request, sesi=sesi)
    if cek['alasan'] == 'tidak_dikenal':
        raise HTTPException(404, PESAN_TOKEN, headers=TANPA_CACHE)
    if not cek['berlaku']:
        raise HTTPException(403, {k: cek[k] for k in ('alasan', 'pesan', 'mulai_at', 'selesai_at')} | {'madrasah': await madrasah_publik()},
                            headers=TANPA_CACHE)
    return tautan, ujian


async def kisi_kisi_publik(ujian_id: str) -> List[Dict[str, Any]]:
    """Kisi-kisi terkirim untuk mapel baku aktif tiap jenjang, urut jenjang lalu urutan mapel baku. Kartu soal TIDAK
    pernah ikut; field dibatasi (tanpa nama_berkas/pengunggah)."""
    docs = await db[KOLEKSI_BERKAS].find({'ujian_id': ujian_id, 'jenis': 'kisi_kisi', 'status': 'terkirim'}, {'_id': 0}).to_list(500)
    hasil = []
    for jenjang in sorted({d.get('jenjang') for d in docs if d.get('jenjang') in (7, 8, 9)}):
        urutan = {m['kode']: m['urutan'] for m in await mapel_jenjang(db, jenjang)}
        for d in sorted((d for d in docs if d.get('jenjang') == jenjang and d.get('mapel') in urutan), key=lambda d: urutan[d['mapel']]):
            hasil.append({'id': d['id'], 'jenjang': jenjang, 'mapel': d['mapel'], 'nama_file': d.get('nama_file'),
                          'ukuran_byte': d.get('ukuran_byte'), 'updated_at': d.get('updated_at'), 'jumlah_unduh': int(d.get('jumlah_unduh') or 0)})
    return hasil


@router.get("/publik/info-ujian/{token}")
async def info_ujian_publik(token: str, request: Request, response: Response):
    """Halaman info ujian untuk siswa (tanpa login): madrasah, ujian, jendela tautan, jadwal semua jenjang, tata tertib,
    panduan CBT, dan daftar kisi-kisi + jumlah unduhan. Pembukaan tautan dicatat ke ujian_akses_log."""
    tautan, ujian = await tautan_berlaku(token, 'info', request)
    konten = await db[KOLEKSI_INFO_KONTEN].find_one({'ujian_id': ujian['id']}, {'_id': 0})
    response.headers.update(TANPA_CACHE)
    return {
        'madrasah': await madrasah_publik(),
        'ujian': {k: ujian.get(k) for k in ('nama', 'jenis', 'tahun_pelajaran', 'mulai', 'selesai')},
        'tautan': {'jenis': tautan['jenis'], 'mulai_at': tautan.get('mulai_at'), 'selesai_at': tautan.get('selesai_at')},
        'jadwal': await jadwal_ujian(ujian['id']),
        **ringkas_konten_publik(konten),
        'kisi_kisi': await kisi_kisi_publik(ujian['id']),
        'mapel': await mapel_semua_jenjang(db),
    }


@router.get("/publik/info-ujian/{token}/panduan-cbt")
async def panduan_cbt_publik(token: str, request: Request):
    """PDF panduan CBT (dibuka inline di tab baru). Tautan tetap divalidasi; dicatat sebagai unduhan publik
    (jenis_berkas 'panduan_cbt') di ujian_unduh_log, bukan sebagai pembukaan halaman."""
    tautan, ujian = await tautan_berlaku(token, 'info', request, catat='gagal')
    konten = await db[KOLEKSI_INFO_KONTEN].find_one({'ujian_id': ujian['id']}, {'_id': 0, 'panduan_pdf': 1})
    pdf = (konten or {}).get('panduan_pdf') or {}
    jalur = jalur_unggahan(SUBFOLDER_INFO, pdf.get('nama_berkas')) if pdf.get('nama_berkas') else None
    if not jalur or not os.path.isfile(jalur):
        raise HTTPException(404, "Panduan CBT belum tersedia.")
    await catat_unduh(db, {'id': None, 'ujian_id': ujian['id'], 'jenis': 'panduan_cbt'}, 'publik', request, tautan=tautan)
    return FileResponse(jalur, media_type='application/pdf', filename=pdf.get('nama_file') or 'Panduan CBT.pdf',
                        content_disposition_type='inline', headers=TANPA_CACHE)


PESAN_KISI_TIDAK_ADA = 'Kisi-kisi ini tidak ditemukan atau sudah diganti. Muat ulang halaman untuk daftar terbaru.'


@router.get("/publik/info-ujian/{token}/kisi-kisi/{berkas_id}")
async def unduh_kisi_kisi_publik(token: str, berkas_id: str, request: Request):
    """Unduh satu kisi-kisi (PDF, attachment) lewat tautan info. Hanya berkas jenis kisi-kisi yang terkirim pada ujian
    tautan itu dan mapel baku aktif — kartu soal (rahasia) tidak pernah dapat diunduh di sini. Setiap unduhan menambah
    penghitung `jumlah_unduh` secara atomik (dikirim balik lewat header X-Jumlah-Unduh) dan dicatat ke ujian_unduh_log
    (mode 'publik'); percobaan dengan tautan yang ditolak dicatat ke ujian_akses_log."""
    tautan, ujian = await tautan_berlaku(token, 'info', request, catat='gagal')
    b = await db[KOLEKSI_BERKAS].find_one({'id': berkas_id, 'ujian_id': ujian['id']}, {'_id': 0}) if berkas_id and len(berkas_id) <= 64 else None
    if b and b.get('jenis') == 'kartu_soal':
        # Kartu soal rahasia: jawaban sama persis dengan "tidak ditemukan" (keberadaannya tidak dibocorkan), tetapi
        # percobaannya dicatat agar admin dapat menutup tautan bila ada akses mencurigakan.
        await catat_akses(db, tautan, token, 'kartu_soal_ditolak', request)
        b = None
    if not boleh_unduh_publik(b):
        b = None
    if b and (b.get('jenjang') not in (7, 8, 9) or b.get('mapel') not in {m['kode'] for m in await mapel_jenjang(db, b['jenjang'])}):
        b = None  # mapel di luar daftar baku aktif tidak ditampilkan, jadi juga tidak dapat diunduh
    jalur = jalur_unggahan(SUBFOLDER_BERKAS, b['nama_berkas']) if b and b.get('nama_berkas') else None
    if not jalur or not os.path.isfile(jalur):
        raise HTTPException(404, PESAN_KISI_TIDAK_ADA, headers=TANPA_CACHE)
    jumlah = await tambah_jumlah_unduh(db, b['id'])
    await catat_unduh(db, b, 'publik', request, tautan=tautan)
    nama = b.get('nama_file') or f"Kisi-kisi {nama_mapel(b['mapel'])} Kelas {b['jenjang']}.pdf"
    return FileResponse(jalur, media_type='application/pdf', filename=nama,
                        headers={**TANPA_CACHE, 'X-Jumlah-Unduh': str(jumlah)})


@router.get("/publik/tautan/{token}")
async def validasi_tautan_publik(token: str, request: Request, response: Response):
    """Validasi akses satu token tautan publik (jenis apa pun) TANPA memuat isi halaman — dipakai tautan pendek
    /publik/t/:token untuk mengarahkan ke halaman yang tepat. -> { jenis, berlaku, alasan, pesan, mulai_at, selesai_at,
    jalur, madrasah }. 404 bila token tidak dikenal. Tidak membocorkan data ujian; percobaan yang ditolak dicatat ke
    ujian_akses_log (pembukaan yang berhasil dicatat oleh halaman tujuannya)."""
    tautan = await cari_tautan(db, token)
    ujian = await db[KOLEKSI_UJIAN].find_one({'id': tautan['ujian_id']}, {'_id': 0, 'id': 1}) if tautan else None
    if not ujian:
        tautan = None
    cek = cek_tautan(tautan, sekarang_wib())
    if token_layak(token) and not cek['berlaku']:
        await catat_akses(db, tautan, token, cek['alasan'], request)
    if cek['alasan'] == 'tidak_dikenal':
        raise HTTPException(404, PESAN_TOKEN, headers=TANPA_CACHE)
    response.headers.update(TANPA_CACHE)
    return {'jenis': tautan['jenis'], 'jalur': jalur_tautan(tautan), 'madrasah': await madrasah_publik(),
            **{k: cek[k] for k in ('berlaku', 'alasan', 'pesan', 'mulai_at', 'selesai_at')}}
