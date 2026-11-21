"""Template Excel & pembacaan impor Input Nilai guru mapel (Ulangan, Sumatif, UTS, UAS) untuk SATU kelas–mapel.

Tata letak sheet "Nilai":
    baris 1  judul "NILAI <JENIS> <mapel> — KELAS <kelas>"
    baris 2  keterangan (semester, tahun pelajaran, kolom ke / KKTP bila ada)
    baris 3  petunjuk pengisian
    baris 5  header: No | ID Siswa | NISN | Nama | L/P | Nilai            (mode 'nilai' & UAS)
                     No | ID Siswa | NISN | Nama | L/P | Pengetahuan | Keterampilan   (mode 'pk')
    baris 6… satu baris per siswa (urut nama); nilai yang sudah ada ikut terisi.
Sheet tersembunyi `_meta` mengikat berkas ke kelas, mapel, semester, jenis & mode agar tidak terimpor ke tempat yang salah.
Impor TIDAK langsung menyimpan: hasil baca dikembalikan ke layar untuk diperiksa guru lalu disimpan.
"""
import io
import re
from typing import Any, Dict, List, Optional, Tuple

from openpyxl import Workbook, load_workbook

JENIS_META = 'template_penilaian'
SHEET_DATA = 'Nilai'
SHEET_META = '_meta'
BARIS_HEADER = 5
MAKS_BERKAS = 2 * 1024 * 1024
MAKS_BARIS = 500
LABEL_JENIS = {'ulangan': 'ULANGAN', 'sumatif': 'SUMATIF', 'uts': 'UTS', 'uas': 'UAS'}
_KOLOM = {'id siswa': 'siswa_id', 'nisn': 'nisn', 'nama': 'nama', 'nilai': 'nilai', 'pengetahuan': 'p', 'keterampilan': 'k'}


class GalatBerkas(ValueError):
    """Berkas tidak dapat dibaca sebagai template nilai (pesan siap tampil)."""


def _teks(v: Any) -> str:
    if v is None:
        return ''
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v).strip()


def nama_berkas_template(jenis: str, mapel: Dict[str, Any], kelas: Dict[str, Any], semester: str, ke: Optional[int] = None) -> str:
    dasar = f"nilai_{jenis}{f'_{ke}' if ke else ''}_{mapel.get('name') or 'mapel'}_{kelas.get('name') or 'kelas'}_{semester}"
    return re.sub(r'_+', '_', re.sub(r'[^\w]+', '_', dasar)).strip('_') + '.xlsx'


