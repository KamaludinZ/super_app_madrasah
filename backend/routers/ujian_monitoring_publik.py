"""API publik TANPA login halaman Monitoring Pengumpulan berkas ujian (kisi-kisi & kartu soal).

Akses hanya lewat token tautan acak jenis `monitoring` (ujian_tautan_publik), melewati Validator Token + Jendela Waktu
yang sama dengan halaman info (routers.ujian_info_publik.tautan_berlaku). Respons hanya berisi STATUS per jenjang per
mapel baku, nama guru PJ, dan waktu update — isi kartu soal (rahasia) tidak pernah dikirim dan tidak ada jalur unduh
di sini. Kontrak sama dengan frontend/src/lib/ujianMonitoringPublik.js.

Pembukaan halaman dicatat ke ujian_akses_log (satu entri per pembukaan, dengan id `sesi` acak dari klien). Muat ulang
otomatis (?segarkan=1, tiap menit) tidak menambah entri: entri pembukaan sesi itu diperbarui (terakhir_aktif,
jumlah_segarkan) sehingga lama pemantauan tetap terekam tanpa membanjiri log.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Request, Response

from core import db
from routers.ujian_info_publik import TANPA_CACHE, madrasah_publik, tautan_berlaku
from ujian import sekarang_wib
from ujian_info import JENJANG_UJIAN, KODE_MAPEL, catat_segarkan, mapel_semua_jenjang
from ujian_pengumpulan import agregasi_pengumpulan, ringkas_jenjang

router = APIRouter()


@router.get("/publik/monitoring-ujian/{token}")
async def monitoring_ujian_publik(token: str, request: Request, response: Response, segarkan: bool = Query(False),
                                  sesi: Optional[str] = Query(None, max_length=40), jenjang: Optional[int] = Query(None),
                                  mapel: Optional[str] = Query(None, max_length=40)):
    """Status pengumpulan kisi-kisi & kartu soal satu ujian (tanpa login): madrasah, ujian, jendela tautan, waktu server,
    daftar berkas terkirim { jenis, jenjang, mapel, guru_pj_nama, updated_at } untuk mapel baku aktif, dan ringkasan per
    jenjang { total, kisi_kisi, kartu_soal, lengkap }. Saringan opsional: ?jenjang=7|8|9 dan/atau ?mapel=<kode baku>
    (berkas & ringkasan ikut tersaring; nilai yang tidak dikenal -> 422)."""
    tautan, ujian = await tautan_berlaku(token, 'monitoring', request, catat=not segarkan, sesi=sesi)
    if jenjang is not None and jenjang not in JENJANG_UJIAN:
        raise HTTPException(422, 'Jenjang harus 7, 8, atau 9.')
    if mapel and mapel not in KODE_MAPEL:
        raise HTTPException(422, 'Mata pelajaran tidak dikenal. Pakai kode dari daftar 15 mapel baku.')
    if segarkan:
        await catat_segarkan(db, tautan, sesi)
    agregasi = await agregasi_pengumpulan(db, ujian['id'])
    jenjang_tampil = [jenjang] if jenjang is not None else list(JENJANG_UJIAN)
    berkas = [b for b in agregasi['berkas'] if b['jenjang'] in jenjang_tampil and (not mapel or b['mapel'] == mapel)]
    ringkasan = {str(j): ringkas_jenjang([b for b in agregasi['jenjang'][str(j)]['baris'] if not mapel or b['kode'] == mapel])
                 for j in jenjang_tampil}
    response.headers.update(TANPA_CACHE)
    return {
        'madrasah': await madrasah_publik(),
        'ujian': {k: ujian.get(k) for k in ('nama', 'jenis', 'tahun_pelajaran', 'mulai', 'selesai')},
        'tautan': {'jenis': tautan['jenis'], 'mulai_at': tautan.get('mulai_at'), 'selesai_at': tautan.get('selesai_at')},
        'waktu_server': sekarang_wib().isoformat(),
        'berkas': berkas,
        'ringkasan': ringkasan,
        'saringan': {'jenjang': jenjang, 'mapel': mapel or None},
        'terakhir': agregasi['terakhir'],
        'mapel': await mapel_semua_jenjang(db),
    }
