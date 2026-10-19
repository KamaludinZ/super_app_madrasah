"""API penilaian kinerja oleh penilai: daftar tugas dan lembar penilaian.

Syarat akses 'penilai' (pkg_akses): anggota tim penilai yang sudah disupervisi kepala madrasah; kepala selalu lolos.
"""
from typing import Dict

from fastapi import APIRouter, Depends, Path

from core import db
from pkg_akses import sk_aktif
from pkg_beranda import tugas_penilaian_saya
from pkg_instrumen import instrumen_aktif
from pkg_lembar import konteks_lembar, lembar_tampil
from pkg_penjaga import penjaga_pkg
from pkg_skema import POLA_ID

router = APIRouter()

penilai = penjaga_pkg('penilai')


@router.get("/pkg/penilaian/tugas")
async def daftar_tugas_api(akses: Dict = Depends(penilai)):
    """Tugas penilaian pengguna pada periode berjalan: guru yang dibagikan + status/progres lembar, ringkasan
    jumlah per status, instrumen acuan aktif, dan apakah lembar dapat diisi saat ini (masa penilaian & instrumen)."""
    periode, sk = await sk_aktif(db)
    tugas = await tugas_penilaian_saya(db, akses['user'], periode, sk)
    aktif = await instrumen_aktif(db)
    k = akses['keanggotaan']
    alasan = None if k.get('dalam_masa_penilaian') else 'di_luar_masa'
    if not aktif:
        alasan = alasan or 'instrumen_belum_ada'
    ringkasan = {'total': len(tugas), 'belum': 0, 'draf': 0, 'terkunci': 0}
    for t in tugas:
        ringkasan[t['status']] += 1
    return {
        'periode': k.get('periode'),
        'instrumen': {key: aktif.get(key) for key in ('id', 'versi_template', 'revisi', 'cocok_resmi')} if aktif else None,
        'dapat_diisi': alasan is None,
        'alasan_tidak_dapat_diisi': alasan,
        'ringkasan': ringkasan,
        'tugas': tugas,
    }


@router.get("/pkg/penilaian/lembar/{guru_id}")
async def buka_lembar_api(guru_id: str = Path(..., pattern=POLA_ID), akses: Dict = Depends(penilai)):
    """Buka lembar penilaian guru yang dibagikan kepada penilai: isian tersimpan (bila ada), instrumen yang berlaku
    (versi saat lembar dibuat, atau instrumen aktif untuk lembar baru), identitas guru, dan status dapat diisi.
    Lembar baru belum disimpan sampai draf pertama. 403 'bukan_penugasan' bila guru tidak dibagikan."""
    ktx = await konteks_lembar(db, akses['user'], akses['keanggotaan'], guru_id)
    return await lembar_tampil(db, ktx, guru_id)
