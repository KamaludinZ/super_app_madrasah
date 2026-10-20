"""API cetak dokumen resmi PKG (Excel & PDF via LibreOffice) dengan otorisasi & validasi masukan.

Otorisasi: pengguna personil PKG pada periode yang dicetak (pkg_rekap.anggota_periode) dan berperan pengelola
(kepala madrasah atau penilai); data mengikuti cakupan peran (kepala semua guru, penilai guru yang dinilainya).
Hanya lembar terkunci yang tercetak. PDF memakai LibreOffice; bila tidak tersedia/gagal, dibuat PDF cadangan ReportLab
berpenanda "bukan salinan identik" (header X-PKG-Mesin: reportlab). Setiap unduhan tercatat di riwayat unduhan & jejak audit (catat_cetak_template).
"""
from datetime import date
from typing import Any, Dict, Optional, Tuple
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import Response

from core import db, get_current_user, logger
from pkg_akses import keanggotaan_sk, tolak
from pkg_penjaga import penjaga_pkg
from pkg_audit import AKSI_LIHAT_UNDUHAN, URUT_UNDUHAN, catat_audit_pkg_harian, catat_cetak_gagal, catat_cetak_template, daftar_unduhan
from pkg_cetak import StrukturTidakSesuai, laporan_guru_excel, rekap_excel
from pkg_pdf import KonversiPdfGagal, LibreOfficeTidakTersedia, kemampuan_pdf, xlsx_ke_pdf
from pkg_pdf_cadangan import laporan_guru_pdf_cadangan, rekap_pdf_cadangan
from pkg_kehadiran import kehadiran_guru
from pkg_nilai import hitung_nilai
from pkg_rekap import agregasi_rekap, anggota_periode, cakupan_rekap, nilai_akhir_guru, periode_dan_sk
from pkg_skema import JENIS_DOKUMEN, KOLEKSI_INSTRUMEN, KOLEKSI_PENILAIAN, POLA_ID, CetakRequest
from pkg_template import TEMPLATE_PKG, TemplateTidakTersedia, info_template, nama_berkas_cetak

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
    kehadiran = await kehadiran_guru(db_, periode, data.guru_id)
    laporan['kehadiran'] = kehadiran['bulan']
    laporan['nilai_akhir_360'] = await nilai_akhir_guru(db_, periode, data.guru_id, hitung_nilai(instrumen or {}, laporan['isian'])['capaian_persen'])
    try:
        isi = laporan_guru_excel(laporan, hanya_rekap=data.format == 'pdf')
    except StrukturTidakSesuai as e:
        raise HTTPException(409, str(e)) from e
    return {'jenis_template': 'instrumen', 'dasar_nama': f"Laporan_PKG_{guru.get('nama') or data.guru_id}_{periode.get('nama_periode') or ''}",
            'xlsx': isi, 'periode': periode, 'guru_id': data.guru_id, 'cadangan': lambda: laporan_guru_pdf_cadangan(laporan)}


def respon_berkas(isi: bytes, nama: str, format_berkas: str, mesin: str, alasan_cadangan: Optional[str] = None) -> Response:
    header = {
        'Content-Disposition': f"attachment; filename=\"{nama}\"; filename*=UTF-8''{quote(nama)}",
        'X-PKG-Mesin': mesin, 'Access-Control-Expose-Headers': 'Content-Disposition, X-PKG-Mesin, X-PKG-Cadangan',
    }
    if alasan_cadangan:
        header['X-PKG-Cadangan'] = alasan_cadangan
    return Response(isi, media_type=MIME[format_berkas], headers=header)


async def buat_pdf(siap: Dict[str, Any]) -> Tuple[bytes, str, Optional[str]]:
    """PDF dari berkas cetak: LibreOffice bila terdeteksi, selain itu (atau bila konversi gagal) cadangan ReportLab.
    Hasil: (isi, mesin, alasan_cadangan) dengan alasan 'libreoffice_tidak_tersedia' | 'konversi_gagal' | None."""
    if not kemampuan_pdf()['libreoffice']:
        return siap['cadangan'](), 'reportlab', 'libreoffice_tidak_tersedia'
    try:
        return await xlsx_ke_pdf(siap['xlsx'], nama_berkas_cetak(siap['dasar_nama'], 'xlsx')), 'libreoffice', None
    except (LibreOfficeTidakTersedia, KonversiPdfGagal) as e:
        # Cadangan: tata letak bukan salinan identik Excel; ditandai di setiap halaman & di header respons.
        logger.warning(f'[pkg_cetak] PDF memakai cadangan ReportLab: {e}')
        alasan = 'libreoffice_tidak_tersedia' if isinstance(e, LibreOfficeTidakTersedia) else 'konversi_gagal'
        return siap['cadangan'](), 'reportlab', alasan


@router.get("/pkg/cetak/kemampuan")
async def kemampuan_cetak_api(user: Dict = Depends(get_current_user)):
    """Ketersediaan alat cetak di server: Excel butuh template resmi utuh; PDF identik butuh LibreOffice, tanpanya
    PDF tetap dapat diunduh sebagai versi cadangan ReportLab (bukan salinan identik)."""
    template = {b['jenis']: b['status'] for b in info_template()['berkas']}
    pdf = kemampuan_pdf()
    return {
        'excel': {'tersedia': all(s != 'hilang' for s in template.values()), 'template': template},
        'pdf': {**pdf, 'tersedia': True,
                'catatan': None if pdf['identik'] else 'LibreOffice tidak tersedia di server; PDF dibuat sebagai versi cadangan '
                                                       '(ReportLab) yang bukan salinan identik berkas Excel resmi.'},
    }


