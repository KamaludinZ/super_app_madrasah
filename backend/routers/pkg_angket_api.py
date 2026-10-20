"""API angket penilaian 360° PKG (sejawat, peserta didik, orang tua/wali) — angket dicetak di kertas, diisi responden
tanpa akun, lalu rekap jawabannya diinput kembali oleh kepala madrasah atau tim penilai.

Otorisasi: personil PKG pada periode (pkg_rekap.anggota_periode) yang berperan pengelola (kepala madrasah atau penilai);
guru dibatasi cakupan peran (kepala semua guru, penilai guru yang dinilainya). Cetak angket memakai bagian sheet
FORM-360-GR template resmi; PDF lewat LibreOffice dengan cadangan ReportLab berpenanda. Setiap unduhan tercatat di
riwayat unduhan & jejak audit (jenis dokumen 'angket').
"""
from datetime import date
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from core import db, get_current_user
from pkg_akses import keanggotaan_sk, tolak
from pkg_angket import JENIS_ANGKET, angket_excel, daftar_jenis
from pkg_audit import catat_cetak_gagal, catat_cetak_template
from pkg_pdf_cadangan import angket_pdf_cadangan
from pkg_rekap import anggota_periode, cakupan_rekap, periode_dan_sk
from pkg_skema import AngketCetakRequest
from pkg_template import TEMPLATE_PKG, TemplateTidakTersedia, nama_berkas_cetak
from routers.pkg_cetak_api import buat_pdf, respon_berkas

router = APIRouter()


async def konteks_pengelola(db_, user: Dict[str, Any], periode_id: Optional[str], guru_id: Optional[str]) -> Dict[str, Any]:
    """Periode, SK, dan cakupan pengguna pengelola angket; guru (bila ada) harus dalam cakupan & bukan diri sendiri.
    Hasil {periode, sk, cakupan, guru: {id, nama, nip, mapel, tugas_tambahan} | None}."""
    periode, sk = await periode_dan_sk(db_, periode_id)
    if not await anggota_periode(db_, user, periode, sk):
        raise tolak('bukan_anggota_sk', 'Anda tidak termasuk personil PKG pada periode ini.')
    cakupan = await cakupan_rekap(db_, user, await keanggotaan_sk(db_, user), periode)
    if cakupan['cakupan'] == 'pribadi':
        raise tolak('bukan_penilai', 'Angket 360° hanya dikelola kepala madrasah dan tim penilai.')
    guru = None
    if guru_id:
        if (guru_id == cakupan['diri'] and cakupan['cakupan'] != 'semua') or (
                cakupan['guru'] is not None and guru_id not in cakupan['guru']):
            raise tolak('bukan_penugasan', 'Guru ini tidak termasuk dalam cakupan Anda.')
        snap = ((sk or {}).get('snapshot_anggota') or {}).get(guru_id) or {}
        akun = await db_.users.find_one({'id': guru_id}, {'_id': 0, 'full_name': 1, 'nip': 1, 'nip_nuptk': 1, 'tugas_tambahan': 1}) or {}
        if not snap and not akun:
            raise HTTPException(404, 'Guru tidak ditemukan.')
        guru = {'id': guru_id, 'nama': snap.get('nama') or akun.get('full_name'), 'nip': snap.get('nip') or akun.get('nip') or akun.get('nip_nuptk'),
                'mapel': snap.get('mapel'), 'tugas_tambahan': akun.get('tugas_tambahan')}
    return {'periode': periode, 'sk': sk, 'cakupan': cakupan, 'guru': guru}


@router.get("/pkg/angket/jenis")
async def jenis_angket_api(user: Dict = Depends(get_current_user)):
    """Jenis angket 360° (sejawat, siswa, ortu) dengan jumlah butir, skor maksimum per responden, dan batas responden."""
    if not (await keanggotaan_sk(db, user)).get('anggota'):
        raise tolak('bukan_anggota_sk', 'Anda tidak termasuk personil PKG.')
    try:
        return daftar_jenis()
    except TemplateTidakTersedia as e:
        raise HTTPException(503, str(e)) from e


@router.post("/pkg/angket/cetak")
async def cetak_angket_api(data: AngketCetakRequest, request: Request, user: Dict = Depends(get_current_user)):
    """Unduh angket kertas 360° satu jenis (bagian FORM-360-GR) — identitas guru terisi bila `guru_id` diberikan,
    tanpa guru_id berupa angket kosong. Excel dari template resmi atau PDF (LibreOffice; cadangan ReportLab
    berpenanda). 403 di luar hak/cakupan, 503 bila template tidak tersedia/berubah."""
    meta = {'jenis_dokumen': 'angket', 'jenis_angket': data.jenis_angket, 'format': data.format,
            'periode_id': data.periode_id, 'guru_id': data.guru_id, 'endpoint': request.url.path}
    try:
        try:
            ktx = await konteks_pengelola(db, user, data.periode_id, data.guru_id)
            xlsx = angket_excel(data.jenis_angket, ktx['guru'])
        except TemplateTidakTersedia as e:
            raise HTTPException(503, str(e)) from e
    except HTTPException as e:
        await catat_cetak_gagal(db, user, e.status_code, e.detail, meta, request=request)
        raise
    guru = ktx['guru']
    label = JENIS_ANGKET[data.jenis_angket]['label'].replace(' ', '_').replace('/', '_')
    siap = {'xlsx': xlsx, 'dasar_nama': f"Angket_360_{label}_{(guru or {}).get('nama') or 'Kosong'}",
            'cadangan': lambda: angket_pdf_cadangan(data.jenis_angket, guru)}
    if data.format == 'pdf':
        isi, mesin, alasan = await buat_pdf(siap)
    else:
        isi, mesin, alasan = xlsx, 'openpyxl', None
    nama = nama_berkas_cetak(siap['dasar_nama'], data.format)
    info = TEMPLATE_PKG['instrumen']
    await catat_cetak_template(db, user, 'instrumen', data.format, nama, info['versi'], info['checksum_resmi'],
                               periode_id=ktx['periode']['id'], request=request, jenis_dokumen='angket',
                               guru_id=data.guru_id, mesin=mesin, isi=isi,
                               metadata={'jenis_angket': data.jenis_angket, 'tanggal_cetak': date.today().isoformat(),
                                         'alasan_cadangan': alasan, 'endpoint': meta['endpoint']})
    return respon_berkas(isi, nama, data.format, mesin, alasan)
