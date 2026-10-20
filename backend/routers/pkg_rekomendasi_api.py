"""API rekomendasi PKB per guru per periode — dipilih/diisi oleh penilai maupun kepala madrasah (cakupan sama dengan
angket 360°, lihat routers.pkg_angket_api.konteks_pengelola). Perubahan hanya pada periode berjalan dan tercatat di
jejak audit (rekomendasi_simpan)."""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request

from core import db, get_current_user
from pkg_akses import keanggotaan_sk
from pkg_audit import catat_audit_pkg
from pkg_nilai import level_dari_label
from pkg_rekap import agregasi_rekap, model_kompetensi_guru
from pkg_rekomendasi import (
    FOKUS_KOMPETENSI, OPSI_PKB, rekomendasi_guru, rekomendasi_periode, saran_pkb, simpan_rekomendasi, teks_rekomendasi,
)
from pkg_skema import POLA_ID, RekomendasiPkbRequest
from routers.pkg_angket_api import konteks_pengelola

router = APIRouter()


def _publik(rek: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not rek:
        return None
    return {**{k: rek.get(k) for k in ('pilihan_pkb', 'fokus_kompetensi', 'catatan', 'disusun_oleh_nama', 'peran_penyusun', 'tanggal')},
            'teks': teks_rekomendasi(rek)}


@router.get("/pkg/rekomendasi-pkb/opsi")
async def opsi_pkb_api(user: Dict = Depends(get_current_user)):
    """Opsi baku rekomendasi PKB dan fokus kompetensi."""
    return {'opsi': [{'kode': k, 'label': v} for k, v in OPSI_PKB.items()],
            'fokus': [{'kode': k, 'label': v} for k, v in FOKUS_KOMPETENSI.items()]}


@router.get("/pkg/rekomendasi-pkb/ringkasan")
async def ringkasan_pkb_api(periode_id: Optional[str] = Query(None, pattern=POLA_ID), user: Dict = Depends(get_current_user)):
    """Status rekomendasi PKB seluruh guru dalam cakupan pada periode (teks ringkas bila sudah disusun)."""
    ktx = await konteks_pengelola(db, user, periode_id, None)
    cakupan = ktx['cakupan']
    saring = cakupan['guru'] - {cakupan['diri']} if cakupan['guru'] is not None else None
    agregat = await agregasi_rekap(db, ktx['periode'], ktx['sk'], saring_guru=saring)
    rek = await rekomendasi_periode(db, ktx['periode']['id'], [g['guru_id'] for g in agregat['guru']])
    return {
        'periode': {k: ktx['periode'].get(k) for k in ('id', 'nama_periode', 'status')},
        'guru': [{'guru_id': g['guru_id'], 'nama': g['nama'], 'mapel': g['mapel'], 'status': g['status'],
                  'level_capaian': g.get('level_capaian'), 'rekomendasi': _publik(rek.get(g['guru_id']))} for g in agregat['guru']],
    }


@router.get("/pkg/rekomendasi-pkb/{guru_id}")
async def rekomendasi_guru_api(guru_id: str = Path(..., pattern=POLA_ID), periode_id: Optional[str] = Query(None, pattern=POLA_ID),
                               user: Dict = Depends(get_current_user)):
    """Rekomendasi PKB satu guru beserta level guru (Plus 360 bila tersedia, selain itu level normal) dan saran opsi."""
    ktx = await konteks_pengelola(db, user, periode_id, guru_id)
    model = await model_kompetensi_guru(db, ktx['periode'], ktx['sk'], guru_id)
    lv = (model or {}).get('level_guru') or {}
    acuan = lv.get('simpulan') or lv.get('plus_360') or lv.get('normal')
    return {
        'periode': {k: ktx['periode'].get(k) for k in ('id', 'nama_periode', 'status')}, 'guru': ktx['guru'],
        'status_penilaian': (model or {}).get('status'), 'level_guru': lv or None,
        'saran': saran_pkb(level_dari_label(acuan)), 'level_acuan': acuan,
        'rekomendasi': _publik(await rekomendasi_guru(db, ktx['periode']['id'], guru_id)),
    }


@router.put("/pkg/rekomendasi-pkb/{guru_id}")
async def simpan_rekomendasi_api(data: RekomendasiPkbRequest, request: Request, guru_id: str = Path(..., pattern=POLA_ID),
                                 user: Dict = Depends(get_current_user)):
    """Simpan rekomendasi PKB satu guru (mengganti sebelumnya; penyusun & perannya dicatat). 409 bila periode tidak
    berjalan."""
    ktx = await konteks_pengelola(db, user, data.periode_id, guru_id)
    if ktx['periode'].get('status') != 'berjalan':
        raise HTTPException(409, 'Rekomendasi PKB hanya dapat diubah pada periode yang sedang berjalan.')
    peran = 'kepala' if (await keanggotaan_sk(db, user)).get('peran') == 'kepala' else 'penilai'
    rek = await simpan_rekomendasi(db, ktx['periode']['id'], guru_id, data.pilihan_pkb, data.fokus_kompetensi, data.catatan, user, peran)
    await catat_audit_pkg(db, 'rekomendasi_simpan', user, {'periode_id': ktx['periode']['id'], 'guru_id': guru_id,
                                                           'pilihan_pkb': rek['pilihan_pkb'], 'peran_penyusun': peran},
                          request=request)
    return _publik(rek)