@router.post("/pkg/cetak")
async def cetak_api(data: CetakRequest, request: Request, user: Dict = Depends(get_current_user)):
    """Unduh dokumen resmi: rekap seluruh guru dalam cakupan (`jenis=rekap`) atau laporan satu guru (`jenis=guru`)
    sebagai Excel dari template resmi, atau PDF hasil konversi LibreOffice (rumus template dihitung ulang; laporan
    per guru hanya lembar rekapitulasi 04-RKAP-PKG). Tanpa LibreOffice: PDF cadangan ReportLab berpenanda.
    403 di luar hak/cakupan, 409 bila belum ada lembar terkunci, 503 bila template tidak tersedia/berubah.
    Unduhan berhasil tercatat di riwayat unduhan & jejak audit; percobaan yang ditolak/gagal dicatat sebagai cetak_gagal."""
    meta = {'jenis_dokumen': data.jenis, 'format': data.format, 'periode_id': data.periode_id, 'guru_id': data.guru_id,
            'endpoint': request.url.path}
    try:
        try:
            siap = await siapkan_cetak(db, user, data)
        except TemplateTidakTersedia as e:
            raise HTTPException(503, str(e)) from e
    except HTTPException as e:
        await catat_cetak_gagal(db, user, e.status_code, e.detail, meta, request=request)
        raise
    if data.format == 'pdf':
        isi, mesin, alasan_cadangan = await buat_pdf(siap)
    else:
        isi, mesin, alasan_cadangan = siap['xlsx'], 'openpyxl', None
    nama = nama_berkas_cetak(siap['dasar_nama'], data.format)
    info = TEMPLATE_PKG[siap['jenis_template']]
    await catat_cetak_template(db, user, siap['jenis_template'], data.format, nama, info['versi'], info['checksum_resmi'],
                               periode_id=siap['periode']['id'], request=request, jenis_dokumen=data.jenis,
                               guru_id=siap['guru_id'], mesin=mesin, isi=isi,
                               metadata={'tanggal_cetak': date.today().isoformat(), 'alasan_cadangan': alasan_cadangan,
                                         'endpoint': meta['endpoint']})
    return respon_berkas(isi, nama, data.format, mesin, alasan_cadangan)


@router.post("/pkg/cetak/pdf")
async def cetak_pdf_api(data: CetakRequest, request: Request, user: Dict = Depends(get_current_user)):
    """Unduh PDF (format pada badan permintaan diabaikan). Header X-PKG-Mesin: libreoffice | reportlab; untuk cadangan
    ditambah X-PKG-Cadangan berisi alasannya. Ketersediaan alat dapat dicek lebih dulu lewat GET /pkg/cetak/kemampuan."""
    return await cetak_api(data.model_copy(update={'format': 'pdf'}), request, user)


POLA_TANGGAL = r'^\d{4}-\d{2}-\d{2}$'


@router.get("/pkg/cetak/unduhan")
async def daftar_unduhan_api(
    request: Request,
    periode_id: Optional[str] = Query(None, pattern=POLA_ID),
    jenis: Optional[str] = Query(None, pattern='^(' + '|'.join(JENIS_DOKUMEN) + ')$'),
    format: Optional[str] = Query(None, pattern='^(xlsx|pdf)$'),
    mesin: Optional[str] = Query(None, pattern='^(openpyxl|libreoffice|reportlab)$'),
    guru_id: Optional[str] = Query(None, pattern=POLA_ID),
    aktor_id: Optional[str] = Query(None, pattern=POLA_ID),
    dari: Optional[str] = Query(None, pattern=POLA_TANGGAL),
    sampai: Optional[str] = Query(None, pattern=POLA_TANGGAL),
    cari: Optional[str] = Query(None, max_length=100),
    urut: str = Query('timestamp', pattern='^(' + '|'.join(URUT_UNDUHAN) + ')$'),
    arah: str = Query('desc', pattern='^(asc|desc)$'),
    halaman: int = Query(1, ge=1, le=10000),
    per_halaman: int = Query(25, ge=1, le=100),
    akses: Dict = Depends(penjaga_pkg('anggota')),
):
    """Riwayat unduhan dokumen resmi berhalaman: saring periode/jenis/format/mesin/guru/pengunduh/rentang tanggal (WIB)
    & cari nama berkas/pengunduh; urut per kolom. Kepala madrasah melihat semua unduhan; penilai hanya unduhannya
    sendiri (aktor_id dipaksa); selain itu 403. Hasil {item, total, halaman, per_halaman, urut, arah}."""
    user, k = akses['user'], akses['keanggotaan']
    if k.get('peran') != 'kepala':
        if not k.get('sebagai_penilai'):
            raise tolak('bukan_penilai', 'Riwayat unduhan hanya untuk kepala madrasah dan tim penilai.')
        aktor_id = user['id']
    try:
        for tanggal in filter(None, (dari, sampai)):
            date.fromisoformat(tanggal)
    except ValueError as e:
        raise HTTPException(422, 'Tanggal saringan tidak valid.') from e
    if dari and sampai and dari > sampai:
        raise HTTPException(422, 'Tanggal awal melewati tanggal akhir.')
    await catat_audit_pkg_harian(db, AKSI_LIHAT_UNDUHAN, user, kunci=request.url.path,
                                 metadata={'periode_id': periode_id, 'endpoint': request.url.path}, request=request)
    return await daftar_unduhan(db, periode_id=periode_id, jenis=jenis, format_berkas=format, mesin=mesin,
                                guru_id=guru_id, aktor_id=aktor_id, dari=dari, sampai=sampai, cari=cari, urut=urut,
                                arah=arah, halaman=halaman, per_halaman=per_halaman)
