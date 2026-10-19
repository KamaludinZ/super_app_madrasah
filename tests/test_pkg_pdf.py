"""Konversi PDF via LibreOffice: rekap & laporan per guru dari template resmi (dilewati bila LibreOffice tidak ada)."""

import asyncio
import os
import shutil
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_cetak  # noqa: E402
import pkg_pdf  # noqa: E402

perlu_lo = pytest.mark.skipif(not pkg_pdf.libreoffice_tersedia(), reason='LibreOffice tidak tersedia')
PERIODE = {'semester': 'Ganjil', 'tahun_pelajaran': '2026/2027', 'tanggal_buka': '2026-10-01', 'tanggal_tutup': '2026-11-30'}


def _teks_pdf(isi, tmp_path):
    if not shutil.which('pdftotext'):
        return None
    f = tmp_path / 'x.pdf'
    f.write_bytes(isi)
    return subprocess.run(['pdftotext', '-layout', str(f), '-'], capture_output=True, text=True, check=True).stdout


@perlu_lo
def test_rekap_ke_pdf(tmp_path):
    xlsx = pkg_cetak.rekap_excel([{'nama': 'Budi Santoso', 'capaian_persen': 80.0}, {'nama': 'Siti Aminah', 'capaian_persen': 95.5}], PERIODE)
    pdf = asyncio.run(pkg_pdf.xlsx_ke_pdf(xlsx, 'rekap.xlsx'))
    assert pdf.startswith(b'%PDF')
    teks = _teks_pdf(pdf, tmp_path)
    if teks is not None:  # rumus predikat & rata-rata dihitung LibreOffice
        assert 'Budi Santoso' in teks and 'Sangat Baik' in teks and 'Baik' in teks and '87.75' in teks.replace(',', '.')


@perlu_lo
def test_laporan_guru_ke_pdf_hanya_rekapitulasi(tmp_path):
    import pkg_instrumen_impor
    kompetensi = pkg_instrumen_impor.pratinjau_dari_template()['kompetensi']
    isian = {s['kode']: {'centang': [1, 2, 3, 4]} for k in kompetensi for s in k['sub']}
    laporan = {'guru': {'nama': 'Budi Santoso', 'nip': '1987'}, 'periode': PERIODE, 'sk': {'nomor_sk': 'B-1'},
               'penilai': {'nama': 'Penilai'}, 'kepala': {'nama': 'Kepala'}, 'instrumen': {'kompetensi': kompetensi},
               'isian': isian, 'terkunci_pada': '2026-10-18'}
    pdf = asyncio.run(pkg_pdf.xlsx_ke_pdf(pkg_cetak.laporan_guru_excel(laporan, hanya_rekap=True), 'laporan.xlsx'))
    assert pdf.startswith(b'%PDF')
    teks = _teks_pdf(pdf, tmp_path)
    if teks is not None:
        assert 'REKAPITULASI' in teks.upper() and 'Budi Santoso' in teks
        assert '48' in teks and 'Level 4' in teks and 'Ahli Madya' in teks  # 12 x 4 = 48 -> 80% -> Level 4, Madya
        assert 'PETUNJUK' not in teks  # sheet 00-DATA tidak ikut tercetak


def test_libreoffice_tidak_ada(monkeypatch):
    monkeypatch.setattr(pkg_pdf, 'cari_soffice', lambda: None)
    with pytest.raises(pkg_pdf.LibreOfficeTidakTersedia):
        asyncio.run(pkg_pdf.xlsx_ke_pdf(b'x'))


def test_konversi_gagal(monkeypatch, tmp_path):
    palsu = tmp_path / 'soffice'
    palsu.write_text('#!/bin/sh\nexit 3\n')
    palsu.chmod(0o755)
    monkeypatch.setenv('PKG_SOFFICE', str(palsu))
    with pytest.raises(pkg_pdf.KonversiPdfGagal):
        asyncio.run(pkg_pdf.xlsx_ke_pdf(b'x'))
    lambat = tmp_path / 'lambat'
    lambat.write_text('#!/bin/sh\nsleep 5\n')
    lambat.chmod(0o755)
    monkeypatch.setenv('PKG_SOFFICE', str(lambat))
    with pytest.raises(pkg_pdf.KonversiPdfGagal):
        asyncio.run(pkg_pdf.xlsx_ke_pdf(b'x', batas_detik=0.5))
