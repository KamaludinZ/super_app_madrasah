"""Daftar mapel baku ujian per jenjang (master `ujian_mapel_baku`, di-seed 15 mapel × 3 jenjang).

Dipakai formulir unggah berkas guru PJ, panel admin (bundel ZIP), dan sama dengan daftar yang dikirim ke halaman
publik info/monitoring — satu sumber agar tab jenjang, monitoring, formulir unggah, dan ZIP konsisten.
"""
from typing import Dict

from fastapi import APIRouter, Depends

from core import db, get_current_user
from ujian_info import mapel_semua_jenjang

router = APIRouter()


@router.get("/ujian/mapel-baku")
async def daftar_mapel_baku(user: Dict = Depends(get_current_user)):
    """Mapel baku aktif tiap jenjang (urutan baku): { jenjang: { '7': [{kode, nama}], '8': [...], '9': [...] } }."""
    return {'jenjang': await mapel_semua_jenjang(db)}
