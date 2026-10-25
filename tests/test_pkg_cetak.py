"""Cetak rekap Excel dari template resmi: isi baris, rumus, sisip baris >10 guru, master tidak berubah."""

import io
import os
import sys
from datetime import date

from openpyxl import load_workbook

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pkg_cetak  # noqa: E402
import pkg_template  # noqa: E402

PERIODE = {'id': 'p1', 'semester': 'Ganjil', 'tahun_pelajaran': '2026/2027', 'tanggal_buka': '2026-10-01', 'tanggal_tutup': '2026-11-30'}


def _guru(n):
    return [{'nama': f'Guru {i:02d}', 'mapel': 'IPA', 'capaian_persen': 50 + i * 3.333} for i in range(1, n + 1)]


def _buka(isi):
    return load_workbook(io.BytesIO(isi))['Rekap hasil PKG']


def test_rekap_tiga_guru():
    asli = pkg_template.hitung_checksum(pkg_template.path_template('rekap'))
    ws = _buka(pkg_cetak.rekap_excel(_guru(3), PERIODE, kepala='Drs. H. Mahmud, M.Pd.', tanggal_cetak=date(2026, 12, 5)))
    assert ws['A1'].value == 'REKAP HASIL PENILAIAN KINERJA GURU (PKG) TAHUN 2026'
    assert ws['A2'].value == 'PADA SEMESTER GANJIL TAHUN PELAJARAN 2026/2027'
    assert [ws[f'A{r}'].value for r in range(6, 10)] == [1, 2, 3, None]
    assert [ws[f'B{r}'].value for r in (6, 8)] == ['Guru 01', 'Guru 03'] and ws['D6'].value == 'IPA'
    assert ws['F6'].value == 53.33 and ws['G6'].value.startswith('=IF(F6="","",IF(F6>=91,"Sangat Baik"')
    assert ws['G9'].value is None and ws['B15'].value is None  # baris sisa dikosongkan
    assert ws['F16'].value == '=SUM(F6:F15)' and 'AVERAGE(F6:F15)' in ws['F17'].value and ws['G17'].value.startswith('=IF(F17')
    assert ws['G19'].value == 'Malang, 5 Desember 2026' and ws['G24'].value == 'Drs. H. Mahmud, M.Pd.'
    assert pkg_template.hitung_checksum(pkg_template.path_template('rekap')) == asli  # master utuh


def test_rekap_lebih_dari_sepuluh_guru():
    ws = _buka(pkg_cetak.rekap_excel(_guru(12), PERIODE, tanggal_cetak=date(2026, 12, 5)))
    assert [ws[f'A{r}'].value for r in (6, 15, 16, 17)] == [1, 10, 11, 12]
    assert ws['B17'].value == 'Guru 12' and ws['A17'].border.left.style == 'thin'  # gaya baris ikut tersalin
    assert ws['A18'].value == 'Jumlah' and ws['F18'].value == '=SUM(F6:F17)' and ws['A19'].value.startswith('Rata')
    gabung = {str(r) for r in ws.merged_cells.ranges}
    assert {'A18:E18', 'A19:E19', 'A1:H1', 'A2:H2'} <= gabung and 'A16:E16' not in gabung
    assert ws['G21'].value == 'Malang, 5 Desember 2026' and ws['G22'].value.startswith('Kepala')


def test_predikat_rekap():
    assert [pkg_cetak.predikat_rekap(n) for n in (95, 91, 80, 61, 60, 59.9, None)] == \
        ['Sangat Baik', 'Sangat Baik', 'Baik', 'Cukup', 'Sedang', 'Kurang', '']
    assert pkg_cetak.tanggal_indonesia(date(2026, 1, 9)) == '9 Januari 2026'


def test_laporan_pdf_hanya_lembar_rekap_tanpa_area_cetak_sheet_lain():
    # LibreOffice tetap mengekspor sheet tersembunyi yang punya area cetak; area cetaknya harus dihapus.
    import pkg_instrumen_impor
    instrumen = {'kompetensi': pkg_instrumen_impor.pratinjau_dari_template()['kompetensi']}
    isian = {s['kode']: {'centang': [1, 2]} for k in instrumen['kompetensi'] for s in k['sub']}
    wb = load_workbook(io.BytesIO(pkg_cetak.laporan_guru_excel({'instrumen': instrumen, 'isian': isian}, hanya_rekap=True)))
    assert wb.active.title == '04-RKAP-PKG'
    for ws in wb.worksheets:
        if ws.title != '04-RKAP-PKG':
            assert ws.sheet_state == 'hidden' and (not ws.print_area or ws.print_area.endswith('!')), ws.title