def buat_template(jenis: str, mode: str, kelas: Dict[str, Any], mapel: Dict[str, Any], semester: str, tahun: Optional[str],
                  siswa: List[Dict[str, Any]], nilai: Dict[str, Dict[str, Any]], kolom: Optional[Dict[str, Any]] = None) -> bytes:
    """Template .xlsx satu kelas–mapel–jenis. `nilai` = {siswa_id: {nilai}|{p,k}} yang sudah ada (ikut terisi)."""
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.worksheet.datavalidation import DataValidation

    pk = mode == 'pk' and jenis != 'uas'
    kolom_nilai = ['Pengetahuan', 'Keterampilan'] if pk else ['Nilai']
    header = ['No', 'ID Siswa', 'NISN', 'Nama', 'L/P', *kolom_nilai]
    hijau, kuning, abu = (PatternFill('solid', start_color=c) for c in ('C6E0B4', 'FFF2CC', 'EDEDED'))
    tipis = Side(style='thin', color='999999')
    garis = Border(left=tipis, right=tipis, top=tipis, bottom=tipis)

    wb = Workbook()
    ws = wb.active
    ws.title = SHEET_DATA
    ke = (kolom or {}).get('ke') if jenis in ('ulangan', 'sumatif') else None
    judul = f"NILAI {LABEL_JENIS.get(jenis, jenis.upper())}{f' KE-{ke}' if ke else ''}"
    ws['A1'] = f"{judul} {mapel.get('name') or ''} — KELAS {kelas.get('name') or ''}".strip()
    ws['A1'].font = Font(bold=True, size=13)
    info = [f"Semester {semester}", f"TP {tahun}" if tahun else None]
    if kolom and kolom.get('kktp') is not None:
        info.append(f"KKTP {kolom['kktp']:g}")
    if kolom and kolom.get('ringkasan'):
        info.append(str(kolom['ringkasan'])[:120])
    ws['A2'] = ' · '.join(x for x in info if x)
    ws['A2'].font = Font(size=10, color='333333')
    ws['A3'] = (f"Isi kolom {' & '.join(kolom_nilai)} (kuning) dengan angka 0–100; biarkan kosong bila belum dinilai. "
                "Jangan mengubah kolom ID Siswa. Setelah diisi, impor berkas ini dari halaman Input Nilai.")
    ws['A3'].font = Font(italic=True, size=9, color='555555')
    for i, h in enumerate(header, start=1):
        sel = ws.cell(row=BARIS_HEADER, column=i, value=h)
        sel.font, sel.fill, sel.border = Font(bold=True), hijau, garis
        sel.alignment = Alignment(horizontal='center', vertical='center')
    for n, s in enumerate(siswa, start=1):
        r = BARIS_HEADER + n
        isi = nilai.get(s['id']) or {}
        nilai_baris = [isi.get('p'), isi.get('k')] if pk else [isi.get('nilai')]
        for i, v in enumerate([n, s['id'], s.get('nisn') or '', s.get('nama') or '', s.get('jk') or '', *nilai_baris], start=1):
            sel = ws.cell(row=r, column=i, value=v)
            sel.border = garis
            sel.fill = kuning if i > 5 else abu
            if i in (1, 5) or i > 5:
                sel.alignment = Alignment(horizontal='center')
    if siswa:
        akhir = BARIS_HEADER + len(siswa)
        dv = DataValidation(type='decimal', operator='between', formula1='0', formula2='100', allow_blank=True,
                            showErrorMessage=True, errorTitle='Nilai tidak valid', error='Isi angka 0–100.')
        ws.add_data_validation(dv)
        for i in range(6, 6 + len(kolom_nilai)):
            col = chr(64 + i)
            dv.add(f'{col}{BARIS_HEADER + 1}:{col}{akhir}')
    for i, lebar in enumerate([5, 38, 14, 34, 5, 13, 13][:len(header)], start=1):
        ws.column_dimensions[chr(64 + i)].width = lebar
    ws.freeze_panes = f'A{BARIS_HEADER + 1}'

    meta = wb.create_sheet(SHEET_META)
    for kunci, nilai_meta in (('jenis', JENIS_META), ('jenis_nilai', jenis), ('mode', 'pk' if pk else 'nilai'), ('class_id', kelas.get('id')),
                              ('subject_id', mapel.get('id')), ('semester', semester), ('kolom_id', (kolom or {}).get('id') or '')):
        meta.append([kunci, nilai_meta])
    meta.sheet_state = 'hidden'
    keluar = io.BytesIO()
    wb.save(keluar)
    return keluar.getvalue()


def _angka(v: Any) -> Tuple[Optional[float], Optional[str]]:
    """(nilai, galat). Kosong -> (None, None). Menerima koma desimal ("80,5")."""
    t = _teks(v)
    if not t:
        return None, None
    try:
        f = float(t.replace(',', '.'))
    except ValueError:
        return None, f'"{t}" bukan angka'
    if not 0 <= f <= 100:
        return None, f'nilai {t} di luar 0–100'
    return round(f, 2), None


