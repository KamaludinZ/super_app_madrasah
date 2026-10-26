"""API isian identitas guru untuk lampiran laporan PKG (lihat pkg_identitas_isian): guru melengkapi identitas dirinya
(`/pkg/identitas/saya`), kepala madrasah dan penilai melengkapi guru yang menjadi kewenangannya
(`/pkg/identitas/{guru_id}`). Penolakan: 403 {alasan, pesan}."""
from typing import Dict

from fastapi import APIRouter, Depends, Path, Request

from core import db
from pkg_identitas_isian import baca_identitas, simpan_identitas, tentukan_hak
from pkg_penjaga import penjaga_pkg
from pkg_skema import POLA_ID, IdentitasPkgRequest

router = APIRouter()


async def _baca(user: Dict, guru_id: str) -> Dict:
    peran, periode, sk = await tentukan_hak(db, user, guru_id)
    return await baca_identitas(db, guru_id, periode, sk, peran)


async def _simpan(user: Dict, guru_id: str, data: IdentitasPkgRequest, request: Request) -> Dict:
    peran, periode, sk = await tentukan_hak(db, user, guru_id)
    berubah = await simpan_identitas(db, guru_id, data, user, peran, periode, sk, request=request)
    sk = (await tentukan_hak(db, user, guru_id))[2] if berubah else sk  # muat ulang snapshot terbaru
    return {**await baca_identitas(db, guru_id, periode, sk, peran), 'berubah': berubah}


@router.get("/pkg/identitas/saya")
async def identitas_saya_api(akses: Dict = Depends(penjaga_pkg('anggota'))):
    """Identitas diri seperti yang akan tercetak di lampiran PKG, penanda isian kosong, dan isian PKG yang dapat diubah."""
    return await _baca(akses['user'], akses['user']['id'])


@router.put("/pkg/identitas/saya")
async def ubah_identitas_saya_api(data: IdentitasPkgRequest, request: Request, akses: Dict = Depends(penjaga_pkg('anggota'))):
    """Ubah isian PKG milik sendiri (pangkat, golongan, TMT golongan, jabatan fungsional, pendidikan, spesialisasi)."""
    return await _simpan(akses['user'], akses['user']['id'], data, request)


@router.get("/pkg/identitas/{guru_id}")
async def identitas_guru_api(guru_id: str = Path(..., pattern=POLA_ID), akses: Dict = Depends(penjaga_pkg('anggota'))):
    """Identitas satu guru untuk kepala madrasah (semua guru pada SK aktif) atau penilai (guru yang dibagikan)."""
    return await _baca(akses['user'], guru_id)


@router.put("/pkg/identitas/{guru_id}")
async def ubah_identitas_guru_api(data: IdentitasPkgRequest, request: Request, guru_id: str = Path(..., pattern=POLA_ID),
                                  akses: Dict = Depends(penjaga_pkg('anggota'))):
    """Lengkapi isian PKG seorang guru atas nama kepala madrasah/penilai berwenang; tercatat di jejak audit."""
    return await _simpan(akses['user'], guru_id, data, request)
