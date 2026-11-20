"""Mesin cetak lembar ujian: Daftar Hadir Peserta & Berita Acara per ruang per jenjang per sesi.

Urutan mesin (sama dengan modul PKG): template Word asli diisi (ujian_cetak_docx) lalu dikonversi LibreOffice Writer
ke PDF — hasilnya identik dengan template madrasah. Bila LibreOffice tidak tersedia/gagal, dipakai cadangan ReportLab
(ujian_cetak_pdf) yang meniru tata letaknya. Format .docx (dapat disunting) selalu tersedia tanpa LibreOffice.
"""
import logging
from typing import Any, Dict, Tuple

from pkg_pdf import KonversiPdfGagal, LibreOfficeTidakTersedia, libreoffice_tersedia, xlsx_ke_pdf as berkas_office_ke_pdf
from ujian_cetak_docx import isi_berita_acara, isi_daftar_hadir
from ujian_cetak_pdf import pdf_berita_acara, pdf_daftar_hadir

logger = logging.getLogger('matsandatama')

JENIS_DOKUMEN = {
    'daftar_hadir': {'label': 'Daftar Hadir Peserta', 'docx': isi_daftar_hadir, 'pdf': pdf_daftar_hadir},
    'berita_acara': {'label': 'Berita Acara', 'docx': isi_berita_acara, 'pdf': pdf_berita_acara},
}
FORMAT = ('pdf', 'docx')
MIME = {'pdf': 'application/pdf', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}


def kemampuan_cetak() -> Dict[str, Any]:
    ada = libreoffice_tersedia()
    return {'libreoffice': ada, 'mesin': 'libreoffice' if ada else 'reportlab', 'identik': ada}


async def buat_dokumen(jenis: str, data: Dict[str, Any], format_: str = 'pdf') -> Tuple[bytes, str]:
    """-> (isi berkas, mesin). mesin: 'docx' | 'libreoffice' | 'reportlab'."""
    if jenis not in JENIS_DOKUMEN:
        raise ValueError(f'Jenis dokumen tidak dikenal: {jenis}')
    if format_ not in FORMAT:
        raise ValueError(f'Format tidak dikenal: {format_}')
    docx = JENIS_DOKUMEN[jenis]['docx'](data)
    if format_ == 'docx':
        return docx, 'docx'
    try:
        return await berkas_office_ke_pdf(docx, f'{jenis}.docx'), 'libreoffice'
    except (LibreOfficeTidakTersedia, KonversiPdfGagal) as e:
        logger.info(f'[ujian_cetak] {jenis}: LibreOffice tidak dipakai ({e}); cadangan ReportLab')
        return JENIS_DOKUMEN[jenis]['pdf'](data), 'reportlab'
