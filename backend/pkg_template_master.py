"""Template master instrumen PKG buatan aplikasi (milik madrasah sendiri), pengganti berkas instrumen pihak lain.

Berkas .xlsx dibuat dari instrumen aktif (atau struktur yang diberikan) dengan identitas madrasah dari pengaturan
(global_config): sheet "Petunjuk" (identitas & cara pengisian), sheet "Instrumen" (satu baris per sub-kompetensi:
kode & nama kompetensi, kode & nama sub, bobot, indikator Level 1–5), dan sheet tersembunyi "_info" (penanda format).
Berkas yang sama dapat diedit lalu diimpor kembali di menu Instrumen (pkg_instrumen_impor mengenali penandanya).

Kolom kode disimpan sebagai teks agar "1.10" tidak berubah menjadi angka 1.1 di Excel.
"""
import io
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

PENANDA = 'TEMPLATE-MASTER-INSTRUMEN-PKG'
VERSI_FORMAT = '1'
SHEET_INSTRUMEN = 'Instrumen'
SHEET_PETUNJUK = 'Petunjuk'
SHEET_INFO = '_info'
JUDUL_KOLOM = ('No', 'Kode Kompetensi', 'Nama Kompetensi', 'Kode Sub', 'Nama Sub-kompetensi', 'Bobot',
               'Indikator Level 1', 'Indikator Level 2', 'Indikator Level 3', 'Indikator Level 4', 'Indikator Level 5')
LEBAR_KOLOM = (5, 12, 24, 9, 32, 8, 40, 40, 40, 40, 40)
BARIS_JUDUL_TABEL = 5
STRUKTUR_CETAK = (4, 3)  # cetak laporan resmi: 4 kompetensi x 3 sub-kompetensi

HIJAU = '006837'
HIJAU_MUDA = 'E8F5EE'
ABU = 'F8FAFC'
GARIS = Side(style='thin', color='CBD5E1')
BINGKAI = Border(left=GARIS, right=GARIS, top=GARIS, bottom=GARIS)


def _teks(v: Any) -> str:
    return re.sub(r'\s+', ' ', str(v)).strip() if v is not None else ''


def _kode(v: Any) -> str:
    """Kode dari sel: teks apa adanya; angka bulat -> '3', angka desimal (kode sub yang sempat jadi angka) -> '1.2'."""
    if isinstance(v, bool) or v is None:
        return _teks(v)
    if isinstance(v, int) or (isinstance(v, float) and v.is_integer()):
        return str(int(v))
    if isinstance(v, float):
        return repr(v)
    return _teks(v)


def _identitas_baris(madrasah: Dict[str, Any]) -> List[Tuple[str, str]]:
    return [('Nama Madrasah', madrasah.get('nama') or '-'), ('NSM', madrasah.get('nsm') or '-'),
            ('NPSN', madrasah.get('npsn') or '-'), ('Alamat', madrasah.get('alamat') or '-'),
            ('Kepala Madrasah', madrasah.get('kepala') or '-')]


