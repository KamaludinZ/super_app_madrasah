"""Lokasi penyimpanan berkas unggahan (satu sumber untuk semua router upload).

Root default = folder `uploads` di samping kode backend:
  - container (Dockerfile & Coolify): /app/uploads  -> dipasang sebagai volume `./uploads:/app/uploads`
    di docker-compose, sehingga berkas TIDAK hilang saat redeploy.
  - lokal: backend/uploads
Bisa diganti lewat env UPLOAD_ROOT (path absolut).

Versi lama menulis ke `<repo>/uploads` (di container: /uploads, di luar volume -> hilang tiap redeploy).
`pindahkan_unggahan_lama()` menyalin berkas dari lokasi lama itu ke root baru saat startup (idempoten).
"""
import logging
import os
import shutil
from typing import Dict

logger = logging.getLogger('matsandatama')

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_ROOT = os.path.abspath(os.environ.get('UPLOAD_ROOT') or os.path.join(_BACKEND_DIR, 'uploads'))
LOKASI_LAMA = os.path.abspath(os.path.join(_BACKEND_DIR, '..', 'uploads'))

# Subfolder per jenis unggahan
SUBFOLDER = ('achievements', 'dokumen_siswa', 'student_detail', 'gtk_berkas')


def folder_unggahan(nama: str) -> str:
    """Path absolut subfolder unggahan (dibuat bila belum ada)."""
    path = os.path.join(UPLOAD_ROOT, nama)
    os.makedirs(path, exist_ok=True)
    return path


def pindahkan_unggahan_lama() -> int:
    """Salin berkas dari lokasi lama ke UPLOAD_ROOT bila belum ada di sana. -> jumlah berkas disalin."""
    if os.path.normcase(LOKASI_LAMA) == os.path.normcase(UPLOAD_ROOT) or not os.path.isdir(LOKASI_LAMA):
        return 0
    n = 0
    for akar, _, berkas in os.walk(LOKASI_LAMA):
        tujuan_dir = os.path.join(UPLOAD_ROOT, os.path.relpath(akar, LOKASI_LAMA))
        for nama in berkas:
            tujuan = os.path.join(tujuan_dir, nama)
            if not os.path.exists(tujuan):
                os.makedirs(tujuan_dir, exist_ok=True)
                shutil.copy2(os.path.join(akar, nama), tujuan)
                n += 1
    return n


def periksa_penyimpanan() -> Dict:
    """Siapkan folder, salin berkas lama, dan uji tulis. Dipanggil saat startup; hasil dicatat di log."""
    hasil = {'root': UPLOAD_ROOT, 'disalin': 0, 'bisa_tulis': False, 'jumlah_berkas': 0}
    try:
        for nama in SUBFOLDER:
            folder_unggahan(nama)
        hasil['disalin'] = pindahkan_unggahan_lama()
        uji = os.path.join(UPLOAD_ROOT, f'.uji_tulis_{os.getpid()}')  # unik per worker uvicorn
        with open(uji, 'w') as f:
            f.write('ok')
        os.remove(uji)
        hasil['bisa_tulis'] = True
        hasil['jumlah_berkas'] = sum(len(b) for _, _, b in os.walk(UPLOAD_ROOT))
    except Exception as e:  # noqa: BLE001
        hasil['galat'] = str(e)
    # Di dalam container, folder unggahan harus volume/persistent storage; bila tidak, berkas hilang saat redeploy.
    hasil['di_container'] = os.path.exists('/.dockerenv')
    hasil['volume'] = os.path.ismount(UPLOAD_ROOT)
    if hasil['di_container'] and not hasil['volume']:
        logger.warning(f"[unggahan] PERINGATAN: {UPLOAD_ROOT} BUKAN volume — berkas unggahan akan HILANG saat redeploy. "
                       f"Pasang persistent storage/volume ke {UPLOAD_ROOT} (lihat docs/deployment/COOLIFY_DEPLOYMENT.md).")
    if hasil['bisa_tulis']:
        logger.info(f"[unggahan] folder {UPLOAD_ROOT} siap ({hasil['jumlah_berkas']} berkas"
                    f"{', ' + str(hasil['disalin']) + ' disalin dari lokasi lama' if hasil['disalin'] else ''})")
    else:
        logger.error(f"[unggahan] folder {UPLOAD_ROOT} TIDAK bisa ditulis: {hasil.get('galat')}")
    return hasil
