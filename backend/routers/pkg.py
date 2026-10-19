"""API modul PKG (Penilaian Kinerja Guru). Akses dibatasi keanggotaan SK aktif (lihat pkg_akses)."""
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_current_user
from pkg_akses import keanggotaan_sk, sk_aktif, wajib_akses
from pkg_audit import AKSI_BUKA_BERANDA, AKSI_TOLAK_AKSES, catat_audit_pkg_harian
from pkg_beranda import menu_pkg, pengingat_pkg, ringkasan_kinerja, tugas_penilaian_saya

router = APIRouter()


async def _penjaga(request: Request, user: Dict, endpoint: str, syarat: str = 'anggota') -> Dict:
    """wajib_akses (keanggotaan SK aktif + syarat) dengan jejak audit penolakan (satu entri/pengguna/endpoint/hari)."""
    try:
        return await wajib_akses(db, user, syarat)
    except HTTPException as e:
        alasan = e.detail.get('alasan') if isinstance(e.detail, dict) else None
        await catat_audit_pkg_harian(db, AKSI_TOLAK_AKSES, user, kunci=f'{endpoint}:{alasan}',
                                     metadata={'endpoint': endpoint, 'alasan': alasan}, request=request)
        raise


@router.get("/pkg/sk/my-membership")
async def keanggotaan_saya(user: Dict = Depends(get_current_user)):
    """Keanggotaan pengguna pada SK aktif untuk penjaga menu/halaman frontend.
    Selalu 200; non-anggota mendapat `anggota: false` + `penolakan` (alasan & pesan)."""
    return await keanggotaan_sk(db, user)


@router.get("/pkg/beranda")
async def beranda_pkg(request: Request, user: Dict = Depends(get_current_user)):
    """Data Beranda PKG. Non-anggota SK aktif ditolak 403 {'alasan': 'bukan_anggota_sk', 'pesan'}.
    Kunjungan & penolakan tercatat di pkg_audit_log (harian per pengguna)."""
    k = await _penjaga(request, user, '/pkg/beranda')
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
async def ringkasan_beranda(request: Request, user: Dict = Depends(get_current_user)):
    """Ringkasan Kinerja periode berjalan: {total, selesai, sedang, belum} guru dinilai pada SK aktif."""
    await _penjaga(request, user, '/pkg/beranda/ringkasan')
    _, sk = await sk_aktif(db)
    return await ringkasan_kinerja(db, sk)


@router.get("/pkg/beranda/tugas-saya")
async def tugas_saya(request: Request, user: Dict = Depends(get_current_user)):
    """Tugas Penilaian Saya: guru yang dibagikan kepada pengguna pada periode berjalan, beserta status lembar.
    Anggota yang hanya dinilai mendapat daftar kosong; status supervisi ada di /pkg/sk/my-membership."""
    await _penjaga(request, user, '/pkg/beranda/tugas-saya')
    periode, sk = await sk_aktif(db)
    return await tugas_penilaian_saya(db, user, periode, sk)


@router.get("/pkg/beranda/menu")
async def menu_beranda(request: Request, user: Dict = Depends(get_current_user)):
    """Pintasan sembilan menu PKG dengan status akses per pengguna (akses + alasan penolakan).
    Penjaga di tiap endpoint tetap memvalidasi ulang; daftar ini hanya untuk tampilan."""
    k = await _penjaga(request, user, '/pkg/beranda/menu')
    return menu_pkg(k)


@router.get("/pkg/beranda/pengingat")
async def pengingat_beranda(request: Request, user: Dict = Depends(get_current_user)):
    """Pengingat tenggat PKG pengguna (tenggat periode & supervisi); juga dikirim ke lonceng via GET /notifications."""
    k = await _penjaga(request, user, '/pkg/beranda/pengingat')
    periode, sk = await sk_aktif(db)
    return await pengingat_pkg(db, user, k, periode, sk)
