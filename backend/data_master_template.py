"""Service pembuat template impor Excel data master (Siswa / GTK).

Template = sheet data berisi baris judul baku (dibuat oleh buat_template yang sama dengan
unduhan, sehingga kolomnya identik) + sheet "Petunjuk" berisi aturan pengisian tiap kolom.
Aturan kolom memakai klasifikasi yang sama dengan legenda di frontend (LegendaPengisian.js).
"""
import re
from typing import Any, Dict, List, Tuple

from openpyxl.comments import Comment
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from data_master_excel import PENANDA_KETERANGAN, PILIHAN_GTK, SKEMA, TERKUNCI, buat_template, workbook_bytes

_POLA_PILIHAN = re.compile(r'\(([^)]*/[^)]*)\)\s*$')

PETUNJUK_ATURAN = {
    'kunci': 'Kolom identitas terkunci — penanda baris saat impor. Jangan diubah; baris tanpa identitas valid dilewati.',
    'tanggal': 'Tanggal dengan format TAHUN-BULAN-TANGGAL.',
    'ya_tidak': 'Isi "Ya" atau "Tidak".',
    'daftar': 'Beberapa nilai dipisah titik koma (;).',
    'pilihan': 'Isi salah satu kode yang tertulis di judul kolom (dalam kurung).',
    'teks': 'Teks bebas. Nomor ditulis lengkap termasuk angka 0 di depan.',
}

CONTOH_ATURAN = {'tanggal': '2012-05-10', 'ya_tidak': 'Ya', 'daftar': 'BCG; Polio'}


def aturan_kolom(k: Dict[str, Any]) -> str:
    """'kunci' | 'tanggal' | 'ya_tidak' | 'daftar' | 'pilihan' | 'teks' (urutan cek = frontend)."""
    if k.get('kunci'):
        return 'kunci'
    if 'YYYY-MM-DD' in k['label']:
        return 'tanggal'
    if '(Ya/Tidak)' in k['label']:
        return 'ya_tidak'
    if k.get('daftar'):
        return 'daftar'
    if _POLA_PILIHAN.search(k['label']):
        return 'pilihan'
    return 'teks'


def pilihan_kolom(k: Dict[str, Any]) -> List[str]:
    """Kode pilihan yang diterima kolom 'pilihan' (dari judul kolom), mis. ['L', 'P']."""
    m = _POLA_PILIHAN.search(k['label'])
    return [x.strip() for x in m.group(1).split('/')] if m else []


def petunjuk_kolom(k: Dict[str, Any]) -> Tuple[str, str, str]:
    """(aturan, petunjuk, contoh) untuk satu kolom."""
    aturan = aturan_kolom(k)
    petunjuk = PETUNJUK_ATURAN[aturan]
    contoh = CONTOH_ATURAN.get(aturan, '')
    if aturan == 'pilihan':
        kode = pilihan_kolom(k)
        field = k['path'].split('.')[-1]
        label = PILIHAN_GTK.get(field, {})
        if label:
            petunjuk += ' Boleh juga label: ' + ', '.join(f'{kd} = {label[kd]}' for kd in kode if kd in label) + '.'
        contoh = kode[0] if kode else ''
    return aturan, petunjuk, contoh


BARIS_VALIDASI = 2000  # jangkauan dropdown pada template (baris 2..2001)


def tambah_validasi_pilihan(ws, kolom: List[Dict[str, Any]], baris_awal: int = 2) -> int:
    """Dropdown Excel untuk kolom pilihan (kode di judul) dan Ya/Tidak. Isian di luar daftar
    hanya diberi peringatan (bukan ditolak) karena impor juga menerima label, mis. 'Milik Sendiri'."""
    n = 0
    for i, k in enumerate(kolom, 1):
        aturan = aturan_kolom(k)
        if aturan == 'pilihan':
            opsi = pilihan_kolom(k)
        elif aturan == 'ya_tidak':
            opsi = ['Ya', 'Tidak']
        else:
            continue
        dv = DataValidation(type='list', formula1='"' + ','.join(opsi) + '"', allow_blank=True,
                            showErrorMessage=True, errorStyle='warning',
                            errorTitle='Isian tidak dikenal', error='Pilih salah satu: ' + ', '.join(opsi),
                            promptTitle=k['label'][:32], prompt='Pilih: ' + ', '.join(opsi), showInputMessage=True)
        col = get_column_letter(i)
        dv.add(f'{col}{baris_awal}:{col}{baris_awal + BARIS_VALIDASI - 1}')
        ws.add_data_validation(dv)
        n += 1
    return n


