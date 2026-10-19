"""API rekap hasil penilaian PKG.

Kontrol akses (penjaga `akses_rekap`): pengguna harus personil PKG pada PERIODE YANG DIPILIH — kepala madrasah,
tercantum di SK periode itu, atau tercatat di penugasan/lembarnya (sehingga rekap periode lama tetap terbuka bagi
personilnya walau SK aktif sekarang berbeda). Penolakan 403 {'alasan': 'bukan_anggota_sk'} tercatat di audit.
Cakupan data menurut peran (pkg_rekap.cakupan_rekap): kepala semua guru, penilai guru yang dinilainya, guru yang
dinilai hanya hasilnya sendiri setelah dikunci."""
from typing import Dict, Optional

from fastapi import APIRouter, Depends, Path, Query, Request

from core import db, get_current_user
from pkg_akses import keanggotaan_sk, tolak
from pkg_penjaga import penjaga_pkg
from pkg_audit import AKSI_TOLAK_AKSES, catat_audit_pkg, catat_audit_pkg_harian
from pkg_rekap import (
    anggota_periode, bangun_ulang_rekap, boleh_lihat_guru, cakupan_rekap, riwayat_unduhan, daftar_periode_rekap, periode_dan_sk, rekap_periode, rekap_tim, rincian_guru,
    statistik_lengkap,
)
from pkg_skema import POLA_ID

router = APIRouter()

# Saringan bersama endpoint rekap: periode_id, atau tahun pelajaran (YYYY/YYYY) & semester -> periode terbaru cocok.
TahunPelajaran = Query(None, pattern=r'^\d{4}/\d{4}$')
Semester = Query(None, max_length=40)


async def akses_rekap(
    request: Request,
    periode_id: Optional[str] = Query(None, pattern=POLA_ID),
    tahun_pelajaran: Optional[str] = TahunPelajaran,
    semester: Optional[str] = Semester,
    user: Dict = Depends(get_current_user),
) -> Dict:
    """Penjaga rekap: tentukan periode dari saringan, lalu wajibkan keanggotaan PKG pada periode tersebut."""
    periode, sk = await periode_dan_sk(db, periode_id, tahun_pelajaran, semester)
    if not await anggota_periode(db, user, periode, sk):
        endpoint = request.url.path if request is not None else 'rekap'
        await catat_audit_pkg_harian(db, AKSI_TOLAK_AKSES, user, kunci=f'{endpoint}:bukan_anggota_sk',
                                     metadata={'endpoint': endpoint, 'alasan': 'bukan_anggota_sk', 'periode_id': periode['id']},
                                     request=request)
        raise tolak('bukan_anggota_sk', 'Anda tidak termasuk personil PKG pada periode ini.')
    k = await keanggotaan_sk(db, user)
    # Akses rekap dicatat harian per pengguna/endpoint/periode (bukan setiap muat ulang).
    endpoint = request.url.path if request is not None else 'rekap'
    await catat_audit_pkg_harian(db, 'lihat_rekap', user, kunci=f"{endpoint}:{periode['id']}",
                                 metadata={'endpoint': endpoint, 'periode_id': periode['id']}, request=request)
    return {'user': user, 'keanggotaan': k, 'periode': periode, 'sk': sk}


kepala = penjaga_pkg('kepala')


@router.get("/pkg/rekap")
async def rekap_api(akses: Dict = Depends(akses_rekap)):
    """Rekap periode (`periode_id`, atau `tahun_pelajaran`/`semester`, bawaan periode berjalan): ringkasan,
    statistik, dan nilai per guru dalam cakupan pengguna."""
    return await rekap_periode(db, akses['user'], akses['keanggotaan'], akses['periode'], akses['sk'])


@router.get("/pkg/rekap/periode")
async def periode_rekap_api(tahun_pelajaran: Optional[str] = TahunPelajaran, semester: Optional[str] = Semester,
                            user: Dict = Depends(get_current_user)):
    """Daftar periode untuk saringan rekap (berjalan & ditutup, terbaru dulu) — hanya periode tempat pengguna
    menjadi personil PKG (kepala melihat semua)."""
    hasil = []
    for p in await daftar_periode_rekap(db, tahun_pelajaran, semester):
        periode, sk = await periode_dan_sk(db, p['id'])
        if await anggota_periode(db, user, periode, sk):
            hasil.append(p)
    return hasil


