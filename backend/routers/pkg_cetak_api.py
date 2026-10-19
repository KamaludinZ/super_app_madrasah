"""API cetak dokumen resmi PKG (Excel & PDF via LibreOffice) dengan otorisasi & validasi masukan.

Otorisasi: pengguna personil PKG pada periode yang dicetak (pkg_rekap.anggota_periode) dan berperan pengelola
(kepala madrasah atau penilai); data mengikuti cakupan peran (kepala semua guru, penilai guru yang dinilainya).
Hanya lembar terkunci yang tercetak. PDF memakai LibreOffice; bila tidak tersedia/gagal, dibuat PDF cadangan ReportLab
berpenanda "bukan salinan identik" (header X-PKG-Mesin: reportlab). Setiap unduhan tercatat di riwayat unduhan & jejak audit (catat_cetak_template).
"""
from datetime import date
from typing import Any, Dict
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from core import db, get_current_user, logger
from pkg_akses import keanggotaan_sk, tolak
from pkg_audit import catat_cetak_template
from pkg_cetak import StrukturTidakSesuai, laporan_guru_excel, rekap_excel
from pkg_pdf import KonversiPdfGagal, LibreOfficeTidakTersedia, xlsx_ke_pdf
from pkg_pdf_cadangan import laporan_guru_pdf_cadangan, rekap_pdf_cadangan
from pkg_rekap import agregasi_rekap, anggota_periode, cakupan_rekap, periode_dan_sk
from pkg_skema import KOLEKSI_INSTRUMEN, KOLEKSI_PENILAIAN, CetakRequest
from pkg_template import TEMPLATE_PKG, TemplateTidakTersedia, nama_berkas_cetak

router = APIRouter()

