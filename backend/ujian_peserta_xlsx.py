"""Template & impor nomor peserta per ruang (.xlsx) modul Ujian Madrasah.

Satu berkas = SATU ruang dan hanya berisi siswa yang sudah dibagi ke ruang itu. Tata letak sama dengan template
frontend (frontend/src/lib/ujianPeserta.js):
    baris 1  judul "TEMPLATE NOMOR PESERTA — <nama ujian>"
    baris 2  keterangan ruang & petunjuk
    baris 4  header KOLOM_TEMPLATE_PESERTA
    baris 5… satu baris per peserta; kolom "No. Peserta" (H) yang diisi, kolom "ID Siswa" (B) dipakai mencocokkan.
Sheet tersembunyi `_meta` menyimpan ujian_id & ruang_id agar berkas ruang lain tidak terimpor ke ruang yang salah.
"""
import io
import re
from typing import Any, Dict, List, Optional, Tuple

from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

KOLOM_TEMPLATE_PESERTA = ['No', 'ID Siswa', 'NIS', 'NISN', 'Nama', 'Kelas', 'Jenjang', 'No. Peserta', 'No. Peserta UM (data siswa)']
BARIS_HEADER = 4
KOLOM_NOMOR = 8  # H
LEBAR = [6, 38, 10, 13, 34, 8, 8, 16, 24]
JENIS_META = 'template_nomor_peserta'
MAKS_BARIS_IMPOR = 500

HIJAU = PatternFill('solid', start_color='C6E0B4')
KUNING = PatternFill('solid', start_color='FFF2CC')
ABU = PatternFill('solid', start_color='EDEDED')
TIPIS = Side(style='thin', color='999999')
GARIS = Border(left=TIPIS, right=TIPIS, top=TIPIS, bottom=TIPIS)


def nama_berkas_template(ujian: Dict[str, Any], ruang: Dict[str, Any]) -> str:
    dasar = f"template_nomor_peserta_{ujian.get('nama') or 'ujian'}_ruang_{ruang.get('nama_ruang') or ''}"
    return re.sub(r'_+', '_', re.sub(r'[^\w]+', '_', dasar)).strip('_') + '.xlsx'


def buat_template_peserta(ujian: Dict[str, Any], ruang: Dict[str, Any], peserta: List[Dict[str, Any]]) -> bytes:
    """Template .xlsx satu ruang berisi pesertanya (urut seperti tampilan). Kolom selain No. Peserta berlatar abu-abu
    (acuan, jangan diubah); kolom No. Peserta berformat teks agar nol di depan tidak hilang."""
    wb = Workbook()
    ws = wb.active
    ws.title = 'Peserta'
    jenjang = ' + '.join(str(j) for j in ruang.get('jenjang', []))
    ws['A1'] = f"TEMPLATE NOMOR PESERTA — {ujian.get('nama') or ''}"
    ws['A1'].font = Font(bold=True, size=13)
    ws['A2'] = (f"Ruang {ruang.get('nama_ruang')} · Kelas {jenjang} · Isi kolom \"No. Peserta\" saja; jangan ubah kolom ID Siswa. "
                "Satu berkas hanya untuk ruang ini.")
    ws['A2'].font = Font(italic=True, size=9, color='555555')
    for c, judul in enumerate(KOLOM_TEMPLATE_PESERTA, start=1):
        sel = ws.cell(row=BARIS_HEADER, column=c, value=judul)
        sel.font = Font(bold=True)
        sel.fill = HIJAU
        sel.border = GARIS
        sel.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    for i, p in enumerate(peserta, start=1):
        r = BARIS_HEADER + i
        nilai = [i, p.get('siswa_id'), p.get('nis') or '', p.get('nisn') or '', p.get('nama'), p.get('kelas'), p.get('jenjang'),
                 p.get('nomor_peserta') or '', p.get('nomor_peserta_um') or '']
        for c, v in enumerate(nilai, start=1):
            sel = ws.cell(row=r, column=c, value=v)
            sel.border = GARIS
            if c == KOLOM_NOMOR:
                sel.fill = KUNING
                sel.number_format = '@'
            elif c in (2, 3, 4, 9):
                sel.number_format = '@'
                sel.fill = ABU
            else:
                sel.fill = ABU
    for c, w in enumerate(LEBAR, start=1):
        ws.column_dimensions[ws.cell(row=BARIS_HEADER, column=c).column_letter].width = w
    ws.freeze_panes = ws.cell(row=BARIS_HEADER + 1, column=3)
    if peserta:
        dv = DataValidation(type='textLength', operator='lessThanOrEqual', formula1='30', allow_blank=True,
                            error='No. Peserta maksimal 30 karakter', errorTitle='No. Peserta')
        ws.add_data_validation(dv)
        dv.add(f'H{BARIS_HEADER + 1}:H{BARIS_HEADER + len(peserta)}')
    meta = wb.create_sheet('_meta')
    for baris in (('ujian_id', ujian.get('id')), ('ruang_id', ruang.get('id')), ('jenis', JENIS_META)):
        meta.append(list(baris))
    meta.sheet_state = 'hidden'
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _teks(v: Any) -> str:
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return ' '.join(str(v).split())


class GalatBerkas(ValueError):
    """Berkas tidak dapat dipakai sama sekali (bukan galat per baris)."""


