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
    assert wb['COVER']['C43'].value == 'KANTOR KEMENTERIAN AGAMA KABUPATEN MALANG'
    assert wb['04-RKAP-PKG'].page_setup.fitToHeight == 1 and wb['SISWA'].page_setup.fitToHeight == 0  # SISWA punya pemisah halaman


def test_laporan_huruf_kapital_periode_dan_persetujuan():
    import pkg_instrumen_impor
    instrumen = {'kompetensi': pkg_instrumen_impor.pratinjau_dari_template()['kompetensi']}
    wb = load_workbook(io.BytesIO(pkg_cetak.laporan_guru_excel({'instrumen': instrumen, 'isian': {}},
                                                               lembar=list(pkg_cetak.LEMBAR_PDF_LENGKAP))))
    # Font judul kapital: teks huruf kecil template & rumus nama sekolah dijadikan kapital (PDF LibreOffice tanpa font itu).
    assert wb['COVER']['C43'].value == 'KANTOR KEMENTERIAN AGAMA KOTA MALANG'
    assert wb['INDEK-HDIR']['B4'].value.startswith('=UPPER(')
    ws = wb['01-LAPORN']
    # Periode penilaian satu teks di sel gabungan E17:H17 agar tanggal tidak terpotong.
    assert 's.d.' in ws['E17'].value and ws['F17'].value is None and ws['G17'].value is None
    assert 'E17:H17' in {str(m) for m in ws.merged_cells.ranges} and ws['E17'].alignment.shrink_to_fit
    # Persetujuan: label -> Tanda tangan -> ruang -> nama -> NIP; tiap pihak satu sel gabungan rata tengah (C:D, F:H).
    gabungan = {str(m) for m in ws.merged_cells.ranges}
    for kol, kanan, nama, nip in (('C', 'D', '=E5&""', '="NIP. "&E6&""'),
                                  ('F', 'H', "='00-DATA'!E33&\"\"", "=\"NIP. \"&'00-DATA'!E34&\"\"")):
        assert ws[f'{kol}30'].value == 'Tanda tangan'
        assert all(ws[f'{kol}{r}'].value is None for r in (31, 32, 33))
        # Nama panjang dipindah baris di titik seimbang (rumus tetap merujuk sumber), atau utuh bila muat.
        assert ws[f'{kol}34'].value in (nama, ) or ws[f'{kol}34'].value.startswith(f'=SUBSTITUTE({nama[1:]},')
        assert ws[f'{kol}34'].font.b and ws[f'{kol}34'].alignment.wrap_text and ws[f'{kol}35'].value == nip
        assert all(f'{kol}{r}:{kanan}{r}' in gabungan for r in range(29, 36))
        assert all(ws[f'{kol}{r}'].alignment.horizontal == 'center' for r in range(29, 36))
        assert not ws[f'{kol}30'].font.u and not ws[f'{kol}35'].font.u and ws[f'{kol}34'].font.u
        assert ws[f'{kanan}30'].border.right.style == ws['H24'].border.right.style if kanan == 'H' else True
    assert (ws['C29'].value, ws['F29'].value, ws['G34'].value) == ('Guru yang Dinilai', 'Penilai', None)
    # Font resmi seragam di seluruh lembar cetak.
    assert {sel.font.name for n in pkg_cetak.LEMBAR_PDF_LENGKAP for sel in pkg_cetak.sel_berisi(wb[n])} == {'Arial'}


def test_rapikan_cetak_tanda_tangan_dan_teks_panjang():
    """Nama bergelar panjang tidak terpotong: blok tanda tangan per pihak (gabungan rata tengah, dibungkus bila panjang)
    dan isian identitas digabung sampai batas area cetak dengan huruf diperkecil secukupnya."""
    lap = _lap_lengkap()
    lap['identitas'] = {
        'guru': {'nama': 'Dr. Hj. Siti Nurhalimah Rahmawati, S.Pd.I., M.Pd.', 'nip': '198207152009012003'},
        'penilai': {'nama': 'Drs. H. Muhammad Abdurrahman Wahid, M.Pd.I.', 'nip': '196812241995031002'},
        'kepala': {'nama': 'H. Ahmad Fauzan Hidayatullah, S.Ag., M.Pd.', 'nip': '197003121998031004'},
        'sekolah': {'nama': 'Madrasah Ibtidaiyah Negeri 2 Kabupaten Malang', 'kota': 'Kabupaten Malang'},
        'periode': {'mulai': '28 September 2026', 'selesai': '30 November 2026', 'tanggal_penilaian': '25 November 2026'},
    }
    wb = load_workbook(io.BytesIO(pkg_cetak.laporan_guru_excel(lap, lembar=list(pkg_cetak.LEMBAR_PDF_LENGKAP))))
    gab = lambda ws: {str(m) for m in ws.merged_cells.ranges}
    ws = wb['02-IDNTY']
    # Isian identitas: E:H sampai batas area cetak, diperkecil bila tetap tidak muat (tidak lagi keluar area cetak).
    assert 'E6:H6' in gab(ws) and ws['E6'].alignment.shrink_to_fit and 6 <= ws['E6'].font.sz < 10
    # Tanda tangan: Penilai di B:D, guru di E:H; tempat-tanggal satu teks di pihak kanan.
    for r in (35, 38, 39):
        assert {f'B{r}:D{r}', f'E{r}:H{r}'} <= gab(ws)
        assert ws[f'B{r}'].alignment.horizontal == ws[f'E{r}'].alignment.horizontal == 'center'
    # Nama bergelar panjang: 2 baris seimbang (CHAR(10) disisipkan, rumus tetap merujuk sel sumber), baris ditinggikan.
    assert ws['B38'].value == '=SUBSTITUTE(E26&"","Drs. H. Muhammad ","Drs. H. Muhammad"&CHAR(10),1)'
    assert ws['E38'].value.startswith('=SUBSTITUTE(E6&"",') and 'CHAR(10)' in ws['E38'].value and ws['G38'].value is None
    assert ws['B38'].alignment.wrap_text and ws.row_dimensions[38].height > 20
    assert ws['B38'].font.sz == ws['E38'].font.sz  # satu baris, satu ukuran huruf
    assert 'E34:H34' in gab(ws) and ws['F34'].value is None and ws['G34'].value is None and '", "' in ws['E34'].value
    # Tiga pihak di rekap & indeks kehadiran.
    assert {'B50:C50', 'D50:E50', 'F50:H50'} <= gab(wb['04-RKAP-PKG'])
    assert {'B35:D35', 'E35:H35', 'I35:K35'} <= gab(wb['INDEK-HDIR'])
    assert {'B52:D52', 'E52:F52', 'B53:D53', 'E53:F53'} <= gab(wb['05-RKAP-PKGR'])


def test_nilai_teks_rumus_sederhana():
    import pkg_cetak_rapi
    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = 'A'
    data = wb.create_sheet('00-DATA')
    data['E5'] = 'Budi'
    ws['B1'] = "='00-DATA'!E5&\"\""
    ws['B2'] = '="NIP. "&UPPER(B1)'
    ws['B3'] = '=IF(1,2,3)'
    assert pkg_cetak_rapi.nilai_teks(wb, ws, ws['B2'].value) == 'NIP. BUDI'
    assert pkg_cetak_rapi.nilai_teks(wb, ws, ws['B3'].value) is None
    lebar = max(pkg_cetak_rapi.lebar_teks(t, 10) for t in ('satu dua', 'tiga empat')) + 1
    assert pkg_cetak_rapi.baris_bungkus('satu dua tiga empat', lebar, 10) == 2


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
