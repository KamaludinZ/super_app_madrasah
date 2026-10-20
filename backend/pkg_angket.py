"""Angket penilaian 360° PKG (sejawat, peserta didik, orang tua/wali) mengikuti template resmi pkg_template_v2026.xlsx.

Butir angket dibaca dari sheet isian template (SEJAWAT, SISWA, ORTU: kolom C komponen, D nomor, E pernyataan) sehingga
urutan butir di aplikasi, angket cetak, dan berkas laporan selalu sama. Angket kertas dicetak dari bagian sheet
FORM-360-GR yang sesuai (identitas guru diisi, area cetak dibatasi bagian itu, sheet lain disembunyikan). Skor tiap
butir 0 (tidak ada bukti) / 1 (terpenuhi sebagian) / 2 (seluruhnya terpenuhi). DUDI tidak dipakai (khusus SMK).
"""
from typing import Any, Dict, List, Optional

from pkg_template import buka_template, isi_template_ke_bytes, tampilkan_hanya

# form: rentang baris bagian FORM-360-GR (area cetak B:H); identitas: sel nama, NIP, tugas tambahan di bagian itu.
# baris: rentang baris butir pada sheet isian; kolom penilai: 10 blok (0/1/2) mulai kolom F, label nomor di baris 7.
JENIS_ANGKET: Dict[str, Dict[str, Any]] = {
    'sejawat': {'label': 'Teman Sejawat', 'sheet': 'SEJAWAT', 'baris': (9, 36), 'form': (2, 50), 'identitas': ('E6', 'E7', 'E8')},
    'siswa': {'label': 'Peserta Didik', 'sheet': 'SISWA', 'baris': (9, 48), 'form': (52, 124), 'identitas': ('E56', 'E57', 'E58')},
    'ortu': {'label': 'Orang Tua/Wali', 'sheet': 'ORTU', 'baris': (9, 16), 'form': (155, 188), 'identitas': ('E159', 'E160', 'E161')},
}
SHEET_FORM = 'FORM-360-GR'
SKOR_ANGKET = (0, 1, 2)
MAKS_RESPONDEN = 10  # template menyediakan 10 kolom penilai per sheet

_BUTIR: Dict[str, List[Dict[str, Any]]] = {}


class AngketTidakSesuai(Exception):
    """Sheet angket template tidak sesuai struktur yang diharapkan."""


def _baca_butir(wb, jenis: str) -> List[Dict[str, Any]]:
    cfg = JENIS_ANGKET[jenis]
    ws = wb[cfg['sheet']]
    butir, komponen = [], None
    for baris in range(cfg['baris'][0], cfg['baris'][1] + 1):
        if ws[f'C{baris}'].value:
            komponen = str(ws[f'C{baris}'].value).strip()
        nomor, teks = ws[f'D{baris}'].value, ws[f'E{baris}'].value
        if not isinstance(nomor, (int, float)) or not teks:
            raise AngketTidakSesuai(f"{cfg['sheet']}!D{baris}:E{baris} bukan butir angket.")
        butir.append({'no': len(butir) + 1, 'kode': f'{jenis}.{len(butir) + 1}', 'komponen': komponen,
                      'nomor': int(nomor), 'pernyataan': ' '.join(str(teks).split()), 'baris': baris})
    return butir


def butir_angket(jenis: str) -> List[Dict[str, Any]]:
    """Daftar butir angket satu jenis: [{no, kode, komponen, nomor, pernyataan, baris}] (dibaca sekali dari template)."""
    if jenis not in JENIS_ANGKET:
        raise KeyError(jenis)
    if jenis not in _BUTIR:
        wb = buka_template('instrumen')
        try:
            for j in JENIS_ANGKET:
                _BUTIR[j] = _baca_butir(wb, j)
        finally:
            wb.close()
    return _BUTIR[jenis]


def daftar_jenis() -> List[Dict[str, Any]]:
    """Jenis angket beserta jumlah butir & skor maksimum per responden (jumlah butir x 2)."""
    return [{'jenis': j, 'label': c['label'], 'sheet': c['sheet'], 'jumlah_butir': len(butir_angket(j)),
             'skor_maks': len(butir_angket(j)) * max(SKOR_ANGKET), 'maks_responden': MAKS_RESPONDEN}
            for j, c in JENIS_ANGKET.items()]


def isi_form_angket(wb, jenis: str, guru: Optional[Dict[str, Any]] = None) -> None:
    """Siapkan workbook untuk mencetak angket kertas satu jenis: identitas guru di bagian FORM-360-GR (kosong = titik-
    titik isian template dipertahankan), area cetak bagian itu saja, dan sheet lain disembunyikan."""
    cfg = JENIS_ANGKET[jenis]
    ws = wb[SHEET_FORM]
    if guru:
        for sel, nilai in zip(cfg['identitas'], (guru.get('nama'), guru.get('nip'), guru.get('tugas_tambahan'))):
            ws[sel] = f": {nilai or '-'}"
    awal, akhir = cfg['form']
    ws.print_area = f'B{awal}:H{akhir}'
    # Kolom skor terakhir (H) melewati lebar kertas pada setelan template; muatkan lebar ke 1 halaman, tinggi bebas.
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
    tampilkan_hanya(wb, [SHEET_FORM])


def angket_excel(jenis: str, guru: Optional[Dict[str, Any]] = None) -> bytes:
    """Berkas .xlsx angket kertas satu jenis dari template resmi (lihat isi_form_angket)."""
    return isi_template_ke_bytes('instrumen', lambda wb: isi_form_angket(wb, jenis, guru))
