"""Berkas nilai UAS (.xlsx) modul Ujian Madrasah: SATU berkas per mapel per jenjang, SATU sheet per kelas.

Tata letak tiap sheet kelas (sama dengan template frontend, frontend/src/lib/ujianNilai.js):
    baris 1  judul "NILAI UAS <mapel> — KELAS <kelas>"
    baris 2  petunjuk
    baris 4  header KOLOM_TEMPLATE_NILAI
    baris 5… satu baris per siswa; kolom "Nilai UAS" (E) yang diisi, kolom "ID Siswa" (B) dipakai mencocokkan.
Nama sheet = nama kelas (mis. 7A). Sheet tersembunyi `_meta` menyimpan ujian_id, mapel_id & jenjang agar berkas mapel
atau jenjang lain tidak terimpor ke tempat yang salah.
"""
import io
import re
from typing import Any, Dict, List, Optional, Tuple

from openpyxl import load_workbook

KOLOM_TEMPLATE_NILAI = ['No', 'ID Siswa', 'NIS', 'Nama', 'Nilai UAS']
BARIS_HEADER = 4
JENIS_META = 'template_nilai_uas'
SHEET_META = '_meta'
MAKS_BERKAS = 5 * 1024 * 1024
MAKS_BARIS_IMPOR = 3000
_KOLOM_DIKENAL = {'id siswa': 'siswa_id', 'nis': 'nis', 'nama': 'nama', 'nilai uas': 'nilai'}


class GalatBerkas(ValueError):
    """Berkas tidak dapat dibaca sebagai template nilai UAS (pesan siap tampil)."""


def kunci_kelas(nama: Any) -> str:
    """Nama kelas/sheet dibandingkan tanpa spasi, tanda baca, dan huruf besar-kecil ('7 a' == '7A')."""
    return re.sub(r'[^0-9a-z]', '', str(nama or '').lower())


def _teks(v: Any) -> str:
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def _baca_meta(ws) -> Dict[str, str]:
    meta = {}
    for baris in ws.iter_rows(min_row=1, max_row=50, max_col=2, values_only=True):
        if baris and baris[0]:
            meta[_teks(baris[0])] = _teks(baris[1] if len(baris) > 1 else '')
    return meta


def _baca_sheet(ws) -> Optional[List[Dict[str, Any]]]:
    """Baris isian satu sheet kelas, atau None bila sheet tidak berheader template (mis. sheet catatan)."""
    peta, baris_header = {}, None
    for r, baris in enumerate(ws.iter_rows(min_row=1, max_row=10, values_only=True), start=1):
        judul = {_teks(v).lower(): i for i, v in enumerate(baris or ()) if v is not None}
        if 'nilai uas' in judul:
            peta = {_KOLOM_DIKENAL[k]: i for k, i in judul.items() if k in _KOLOM_DIKENAL}
            baris_header = r
            break
    if baris_header is None:
        return None
    hasil = []
    for r, baris in enumerate(ws.iter_rows(min_row=baris_header + 1, values_only=True), start=baris_header + 1):
        isi = {k: (baris[i] if baris and i < len(baris) else None) for k, i in peta.items()}
        if not any(_teks(isi.get(k)) for k in ('siswa_id', 'nis', 'nama')) and not _teks(isi.get('nilai')):
            continue
        hasil.append({'baris': r, 'siswa_id': _teks(isi.get('siswa_id')), 'nis': _teks(isi.get('nis')),
                      'nama': _teks(isi.get('nama')), 'nilai': isi.get('nilai')})
    return hasil


def baca_berkas_nilai(isi: bytes) -> Tuple[Dict[str, str], List[Dict[str, Any]]]:
    """-> (meta, sheets) dengan sheets = [{ sheet, baris: [{ baris, siswa_id, nis, nama, nilai }] }] menurut urutan
    sheet di berkas. GalatBerkas bila bukan .xlsx, tidak ada sheet bertemplate, atau barisnya terlalu banyak."""
    if len(isi) > MAKS_BERKAS:
        raise GalatBerkas('Ukuran berkas maksimal 5 MB')
    try:
        wb = load_workbook(io.BytesIO(isi), data_only=True)
    except Exception:
        raise GalatBerkas('Berkas bukan .xlsx yang valid. Gunakan template nilai UAS dari aplikasi.')
    meta = _baca_meta(wb[SHEET_META]) if SHEET_META in wb.sheetnames else {}
    sheets = []
    for ws in wb.worksheets:
        if ws.title == SHEET_META or ws.sheet_state != 'visible':
            continue
        baris = _baca_sheet(ws)
        if baris is not None:
            sheets.append({'sheet': ws.title, 'baris': baris})
    if not sheets:
        raise GalatBerkas('Tidak ada sheet kelas berkolom "Nilai UAS". Gunakan template nilai UAS dari aplikasi.')
    if sum(len(s['baris']) for s in sheets) > MAKS_BARIS_IMPOR:
        raise GalatBerkas(f'Berkas berisi lebih dari {MAKS_BARIS_IMPOR} baris; pecah per jenjang sesuai template.')
    return meta, sheets