MIME = {'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'pdf': 'application/pdf'}


async def _pengaturan(db_) -> Dict[str, Any]:
    return await db_.settings.find_one({'id': 'global_config'}, {'_id': 0}) or {}


async def siapkan_cetak(db_, user: Dict[str, Any], data: CetakRequest) -> Dict[str, Any]:
    """Validasi hak & data cetak; hasil: {jenis_template, dasar_nama, xlsx (bytes), periode, guru_id}."""
    periode, sk = await periode_dan_sk(db_, data.periode_id)
    if not await anggota_periode(db_, user, periode, sk):
        raise tolak('bukan_anggota_sk', 'Anda tidak termasuk personil PKG pada periode ini.')
    k = await keanggotaan_sk(db_, user)
    cakupan = await cakupan_rekap(db_, user, k, periode)
    if cakupan['cakupan'] == 'pribadi':
        raise tolak('bukan_penilai', 'Cetak dokumen resmi hanya untuk kepala madrasah dan tim penilai.')
    pengaturan = await _pengaturan(db_)
    kepala = pengaturan.get('headmaster_name')

    if data.jenis == 'rekap':
        saring = cakupan['guru'] - {cakupan['diri']} if cakupan['guru'] is not None else None
        agregat = await agregasi_rekap(db_, periode, sk, saring_guru=saring, hanya_terkunci=True)
        if not agregat['guru']:
            raise HTTPException(409, 'Belum ada lembar terkunci untuk dicetak pada periode ini.')
        isi = rekap_excel(agregat['guru'], periode, kepala=kepala)
        return {'jenis_template': 'rekap', 'dasar_nama': f"Rekap_Hasil_PKG_{periode.get('nama_periode') or ''}",
                'xlsx': isi, 'periode': periode, 'guru_id': None,
                'cadangan': lambda: rekap_pdf_cadangan(agregat['guru'], periode, kepala)}

    if cakupan['guru'] is not None and (data.guru_id not in cakupan['guru'] or data.guru_id == cakupan['diri']):
        raise tolak('bukan_penugasan', 'Laporan guru ini tidak termasuk dalam cakupan Anda.')
    lembar = await db_[KOLEKSI_PENILAIAN].find_one(
        {'periode_id': periode['id'], 'guru_dinilai_id': data.guru_id, 'status': 'terkunci'}, {'_id': 0})
    if not lembar:
        raise HTTPException(409, 'Lembar penilaian guru ini belum dikirim & dikunci.')
    instrumen = await db_[KOLEKSI_INSTRUMEN].find_one({'id': lembar.get('instrumen_id')}, {'_id': 0})
    snap = (sk or {}).get('snapshot_anggota') or {}
    penilai = snap.get(lembar.get('penilai_id')) or {}
    if not penilai:
        akun = await db_.users.find_one({'id': lembar.get('penilai_id')}, {'_id': 0, 'full_name': 1, 'nip_nuptk': 1}) or {}
        penilai = {'nama': akun.get('full_name'), 'nip': akun.get('nip_nuptk')}
    guru = lembar.get('snapshot_guru') or {}
    laporan = {
        'guru': guru, 'periode': periode, 'sk': sk or {}, 'penilai': penilai,
        'kepala': {'nama': kepala, 'nip': next((x.get('nip') for x in pengaturan.get('leadership') or []
                                                 if 'kepala' in (x.get('position') or '').lower()), None)},
        'nama_sekolah': pengaturan.get('school_name'), 'instrumen': instrumen or {}, 'isian': lembar.get('isian') or {},
        'terkunci_pada': lembar.get('terkunci_pada'),
    }
    try:
        isi = laporan_guru_excel(laporan, hanya_rekap=data.format == 'pdf')
    except StrukturTidakSesuai as e:
        raise HTTPException(409, str(e)) from e
    return {'jenis_template': 'instrumen', 'dasar_nama': f"Laporan_PKG_{guru.get('nama') or data.guru_id}_{periode.get('nama_periode') or ''}",
            'xlsx': isi, 'periode': periode, 'guru_id': data.guru_id, 'cadangan': lambda: laporan_guru_pdf_cadangan(laporan)}


def respon_berkas(isi: bytes, nama: str, format_berkas: str, mesin: str) -> Response:
    return Response(isi, media_type=MIME[format_berkas], headers={
        'Content-Disposition': f"attachment; filename=\"{nama}\"; filename*=UTF-8''{quote(nama)}",
        'X-PKG-Mesin': mesin, 'Access-Control-Expose-Headers': 'Content-Disposition, X-PKG-Mesin',
    })


@router.post("/pkg/cetak")
async def cetak_api(data: CetakRequest, request: Request, user: Dict = Depends(get_current_user)):
    """Unduh dokumen resmi: rekap seluruh guru dalam cakupan (`jenis=rekap`) atau laporan satu guru (`jenis=guru`)
    sebagai Excel dari template resmi, atau PDF hasil konversi LibreOffice (rumus template dihitung ulang; laporan
    per guru hanya lembar rekapitulasi 04-RKAP-PKG). Tanpa LibreOffice: PDF cadangan ReportLab berpenanda.
    403 di luar hak/cakupan, 409 bila belum ada lembar terkunci, 503 bila template tidak tersedia/berubah."""
    try:
        siap = await siapkan_cetak(db, user, data)
    except TemplateTidakTersedia as e:
        raise HTTPException(503, str(e)) from e
    if data.format == 'pdf':
        try:
            isi, mesin = await xlsx_ke_pdf(siap['xlsx'], nama_berkas_cetak(siap['dasar_nama'], 'xlsx')), 'libreoffice'
        except (LibreOfficeTidakTersedia, KonversiPdfGagal) as e:
            # Cadangan: tata letak bukan salinan identik Excel; ditandai di setiap halaman & di header respons.
            logger.warning(f'[pkg_cetak] PDF memakai cadangan ReportLab: {e}')
            isi, mesin = siap['cadangan'](), 'reportlab'
    else:
        isi, mesin = siap['xlsx'], 'openpyxl'
    nama = nama_berkas_cetak(siap['dasar_nama'], data.format)
    info = TEMPLATE_PKG[siap['jenis_template']]
    await catat_cetak_template(db, user, siap['jenis_template'], data.format, nama, info['versi'], info['checksum_resmi'],
                               periode_id=siap['periode']['id'], request=request, jenis_dokumen=data.jenis,
                               guru_id=siap['guru_id'], mesin=mesin, isi=isi,
                               metadata={'tanggal_cetak': date.today().isoformat()})
    return respon_berkas(isi, nama, data.format, mesin)
