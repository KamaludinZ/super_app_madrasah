"""Berkas template resmi PKG (Excel) di folder internal backend/templates/.

    pkg_template_v2026.xlsx     instrumen PKG (kompetensi, indikator, bobot) — sumber impor instrumen
    rekap_hasil_pkg_v2026.xlsx  format rekap hasil PKG — dasar cetak Excel/PDF

Berkas hanya dibuka dari path internal ini (nama berkas tetap, bukan masukan pengguna) dan tidak pernah
ditimpa; hasil cetak ditulis ke salinan sementara. Saat startup `periksa_template()` memberi peringatan di log
bila ada berkas yang tidak ditemukan, agar masalah image/volume terdeteksi sebelum pengguna mencetak.
"""
import logging
import os
from typing import Any, Dict

logger = logging.getLogger('matsandatama')

FOLDER_TEMPLATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
VERSI_TEMPLATE = '2026'

TEMPLATE_PKG = {
    'instrumen': {'nama_berkas': 'pkg_template_v2026.xlsx', 'judul': 'Instrumen PKG Tahun 2026'},
    'rekap': {'nama_berkas': 'rekap_hasil_pkg_v2026.xlsx', 'judul': 'Rekap Hasil PKG 2026'},
}


def path_template(jenis: str) -> str:
    """Path absolut berkas template `jenis` ('instrumen' | 'rekap') di folder internal."""
    if jenis not in TEMPLATE_PKG:
        raise ValueError(f'jenis template tidak dikenal: {jenis}')
    return os.path.join(FOLDER_TEMPLATE, TEMPLATE_PKG[jenis]['nama_berkas'])


def periksa_template() -> Dict[str, Any]:
    """Periksa keberadaan semua berkas template. Dipanggil saat startup; berkas hilang dicatat sebagai peringatan."""
    berkas = []
    for jenis, info in TEMPLATE_PKG.items():
        path = path_template(jenis)
        ada = os.path.isfile(path)
        berkas.append({'jenis': jenis, 'nama_berkas': info['nama_berkas'], 'ada': ada,
                       'ukuran': os.path.getsize(path) if ada else None})
        if not ada:
            logger.warning(f"[pkg] Berkas template {info['nama_berkas']} tidak ditemukan di {FOLDER_TEMPLATE}; "
                           "impor instrumen & cetak PKG tidak akan berjalan sampai berkas tersedia.")
    hasil = {'folder': FOLDER_TEMPLATE, 'versi': VERSI_TEMPLATE, 'berkas': berkas,
             'lengkap': all(b['ada'] for b in berkas)}
    if hasil['lengkap']:
        logger.info(f"[pkg] Berkas template PKG v{VERSI_TEMPLATE} lengkap ({len(berkas)} berkas).")
    return hasil
