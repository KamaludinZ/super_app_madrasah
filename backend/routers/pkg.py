"""API modul PKG (Penilaian Kinerja Guru). Akses dibatasi keanggotaan SK aktif (lihat pkg_akses & pkg_penjaga)."""
from typing import Dict

from fastapi import APIRouter, Depends, Query, Request

from core import db, get_current_user
from pkg_akses import keanggotaan_sk, sk_aktif
from pkg_audit import AKSI_BUKA_BERANDA, catat_audit_pkg_harian
from pkg_beranda import menu_pkg, pengingat_pkg, ringkasan_kinerja, tugas_penilaian_saya
from pkg_penjaga import penjaga_pkg
from pkg_template import info_template

router = APIRouter()

anggota_sk = penjaga_pkg('anggota')


@router.get("/pkg/sk/my-membership")
async def keanggotaan_saya(user: Dict = Depends(get_current_user)):
    """Keanggotaan pengguna pada SK aktif untuk penjaga menu/halaman frontend.
    Selalu 200; non-anggota mendapat `anggota: false` + `penolakan` (alasan & pesan)."""
    return await keanggotaan_sk(db, user)


@router.get("/pkg/beranda")
async def beranda_pkg(request: Request, akses: Dict = Depends(anggota_sk)):
    """Data Beranda PKG. Non-anggota SK aktif ditolak 403 {'alasan': 'bukan_anggota_sk', 'pesan'}.
    Kunjungan & penolakan tercatat di pkg_audit_log (harian per pengguna)."""
    user, k = akses['user'], akses['keanggotaan']
    periode, sk = await sk_aktif(db)
    await catat_audit_pkg_harian(db, AKSI_BUKA_BERANDA, user, metadata={'periode_id': (periode or {}).get('id')},
                                 request=request)
    return {
        'periode': k['periode'],
        'keanggotaan': {kunci: v for kunci, v in k.items() if kunci not in ('periode', 'penolakan')},
        'ringkasan': await ringkasan_kinerja(db, sk),
        'tugas': await tugas_penilaian_saya(db, user, periode, sk),
        'menu': menu_pkg(k),
        'pengingat': await pengingat_pkg(db, user, k, periode, sk),
    }


@router.get("/pkg/beranda/ringkasan")
async def ringkasan_beranda(akses: Dict = Depends(anggota_sk)):
    """Ringkasan Kinerja periode berjalan: {total, selesai, sedang, belum} guru dinilai pada SK aktif."""
    _, sk = await sk_aktif(db)
    return await ringkasan_kinerja(db, sk)


@router.get("/pkg/beranda/tugas-saya")
async def tugas_saya(akses: Dict = Depends(anggota_sk)):
    """Tugas Penilaian Saya: guru yang dibagikan kepada pengguna pada periode berjalan, beserta status lembar.
    Anggota yang hanya dinilai mendapat daftar kosong; status supervisi ada di /pkg/sk/my-membership."""
    periode, sk = await sk_aktif(db)
    return await tugas_penilaian_saya(db, akses['user'], periode, sk)


@router.get("/pkg/beranda/menu")
async def menu_beranda(akses: Dict = Depends(anggota_sk)):
    """Pintasan sembilan menu PKG dengan status akses per pengguna (akses + alasan penolakan).
    Penjaga di tiap endpoint tetap memvalidasi ulang; daftar ini hanya untuk tampilan."""
    return menu_pkg(akses['keanggotaan'])


@router.get("/pkg/beranda/pengingat")
async def pengingat_beranda(akses: Dict = Depends(anggota_sk)):
    """Pengingat tenggat PKG pengguna (tenggat periode & supervisi); juga dikirim ke lonceng via GET /notifications."""
    periode, sk = await sk_aktif(db)
    return await pengingat_pkg(db, akses['user'], akses['keanggotaan'], periode, sk)


@router.get("/pkg/template/info")
async def info_template_api(periksa_ulang: bool = Query(False), akses: Dict = Depends(anggota_sk)):
    """Versi & checksum berkas template resmi PKG (hasil pemeriksaan terakhir). Hanya kepala madrasah yang dapat
    meminta pemeriksaan ulang (`periksa_ulang=true`); anggota lain selalu mendapat hasil tersimpan."""
    return info_template(periksa_ulang=periksa_ulang and akses['keanggotaan'].get('peran') == 'kepala')
