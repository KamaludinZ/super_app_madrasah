"""API rekap hasil penilaian PKG. Cakupan data menurut peran (pkg_rekap.cakupan_rekap): kepala semua guru,
penilai guru yang dinilainya, guru yang dinilai hanya hasilnya sendiri setelah dikunci."""
from typing import Dict, Optional

from fastapi import APIRouter, Depends, Path, Query

from core import db
from pkg_akses import tolak
from pkg_penjaga import penjaga_pkg
from pkg_rekap import boleh_lihat_guru, cakupan_rekap, periode_dan_sk, rincian_guru
from pkg_skema import POLA_ID

router = APIRouter()

anggota_sk = penjaga_pkg('anggota')


@router.get("/pkg/rekap/guru/{guru_id}")
async def rekap_guru_api(
    guru_id: str = Path(..., pattern=POLA_ID),
    periode_id: Optional[str] = Query(None, pattern=POLA_ID),
    akses: Dict = Depends(anggota_sk),
):
    """Rincian rekap satu guru pada periode (bawaan periode berjalan): hasil akhir resmi, isian per sub dengan
    instrumen versi lembar, dan catatan evaluasi. Di luar cakupan pengguna ditolak 403."""
    periode, sk = await periode_dan_sk(db, periode_id)
    cakupan = await cakupan_rekap(db, akses['user'], akses['keanggotaan'], periode)
    rincian = await rincian_guru(db, periode, sk, guru_id)
    if not rincian or not boleh_lihat_guru(cakupan, guru_id, rincian['status'] == 'terkunci'):
        raise tolak('bukan_penugasan', 'Rekap guru ini tidak termasuk dalam cakupan Anda.')
    return rincian
