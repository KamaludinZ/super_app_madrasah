"""Ujian Madrasah — mesin cetak lembar Daftar Hadir & Berita Acara: template docx asli diisi (template teks & pola TTD
per ujian), PDF via LibreOffice dengan cadangan ReportLab."""
import asyncio
import io
import os
import sys
import zipfile
import xml.etree.ElementTree as ET

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import ujian_cetak as uc  # noqa: E402
import ujian_cetak_docx as cd  # noqa: E402
import ujian_cetak_pdf as cp  # noqa: E402


def _png(lebar=60, tinggi=20):
    from PIL import Image
    b = io.BytesIO()
    Image.new('RGBA', (lebar, tinggi), (0, 0, 0, 255)).save(b, 'PNG')
    return b.getvalue()


TPL = {'nama_madrasah': 'MTsN 2 Kota Malang', 'kop_madrasah': 'MTs NEGERI 2 KOTA MALANG', 'alamat': 'Jl. Uji No. 1, Kota Malang',
       'kota_ttd': 'Malang', 'singkatan_ujian': 'ASTS', 'nama_kegiatan': 'Asesmen Sumatif Tengah Semester',
       'catatan_kaki': 'Diisi mapel saat itu'}


def _dh(n=35, tampil=True):
    return {'template': TPL, 'pola_ttd': {'tampil_di_cetak': tampil, 'tinggi_mm': 12}, 'tahun_pelajaran': '2026/2027',
            'hari_tanggal': cd.hari_tanggal('2026-12-02'), 'pukul': '07.30 – 09.30 WIB', 'mapel': 'Matematika', 'ruang': '01',
            'kota_tanggal': 'Malang, 2 Desember 2026', 'pengawas': {'nama': 'Pak Pengawas', 'nip': '1970', 'ttd_png': _png()},
            'peserta': [{'nomor_peserta': f'01-{i:03d}', 'nama': f'Peserta {i}', 'kelas': '7A', 'ttd_png': _png() if i % 2 else None}
                        for i in range(1, n + 1)]}


def _ba(tampil=True):
    return {'template': TPL, 'pola_ttd': {'tampil_di_cetak': tampil, 'tinggi_mm': 12}, 'tahun_pelajaran': '2026/2027',
            'tanggal': '2026-12-02', 'jenjang': 8, 'jam_mulai': '07:30', 'jam_selesai': '09:30', 'ruang': '01',
            'mapel': 'Bahasa Indonesia', 'jumlah_peserta': 6, 'hadir': ['A1', 'A2', 'A3', 'A4', 'A5'], 'tidak_hadir': ['A6'],
            'catatan': 'Tertib.', 'pengawas': {'nama': 'Bu Pengawas', 'nip': '1980', 'ttd_png': _png()}}


def _media(docx):
    with zipfile.ZipFile(io.BytesIO(docx)) as z:
        return [n for n in z.namelist() if n.startswith('word/media/ttd_')]


def test_bahasa_indonesia():
    assert cd.terbilang(2026) == 'dua ribu dua puluh enam'
    assert [cd.terbilang(n) for n in (0, 1, 11, 12, 19, 20, 35, 100, 115, 1000)] == [
        'nol', 'satu', 'sebelas', 'dua belas', 'sembilan belas', 'dua puluh', 'tiga puluh lima', 'seratus', 'seratus lima belas', 'seribu']
    assert cd.hari_tanggal('2026-12-02') == 'Rabu, 2 Desember 2026'
    assert cd.huruf_besar_madrasah('MTsN 2 Kota Malang') == 'MTsN 2 KOTA MALANG'
    assert cd.baris_nomor(['1', '2', '3', '4', '5']) == ['1, 2, 3, 4,', '5'] and cd.baris_nomor([]) == ['-']


def test_struktur_template_tidak_berubah():
    """Pengisi bergantung pada urutan elemen template; berkas template yang diganti harus berstruktur sama."""
    with zipfile.ZipFile(cd.TEMPLATE_DH) as z:
        body = ET.fromstring(z.read('word/document.xml')).find(cd.W + 'body')
    assert len(body[4].findall(cd.W + 'tr')) == 33 and cd._teks_el(body[7]) == 'Pengawas Ruang'
    with zipfile.ZipFile(cd.TEMPLATE_BA) as z:
        body = ET.fromstring(z.read('word/document.xml')).find(cd.W + 'body')
    p = list(body)
    assert cd._teks_el(p[1]) == 'BERITA ACARA' and cd._teks_el(p[31]).startswith('Tanda Tangan')
    assert cd._teks_el(p[12]).startswith('Yang Hadir') and cd._teks_el(p[20]).startswith('Yang tidak hadir')


