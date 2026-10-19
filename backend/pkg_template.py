"""Berkas template resmi PKG (Excel) di folder internal backend/templates/.

    pkg_template_v2026.xlsx     instrumen PKG (kompetensi, indikator, bobot) — sumber impor instrumen
    rekap_hasil_pkg_v2026.xlsx  format rekap hasil PKG — dasar cetak Excel/PDF

Berkas hanya dibuka dari path internal ini (nama berkas tetap, bukan masukan pengguna) dan tidak pernah
ditimpa; hasil cetak ditulis ke salinan sementara. Saat startup `periksa_template()` memberi peringatan di log
bila ada berkas yang tidak ditemukan atau isinya berbeda dari checksum resmi, agar masalah image/volume
terdeteksi sebelum pengguna mencetak.

Mengganti berkas template resmi = menaikkan VERSI_TEMPLATE, nama berkas, dan CHECKSUM_RESMI bersamaan.
"""
import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger('matsandatama')

FOLDER_TEMPLATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
VERSI_TEMPLATE = '2026'

# Versi & SHA-256 resmi tiap berkas template (isi berkas yang disahkan untuk cetak dokumen resmi).
TEMPLATE_PKG = {
    'instrumen': {
        'nama_berkas': 'pkg_template_v2026.xlsx', 'judul': 'Instrumen PKG Tahun 2026', 'versi': '2026',
        'checksum_resmi': 'e4e768b7b5dfbdbc1a32a1b88d9a731bcceac2c1ffd2af9801aa8a994f637da5',
    },
    'rekap': {
        'nama_berkas': 'rekap_hasil_pkg_v2026.xlsx', 'judul': 'Rekap Hasil PKG 2026', 'versi': '2026',
        'checksum_resmi': '5a8d72c523c82869b3a874679eb6392d2e365660af3d81628e750b89376a775e',
    },
}


def path_template(jenis: str) -> str:
    """Path absolut berkas template `jenis` ('instrumen' | 'rekap') di folder internal."""
    if jenis not in TEMPLATE_PKG:
        raise ValueError(f'jenis template tidak dikenal: {jenis}')
    return os.path.join(FOLDER_TEMPLATE, TEMPLATE_PKG[jenis]['nama_berkas'])


def hitung_checksum(path: str) -> Optional[str]:
    """SHA-256 isi berkas (dibaca per blok, hanya-baca); None bila berkas tidak ada."""
    if not os.path.isfile(path):
        return None
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for blok in iter(lambda: f.read(1024 * 1024), b''):
            h.update(blok)
    return h.hexdigest()


def info_berkas(jenis: str) -> Dict[str, Any]:
    """Info satu berkas template: versi, ukuran, checksum vs checksum resmi, status 'cocok'|'berbeda'|'hilang'."""
    info = TEMPLATE_PKG[jenis]
    path = path_template(jenis)
    checksum = hitung_checksum(path)
    status = 'hilang' if checksum is None else 'cocok' if checksum == info['checksum_resmi'] else 'berbeda'
    return {
        'jenis': jenis, 'nama_berkas': info['nama_berkas'], 'judul': info['judul'], 'versi': info['versi'],
        'ukuran': os.path.getsize(path) if checksum is not None else None,
        'checksum': checksum, 'checksum_resmi': info['checksum_resmi'], 'status': status,
        'ada': checksum is not None,
    }


def periksa_template() -> Dict[str, Any]:
    """Periksa keberadaan & checksum semua berkas template. Dipanggil saat startup; berkas hilang atau berubah
    dicatat sebagai peringatan. Bentuk hasil mengikuti GET /pkg/template/info."""
    berkas = [info_berkas(jenis) for jenis in TEMPLATE_PKG]
    for b in berkas:
        if b['status'] == 'hilang':
            logger.warning(f"[pkg] Berkas template {b['nama_berkas']} tidak ditemukan di {FOLDER_TEMPLATE}; "
                           "impor instrumen & cetak PKG tidak akan berjalan sampai berkas tersedia.")
        elif b['status'] == 'berbeda':
            logger.warning(f"[pkg] Checksum berkas template {b['nama_berkas']} berbeda dari checksum resmi "
                           f"v{b['versi']}; cetak dokumen resmi dapat tidak sesuai.")
    hasil = {'folder': FOLDER_TEMPLATE, 'versi': VERSI_TEMPLATE, 'versi_template': VERSI_TEMPLATE,
             'diperiksa_pada': datetime.now(timezone.utc).isoformat(), 'berkas': berkas,
             'lengkap': all(b['ada'] for b in berkas), 'utuh': all(b['status'] == 'cocok' for b in berkas)}
    if hasil['utuh']:
        logger.info(f"[pkg] Berkas template PKG v{VERSI_TEMPLATE} lengkap & checksum cocok ({len(berkas)} berkas).")
    return hasil
