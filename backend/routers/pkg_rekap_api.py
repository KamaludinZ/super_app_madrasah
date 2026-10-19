"""API rekap hasil penilaian PKG. Cakupan data menurut peran (pkg_rekap.cakupan_rekap): kepala semua guru,
penilai guru yang dinilainya, guru yang dinilai hanya hasilnya sendiri setelah dikunci."""
from typing import Dict, Optional

from fastapi import APIRouter, Depends, Path, Query

from core import db
from pkg_akses import tolak
from pkg_penjaga import penjaga_pkg
from pkg_rekap import (
    boleh_lihat_guru, cakupan_rekap, daftar_periode_rekap, periode_dan_sk, rekap_periode, rekap_tim, rincian_guru,
    statistik_lengkap,
)
from pkg_skema import POLA_ID

router = APIRouter()

# Saringan bersama endpoint rekap: periode_id, atau tahun pelajaran (YYYY/YYYY) & semester -> periode terbaru cocok.
TahunPelajaran = Query(None, pattern=r'^\d{4}/\d{4}$')
Semester = Query(None, max_length=40)

anggota_sk = penjaga_pkg('anggota')


@router.get("/pkg/rekap")
async def rekap_api(periode_id: Optional[str] = Query(None, pattern=POLA_ID), tahun_pelajaran: Optional[str] = TahunPelajaran,
                    semester: Optional[str] = Semester, akses: Dict = Depends(anggota_sk)):
    """Rekap periode (bawaan periode berjalan): ringkasan, statistik, dan nilai per guru dalam cakupan pengguna."""
    return await rekap_periode(db, akses['user'], akses['keanggotaan'], periode_id, tahun_pelajaran, semester)


@router.get("/pkg/rekap/periode")
async def periode_rekap_api(tahun_pelajaran: Optional[str] = TahunPelajaran, semester: Optional[str] = Semester,
                            akses: Dict = Depends(anggota_sk)):
    """Daftar periode untuk saringan rekap (berjalan & ditutup, terbaru dulu)."""
    return await daftar_periode_rekap(db, tahun_pelajaran, semester)


@router.get("/pkg/rekap/tim")
async def rekap_tim_api(periode_id: Optional[str] = Query(None, pattern=POLA_ID), tahun_pelajaran: Optional[str] = TahunPelajaran,
                        semester: Optional[str] = Semester, akses: Dict = Depends(anggota_sk)):
    """Rekap per tim penilai dalam SK periode beserta status supervisi & lembar. Kepala melihat semua tim; penilai
    hanya timnya sendiri; guru yang hanya dinilai ditolak 403."""
    periode, sk = await periode_dan_sk(db, periode_id, tahun_pelajaran, semester)
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
async def statistik_api(periode_id: Optional[str] = Query(None, pattern=POLA_ID), tahun_pelajaran: Optional[str] = TahunPelajaran,
                        semester: Optional[str] = Semester, akses: Dict = Depends(anggota_sk)):
    """Statistik capaian periode dalam cakupan pengguna: rata-rata, median, tertinggi, terendah, sebaran predikat &
    level, sebaran capaian per rentang 10%, dan rata-rata subtotal per kompetensi (lembar terkunci saja)."""
    rekap = await rekap_periode(db, akses['user'], akses['keanggotaan'], periode_id, tahun_pelajaran, semester)
    return {'periode': rekap['periode'], 'cakupan': rekap['cakupan'], 'statistik': statistik_lengkap(rekap['guru'])}


@router.get("/pkg/rekap/guru/{guru_id}")
async def rekap_guru_api(
    guru_id: str = Path(..., pattern=POLA_ID),
    periode_id: Optional[str] = Query(None, pattern=POLA_ID),
    tahun_pelajaran: Optional[str] = TahunPelajaran,
    semester: Optional[str] = Semester,
    akses: Dict = Depends(anggota_sk),
):
    """Rincian rekap satu guru pada periode (bawaan periode berjalan): hasil akhir resmi, isian per sub dengan
    instrumen versi lembar, dan catatan evaluasi. Di luar cakupan pengguna ditolak 403."""
    periode, sk = await periode_dan_sk(db, periode_id, tahun_pelajaran, semester)
    cakupan = await cakupan_rekap(db, akses['user'], akses['keanggotaan'], periode)
    rincian = await rincian_guru(db, periode, sk, guru_id)
    if not rincian or not boleh_lihat_guru(cakupan, guru_id, rincian['status'] == 'terkunci'):
        raise tolak('bukan_penugasan', 'Rekap guru ini tidak termasuk dalam cakupan Anda.')
    return rincian