@router.get("/pkg/rekap/tim")
async def rekap_tim_api(akses: Dict = Depends(akses_rekap)):
    """Rekap per tim penilai dalam SK periode beserta status supervisi & lembar. Kepala melihat semua tim; penilai
    hanya timnya sendiri; guru yang hanya dinilai ditolak 403."""
    periode, sk = akses['periode'], akses['sk']
    cakupan = await cakupan_rekap(db, akses['user'], akses['keanggotaan'], periode)
    if cakupan['cakupan'] == 'pribadi':
        raise tolak('bukan_penilai', 'Rekap tim hanya untuk kepala madrasah dan tim penilai.')
    penilai = None if cakupan['cakupan'] == 'semua' else akses['user']['id']
    return {
        'periode': {k: periode.get(k) for k in ('id', 'nama_periode', 'status')},
        'sk': {'id': sk['id'], 'nomor_sk': sk.get('nomor_sk')} if sk else None,
        'tim': await rekap_tim(db, periode, sk, penilai),
    }


@router.get("/pkg/rekap/statistik")
async def statistik_api(akses: Dict = Depends(akses_rekap)):
    """Statistik capaian periode dalam cakupan pengguna: rata-rata, median, tertinggi, terendah, sebaran predikat &
    level, sebaran capaian per rentang 10%, dan rata-rata subtotal per kompetensi (lembar terkunci saja)."""
    rekap = await rekap_periode(db, akses['user'], akses['keanggotaan'], akses['periode'], akses['sk'])
    return {'periode': rekap['periode'], 'cakupan': rekap['cakupan'], 'statistik': statistik_lengkap(rekap['guru'])}


@router.get("/pkg/rekap/guru/{guru_id}")
async def rekap_guru_api(guru_id: str = Path(..., pattern=POLA_ID), akses: Dict = Depends(akses_rekap)):
    """Rincian rekap satu guru pada periode: hasil akhir resmi, isian per sub dengan instrumen versi lembar, dan
    catatan evaluasi. Di luar cakupan pengguna ditolak 403."""
    periode, sk = akses['periode'], akses['sk']
    cakupan = await cakupan_rekap(db, akses['user'], akses['keanggotaan'], periode)
    rincian = await rincian_guru(db, periode, sk, guru_id)
    if not rincian or not boleh_lihat_guru(cakupan, guru_id, rincian['status'] == 'terkunci'):
        raise tolak('bukan_penugasan', 'Rekap guru ini tidak termasuk dalam cakupan Anda.')
    await catat_audit_pkg_harian(db, 'lihat_rekap_guru', akses['user'], kunci=f"{periode['id']}:{guru_id}",
                                 metadata={'periode_id': periode['id'], 'guru_id': guru_id})
    return rincian



@router.post("/pkg/rekap/hitung-ulang")
async def hitung_ulang_api(request: Request, periode_id: str = Query(..., pattern=POLA_ID), akses: Dict = Depends(kepala)):
    """Bangun ulang rekap satu periode dari lembar terkunci (kepala madrasah), mis. setelah perbaikan data."""
    periode, _ = await periode_dan_sk(db, periode_id)
    hasil = await bangun_ulang_rekap(db, periode['id'])
    await catat_audit_pkg(db, 'rekap_hitung_ulang', akses['user'], {'periode_id': periode['id'], **hasil}, request=request)
    return hasil


@router.get("/pkg/rekap/unduhan")
async def riwayat_unduhan_api(periode_id: Optional[str] = Query(None, pattern=POLA_ID), akses: Dict = Depends(kepala)):
    """Riwayat unduhan & cetak dokumen PKG (siapa, kapan, berkas, format, versi template), terbaru dulu."""
    return await riwayat_unduhan(db, periode_id)
