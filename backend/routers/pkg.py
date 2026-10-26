"""API modul PKG (Penilaian Kinerja Guru). Akses dibatasi keanggotaan SK aktif (lihat pkg_akses & pkg_penjaga)."""
import os
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request
from fastapi.responses import FileResponse

from core import db, get_current_user
from pkg_akses import adalah_kepala, keanggotaan_sk, sk_aktif, tolak
from pkg_ambang import konfigurasi as konfigurasi_ambang
from pkg_audit import (
    AKSI_BUKA_BERANDA, AKSI_LIHAT_TEMPLATE, AKSI_PERIKSA_TEMPLATE, catat_audit_pkg, catat_audit_pkg_harian,
)
from pkg_beranda import menu_pkg, pengingat_pkg, ringkasan_kinerja, tugas_penilaian_saya
from pkg_penjaga import penjaga_pkg
from pkg_skema import KOLEKSI_SK, POLA_ID
from pkg_template import info_template

router = APIRouter()

anggota_sk = penjaga_pkg('anggota')


@router.get("/pkg/sk/my-membership")
async def keanggotaan_saya(user: Dict = Depends(get_current_user)):
    """Keanggotaan pengguna pada SK aktif untuk penjaga menu/halaman frontend.
    Selalu 200; non-anggota mendapat `anggota: false` + `penolakan` (alasan & pesan)."""
    return await keanggotaan_sk(db, user)


@router.get("/pkg/sk/{sk_id}/berkas")
async def lihat_berkas_sk(sk_id: str = Path(..., pattern=POLA_ID), user: Dict = Depends(get_current_user)):
    """File SK (ditampilkan inline) untuk kepala madrasah dan personil yang tercantum di SK itu (penilai & dinilai)."""
    from pkg_sk import JENIS_BERKAS_SK, path_berkas_sk
    sk = await db[KOLEKSI_SK].find_one({'id': sk_id}, {'_id': 0, 'penilai_ids': 1, 'dinilai_ids': 1, 'berkas': 1})
    if not sk:
        raise HTTPException(404, 'SK tidak ditemukan.')
    uid = user.get('id')
    if not (adalah_kepala(user) or uid in (sk.get('penilai_ids') or []) or uid in (sk.get('dinilai_ids') or [])):
        raise tolak('bukan_anggota_sk', 'File SK hanya dapat dilihat kepala madrasah dan personil yang tercantum di SK ini.')
    b = sk.get('berkas')
    path = path_berkas_sk(b) if b else None
    if not path or not os.path.isfile(path):
        raise HTTPException(404, 'File SK belum diunggah.')
    return FileResponse(path, media_type=JENIS_BERKAS_SK[b['jenis']][1], filename=b.get('nama_asli') or os.path.basename(path),
                        content_disposition_type='inline', headers={'Cache-Control': 'private, no-store'})


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
async def info_template_api(request: Request, periksa_ulang: bool = Query(False), akses: Dict = Depends(anggota_sk)):
    """Versi & checksum berkas template resmi PKG (hasil pemeriksaan terakhir). Hanya kepala madrasah yang dapat
    meminta pemeriksaan ulang (`periksa_ulang=true`); anggota lain selalu mendapat hasil tersimpan.
    Akses dicatat harian; pemeriksaan ulang dicatat per aksi beserta status berkas."""
    ulang = periksa_ulang and akses['keanggotaan'].get('peran') == 'kepala'
    info = info_template(periksa_ulang=ulang)
    if ulang:
        await catat_audit_pkg(db, AKSI_PERIKSA_TEMPLATE, akses['user'],
                              {'utuh': info['utuh'], 'status': {b['jenis']: b['status'] for b in info['berkas']}},
                              request=request)
    else:
        await catat_audit_pkg_harian(db, AKSI_LIHAT_TEMPLATE, akses['user'], metadata={'versi_template': info['versi_template']},
                                     request=request)
    return info


@router.get("/pkg/ambang")
async def ambang_api(akses: Dict = Depends(anggota_sk)):
    """Ambang tingkat kompetensi/level, predikat jenjang & rekap, sebutan angket 360°, proporsi nilai per jenjang,
    dan konstanta kehadiran — baca saja, disalin dari rumus template resmi (pkg_ambang)."""
    return konfigurasi_ambang()