def baca_impor(isi: bytes, jenis: str, mode: str, class_id: str, subject_id: str, siswa: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Baca berkas impor -> { nilai: {siswa_id: {nilai}|{p,k}}, terbaca, kosong, galat: [{baris, nama, pesan}] }.
    Siswa dicocokkan lewat ID Siswa, lalu NISN, lalu nama persis. GalatBerkas bila berkas tidak sesuai."""
    if len(isi) > MAKS_BERKAS:
        raise GalatBerkas('Ukuran berkas maksimal 2 MB')
    try:
        wb = load_workbook(io.BytesIO(isi), data_only=True)
    except Exception:
        raise GalatBerkas('Berkas bukan .xlsx yang valid. Gunakan template dari halaman Input Nilai.')
    pk = mode == 'pk' and jenis != 'uas'
    if SHEET_META in wb.sheetnames:
        meta = {_teks(r[0]): _teks(r[1]) for r in wb[SHEET_META].iter_rows(max_col=2, values_only=True) if r and r[0]}
        if meta.get('jenis') == JENIS_META:
            if meta.get('class_id') and meta['class_id'] != class_id:
                raise GalatBerkas('Berkas ini template kelas lain. Unduh template dari kelas yang sedang dipilih.')
            if meta.get('subject_id') and meta['subject_id'] != subject_id:
                raise GalatBerkas('Berkas ini template mata pelajaran lain.')
            if meta.get('jenis_nilai') and meta['jenis_nilai'] != jenis:
                raise GalatBerkas(f"Berkas ini template nilai {LABEL_JENIS.get(meta['jenis_nilai'], meta['jenis_nilai'])}, "
                                  f"bukan {LABEL_JENIS.get(jenis, jenis)}.")
            if meta.get('mode') and meta['mode'] != ('pk' if pk else 'nilai'):
                raise GalatBerkas('Mode kolom berkas berbeda dengan mode kelas ini (Nilai vs Pengetahuan & Keterampilan). Unduh template baru.')
    ws = wb[SHEET_DATA] if SHEET_DATA in wb.sheetnames else wb.worksheets[0]
    peta, baris_header = {}, None
    for r, baris in enumerate(ws.iter_rows(min_row=1, max_row=15, values_only=True), start=1):
        judul = {_teks(v).lower(): i for i, v in enumerate(baris or ()) if v is not None}
        if ('pengetahuan' in judul and 'keterampilan' in judul) if pk else ('nilai' in judul):
            peta = {_KOLOM[k]: i for k, i in judul.items() if k in _KOLOM}
            baris_header = r
            break
    if baris_header is None:
        harap = 'Pengetahuan & Keterampilan' if pk else 'Nilai'
        raise GalatBerkas(f'Kolom {harap} tidak ditemukan. Gunakan template dari halaman Input Nilai.')
    per_id = {s['id']: s for s in siswa}
    per_nisn = {str(s.get('nisn')): s for s in siswa if s.get('nisn')}
    per_nama = {}
    for s in siswa:
        per_nama.setdefault((s.get('nama') or '').strip().lower(), []).append(s)
    hasil, galat, kosong, terbaca = {}, [], 0, 0
    for r, baris in enumerate(ws.iter_rows(min_row=baris_header + 1, values_only=True), start=baris_header + 1):
        if r - baris_header > MAKS_BARIS:
            raise GalatBerkas(f'Berkas berisi lebih dari {MAKS_BARIS} baris.')
        isi_baris = {k: (baris[i] if baris and i < len(baris) else None) for k, i in peta.items()}
        sid, nisn, nama = _teks(isi_baris.get('siswa_id')), _teks(isi_baris.get('nisn')), _teks(isi_baris.get('nama'))
        bidang = ('p', 'k') if pk else ('nilai',)
        if not (sid or nisn or nama) and not any(_teks(isi_baris.get(b)) for b in bidang):
            continue
        terbaca += 1
        s = per_id.get(sid) or per_nisn.get(nisn)
        if not s and nama:
            calon = per_nama.get(nama.lower()) or []
            s = calon[0] if len(calon) == 1 else None
        if not s:
            galat.append({'baris': r, 'nama': nama or sid or nisn, 'pesan': 'siswa tidak ditemukan di kelas ini'})
            continue
        isian, salah = {}, None
        for b in bidang:
            v, g = _angka(isi_baris.get(b))
            if g:
                salah = g
            elif v is not None:
                isian[b] = v
        if salah:
            galat.append({'baris': r, 'nama': s.get('nama'), 'pesan': salah})
            continue
        if not isian:
            kosong += 1
            continue
        hasil[s['id']] = isian
    return {'nilai': hasil, 'terbaca': terbaca, 'kosong': kosong, 'galat': galat[:200], 'galat_total': len(galat)}
