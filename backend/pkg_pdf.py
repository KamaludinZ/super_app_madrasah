"""Konversi berkas Excel hasil cetak PKG ke PDF dengan LibreOffice Calc (mode headless) di server.

Setiap konversi memakai folder sementara sendiri (pkg_template.salinan_sementara) termasuk profil LibreOffice
(-env:UserInstallation), sehingga aman dijalankan bersamaan oleh beberapa permintaan/worker; folder dihapus setelah
selesai. LibreOffice menghitung ulang rumus template (tingkat, jumlah, capaian, predikat) saat memuat berkas.
Lokasi program dapat diatur lewat env PKG_SOFFICE; batas waktu lewat PKG_PDF_BATAS_DETIK (bawaan 90 detik).
"""
import asyncio
import logging
import os
import shutil
from typing import Optional

from pkg_template import salinan_sementara

logger = logging.getLogger('matsandatama')

KANDIDAT_SOFFICE = ('soffice', 'libreoffice', '/usr/lib/libreoffice/program/soffice',
                    '/Applications/LibreOffice.app/Contents/MacOS/soffice')


class LibreOfficeTidakTersedia(Exception):
    """Program LibreOffice (soffice) tidak ditemukan di server."""


class KonversiPdfGagal(Exception):
    """LibreOffice gagal/terlalu lama mengonversi berkas."""


def cari_soffice() -> Optional[str]:
    env = os.environ.get('PKG_SOFFICE')
    for calon in ((env,) if env else ()) + KANDIDAT_SOFFICE:
        jalur = shutil.which(calon) or (calon if os.path.isfile(calon) and os.access(calon, os.X_OK) else None)
        if jalur:
            return jalur
    return None


def libreoffice_tersedia() -> bool:
    return cari_soffice() is not None


def kemampuan_pdf() -> dict:
    """Deteksi alat cetak PDF saat ini (dibaca ulang tiap panggilan, jadi pemasangan LibreOffice langsung terdeteksi):
    mesin yang akan dipakai dan apakah hasilnya salinan identik berkas Excel resmi."""
    ada = libreoffice_tersedia()
    return {'libreoffice': ada, 'mesin': 'libreoffice' if ada else 'reportlab', 'identik': ada}


async def xlsx_ke_pdf(isi_xlsx: bytes, nama_berkas: str = 'pkg.xlsx', batas_detik: Optional[float] = None) -> bytes:
    """Konversi bytes .xlsx menjadi bytes PDF via LibreOffice. Melempar LibreOfficeTidakTersedia/KonversiPdfGagal."""
    soffice = cari_soffice()
    if not soffice:
        raise LibreOfficeTidakTersedia('LibreOffice tidak tersedia di server.')
    batas = batas_detik or float(os.environ.get('PKG_PDF_BATAS_DETIK', '90'))
    with salinan_sementara(isi_xlsx, nama_berkas) as path:
        folder = os.path.dirname(path)
        profil = os.path.join(folder, 'profil_lo')
        proses = await asyncio.create_subprocess_exec(
            soffice, f'-env:UserInstallation=file://{profil}', '--headless', '--norestore', '--nolockcheck',
            '--nodefault', '--nologo', '--convert-to', 'pdf', '--outdir', folder, path,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        try:
            _, galat = await asyncio.wait_for(proses.communicate(), timeout=batas)
        except asyncio.TimeoutError as e:
            proses.kill()
            await proses.wait()
            raise KonversiPdfGagal(f'Konversi PDF melebihi {batas:g} detik.') from e
        hasil = os.path.splitext(path)[0] + '.pdf'
        if proses.returncode != 0 or not os.path.isfile(hasil):
            logger.warning(f'[pkg_pdf] konversi gagal (kode {proses.returncode}): {galat.decode(errors="ignore")[:300]}')
            raise KonversiPdfGagal('LibreOffice gagal mengonversi berkas ke PDF.')
        with open(hasil, 'rb') as f:
            return f.read()