def test_laporan_pdf_lengkap_dan_cover():
    import pkg_instrumen_impor
    instrumen = {'kompetensi': pkg_instrumen_impor.pratinjau_dari_template()['kompetensi']}
    lap = {'instrumen': instrumen, 'isian': {}, 'identitas': {'sekolah': {'kota': 'Kabupaten Malang'}}}
    wb = load_workbook(io.BytesIO(pkg_cetak.laporan_guru_excel(lap, lembar=list(pkg_cetak.LEMBAR_PDF_LENGKAP))))
    terlihat = [ws.title for ws in wb.worksheets if ws.sheet_state == 'visible']
    assert terlihat == list(pkg_cetak.LEMBAR_PDF_LENGKAP) and wb.active.title == 'COVER'
    assert 'MODEL-GURU' not in terlihat and 'DUDI' not in terlihat and '00-DATA' not in terlihat
    assert wb['COVER']['C43'].value == 'kantor kementerian agama kabupaten malang'
    assert wb['04-RKAP-PKG'].page_setup.fitToHeight == 1 and wb['SISWA'].page_setup.fitToHeight == 0  # SISWA punya pemisah halaman


def _lap_lengkap():
    import pkg_instrumen_impor
    instrumen = {'kompetensi': pkg_instrumen_impor.pratinjau_dari_template()['kompetensi']}
    return {'instrumen': instrumen, 'isian': {}, 'identitas': {'sekolah': {'kota': 'Kabupaten Malang'}}}


def test_hasil_excel_tidak_terkunci():
    # Template resmi memproteksi sheet (COVER, KOMP, rekap) dengan sandi yang tidak dimiliki pengguna; salinan unduhan harus bebas.
    asli = load_workbook(pkg_template.path_template('instrumen'))
    assert any(ws.protection.sheet for ws in asli.worksheets)  # sumber memang terkunci
    for isi in (pkg_cetak.laporan_guru_excel(_lap_lengkap()), pkg_cetak.laporan_guru_excel(_lap_lengkap(), lembar=list(pkg_cetak.LEMBAR_PDF_LENGKAP)),
                pkg_cetak.rekap_excel(_guru(3), PERIODE)):
        wb = load_workbook(io.BytesIO(isi))
        assert not any(ws.protection.sheet for ws in wb.worksheets) and not (wb.security and wb.security.lockStructure)
        assert all(not ws.protection.password for ws in wb.worksheets)


def test_pdf_lengkap_urutan_dan_page_setup_per_lembar():
    wb = load_workbook(io.BytesIO(pkg_cetak.laporan_guru_excel(_lap_lengkap(), lembar=list(pkg_cetak.LEMBAR_PDF_LENGKAP))))
    terlihat = [ws.title for ws in wb.worksheets if ws.sheet_state == 'visible']
    assert terlihat == list(pkg_cetak.LEMBAR_PDF_LENGKAP) == [
        'COVER', '01-LAPORN', '02-IDNTY', 'KOMP-1', 'KOMP (2)', 'KOMP (3)', 'KOMP (4)', '04-RKAP-PKG', '05-RKAP-PKGR', 'INDEK-HDIR',
        'SEJAWAT', 'SISWA', 'ORTU', 'RUBRIK-CAPAIAN']
    for ws in (wb[n] for n in terlihat):
        assert int(ws.page_setup.paperSize) == int(ws.PAPERSIZE_A4) and ws.sheet_properties.pageSetUpPr.fitToPage is True
        assert ws.page_setup.fitToWidth == 1 and not ws.row_breaks.brk and ws.print_options.horizontalCentered and ws.print_area
        assert ws.page_setup.fitToHeight == (0 if ws.title in pkg_cetak.LEMBAR_TINGGI_BEBAS else 1), ws.title
    assert all(wb[n].print_title_rows == '$7:$8' for n in pkg_cetak.LEMBAR_TINGGI_BEBAS)
    assert wb['INDEK-HDIR'].page_setup.orientation == 'landscape' and wb['COVER'].page_setup.orientation == 'portrait'
    assert wb['RUBRIK-CAPAIAN'].page_setup.orientation == 'portrait'


