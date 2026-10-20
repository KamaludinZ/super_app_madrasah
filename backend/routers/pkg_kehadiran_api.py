"""API komponen kehadiran PKG (sheet INDEK-HDIR): rekap kehadiran manual per guru per periode oleh kepala madrasah
atau tim penilai (cakupan sama dengan angket 360°, lihat routers.pkg_angket_api.konteks_pengelola). Perubahan hanya
pada periode berjalan dan tercatat di jejak audit (kehadiran_simpan)."""
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request

from core import db, get_current_user
from pkg_audit import catat_audit_pkg
from pkg_kehadiran import kehadiran_guru, kehadiran_periode, simpan_kehadiran
from pkg_rekap import agregasi_rekap
from pkg_skema import POLA_ID, KehadiranRequest
from routers.pkg_angket_api import konteks_pengelola

router = APIRouter()


@router.get("/pkg/kehadiran/ringkasan")
async def ringkasan_kehadiran_api(periode_id: Optional[str] = Query(None, pattern=POLA_ID), user: Dict = Depends(get_current_user)):
    """Ringkasan kehadiran seluruh guru dalam cakupan: sudah diinput atau belum, jumlah tidak hadir (hari, termasuk
    konversi menit), dan indeks persentase kehadiran."""
    ktx = await konteks_pengelola(db, user, periode_id, None)
    cakupan = ktx['cakupan']
    saring = cakupan['guru'] - {cakupan['diri']} if cakupan['guru'] is not None else None
    agregat = await agregasi_rekap(db, ktx['periode'], ktx['sk'], saring_guru=saring)
    hadir = await kehadiran_periode(db, ktx['periode'], [g['guru_id'] for g in agregat['guru']])
    return {
        'periode': {k: ktx['periode'].get(k) for k in ('id', 'nama_periode', 'status', 'tanggal_buka', 'tanggal_tutup')},
        'guru': [{'guru_id': g['guru_id'], 'nama': g['nama'], 'mapel': g['mapel'], 'penilai_nama': g['penilai_nama'],
                  'status': g['status'], **hadir[g['guru_id']]} for g in agregat['guru']],
    }


@router.get("/pkg/kehadiran/{guru_id}")
async def kehadiran_guru_api(guru_id: str = Path(..., pattern=POLA_ID), periode_id: Optional[str] = Query(None, pattern=POLA_ID),
                             user: Dict = Depends(get_current_user)):
    """Rekap kehadiran satu guru: seluruh bulan periode (bulan tanpa data bernilai 0), hasil per bulan, jumlah, dan
    indeks persentase kehadiran (INDEK-HDIR!K29)."""
    ktx = await konteks_pengelola(db, user, periode_id, guru_id)
    return {'periode': {k: ktx['periode'].get(k) for k in ('id', 'nama_periode', 'status', 'tanggal_buka', 'tanggal_tutup')},
            'guru': ktx['guru'], **await kehadiran_guru(db, ktx['periode'], guru_id)}


@router.put("/pkg/kehadiran/{guru_id}")
async def simpan_kehadiran_api(data: KehadiranRequest, request: Request, guru_id: str = Path(..., pattern=POLA_ID),
                               user: Dict = Depends(get_current_user)):
    """Simpan rekap kehadiran manual satu guru (mengganti data sebelumnya). 409 bila periode tidak berjalan; 422 bila
    bulan di luar periode atau berulang."""
    ktx = await konteks_pengelola(db, user, data.periode_id, guru_id)
    if ktx['periode'].get('status') != 'berjalan':
        raise HTTPException(409, 'Rekap kehadiran hanya dapat diubah pada periode yang sedang berjalan.')
    try:
        hasil = await simpan_kehadiran(db, ktx['periode'], guru_id, [b.model_dump() for b in data.bulan], user)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    await catat_audit_pkg(db, 'kehadiran_simpan', user, {'periode_id': ktx['periode']['id'], 'guru_id': guru_id,
                                                         'indeks_sebelum': hasil.pop('sebelum'), 'indeks': hasil['indeks_persen'],
                                                         'jumlah_tidak_hadir': round(hasil['jumlah']['jumlah_tidak_hadir'], 4)},
                          request=request)
    return {'periode': {k: ktx['periode'].get(k) for k in ('id', 'nama_periode', 'status')}, 'guru': ktx['guru'], **hasil}