def _lembar_petunjuk(ws, madrasah: Dict[str, Any], sumber: str, dibuat: str) -> None:
    ws.sheet_view.showGridLines = False
    ws.column_dimensions['A'].width = 3
    ws.column_dimensions['B'].width = 22
    ws.column_dimensions['C'].width = 95
    ws.merge_cells('B2:C2')
    ws['B2'] = 'TEMPLATE MASTER INSTRUMEN PENILAIAN KINERJA GURU (PKG)'
    ws['B2'].font = Font(bold=True, size=15, color='FFFFFF')
    ws['B2'].fill = PatternFill('solid', fgColor=HIJAU)
    ws['B2'].alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[2].height = 30
    ws.merge_cells('B3:C3')
    ws['B3'] = (madrasah.get('nama') or 'Madrasah').upper()
    ws['B3'].font = Font(bold=True, size=12, color=HIJAU)
    ws['B3'].alignment = Alignment(horizontal='center')
    baris = 5
    for label, nilai in _identitas_baris(madrasah):
        ws.cell(baris, 2, label).font = Font(bold=True, color='334155')
        ws.cell(baris, 3, f': {nilai}').alignment = Alignment(wrap_text=True)
        baris += 1
    baris += 1
    ws.cell(baris, 2, 'Petunjuk Pengisian').font = Font(bold=True, size=12, color=HIJAU)
    baris += 1
    langkah = [
        f'Isi atau ubah instrumen pada sheet "{SHEET_INSTRUMEN}": satu baris = satu sub-kompetensi.',
        'Kode Kompetensi berupa angka (1, 2, 3, ...). Kode Sub ditulis "kode kompetensi.urutan" dan harus diawali '
        'kode kompetensinya, mis. 1.1, 1.2, 2.1.',
        'Setiap sub-kompetensi wajib memiliki 5 indikator (Level 1 sampai Level 5). Teks indikator maksimal 500 '
        'karakter, nama kompetensi/sub-kompetensi maksimal 200 karakter.',
        'Bobot sub-kompetensi berupa angka 0,01 sampai 100 (bawaan 1). Skor sub = jumlah indikator yang dicentang.',
        f'Cetak laporan resmi PKG memakai susunan {STRUKTUR_CETAK[0]} kompetensi x {STRUKTUR_CETAK[1]} sub-kompetensi. '
        'Susunan lain tetap dapat diimpor, tetapi laporan cetak bisa tidak lengkap.',
        'Simpan berkas, lalu impor di aplikasi: Penilaian Kinerja > Instrumen > Impor Instrumen > Unggah berkas .xlsx. '
        'Periksa pratinjau, lalu Terapkan. Instrumen menjadi versi baru; lembar penilaian lama tetap memakai versinya.',
        f'Jangan menghapus sheet tersembunyi "{SHEET_INFO}" (penanda format template master).',
    ]
    for i, teks in enumerate(langkah, 1):
        ws.cell(baris, 2, f'{i}.').alignment = Alignment(horizontal='right', vertical='top')
        sel = ws.cell(baris, 3, teks)
        sel.alignment = Alignment(wrap_text=True, vertical='top')
        ws.row_dimensions[baris].height = 30 if len(teks) > 95 else 16
        baris += 1
    baris += 1
    catatan = ws.cell(baris, 2, f'Dibuat oleh Super Apps MATSANDATAMA pada {dibuat} · sumber: {sumber}')
    catatan.font = Font(italic=True, size=9, color='64748B')
    ws.merge_cells(start_row=baris, start_column=2, end_row=baris, end_column=3)
    ws.page_setup.orientation = 'portrait'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def _lembar_instrumen(ws, kompetensi: List[Dict[str, Any]], madrasah: Dict[str, Any]) -> None:
    jumlah_kolom = len(JUDUL_KOLOM)
    akhir = get_column_letter(jumlah_kolom)
    ws.merge_cells(f'A1:{akhir}1')
    ws['A1'] = 'INSTRUMEN PENILAIAN KINERJA GURU (PKG)'
    ws['A1'].font = Font(bold=True, size=14, color=HIJAU)
    ws['A1'].alignment = Alignment(horizontal='center')
    ws.merge_cells(f'A2:{akhir}2')
    ws['A2'] = (madrasah.get('nama') or 'Madrasah').upper()
    ws['A2'].font = Font(bold=True, size=11)
    ws['A2'].alignment = Alignment(horizontal='center')
    ws.merge_cells(f'A3:{akhir}3')
    ws['A3'] = 'Template master — satu baris per sub-kompetensi; lihat sheet "Petunjuk" sebelum mengedit.'
    ws['A3'].font = Font(italic=True, size=9, color='64748B')
    ws['A3'].alignment = Alignment(horizontal='center')

    for i, (judul, lebar) in enumerate(zip(JUDUL_KOLOM, LEBAR_KOLOM), 1):
        sel = ws.cell(BARIS_JUDUL_TABEL, i, judul)
        sel.font = Font(bold=True, color='FFFFFF')
        sel.fill = PatternFill('solid', fgColor=HIJAU)
        sel.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
        sel.border = BINGKAI
        ws.column_dimensions[get_column_letter(i)].width = lebar
    ws.row_dimensions[BARIS_JUDUL_TABEL].height = 36

    baris = BARIS_JUDUL_TABEL + 1
    nomor = 0
    for urutan_k, k in enumerate(kompetensi):
        isi_latar = PatternFill('solid', fgColor=HIJAU_MUDA if urutan_k % 2 == 0 else ABU)
        for s in k.get('sub') or []:
            nomor += 1
            indikator = {int(x.get('level')): x.get('teks') or '' for x in s.get('indikator') or []}
            nilai = [nomor, str(k.get('kode') or ''), k.get('nama') or '', str(s.get('kode') or ''), s.get('nama') or '',
                     s.get('bobot', 1)] + [indikator.get(level, '') for level in range(1, 6)]
            for kol, v in enumerate(nilai, 1):
                sel = ws.cell(baris, kol, v)
                sel.fill = isi_latar
                sel.border = BINGKAI
                sel.alignment = Alignment(vertical='top', wrap_text=True, horizontal='center' if kol in (1, 2, 4, 6) else 'left')
                if kol in (2, 4):
                    sel.number_format = '@'
            panjang = max([len(str(x)) for x in nilai[6:]] + [len(str(nilai[4]))])
            ws.row_dimensions[baris].height = min(15 * (panjang // 45 + 1) + 4, 240)
            baris += 1
    akhir_data = baris - 1
    # Baris kosong siap isi (format teks pada kolom kode) untuk menambah sub-kompetensi.
    for b in range(baris, baris + 10):
        for kol in range(1, jumlah_kolom + 1):
            sel = ws.cell(b, kol)
            sel.border = BINGKAI
            sel.alignment = Alignment(vertical='top', wrap_text=True)
            if kol in (2, 4):
                sel.number_format = '@'

    bobot = DataValidation(type='decimal', operator='between', formula1='0.01', formula2='100', allow_blank=True,
                           showErrorMessage=True, errorTitle='Bobot tidak valid', error='Bobot berupa angka 0,01 sampai 100.')
    ws.add_data_validation(bobot)
    bobot.add(f'F{BARIS_JUDUL_TABEL + 1}:F{baris + 9}')

    ws.freeze_panes = f'F{BARIS_JUDUL_TABEL + 1}'
    ws.auto_filter.ref = f'A{BARIS_JUDUL_TABEL}:{akhir}{max(akhir_data, BARIS_JUDUL_TABEL + 1)}'
    ws.print_title_rows = f'{BARIS_JUDUL_TABEL}:{BARIS_JUDUL_TABEL}'
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.print_options.horizontalCentered = True
    ws.page_margins.left = ws.page_margins.right = 0.4
    ws.oddFooter.left.text = madrasah.get('nama') or ''
    ws.oddFooter.center.text = 'Template Master Instrumen PKG'
    ws.oddFooter.right.text = 'Hal. &P dari &N'


def buat_template_master(kompetensi: List[Dict[str, Any]], madrasah: Dict[str, Any], sumber: str,
                         sekarang: Optional[datetime] = None) -> bytes:
    """Bytes .xlsx template master. `kompetensi` = struktur instrumen [{kode, nama, sub [{kode, nama, bobot,
    indikator [{level, teks}]}]}]; `madrasah` = {nama, nsm, npsn, alamat, kepala}; `sumber` = keterangan asal isi."""
    dibuat = (sekarang or datetime.now()).strftime('%d-%m-%Y %H:%M')
    wb = Workbook()
    petunjuk = wb.active
    petunjuk.title = SHEET_PETUNJUK
    _lembar_petunjuk(petunjuk, madrasah, sumber, dibuat)
    _lembar_instrumen(wb.create_sheet(SHEET_INSTRUMEN), kompetensi or [], madrasah)
    info = wb.create_sheet(SHEET_INFO)
    for i, (kunci, nilai) in enumerate([('penanda', PENANDA), ('versi_format', VERSI_FORMAT), ('dibuat', dibuat),
                                        ('madrasah', madrasah.get('nama') or ''), ('sumber', sumber)], 1):
        info.cell(i, 1, nilai if kunci == 'penanda' else kunci)
        info.cell(i, 2, '' if kunci == 'penanda' else nilai)
    info.sheet_state = 'hidden'
    wb.active = 1
    wb.properties.creator = 'Super Apps MATSANDATAMA'
    wb.properties.title = 'Template Master Instrumen PKG'
    wb.properties.subject = madrasah.get('nama') or ''
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def adalah_template_master(wb) -> bool:
    """True bila workbook berpenanda template master (sheet _info A1) atau memiliki sheet Instrumen berjudul kolom
    template master (penanda terhapus)."""
    if SHEET_INFO in wb.sheetnames:
        for (a1,) in wb[SHEET_INFO].iter_rows(min_row=1, max_row=1, max_col=1, values_only=True):
            if _teks(a1) == PENANDA:
                return True
    return SHEET_INSTRUMEN in wb.sheetnames and _baris_judul(wb[SHEET_INSTRUMEN]) is not None


def _baris_judul(ws) -> Optional[int]:
    for nomor, baris in enumerate(ws.iter_rows(min_row=1, max_row=15, max_col=3, values_only=True), 1):
        if _teks(baris[1] if len(baris) > 1 else None).lower() == 'kode kompetensi':
            return nomor
    return None


def baca_template_master(wb) -> Tuple[List[Dict[str, Any]], List[Dict[str, str]]]:
    """Struktur kompetensi dari sheet Instrumen + daftar galat {lokasi, pesan}. Baris tanpa kode & nama dilewati."""
    galat: List[Dict[str, str]] = []
    if SHEET_INSTRUMEN not in wb.sheetnames:
        return [], [{'lokasi': SHEET_INSTRUMEN, 'pesan': f'Sheet "{SHEET_INSTRUMEN}" tidak ditemukan.'}]
    ws = wb[SHEET_INSTRUMEN]
    judul = _baris_judul(ws)
    if judul is None:
        return [], [{'lokasi': SHEET_INSTRUMEN, 'pesan': 'Baris judul kolom ("Kode Kompetensi") tidak ditemukan.'}]
    kompetensi: Dict[str, Dict[str, Any]] = {}
    for nomor, baris in enumerate(ws.iter_rows(min_row=judul + 1, max_row=judul + 400, max_col=len(JUDUL_KOLOM),
                                               values_only=True), judul + 1):
        baris = list(baris) + [None] * (len(JUDUL_KOLOM) - len(baris))
        kode_k, nama_k, kode_s, nama_s, bobot = _kode(baris[1]), _teks(baris[2]), _kode(baris[3]), _teks(baris[4]), baris[5]
        indikator = [_teks(x) for x in baris[6:11]]
        if not any([kode_k, nama_k, kode_s, nama_s, *indikator]):
            continue
        lokasi = f'{SHEET_INSTRUMEN}!baris {nomor}'
        if not kode_k or not kode_s:
            galat.append({'lokasi': lokasi, 'pesan': 'Kode Kompetensi dan Kode Sub wajib diisi.'})
            continue
        k = kompetensi.setdefault(kode_k, {'kode': kode_k, 'nama': nama_k, 'sub': []})
        if nama_k and not k['nama']:
            k['nama'] = nama_k
        elif nama_k and nama_k != k['nama']:
            galat.append({'lokasi': lokasi, 'pesan': f'Nama kompetensi {kode_k} berbeda dengan baris sebelumnya ("{k["nama"]}").'})
        kosong = [str(level) for level, teks in enumerate(indikator, 1) if not teks]
        if kosong:
            galat.append({'lokasi': lokasi, 'pesan': f'Indikator Level {", ".join(kosong)} sub-kompetensi {kode_s} kosong.'})
        k['sub'].append({'kode': kode_s, 'nama': nama_s, 'bobot': 1 if bobot in (None, '') else bobot,
                         'indikator': [{'level': level, 'teks': teks} for level, teks in enumerate(indikator, 1) if teks]})
    if not kompetensi and not galat:
        galat.append({'lokasi': SHEET_INSTRUMEN, 'pesan': 'Tidak ada sub-kompetensi yang terbaca.'})
    return list(kompetensi.values()), galat


def peringatan_struktur_cetak(kompetensi: List[Dict[str, Any]]) -> Optional[str]:
    """Peringatan bila susunan instrumen berbeda dari susunan cetak laporan resmi (4 kompetensi x 3 sub)."""
    jumlah_k, jumlah_s = STRUKTUR_CETAK
    if len(kompetensi) == jumlah_k and all(len(k.get('sub') or []) == jumlah_s for k in kompetensi):
        return None
    return (f'Susunan instrumen berbeda dari cetak laporan resmi PKG ({jumlah_k} kompetensi x {jumlah_s} '
            'sub-kompetensi); laporan cetak bisa tidak lengkap.')