KETERANGAN_SINGKAT = {
    'kunci': 'Penanda baris - jangan diubah',
    'tanggal': 'Format TAHUN-BULAN-TANGGAL',
    'ya_tidak': 'Ya / Tidak',
    'daftar': 'Pisahkan dengan ;',
    'teks': 'Teks bebas',
}
_KET_FILL = PatternFill(start_color='F1F5F9', end_color='F1F5F9', fill_type='solid')


def keterangan_singkat(k: Dict[str, Any]) -> str:
    """Teks pendek untuk baris keterangan di bawah judul kolom."""
    aturan, _, contoh = petunjuk_kolom(k)
    if aturan == 'pilihan':
        teks = 'Pilih: ' + ' / '.join(pilihan_kolom(k))
    else:
        teks = KETERANGAN_SINGKAT[aturan]
    return f'{teks} (mis. {contoh})' if contoh and aturan != 'pilihan' else teks


def tambah_baris_keterangan(ws, kolom: List[Dict[str, Any]]) -> None:
    """Baris 2 template: keterangan pengisian singkat tiap kolom. Sel pertama diawali
    PENANDA_KETERANGAN agar baris ini dilewati saat impor. Baris ikut terkunci."""
    for c, k in enumerate(kolom, 1):
        teks = keterangan_singkat(k)
        if c == 1:
            teks = f'{PENANDA_KETERANGAN} {teks}'
        cell = ws.cell(row=2, column=c, value=teks)
        cell.font = Font(italic=True, size=9, color='475569')
        cell.fill = _KET_FILL
        cell.alignment = Alignment(wrap_text=True, vertical='top')
        cell.protection = TERKUNCI
    ws.row_dimensions[2].height = 30
    ws.freeze_panes = 'C3'


def buat_template_data_master(jenis: str):
    """Workbook template impor siap isi untuk jenis 'siswa' | 'gtk'."""
    sk = SKEMA[jenis]
    kolom = sk['kolom']
    wb = buat_template(jenis)
    ws = wb[sk['sheet']]
    # Komentar singkat di judul kolom agar petunjuk terlihat langsung saat mengisi.
    for i, k in enumerate(kolom, 1):
        _, petunjuk, contoh = petunjuk_kolom(k)
        teks = petunjuk + (f' Contoh: {contoh}' if contoh else '')
        ws.cell(row=1, column=i).comment = Comment(teks, 'MATSANDATAMA', width=260, height=110)

    tambah_baris_keterangan(ws, kolom)
    tambah_validasi_pilihan(ws, kolom, baris_awal=3)

    p = wb.create_sheet('Petunjuk')
    p['A1'] = f"Petunjuk pengisian template {sk['sheet']}"
    p['A1'].font = Font(bold=True, size=13)
    umum = [
        f"1. Isi data pada sheet \"{sk['sheet']}\" mulai baris 3. Baris 1 = judul kolom, baris 2 = keterangan pengisian "
        f"(diawali {PENANDA_KETERANGAN}, dilewati saat impor). Jangan mengubah, menghapus, atau menukar urutan baris judul.",
        '2. Kolom identitas terkunci (oranye) dipakai mencocokkan baris dengan data di aplikasi — jangan diubah.',
        '3. Kolom yang dikosongkan tidak mengubah data tersimpan (mode bawaan impor: hanya mengisi yang kosong).',
        '4. Simpan tetap dalam format .xlsx lalu unggah lewat tombol Import.',
    ]
    for r, t in enumerate(umum, 2):
        p.cell(row=r, column=1, value=t)
    hr = len(umum) + 3
    judul = ['Kolom', 'Judul Kolom', 'Bagian', 'Aturan', 'Petunjuk', 'Contoh']
    fill = PatternFill(start_color='006837', end_color='006837', fill_type='solid')
    for c, h in enumerate(judul, 1):
        cell = p.cell(row=hr, column=c, value=h)
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = fill
    for i, k in enumerate(kolom):
        aturan, petunjuk, contoh = petunjuk_kolom(k)
        for c, v in enumerate([get_column_letter(i + 1), k['label'], k['grup'], aturan.replace('_', '/'), petunjuk, contoh], 1):
            cell = p.cell(row=hr + 1 + i, column=c, value=v)
            cell.alignment = Alignment(vertical='top', wrap_text=c == 5)
            cell.number_format = '@'
    for c, w in zip('ABCDEF', (8, 45, 18, 12, 70, 16)):
        p.column_dimensions[c].width = w
    p.freeze_panes = p.cell(row=hr + 1, column=1)
    wb.active = 0
    return wb


def template_bytes(jenis: str) -> bytes:
    return workbook_bytes(buat_template_data_master(jenis))