def test_rekap_page_setup_lanskap_satu_halaman_dan_judul_berulang():
    ws = _buka(pkg_cetak.rekap_excel(_guru(5), PERIODE))
    assert ws.page_setup.orientation == 'landscape' and int(ws.page_setup.paperSize) == int(ws.PAPERSIZE_A4)
    assert (ws.page_setup.fitToWidth, ws.page_setup.fitToHeight) == (1, 1) and ws.print_area == "'Rekap hasil PKG'!$A$1:$H$24"
    banyak = _buka(pkg_cetak.rekap_excel(_guru(25), PERIODE))
    assert (banyak.page_setup.fitToWidth, banyak.page_setup.fitToHeight) == (1, 0) and banyak.print_title_rows == '$5:$5'
    assert banyak.print_area.endswith(f'$H${banyak.max_row}')


def _drawing_per_lembar(isi):
    """{judul lembar: xml drawing} dari berkas hasil, memakai pembaca paket yang sama dengan pemulih drawing."""
    import zipfile
    import pkg_drawing
    with zipfile.ZipFile(io.BytesIO(isi)) as z:
        return {judul: z.read(d).decode('utf-8') for judul, sheet in pkg_drawing._peta_sheet(z).items()
                if (d := pkg_drawing._drawing_template(z, sheet))}


def _semua_relasi_ada(isi):
    import zipfile
    import pkg_drawing
    with zipfile.ZipFile(io.BytesIO(isi)) as z:
        nama = set(z.namelist())
        for n in nama:
            if n.endswith('.rels') and n != '_rels/.rels':
                basis = n.replace('_rels/', '', 1)[:-5]
                for r in pkg_drawing._rels(z.read(n).decode('utf-8')):
                    if r.get('TargetMode') != 'External':
                        assert pkg_drawing._jalur(basis, r['Target']) in nama, (n, r['Target'])
        ct = z.read('[Content_Types].xml').decode('utf-8')
        for n in nama:
            if n.startswith('xl/drawings/drawingT'):
                assert f'PartName="/{n}"' in ct


def test_rekap_drawing_kotak_identitas_terisi_dan_aman_xml():
    madrasah = {'nama': 'MTsN 2 Kota Malang', 'alamat': 'Jl. A & B <Blok 1>', 'npsn': '20533012', 'akreditasi': 'A', 'kepala': 'Drs. H. Mahmud'}
    isi = pkg_cetak.rekap_excel(_guru(3), PERIODE, madrasah=madrasah)
    drawing = _drawing_per_lembar(isi)
    assert list(drawing) == ['Rekap hasil PKG'] and drawing['Rekap hasil PKG'].count('<xdr:sp ') == 1
    xml = drawing['Rekap hasil PKG']
    assert 'IDENTITAS RA / MADRASAH' in xml and 'Lembaga\t: MTsN 2 Kota Malang' in xml and 'Jl. A &amp; B &lt;Blok 1&gt;' in xml
    assert 'N P S N\t\t: 20533012' in xml and 'Status Akreditasi\t: Terakreditasi A' in xml and 'Nama Kepala RA/Madrasah\t: Drs. H. Mahmud' in xml
    assert 'N S M\t\t: <' in xml  # NSM tidak ada di sistem: kosong setelah titik dua
    _semua_relasi_ada(isi)
    assert load_workbook(io.BytesIO(isi))['Rekap hasil PKG']['B6'].value == 'Guru 01'


def test_laporan_guru_mempertahankan_drawing_template_tanpa_tombol_navigasi():
    import zipfile
    isi = pkg_cetak.laporan_guru_excel(_lap_lengkap())
    drawing = _drawing_per_lembar(isi)
    with zipfile.ZipFile(pkg_template.path_template('instrumen')) as tz:
        import pkg_drawing
        asli = {j: pkg_drawing._buang_navigasi(tz.read(pkg_drawing._drawing_template(tz, sh)).decode('utf-8'))
                for j, sh in pkg_drawing._peta_sheet(tz).items() if pkg_drawing._drawing_template(tz, sh)}
    harus = {j for j, x in asli.items() if pkg_drawing.ANCHOR.search(x)}
    assert set(drawing) == harus and {'COVER', 'KOMP-1', '05-RKAP-PKGR'} <= harus
    for j, xml in drawing.items():
        assert '<a:hlinkClick' not in xml, j  # tombol navigasi makro tidak ikut
        assert xml.count('<xdr:pic>') == asli[j].count('<xdr:pic>'), j  # gambar tidak dobel
    assert drawing['COVER'].count('<xdr:pic>') >= 1 and drawing['05-RKAP-PKGR'].count('<xdr:sp ') > 100
    _semua_relasi_ada(isi)
    wb = load_workbook(io.BytesIO(isi))
    assert wb['COVER']['C43'].value is not None and not any(ws.protection.sheet for ws in wb.worksheets)
