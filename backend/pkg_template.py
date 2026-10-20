"""Berkas template resmi PKG (Excel) di folder internal backend/templates/.

    pkg_template_v2026.xlsx     instrumen PKG (kompetensi, indikator, bobot) — sumber impor instrumen
    rekap_hasil_pkg_v2026.xlsx  format rekap hasil PKG — dasar cetak Excel/PDF

Berkas hanya dibuka dari path internal ini (nama berkas tetap, bukan masukan pengguna) dan tidak pernah
ditimpa; hasil cetak ditulis ke salinan sementara. Saat startup `periksa_template()` memberi peringatan di log
bila ada berkas yang tidak ditemukan atau isinya berbeda dari checksum resmi, agar masalah image/volume
terdeteksi sebelum pengguna mencetak.

Mengganti berkas template resmi = menaikkan VERSI_TEMPLATE, nama berkas, dan CHECKSUM_RESMI bersamaan.
"""
import contextlib
import hashlib
import io
import logging
import os
import re
import shutil
import tempfile
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, Iterator, Optional

from openpyxl import Workbook, load_workbook

logger = logging.getLogger('matsandatama')

FOLDER_TEMPLATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
VERSI_TEMPLATE = '2026'

# Versi & SHA-256 resmi tiap berkas template (isi berkas yang disahkan untuk cetak dokumen resmi).
TEMPLATE_PKG = {
    'instrumen': {
        'nama_berkas': 'pkg_template_v2026.xlsx', 'judul': 'Instrumen PKG Tahun 2026', 'versi': '2026',
        'checksum_resmi': 'e4e768b7b5dfbdbc1a32a1b88d9a731bcceac2c1ffd2af9801aa8a994f637da5',
        # Sheet wajib: empat kompetensi (sumber impor instrumen) & rekap per guru (format cetak).
        'sheet_wajib': ('KOMP-1', 'KOMP (2)', 'KOMP (3)', 'KOMP (4)', '04-RKAP-PKG'),
    },
    'rekap': {
        'nama_berkas': 'rekap_hasil_pkg_v2026.xlsx', 'judul': 'Rekap Hasil PKG 2026', 'versi': '2026',
        'checksum_resmi': '5a8d72c523c82869b3a874679eb6392d2e365660af3d81628e750b89376a775e',
        'sheet_wajib': ('Rekap hasil PKG',),
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


# Sheet kompetensi di template instrumen, berurutan sesuai kode kompetensi 1–4.
SHEET_KOMPETENSI = TEMPLATE_PKG['instrumen']['sheet_wajib'][:4]

# Peta sel pengisian cetak (posisi tetap pada template resmi v2026; diverifikasi lewat label jangkar).
#   rekap     : satu baris per guru mulai baris 6 (template menyediakan 10 baris; baris ditambah bila perlu),
#               kolom F = Nilai Kompetensi Guru (capaian %), G = predikat skala rekap (rumus di template).
#   instrumen : laporan per guru — identitas di '00-DATA', centang indikator 'v' di kolom B sheet KOMP-n
#               (sub ke-1/2/3 mulai baris 7/20/33, Level 1–5 berurutan); hasil dihitung rumus 04-RKAP-PKG.
PETA_CETAK = {
    'rekap': {
        'sheet': 'Rekap hasil PKG', 'judul': 'A1', 'subjudul': 'A2', 'baris_awal': 6, 'baris_tersedia': 10,
        'kolom': {'no': 'A', 'nama': 'B', 'pangkat': 'C', 'mapel': 'D', 'tugas_tambahan': 'E', 'nkg': 'F', 'predikat': 'G',
                  'rekomendasi': 'H'},
        'baris_jumlah': 16, 'baris_rata': 17, 'tempat_tanggal': 'G19', 'nama_kepala': 'G24',
        'jangkar': {'A5': 'No', 'B5': 'Nama Guru', 'F5': 'Nilai Kompetensi Guru', 'G5': 'Predikat', 'A16': 'Jumlah',
                    'A17': 'Rata', 'G20': 'Kepala'},
    },
    'instrumen': {
        'sheet_rekap': '04-RKAP-PKG', 'sheet_data': '00-DATA',
        'data': {'nama_guru': 'E5', 'nip_guru': 'E6', 'tahun': 'E15', 'nama_kepala': 'E17', 'nip_kepala': 'E18',
                 'nama_sekolah': 'E26', 'penilai': 'E33', 'nip_penilai': 'E34', 'nomor_sk': 'E36', 'tanggal_sk': 'E37',
                 'periode_awal': 'C41', 'periode_akhir': 'E41', 'tanggal_nilai': 'H41'},
        'kolom_centang': 'B', 'baris_sub': (7, 20, 33),
        'jangkar': {('00-DATA', 'C5'): 'Nama Guru', ('00-DATA', 'C33'): 'Penilai', ('00-DATA', 'C17'): 'Nama Kepsek',
                    ('04-RKAP-PKG', 'B44'): 'Jumlah', ('04-RKAP-PKG', 'B45'): 'Cap. Tingkat Kompetensi'},
    },
}


def _jangkar_instrumen() -> Dict[tuple, str]:
    """Jangkar kode indikator 'L.M' pada kolom C tiap sheet kompetensi (baris pertama & terakhir tiap sub)."""
    peta = PETA_CETAK['instrumen']
    hasil = dict(peta['jangkar'])
    for sheet in SHEET_KOMPETENSI:
        for urutan, baris in enumerate(peta['baris_sub'], 1):
            hasil[(sheet, f'C{baris}')] = f'1.{urutan}'
            hasil[(sheet, f'C{baris + 4}')] = f'5.{urutan}'
    return hasil


def periksa_struktur_cetak(jenis: str, isi: Optional[bytes] = None) -> list:
    """Label jangkar yang tidak cocok pada template `jenis` (kosong = peta sel cetak masih berlaku)."""
    try:
        wb = load_workbook(io.BytesIO(isi if isi is not None else baca_bytes_template(jenis)), read_only=True)
    except Exception as e:  # noqa: BLE001
        return [f'berkas tidak dapat dibuka: {e}']
    salah = []
    try:
        if jenis == 'rekap':
            peta = PETA_CETAK['rekap']
            jangkar = {(peta['sheet'], sel): label for sel, label in peta['jangkar'].items()}
        else:
            jangkar = _jangkar_instrumen()
        for (sheet, sel), label in jangkar.items():
            if sheet not in wb.sheetnames:
                salah.append(f'{sheet} tidak ada')
                continue
            nilai = str(wb[sheet][sel].value or '').strip()
            if not nilai.lower().startswith(label.lower()):
                salah.append(f'{sheet}!{sel} = "{nilai[:30]}" (seharusnya diawali "{label}")')
    finally:
        wb.close()
    return salah


def sheet_hilang(jenis: str) -> Optional[list]:
    """Sheet wajib yang tidak ada di berkas template; None bila berkas tidak dapat dibuka."""
    try:
        wb = load_workbook(path_template(jenis), read_only=True)
    except Exception:  # noqa: BLE001
        return None
    try:
        return [n for n in TEMPLATE_PKG[jenis]['sheet_wajib'] if n not in wb.sheetnames]
    finally:
        wb.close()


def info_berkas(jenis: str) -> Dict[str, Any]:
    """Info satu berkas template: versi, ukuran, checksum vs checksum resmi, status 'cocok'|'berbeda'|'hilang'."""
    info = TEMPLATE_PKG[jenis]
    path = path_template(jenis)
    checksum = hitung_checksum(path)
    status = 'hilang' if checksum is None else 'cocok' if checksum == info['checksum_resmi'] else 'berbeda'
    # Isi yang cocok checksum resmi pasti memuat semua sheet & sel cetak; berkas berbeda diperiksa strukturnya.
    hilang = [] if status == 'cocok' else (sheet_hilang(jenis) if checksum is not None else None)
    struktur = [] if status == 'cocok' else (periksa_struktur_cetak(jenis) if checksum is not None and not hilang else None)
    return {
        'jenis': jenis, 'nama_berkas': info['nama_berkas'], 'judul': info['judul'], 'versi': info['versi'],
        'ukuran': os.path.getsize(path) if checksum is not None else None,
        'checksum': checksum, 'checksum_resmi': info['checksum_resmi'], 'status': status,
        'ada': checksum is not None,
        'sheet_hilang': hilang,
        'struktur_cetak_salah': struktur,
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
            if b['struktur_cetak_salah']:
                logger.warning(f"[pkg] Tata letak berkas template {b['nama_berkas']} berubah; cetak dapat mengisi sel yang "
                               f"salah: {'; '.join(b['struktur_cetak_salah'][:3])}")
            if b['sheet_hilang'] is None or b['sheet_hilang']:
                logger.warning(f"[pkg] Berkas template {b['nama_berkas']} tidak memuat sheet wajib: "
                               f"{b['sheet_hilang'] if b['sheet_hilang'] is not None else 'berkas tidak dapat dibuka'}.")
    hasil = {'folder': FOLDER_TEMPLATE, 'versi': VERSI_TEMPLATE, 'versi_template': VERSI_TEMPLATE,
             'diperiksa_pada': datetime.now(timezone.utc).isoformat(), 'berkas': berkas,
             'lengkap': all(b['ada'] for b in berkas), 'utuh': all(b['status'] == 'cocok' for b in berkas)}
    if hasil['utuh']:
        logger.info(f"[pkg] Berkas template PKG v{VERSI_TEMPLATE} lengkap & checksum cocok ({len(berkas)} berkas).")
    return hasil


# Hasil pemeriksaan terakhir di proses ini (diisi saat startup; dipakai endpoint info tanpa membaca ulang berkas).
HASIL_TERAKHIR: Dict[str, Any] = {}


async def periksa_template_startup(db) -> Dict[str, Any]:
    """Pemeriksaan saat startup: periksa berkas, simpan ke koleksi pkg_template (satu dokumen per jenis), dan
    simpan di memori. Kegagalan menyimpan ke basis data hanya dicatat; pemeriksaan berkas tetap berjalan."""
    from pkg_skema import KOLEKSI_TEMPLATE
    hasil = periksa_template()
    try:
        dihapus = bersihkan_sementara_lama()
        if dihapus:
            logger.info(f"[pkg] {dihapus} folder salinan sementara cetak lama dibersihkan.")
    except OSError as e:
        logger.warning(f"[pkg] Gagal membersihkan salinan sementara lama: {e}")
    HASIL_TERAKHIR.clear()
    HASIL_TERAKHIR.update(hasil)
    try:
        for b in hasil['berkas']:
            await db[KOLEKSI_TEMPLATE].update_one(
                {'jenis': b['jenis']},
                {'$set': {**{k: b[k] for k in ('nama_berkas', 'versi', 'checksum', 'checksum_resmi', 'status', 'ukuran')},
                          'diperiksa_pada': hasil['diperiksa_pada']}},
                upsert=True,
            )
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[pkg] Gagal menyimpan hasil pemeriksaan template: {e}")
    return hasil



# ---------------------------------------------------------------- baca template tanpa menimpa (pola ckg_impor/excel_io)

class TemplateTidakTersedia(Exception):
    """Berkas template tidak ada, atau isinya berbeda dari checksum resmi saat keutuhan diwajibkan."""


def baca_bytes_template(jenis: str, wajib_utuh: bool = False) -> bytes:
    """Isi berkas template `jenis` dari path internal (mode baca saja). `wajib_utuh` memeriksa checksum resmi."""
    path = path_template(jenis)
    if not os.path.isfile(path):
        raise TemplateTidakTersedia(f"Berkas template {TEMPLATE_PKG[jenis]['nama_berkas']} tidak ditemukan.")
    with open(path, 'rb') as f:
        isi = f.read()
    if wajib_utuh and hashlib.sha256(isi).hexdigest() != TEMPLATE_PKG[jenis]['checksum_resmi']:
        raise TemplateTidakTersedia(f"Berkas template {TEMPLATE_PKG[jenis]['nama_berkas']} berbeda dari versi resmi.")
    return isi


def buka_template(jenis: str, hanya_baca: bool = True, wajib_utuh: bool = False) -> Workbook:
    """Workbook template dimuat dari salinan bytes di memori, sehingga berkas asli tidak pernah dibuka untuk ditulis.
    `hanya_baca=True` (read_only + data_only) untuk impor/pembacaan cepat; False untuk diisi lalu disimpan ke
    tempat lain (format & rumus dipertahankan)."""
    isi = baca_bytes_template(jenis, wajib_utuh=wajib_utuh)
    if hanya_baca:
        return load_workbook(io.BytesIO(isi), read_only=True, data_only=True)
    return load_workbook(io.BytesIO(isi))


def tampilkan_hanya(wb: Workbook, nama_sheet: Iterable[str]) -> None:
    """Hanya sheet `nama_sheet` yang terlihat & tercetak (yang pertama jadi sheet aktif). Area cetak sheet lain dihapus
    karena LibreOffice tetap mengekspor sheet tersembunyi yang memiliki area cetak ke PDF; rumus yang merujuk sheet
    tersembunyi tetap dihitung."""
    nama = list(nama_sheet)
    utama = wb[nama[0]]
    wb.active = wb.worksheets.index(utama)
    for ws in wb.worksheets:
        terlihat = ws.title in nama
        ws.sheet_state = 'visible' if terlihat else 'hidden'
        ws.sheet_view.tabSelected = ws is utama
        if not terlihat:
            ws.print_area = None
            ws._print_rows = ws._print_cols = None


def isi_template_ke_bytes(jenis: str, pengisi: Callable[[Workbook], None], wajib_utuh: bool = True) -> bytes:
    """Muat template, jalankan `pengisi(wb)`, dan kembalikan hasilnya sebagai bytes .xlsx baru (template asli utuh)."""
    wb = buka_template(jenis, hanya_baca=False, wajib_utuh=wajib_utuh)
    pengisi(wb)
    keluaran = io.BytesIO()
    wb.save(keluaran)
    return keluaran.getvalue()


# Folder induk salinan sementara hasil cetak (bawaan: folder temp sistem). Tiap cetak memakai subfolder pkg_*.
PREFIKS_SEMENTARA = 'pkg_'


def folder_sementara() -> str:
    folder = os.environ.get('PKG_FOLDER_SEMENTARA') or tempfile.gettempdir()
    os.makedirs(folder, exist_ok=True)
    return folder


def nama_berkas_cetak(dasar: str, ekstensi: str) -> str:
    """Nama berkas unduhan aman: huruf/angka/garis bawah/tanda hubung, maks 80 karakter + ekstensi."""
    bersih = re.sub(r'[^A-Za-z0-9_-]+', '_', dasar or '').strip('_')[:80] or 'pkg'
    return f"{bersih}.{re.sub(r'[^a-z0-9]', '', ekstensi.lower()) or 'xlsx'}"


@contextlib.contextmanager
def salinan_sementara(isi: bytes, nama_berkas: str = 'pkg.xlsx') -> Iterator[str]:
    """Tulis `isi` ke berkas di folder sementara khusus (mis. untuk konversi PDF LibreOffice), lalu hapus
    seluruh folder setelah blok selesai. Nama berkas disaring agar tetap di dalam folder sementara."""
    folder = tempfile.mkdtemp(prefix=PREFIKS_SEMENTARA, dir=folder_sementara())
    try:
        path = os.path.join(folder, os.path.basename(nama_berkas) or 'pkg.xlsx')
        with open(path, 'wb') as f:
            f.write(isi)
        yield path
    finally:
        shutil.rmtree(folder, ignore_errors=True)


@contextlib.contextmanager
def cetak_ke_salinan_sementara(jenis: str, pengisi: Callable[[Workbook], None], nama_berkas: str) -> Iterator[str]:
    """Isi template `jenis` lalu tulis hasilnya ke salinan sementara; yield path .xlsx hasil (template asli utuh).
    Dipakai mesin cetak PDF yang membutuhkan berkas di disk; folder dihapus setelah blok selesai."""
    isi = isi_template_ke_bytes(jenis, pengisi)
    with salinan_sementara(isi, nama_berkas) as path:
        yield path


def bersihkan_sementara_lama(maks_umur_detik: int = 6 * 3600) -> int:
    """Hapus subfolder salinan sementara PKG yang tertinggal (mis. proses mati saat mencetak). Jumlah dihapus."""
    induk = folder_sementara()
    batas = time.time() - maks_umur_detik
    dihapus = 0
    for nama in os.listdir(induk):
        path = os.path.join(induk, nama)
        if nama.startswith(PREFIKS_SEMENTARA) and os.path.isdir(path) and os.path.getmtime(path) < batas:
            shutil.rmtree(path, ignore_errors=True)
            dihapus += 1
    return dihapus


def info_template(periksa_ulang: bool = False) -> Dict[str, Any]:
    """Info untuk GET /pkg/template/info: hasil pemeriksaan terakhir (atau periksa sekarang). Path folder server
    tidak disertakan."""
    if periksa_ulang or not HASIL_TERAKHIR:
        hasil = periksa_template()
        HASIL_TERAKHIR.clear()
        HASIL_TERAKHIR.update(hasil)
    kunci_berkas = ('jenis', 'nama_berkas', 'judul', 'versi', 'ukuran', 'checksum', 'checksum_resmi', 'status')
    return {
        'versi_template': HASIL_TERAKHIR['versi_template'],
        'diperiksa_pada': HASIL_TERAKHIR['diperiksa_pada'],
        'utuh': HASIL_TERAKHIR['utuh'],
        'berkas': [{k: b.get(k) for k in kunci_berkas} for b in HASIL_TERAKHIR['berkas']],
    }