def galat_meta(meta: Dict[str, str], ujian_id: str, mapel_id: str, jenjang: int, nama_mapel: Dict[str, str]) -> Optional[str]:
    """Tolak berkas template milik ujian/mapel/jenjang lain. Berkas tanpa `_meta` (dibuat sendiri) tetap diterima."""
    if meta.get('jenis') != JENIS_META:
        return None
    if meta.get('ujian_id') and meta['ujian_id'] != ujian_id:
        return 'Berkas ini template ujian lain. Unduh template dari ujian yang sedang dipilih.'
    if meta.get('mapel_id') and meta['mapel_id'] != mapel_id:
        lain = nama_mapel.get(meta['mapel_id']) or 'mapel lain'
        return f'Berkas ini template {lain}, bukan {nama_mapel.get(mapel_id) or "mapel yang dipilih"}.'
    if meta.get('jenjang') and meta['jenjang'] != str(jenjang):
        return f"Berkas ini template kelas {meta['jenjang']}, bukan kelas {jenjang}."
    return None


# ---- Pembuatan template ----
LEBAR = [6, 38, 12, 36, 12]
NAMA_SHEET_TERLARANG = re.compile(r'[\\/*?:\[\]]')


def nama_sheet(nama: str, dipakai: set) -> str:
    """Nama sheet Excel sah (maks 31 karakter, tanpa karakter terlarang) dan unik dalam berkas."""
    dasar = (NAMA_SHEET_TERLARANG.sub('-', str(nama or 'Kelas')).strip() or 'Kelas')[:31]
    hasil, i = dasar, 2
    while hasil.lower() in dipakai or hasil == SHEET_META:
        hasil = f'{dasar[:28]}~{i}'
        i += 1
    dipakai.add(hasil.lower())
    return hasil


def nama_berkas_template_nilai(mapel: Dict[str, Any], jenjang: int) -> str:
    dasar = f"template_nilai_uas_{mapel.get('name') or 'mapel'}_kelas_{jenjang}"
    return re.sub(r'_+', '_', re.sub(r'[^\w]+', '_', dasar)).strip('_') + '.xlsx'


def buat_template_nilai(ujian: Dict[str, Any], mapel: Dict[str, Any], jenjang: int, kelas: List[Dict[str, Any]],
                        siswa: List[Dict[str, Any]], nilai: Dict[str, Any]) -> bytes:
    """Template .xlsx nilai UAS satu mapel & jenjang: satu sheet per kelas (urut nama kelas) berisi siswanya urut nama,
    nilai yang sudah ada ikut terisi. Kolom selain Nilai UAS berlatar abu-abu (acuan); kolom Nilai UAS (kuning) bervalidasi
    angka 0–100. Sheet tersembunyi `_meta` mengikat berkas ke ujian, mapel & jenjang ini."""
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.worksheet.datavalidation import DataValidation

    hijau, kuning, abu = (PatternFill('solid', start_color=c) for c in ('C6E0B4', 'FFF2CC', 'EDEDED'))
    tipis = Side(style='thin', color='999999')
    garis = Border(left=tipis, right=tipis, top=tipis, bottom=tipis)
    wb = Workbook()
    wb.remove(wb.active)
    dipakai: set = set()
    for k in kelas:
        ws = wb.create_sheet(nama_sheet(k.get('name'), dipakai))
        anggota = sorted((s for s in siswa if s.get('kelas_id') == k['id']), key=lambda s: ' '.join(str(s.get('full_name') or '').lower().split()))
        ws['A1'] = f"NILAI UAS {mapel.get('name') or ''} — KELAS {k.get('name')}"
        ws['A1'].font = Font(bold=True, size=13)
        ws['A2'] = (f"{ujian.get('nama') or ''} · Isi kolom \"Nilai UAS\" (0–100, desimal boleh). Jangan ubah ID Siswa dan nama sheet; "
                    "kosongkan bila belum ada nilai.")
        ws['A2'].font = Font(italic=True, size=9, color='555555')
        for c, judul in enumerate(KOLOM_TEMPLATE_NILAI, start=1):
            sel = ws.cell(row=BARIS_HEADER, column=c, value=judul)
            sel.font, sel.fill, sel.border = Font(bold=True), hijau, garis
            sel.alignment = Alignment(horizontal='center', vertical='center')
        for i, s in enumerate(anggota, start=1):
            r = BARIS_HEADER + i
            for c, v in enumerate([i, s['id'], s.get('nis') or '', s.get('full_name'), nilai.get(s['id'])], start=1):
                sel = ws.cell(row=r, column=c, value=v)
                sel.border = garis
                sel.fill = kuning if c == 5 else abu
                if c in (2, 3):
                    sel.number_format = '@'
        for c, w in enumerate(LEBAR, start=1):
            ws.column_dimensions[ws.cell(row=BARIS_HEADER, column=c).column_letter].width = w
        ws.freeze_panes = ws.cell(row=BARIS_HEADER + 1, column=5)
        if anggota:
            dv = DataValidation(type='decimal', operator='between', formula1='0', formula2='100', allow_blank=True,
                                error='Nilai UAS harus angka 0–100', errorTitle='Nilai UAS')
            ws.add_data_validation(dv)
            dv.add(f'E{BARIS_HEADER + 1}:E{BARIS_HEADER + len(anggota)}')
    meta = wb.create_sheet(SHEET_META)
    for baris in (('jenis', JENIS_META), ('ujian_id', ujian.get('id')), ('mapel_id', mapel.get('id')), ('jenjang', str(jenjang))):
        meta.append(list(baris))
    meta.sheet_state = 'hidden'
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