def test_isi_daftar_hadir_template_dan_pola():
    docx = cd.isi_daftar_hadir(_dh())
    teks = cd.teks_dokumen(docx)
    for s in ('ASTS TAHUN AJARAN 2026/2027', 'MTs NEGERI 2 KOTA MALANG', 'Jl. Uji No. 1, Kota Malang', 'Rabu, 2 Desember 2026',
              'Matematika', '07.30 – 09.30 WIB', 'Peserta 35', '01-033', 'Malang, 2 Desember 2026', 'Pak Pengawas', 'NIP 1970'):
        assert s in teks, s
    assert teks.count('DAFTAR HADIR PESERTA') == 2  # 35 peserta -> 2 lembar
    assert '\n64\n' in teks  # nomor urut berlanjut di lembar kedua
    assert len(_media(docx)) == 18 + 2  # 18 peserta bertanda tangan + pengawas di 2 lembar
    assert _media(cd.isi_daftar_hadir(_dh(tampil=False))) == []
    with zipfile.ZipFile(io.BytesIO(docx)) as z:  # paket sah: xml terbaca, relasi gambar terdaftar, prefix default
        ET.fromstring(z.read('word/document.xml'))
        rels = z.read('word/_rels/document.xml.rels').decode()
        assert 'rIdTtd1' in rels and '<ns0:' not in rels
    assert cd.teks_dokumen(cd.isi_daftar_hadir(_dh(n=0))).count('DAFTAR HADIR PESERTA') == 1


def test_isi_berita_acara_template_dan_pola():
    docx = cd.isi_berita_acara(_ba())
    teks = cd.teks_dokumen(docx)
    for s in ('PENYELENGGARAAN ASESMEN SUMATIF TENGAH SEMESTER', 'MTsN 2 KOTA MALANG', 'TAHUN AJARAN 2026/2027',
              'Pada hari ini Rabu tanggal dua', 'Desember', 'tahun dua ribu dua puluh enam',
              'Asesmen Sumatif Tengah Semester kelas 8 Tahun Ajaran 2026/2027 dari Pukul 07.30 WIB sampai dengan Pukul 09.30 WIB',
              'Jl. Uji No. 1, Kota Malang', '6 (enam)', ': 5 orang', 'A1, A2, A3, A4,', ': 1 orang', 'A6',
              'mata pelajaran *Bahasa Indonesia', 'Tertib.', 'Bu Pengawas', '1980', '*Diisi mapel saat itu'):
        assert s in teks, s
    assert 'Asesmen Sumatif Akhir Semester' not in teks and '……' not in teks
    assert len(_media(docx)) == 1 and _media(cd.isi_berita_acara(_ba(tampil=False))) == []


def test_cadangan_reportlab():
    pdf = cp.pdf_daftar_hadir(_dh())
    assert pdf.startswith(b'%PDF') and pdf.count(b'/Type /Page') - pdf.count(b'/Type /Pages') == 2
    assert cp.pdf_berita_acara(_ba()).startswith(b'%PDF')


def test_buat_dokumen_memilih_mesin(monkeypatch):
    isi, mesin = asyncio.run(uc.buat_dokumen('berita_acara', _ba(), 'docx'))
    assert mesin == 'docx' and isi[:2] == b'PK'

    async def tanpa_lo(*_a, **_k):
        raise uc.LibreOfficeTidakTersedia('tidak ada')
    monkeypatch.setattr(uc, 'berkas_office_ke_pdf', tanpa_lo)
    isi, mesin = asyncio.run(uc.buat_dokumen('daftar_hadir', _dh(n=3), 'pdf'))
    assert mesin == 'reportlab' and isi.startswith(b'%PDF')

    async def dengan_lo(isi, nama):
        assert nama == 'daftar_hadir.docx' and isi[:2] == b'PK'
        return b'%PDF-lo'
    monkeypatch.setattr(uc, 'berkas_office_ke_pdf', dengan_lo)
    assert asyncio.run(uc.buat_dokumen('daftar_hadir', _dh(n=3), 'pdf')) == (b'%PDF-lo', 'libreoffice')
    with pytest.raises(ValueError):
        asyncio.run(uc.buat_dokumen('rapor', {}, 'pdf'))


@pytest.mark.skipif(not uc.libreoffice_tersedia(), reason='LibreOffice tidak terpasang')
def test_libreoffice_sungguhan_mengonversi_docx():
    isi, mesin = asyncio.run(uc.buat_dokumen('berita_acara', _ba(), 'pdf'))
    assert isi.startswith(b'%PDF')
    assert mesin in ('libreoffice', 'reportlab')  # reportlab bila LibreOffice tanpa Writer
