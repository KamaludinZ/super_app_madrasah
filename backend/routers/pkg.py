"""API modul PKG (Penilaian Kinerja Guru). Akses dibatasi keanggotaan SK aktif (lihat pkg_akses)."""
from typing import Dict

from fastapi import APIRouter, Depends

from core import db, get_current_user
from pkg_akses import keanggotaan_sk, wajib_anggota_sk

router = APIRouter()


@router.get("/pkg/sk/my-membership")
async def keanggotaan_saya(user: Dict = Depends(get_current_user)):
    """Keanggotaan pengguna pada SK aktif untuk penjaga menu/halaman frontend.
    Selalu 200; non-anggota mendapat `anggota: false` + `penolakan` (alasan & pesan)."""
    return await keanggotaan_sk(db, user)


@router.get("/pkg/beranda")
async def beranda_pkg(user: Dict = Depends(get_current_user)):
    """Data Beranda PKG. Non-anggota SK aktif ditolak 403 {'alasan': 'bukan_anggota_sk', 'pesan'}."""
    k = await wajib_anggota_sk(db, user)
    return {'periode': k['periode'], 'keanggotaan': {kunci: v for kunci, v in k.items() if kunci not in ('periode', 'penolakan')}}
