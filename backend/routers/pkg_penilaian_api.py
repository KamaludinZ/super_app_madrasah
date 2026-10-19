"""API penilaian kinerja oleh penilai: daftar tugas dan lembar penilaian.

Syarat akses 'penilai' (pkg_akses): anggota tim penilai yang sudah disupervisi kepala madrasah; kepala selalu lolos.
"""
from typing import Dict

from fastapi import APIRouter, Depends, Path, Request

from core import db
from pkg_akses import sk_aktif
from pkg_beranda import tugas_penilaian_saya
from pkg_instrumen import instrumen_aktif
from pkg_audit import catat_audit_pkg, catat_audit_pkg_harian
from pkg_lembar import kirim_dan_kunci, konteks_lembar, lembar_tampil, simpan_draf
from pkg_penjaga import penjaga_pkg
from pkg_skema import POLA_ID, DrafPenilaianRequest, KirimPenilaianRequest

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


@router.post("/pkg/penilaian/draft")
async def simpan_draf_api(data: DrafPenilaianRequest, request: Request, akses: Dict = Depends(penilai)):
    """Simpan draf lembar (otomatis/berkala). Lembar dibuat saat draf pertama dengan instrumen aktif.
    Ditolak bila lembar terkunci (409) atau di luar masa penilaian (403 di_luar_masa)."""
    ktx = await konteks_lembar(db, akses['user'], akses['keanggotaan'], data.guru_id)
    lembar = await simpan_draf(db, ktx, data)
    meta = {'penilaian_id': lembar['id'], 'guru_id': data.guru_id, 'progres': lembar['progres']}
    if lembar.pop('_baru'):
        await catat_audit_pkg(db, 'penilaian_mulai', akses['user'], {**meta, 'instrumen_id': lembar['instrumen_id']},
                              penilaian_id=lembar['id'], request=request)
    # Draf tersimpan sangat sering (autosave): satu entri audit per lembar per hari, dengan jumlah simpan.
    await catat_audit_pkg_harian(db, 'penilaian_draf', akses['user'], kunci=lembar['id'], metadata=meta, request=request,
                                 penilaian_id=lembar['id'])
    return {'id': lembar['id'], 'status': lembar['status'], 'progres': lembar['progres'], 'updated_at': lembar['updated_at']}


@router.post("/pkg/penilaian/submit")
async def kirim_api(data: KirimPenilaianRequest, request: Request, akses: Dict = Depends(penilai)):
    """Kirim & kunci lembar: server memvalidasi ulang kelengkapan (400 {pesan, galat: {kode_sub: pesan}}), menyimpan
    isian terakhir, menghitung nilai akhir resmi, lalu mengunci lembar permanen (terkunci 409)."""
    ktx = await konteks_lembar(db, akses['user'], akses['keanggotaan'], data.guru_id)
    lembar = await kirim_dan_kunci(db, ktx, data, akses['user'])
    await catat_audit_pkg(db, 'penilaian_kirim', akses['user'], {
        'penilaian_id': lembar['id'], 'guru_id': data.guru_id, 'instrumen_id': lembar['instrumen_id'],
        'nilai_akhir': lembar['nilai_akhir'], 'nilai_maks': lembar['nilai_maks'],
        'capaian_persen': lembar['capaian_persen'], 'predikat': lembar['predikat'],
    }, penilaian_id=lembar['id'], request=request)
    ktx['lembar'] = lembar
    return await lembar_tampil(db, ktx, data.guru_id)