def baca_template_peserta(isi: bytes, ujian_id: str, ruang_id: str) -> List[Tuple[int, str, str, str]]:
    """Baca berkas impor -> [(nomor_baris, siswa_id, nama, nomor_peserta)] untuk baris yang tidak kosong.
    GalatBerkas bila bukan .xlsx, kolom tidak sesuai template, atau berkas milik ruang/ujian lain."""
    try:
        wb = load_workbook(io.BytesIO(isi), read_only=True, data_only=True)
    except Exception as e:  # noqa: BLE001 — berkas rusak / bukan xlsx
        raise GalatBerkas('Berkas tidak dapat dibaca. Pastikan berformat .xlsx dari template aplikasi.') from e
    try:
        if '_meta' in wb.sheetnames:
            meta = {str(r[0]): _teks(r[1]) for r in wb['_meta'].iter_rows(values_only=True) if r and r[0]}
            if meta.get('ruang_id') and meta.get('ruang_id') != ruang_id:
                raise GalatBerkas('Berkas ini template untuk ruang lain. Impor dari ruang yang sesuai atau unduh template ruang ini.')
            if meta.get('ujian_id') and meta.get('ujian_id') != ujian_id:
                raise GalatBerkas('Berkas ini template untuk ujian lain.')
        ws = wb['Peserta'] if 'Peserta' in wb.sheetnames else wb[wb.sheetnames[0]]
        baris = list(ws.iter_rows(values_only=True))
    finally:
        wb.close()
    header = [_teks(v) for v in (baris[BARIS_HEADER - 1] if len(baris) >= BARIS_HEADER else [])]
    if header[:len(KOLOM_TEMPLATE_PESERTA)] != KOLOM_TEMPLATE_PESERTA:
        raise GalatBerkas('Kolom berkas tidak sesuai template. Unduh ulang template ruang ini lalu isi kolom No. Peserta.')
    hasil = []
    for i, r in enumerate(baris[BARIS_HEADER:], start=BARIS_HEADER + 1):
        sel = [_teks(v) for v in (list(r) + [None] * 9)[:9]]
        sid, nama, nomor = sel[1], sel[4], sel[KOLOM_NOMOR - 1]
        if not sid and not nomor:
            continue
        hasil.append((i, sid, nama, nomor))
        if len(hasil) > MAKS_BARIS_IMPOR:
            raise GalatBerkas(f'Berkas berisi lebih dari {MAKS_BARIS_IMPOR} baris peserta; satu berkas hanya untuk satu ruang.')
    return hasil


def rencana_impor(baris: List[Tuple[int, str, str, str]], ruang: Dict[str, Any], siswa: Dict[str, Dict[str, Any]],
                  peserta_ujian: List[Dict[str, Any]], galat_format) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Validasi per baris -> (diterima [{ baris, siswa, peserta|None, nomor }], dilewati [{ baris, siswa_id, nama, alasan }]).

    Aturan: siswa harus ada di data induk (rombel semester ujian), jenjang sesuai ruang, belum terdaftar di ruang LAIN
    pada ujian yang sama, No. Peserta terisi & sah, tidak dipakai peserta lain (keadaan akhir) dan tidak ganda di berkas,
    kapasitas ruang cukup untuk siswa baru. Siswa yang belum di ruang ini ikut ditempatkan.
    """
    per_siswa = {p['siswa_id']: p for p in peserta_ujian}
    sisa = ruang.get('kapasitas', 0) - sum(1 for p in peserta_ujian if p.get('ruang_id') == ruang['id'])
    siswa_di_berkas = {sid for _, sid, _, _ in baris if sid}
    # Pemilik nomor di luar berkas ini (peserta lain pada ujian yang nomornya tidak ikut diganti berkas).
    pemilik_luar = {}
    for p in peserta_ujian:
        if p['siswa_id'] in siswa_di_berkas and p.get('ruang_id') == ruang['id']:
            continue
        if p.get('nomor_kunci'):
            pemilik_luar[p['nomor_kunci']] = p.get('nama')
    diterima, dilewati, dipakai, baris_siswa = [], [], {}, {}
    for no, sid, nama_sel, nomor in baris:
        s = siswa.get(sid)
        nama = (s or {}).get('full_name') or nama_sel or sid

        def lewati(alasan, no=no, sid=sid, nama=nama):
            dilewati.append({'baris': no, 'siswa_id': sid, 'nama': nama, 'alasan': alasan})
        if not s:
            lewati('Siswa tidak ditemukan di data induk')
            continue
        if sid in baris_siswa:
            lewati(f'Siswa yang sama sudah ada di baris {baris_siswa[sid]}')
            continue
        baris_siswa[sid] = no
        p = per_siswa.get(sid)
        if p and p.get('ruang_id') != ruang['id']:
            lewati('Sudah terdaftar di ruang lain pada ujian ini')
            continue
        if s.get('jenjang') not in ruang.get('jenjang', []):
            lewati(f"Kelas {s.get('jenjang')} bukan jenjang ruang ini")
            continue
        if not nomor:
            lewati('No. Peserta kosong')
            continue
        pesan = galat_format(nomor)
        if pesan:
            lewati(pesan)
            continue
        kunci = nomor.strip().upper()
        if kunci in pemilik_luar:
            lewati(f'No. Peserta {nomor} sudah dipakai {pemilik_luar[kunci]}')
            continue
        if kunci in dipakai:
            lewati(f'No. Peserta {nomor} ganda dengan baris {dipakai[kunci]}')
            continue
        if not p:
            if sisa <= 0:
                lewati('Kapasitas ruang penuh')
                continue
            sisa -= 1
        dipakai[kunci] = no
        diterima.append({'baris': no, 'siswa': s, 'peserta': p, 'nomor': nomor.strip()})
    return diterima, dilewati
