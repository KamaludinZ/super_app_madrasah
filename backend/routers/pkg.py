"""API modul PKG (Penilaian Kinerja Guru). Akses dibatasi keanggotaan SK aktif (lihat pkg_akses)."""
from typing import Dict

from fastapi import APIRouter, Depends

from core import db, get_current_user
from pkg_akses import keanggotaan_sk, sk_aktif, wajib_anggota_sk
from pkg_beranda import ringkasan_kinerja, tugas_penilaian_saya

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
    periode, sk = await sk_aktif(db)
    return {
        'periode': k['periode'],
        'keanggotaan': {kunci: v for kunci, v in k.items() if kunci not in ('periode', 'penolakan')},
        'ringkasan': await ringkasan_kinerja(db, sk),
        'tugas': await tugas_penilaian_saya(db, user, periode, sk),
    }


@router.get("/pkg/beranda/ringkasan")
async def ringkasan_beranda(user: Dict = Depends(get_current_user)):
    """Ringkasan Kinerja periode berjalan: {total, selesai, sedang, belum} guru dinilai pada SK aktif."""
    await wajib_anggota_sk(db, user)
    _, sk = await sk_aktif(db)
    return await ringkasan_kinerja(db, sk)


@router.get("/pkg/beranda/tugas-saya")
async def tugas_saya(user: Dict = Depends(get_current_user)):
    """Tugas Penilaian Saya: guru yang dibagikan kepada pengguna pada periode berjalan, beserta status lembar.
    Anggota yang hanya dinilai mendapat daftar kosong; status supervisi ada di /pkg/sk/my-membership."""
    await wajib_anggota_sk(db, user)
    periode, sk = await sk_aktif(db)
    return await tugas_penilaian_saya(db, user, periode, sk)
