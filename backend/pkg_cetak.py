"""Cetak dokumen resmi PKG dari template Excel (salinan di memori; berkas master tidak pernah ditulis).

Rekap hasil (rekap_hasil_pkg_v2026.xlsx, sheet 'Rekap hasil PKG'), posisi sel dari pkg_template.PETA_CETAK['rekap']:
    A1/A2   judul & sub-judul (tahun, semester, tahun pelajaran periode)
    baris 6 dst.  No | Nama Guru | Pangkat/Gol | Mapel | Tugas tambahan | NKG (capaian %) | Predikat (rumus) | Rekomendasi
    Template menyediakan 10 baris; baris disisipkan bila guru lebih banyak, baris sisa dikosongkan.
    Jumlah & rata-rata ditulis ulang dengan rumus yang benar (rumus asli template menjumlah sel label & membagi 10).
    G19 tempat & tanggal, G24 nama kepala madrasah.
Predikat rekap memakai rumus template (Sangat Baik >= 91, Baik >= 76, Cukup >= 61, Sedang >= 60, Kurang).
"""
import re
from copy import copy
from datetime import date
from typing import Any, Dict, List, Optional

from openpyxl.worksheet.worksheet import Worksheet

from pkg_template import PETA_CETAK, isi_template_ke_bytes

BULAN = ('Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November',
         'Desember')


def tanggal_indonesia(tgl: date) -> str:
    return f'{tgl.day} {BULAN[tgl.month - 1]} {tgl.year}'


def predikat_rekap(nkg: Optional[float]) -> str:
    """Predikat skala rekap (rumus kolom G template rekap); dipakai juga oleh PDF cadangan."""
    if nkg is None:
        return ''
    if nkg >= 91:
        return 'Sangat Baik'
    if nkg >= 76:
        return 'Baik'
    if nkg >= 61:
        return 'Cukup'
    if nkg >= 60:
        return 'Sedang'
    return 'Kurang'


def _rumus_predikat(sel: str) -> str:
    return (f'=IF({sel}="","",IF({sel}>=91,"Sangat Baik",IF({sel}>=76,"Baik",IF({sel}>=61,"Cukup",'
            f'IF({sel}>=60,"Sedang","Kurang")))))')


def _salin_gaya_baris(ws: Worksheet, sumber: int, tujuan: int, kolom_maks: int) -> None:
    for c in range(1, kolom_maks + 1):
        a, b = ws.cell(sumber, c), ws.cell(tujuan, c)
        if a.has_style:
            b._style = copy(a._style)
    ws.row_dimensions[tujuan].height = ws.row_dimensions[sumber].height


def isi_rekap(ws: Worksheet, guru: List[Dict[str, Any]], periode: Dict[str, Any], kepala: Optional[str] = None,
              tanggal_cetak: Optional[date] = None) -> None:
    """Isi sheet rekap dengan baris guru (terurut seperti diberikan). `guru` = baris rekap terkunci:
    {nama, pangkat?, mapel, tugas_tambahan?, capaian_persen, rekomendasi?}."""
    peta = PETA_CETAK['rekap']
    k = peta['kolom']
    awal, tersedia = peta['baris_awal'], peta['baris_tersedia']
    kolom_maks = ws.max_column
    tambahan = max(0, len(guru) - tersedia)

    # Sisipkan baris sebelum baris Jumlah; sel gabungan di bawahnya dipindah manual (openpyxl tidak menggesernya).
    if tambahan:
        gabung_bawah = [r for r in list(ws.merged_cells.ranges) if r.min_row >= peta['baris_jumlah']]
        for r in gabung_bawah:
            ws.unmerge_cells(str(r))
        ws.insert_rows(peta['baris_jumlah'], tambahan)
        for r in gabung_bawah:
            r.shift(0, tambahan)
            ws.merge_cells(str(r))
        for i in range(tambahan):
            _salin_gaya_baris(ws, awal + tersedia - 1, awal + tersedia + i, kolom_maks)
    akhir = awal + max(len(guru), tersedia) - 1
    geser = tambahan

    # Judul: tahun & semester/tahun pelajaran periode.
    tahun = str((periode.get('tanggal_tutup') or periode.get('tanggal_buka') or '')[:4] or '')
    if tahun and isinstance(ws[peta['judul']].value, str):
        ws[peta['judul']] = re.sub(r'TAHUN \d{4}', f'TAHUN {tahun}', ws[peta['judul']].value)
    semester = (periode.get('semester') or '').upper()
    tp = periode.get('tahun_pelajaran') or ''
    ws[peta['subjudul']] = f'PADA SEMESTER {semester} TAHUN PELAJARAN {tp}'.strip()

    for i in range(awal, akhir + 1):
        g = guru[i - awal] if i - awal < len(guru) else None
        nilai = {
            'no': (i - awal + 1) if g else None,
            'nama': g.get('nama') if g else None,
            'pangkat': g.get('pangkat') if g else None,
            'mapel': g.get('mapel') if g else None,
            'tugas_tambahan': g.get('tugas_tambahan') if g else None,
            'nkg': round(float(g['capaian_persen']), 2) if g and g.get('capaian_persen') is not None else None,
            'predikat': _rumus_predikat(f"{k['nkg']}{i}") if g else None,
            'rekomendasi': g.get('rekomendasi') if g else None,
        }
        for kunci, kol in k.items():
            ws[f'{kol}{i}'] = nilai[kunci]
        ws[f"{k['nkg']}{i}"].number_format = '0.00'

    rentang = f"{k['nkg']}{awal}:{k['nkg']}{akhir}"
    baris_jumlah, baris_rata = peta['baris_jumlah'] + geser, peta['baris_rata'] + geser
    ws[f"{k['nkg']}{baris_jumlah}"] = f'=SUM({rentang})'
    ws[f"{k['nkg']}{baris_rata}"] = f'=IF(COUNT({rentang})=0,"",ROUND(AVERAGE({rentang}),2))'
    ws[f"{k['nkg']}{baris_rata}"].number_format = '0.00'
    ws[f"{k['predikat']}{baris_rata}"] = _rumus_predikat(f"{k['nkg']}{baris_rata}")

    sel_tanggal = _geser_sel(peta['tempat_tanggal'], geser)
    teks = str(ws[sel_tanggal].value or '')
    kota = teks.split(',')[0].strip() if ',' in teks else ''
    tgl = tanggal_indonesia(tanggal_cetak or date.today())
    ws[sel_tanggal] = f'{kota}, {tgl}' if kota else tgl
    if kepala:
        ws[_geser_sel(peta['nama_kepala'], geser)] = kepala


def _geser_sel(sel: str, baris: int) -> str:
    m = re.match(r'^([A-Z]+)(\d+)$', sel)
    return f'{m.group(1)}{int(m.group(2)) + baris}'


def rekap_excel(guru: List[Dict[str, Any]], periode: Dict[str, Any], kepala: Optional[str] = None,
                tanggal_cetak: Optional[date] = None) -> bytes:
    """Berkas .xlsx rekap hasil PKG dari template resmi (template harus utuh sesuai checksum resmi)."""
    sheet = PETA_CETAK['rekap']['sheet']
    return isi_template_ke_bytes('rekap', lambda wb: isi_rekap(wb[sheet], guru, periode, kepala, tanggal_cetak))
