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

from openpyxl.styles import Alignment, Font
from openpyxl.utils import column_index_from_string, get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from pkg_ambang import AMBANG_PREDIKAT_REKAP, terapkan
from pkg_cetak_rapi import bungkus_dua_baris, gabung, lebar_rentang_pt, rapikan_cetak
from pkg_template import PETA_CETAK, isi_template_ke_bytes, muat_lebar_halaman, tampilkan_hanya

BULAN = ('Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November',
         'Desember')


def tanggal_indonesia(tgl: date) -> str:
    return f'{tgl.day} {BULAN[tgl.month - 1]} {tgl.year}'


def predikat_rekap(nkg: Optional[float]) -> str:
    """Predikat skala rekap (rumus kolom G template rekap); dipakai juga oleh PDF cadangan."""
    return '' if nkg is None else terapkan(AMBANG_PREDIKAT_REKAP, nkg, kosong_bila_nol=False) or ''


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
        if nilai['rekomendasi']:
            sel = ws[f"{k['rekomendasi']}{i}"]
            sel.alignment = Alignment(horizontal=sel.alignment.horizontal, vertical='center', wrap_text=True)
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


def atur_halaman_rekap(ws: Worksheet, jumlah_guru: int) -> None:
    """Setelan cetak rekap madrasah (salinan hasil): A4 lanskap, area cetak seluruh tabel sampai tanda tangan, lebar 1
    halaman, rata tengah. Sampai kapasitas tabel template (10 guru) seluruhnya 1 halaman; lebih dari itu tinggi
    mengikuti isi dan baris judul tabel diulang di setiap halaman."""
    peta = PETA_CETAK['rekap']
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.scale = None
    ws.print_area = f'A1:{get_column_letter(ws.max_column)}{ws.max_row}'
    ws.page_margins.left = ws.page_margins.right = 0.5
    ws.page_margins.top = ws.page_margins.bottom = 0.5
    ws.print_options.horizontalCentered = True
    ws.row_breaks.brk = []
    if jumlah_guru > peta['baris_tersedia']:
        ws.print_title_rows = f"{peta['baris_awal'] - 1}:{peta['baris_awal'] - 1}"
    muat_lebar_halaman(ws, satu_halaman=jumlah_guru <= peta['baris_tersedia'])


def isi_kotak_identitas(xml: str, madrasah: Dict[str, Any]) -> str:
    """Isi kotak teks "IDENTITAS RA / MADRASAH" pada drawing rekap: nilai ditulis setelah titik dua tiap baris label
    (nama lembaga, alamat, NSM, NPSN, status akreditasi, nama kepala); data yang tidak ada dibiarkan kosong. Teks
    di-escape XML."""
    def esc(t):
        return str(t or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    akreditasi = str(madrasah.get('akreditasi') or '').strip()
    if akreditasi and not akreditasi.lower().startswith('terakreditasi'):
        akreditasi = f'Terakreditasi {akreditasi}'
    isian = [('Lembaga', madrasah.get('nama')), ('Alamat', madrasah.get('alamat')), ('N S M', madrasah.get('nsm')),
             ('N P S N', madrasah.get('npsn')), ('Status Akreditasi', akreditasi), ('Nama Kepala RA/Madrasah', madrasah.get('kepala'))]

    def ganti(m):
        isi = m.group(1)
        for label, nilai in isian:
            if label in isi and ':' in isi:
                return f"<a:t>{isi[:isi.index(':') + 1]} {esc(nilai)}</a:t>"
        return m.group(0)
    return re.sub(r'<a:t>([^<]*)</a:t>', ganti, xml)


def rekap_excel(guru: List[Dict[str, Any]], periode: Dict[str, Any], kepala: Optional[str] = None,
                tanggal_cetak: Optional[date] = None, madrasah: Optional[Dict[str, Any]] = None) -> bytes:
    """Berkas .xlsx rekap hasil PKG dari template resmi (template harus utuh sesuai checksum resmi)."""
    sheet = PETA_CETAK['rekap']['sheet']

    def pengisi(wb):
        isi_rekap(wb[sheet], guru, periode, kepala, tanggal_cetak)
        atur_halaman_rekap(wb[sheet], len(guru))
    ubah = (lambda judul, xml: isi_kotak_identitas(xml, {**madrasah, 'kepala': madrasah.get('kepala') or kepala})) if madrasah is not None else None
    return isi_template_ke_bytes('rekap', pengisi, ubah_drawing=ubah)


# ---------------------------------------------------------------- laporan per guru (template instrumen)

class StrukturTidakSesuai(Exception):
    """Instrumen lembar tidak dapat dipetakan ke format cetak template resmi (4 kompetensi x 3 sub x 5 level)."""


def _tanggal_teks(nilai: Optional[str]) -> str:
    try:
        return tanggal_indonesia(date.fromisoformat(str(nilai)[:10]))
    except (TypeError, ValueError):
        return '-'


def isi_laporan_guru(wb, laporan: Dict[str, Any]) -> None:
    """Isi workbook template instrumen untuk satu guru: identitas di '00-DATA' & centang 'v' indikator di KOMP-n
    (rumus resmi 04-RKAP-PKG menghitung tingkat, jumlah, capaian, dan predikat).
    `laporan` = {guru:{nama,nip}, periode, sk:{nomor_sk,tanggal_sk}, penilai:{nama,nip}, kepala:{nama,nip},
                 nama_sekolah, instrumen:{kompetensi}, isian, terkunci_pada, kehadiran:[baris bulan pkg_kehadiran],
                 rekomendasi: teks rekomendasi PKB, identitas: pkg_identitas.lampiran_identitas,
                 angket: {jenis: [responden pkg_angket]}}."""
    from pkg_template import SHEET_KOMPETENSI
    peta = PETA_CETAK['instrumen']
    kompetensi = (laporan.get('instrumen') or {}).get('kompetensi') or []
    if len(kompetensi) != len(SHEET_KOMPETENSI) or any(
            len(k.get('sub') or []) != len(peta['baris_sub']) or any(len(s.get('indikator') or []) != 5 for s in k['sub'])
            for k in kompetensi):
        raise StrukturTidakSesuai('Instrumen lembar tidak sesuai format cetak template resmi.')

    data = wb[peta['sheet_data']]
    p = laporan.get('periode') or {}
    tahun = str((p.get('tanggal_tutup') or p.get('tanggal_buka') or '')[:4] or '-')
    isian_sel = {
        'nama_guru': (laporan.get('guru') or {}).get('nama'), 'nip_guru': (laporan.get('guru') or {}).get('nip'),
        'tahun': tahun, 'nama_kepala': (laporan.get('kepala') or {}).get('nama'), 'nip_kepala': (laporan.get('kepala') or {}).get('nip'),
        'nama_sekolah': laporan.get('nama_sekolah'),
        'penilai': (laporan.get('penilai') or {}).get('nama'), 'nip_penilai': (laporan.get('penilai') or {}).get('nip'),
        'nomor_sk': (laporan.get('sk') or {}).get('nomor_sk'), 'tanggal_sk': _tanggal_teks((laporan.get('sk') or {}).get('tanggal_sk')),
        'periode_awal': _tanggal_teks(p.get('tanggal_buka')), 'periode_akhir': _tanggal_teks(p.get('tanggal_tutup')),
        'tanggal_nilai': _tanggal_teks(laporan.get('terkunci_pada')),
    }
    for kunci, sel in peta['data'].items():
        data[sel] = isian_sel.get(kunci) or '-'
    if laporan.get('identitas'):
        # Lampiran identitas lengkap (pkg_identitas): seluruh isian 00-DATA, contoh isian template ditimpa.
        from pkg_identitas import isi_data_identitas
        isi_data_identitas(wb, laporan['identitas'])
        isi_cover(wb, laporan['identitas'])
        isi_form_instr(wb, laporan['identitas'])
    if 'angket' in laporan:
        from pkg_angket import isi_identitas_form_360, isi_lembar_360
        isi_lembar_360(wb, laporan['angket'] or {})
        isi_identitas_form_360(wb, {**(laporan.get('guru') or {}),
                                    'tugas_tambahan': ((laporan.get('identitas') or {}).get('guru') or {}).get('tugas_tambahan')})

    isi_kehadiran(wb, laporan.get('kehadiran'))
    isi_rekomendasi(wb, laporan.get('rekomendasi'))
    rapikan_huruf_kapital(wb)
    rapikan_laporan_evaluasi(wb)
    rapikan_cetak(wb, LEMBAR_PDF_LENGKAP)
    seragamkan_font(wb)

    isian = laporan.get('isian') or {}
    kol = peta['kolom_centang']
    for k, sheet in zip(kompetensi, SHEET_KOMPETENSI):
        ws = wb[sheet]
        for s, baris in zip(k['sub'], peta['baris_sub']):
            centang = set((isian.get(s['kode']) or {}).get('centang') or [])
            for level in range(1, 6):
                ws[f'{kol}{baris + level - 1}'] = 'v' if level in centang else None


def isi_cover(wb, identitas: Dict[str, Any]) -> None:
    """COVER: identitas, jangka waktu, dan tahun dibaca rumus dari 00-DATA; hanya nama kantor kementerian agama
    (teks tetap di template) yang disesuaikan dengan kabupaten/kota madrasah."""
    kota = ((identitas.get('sekolah') or {}).get('kota') or '').strip()
    if kota:
        wb[PETA_CETAK['instrumen']['cover']['sheet']][PETA_CETAK['instrumen']['cover']['kantor']] = f'KANTOR KEMENTERIAN AGAMA {kota.upper()}'


# Font resmi seragam untuk seluruh laporan (tata naskah dinas). Template memakai campuran font dekoratif (Berlin Sans FB,
# Quicksand, Bernard MT, Perpetua Titling, Calibri, Arial Narrow, Times New Roman) yang tidak ada di server sehingga
# LibreOffice menggantinya dengan font lain yang lebih lebar dan teks terpotong. Arial dicetak dengan Liberation Sans
# (lebar huruf identik) sehingga tampilan Excel dan PDF sama.
FONT_RESMI = 'Arial'


def sel_berisi(ws):
    """Sel yang benar-benar tersimpan di lembar (tanpa membuat sel kosong baru seperti iter_rows pada lembar lebar)."""
    return [sel for sel in list(ws._cells.values()) if sel.value is not None]


def seragamkan_font(wb, nama: str = FONT_RESMI) -> None:
    """Ganti font semua sel bernilai di seluruh lembar menjadi `nama` (ukuran, tebal, miring, warna tetap)."""
    for ws in wb.worksheets:
        for sel in sel_berisi(ws):
            if sel.value is None or not sel.has_style or (sel.font.name or '') == nama:
                continue
            f = copy(sel.font)
            f.name = nama
            sel.font = f


# Font judul template yang hanya memiliki huruf kapital. Excel menampilkannya kapital walau teksnya huruf kecil, tetapi
# server PDF (LibreOffice) tidak memiliki font ini sehingga teks huruf kecil tercetak apa adanya.
FONT_KAPITAL = ('Perpetua Titling',)


def rapikan_huruf_kapital(wb) -> None:
    """Jadikan kapital teks bertipe font judul kapital (mis. nama kantor di COVER, nama sekolah di INDEK-HDIR) agar
    tampil sama di Excel maupun PDF: teks tetap -> upper(); rumus -> dibungkus UPPER()."""
    for ws in wb.worksheets:
        for sel in sel_berisi(ws):
            v = sel.value
            if not isinstance(v, str) or not v or not any(f in (sel.font.name or '') for f in FONT_KAPITAL):
                continue
            if v.startswith('='):
                if not v.upper().startswith('=UPPER('):
                    sel.value = f'=UPPER({v[1:]})'
            elif v != v.upper():
                sel.value = v.upper()


def rapikan_laporan_evaluasi(wb) -> None:
    """Lembar 01-LAPORN pada salinan cetak:
    - Periode Penilaian: tanggal awal & akhir dalam satu teks pada sel gabungan E:H ('1 Juli 2026 s.d. 31 Desember 2026')
      karena sel tanggal template sempit (diapit 'S.d') sehingga tanggal panjang terpotong.
    - Kotak persetujuan: urutan ditata label -> 'Tanda tangan' -> ruang tanda tangan -> nama -> NIP (template: nama &
      NIP di atas tulisan tanda tangan)."""
    peta = PETA_CETAK['instrumen']['laporan']
    ws = wb[peta['sheet']]
    r = peta['periode']
    awal, akhir = ws[f'E{r}'].value, ws[f'G{r}'].value
    if isinstance(awal, str) and isinstance(akhir, str) and awal.startswith('=') and akhir.startswith('='):
        ws[f'E{r}'] = f'={awal[1:]}&" s.d. "&{akhir[1:]}'
        ws[f'F{r}'] = None
        ws[f'G{r}'] = None
        ws.merge_cells(f'E{r}:H{r}')
        a = copy(ws[f'E{r}'].alignment)
        ws[f'E{r}'].alignment = Alignment(horizontal='left', vertical=a.vertical or 'center', shrink_to_fit=True)

    b = peta['persetujuan']  # template: 29 label, 30 nama, 31 NIP, 32 'Tanda tangan'
    for (kol, kanan), sumber in zip(peta['blok_ttd'], peta['kolom_ttd']):
        isi_nama, isi_nip = ws[f'{sumber}{b + 1}'].value, ws[f'{sumber}{b + 2}'].value
        if not isinstance(isi_nama, str) or not isinstance(isi_nip, str) or not isi_nip.startswith('='):
            continue
        gaya = copy(ws[f'{sumber}{b}']._style)
        ukuran = ws[f'{sumber}{b}'].font.sz or 10
        # 29 label, 30 'Tanda tangan', 31–33 ruang tanda tangan, 34 nama (tebal bergaris bawah, boleh 2 baris), 35 NIP.
        isi = {0: 'Guru yang Dinilai' if sumber == peta['kolom_ttd'][0] else 'Penilai', 1: 'Tanda tangan', 2: None, 3: None,
               4: None, 5: isi_nama, 6: f'="NIP. "&{isi_nip[1:]}'}
        for i, nilai in isi.items():
            r = b + i
            for k in {kol, sumber, kanan}:
                ws[f'{k}{r}'].value = None
            sel = ws[f'{kol}{r}']
            sel._style = copy(gaya)
            sel.value = nilai
            sel.font = Font(name=FONT_RESMI, size=ukuran, bold=(i == 5), underline='single' if i == 5 else None)
            gabung(ws, r, column_index_from_string(kol), column_index_from_string(kanan))
            # Semua baris blok rata tengah pada sumbu yang sama; nama panjang dibungkus (maks. 2 baris, tidak menempel
            # garis kotak), baris lain diperkecil bila perlu.
            # Nama menempel ke bawah barisnya & NIP ke atas barisnya agar keduanya rapat.
            sel.alignment = Alignment(horizontal='center', vertical={5: 'bottom', 6: 'top'}.get(i, 'center'),
                                      wrap_text=(i == 5), shrink_to_fit=(i != 5))
            if i == 5:
                lebar = lebar_rentang_pt(ws, column_index_from_string(kol), column_index_from_string(kanan))
                f = copy(sel.font)
                f.sz = bungkus_dua_baris(wb, ws, sel, lebar, ukuran)
                sel.font = f
    for i, tinggi in ((0, 24.75), (1, 15.0), (2, 16.0), (3, 16.0), (4, 16.0), (5, 27.0), (6, 13.5)):
        ws.row_dimensions[b + i].height = tinggi
    for k in 'BCDEFGH':  # 'Tanggal : ...' di bawah kotak: tanpa garis bawah, seragam dengan isi kotak
        sel = ws[f'{k}{b + 7}']
        if isinstance(sel.value, str) and 'Tanggal' in sel.value:
            f = copy(sel.font)
            f.u = None
            sel.font = f


def isi_form_instr(wb, identitas: Dict[str, Any]) -> None:
    """Kepala lembar FORM-INSTR (nama, NIP, pangkat/gol. guru; penilai & NIP; tempat dan tanggal). Daftar centang
    FORM-INSTR memakai model 4 tingkat (Berkembang–Mahir) yang berbeda dari instrumen KOMP 5 level aplikasi, sehingga
    dibiarkan kosong."""
    ws = wb[PETA_CETAK['instrumen']['form_instr']['sheet']]
    g, p = identitas.get('guru') or {}, identitas.get('penilai') or {}
    tempat = ', '.join(x for x in ((identitas.get('sekolah') or {}).get('kota'), (identitas.get('periode') or {}).get('tanggal_penilaian')) if x)
    nilai = {'nama': g.get('nama'), 'nip': g.get('nip'), 'pangkat': ' / '.join(x for x in (g.get('pangkat'), g.get('golongan')) if x),
             'penilai': p.get('nama'), 'nip_penilai': p.get('nip'), 'tempat_tanggal': tempat}
    for kunci, sel in PETA_CETAK['instrumen']['form_instr']['sel'].items():
        ws[sel] = f": {nilai.get(kunci) or '-'}"


def isi_kehadiran(wb, kehadiran: Optional[List[Dict[str, Any]]], tugas_pokok: str = 'Guru') -> None:
    """Isi sheet INDEK-HDIR: label bulan periode & nilai terlambat/pulang cepat (menit) serta tanpa keterangan (hari)
    per bulan; baris bulan sisa dikosongkan (nilai 0). Contoh isian template ditimpa seluruhnya; rumus konversi,
    jumlah, dan indeks kehadiran tetap dari template. Tugas pokok diisi 'Guru' (template berisi contoh kepala sekolah)."""
    peta = PETA_CETAK['instrumen']['kehadiran']
    ws = wb[peta['sheet']]
    k = peta['kolom']
    ws[peta['tugas_pokok']] = tugas_pokok
    baris = list(kehadiran or [])[:peta['baris_maks']]
    for i in range(peta['baris_maks']):
        r = peta['baris_awal'] + i
        b = baris[i] if i < len(baris) else None
        ws[f"{k['label']}{r}"] = (b.get('label') or b.get('bulan')) if b else None
        for kunci in ('terlambat_menit', 'pulang_cepat_menit', 'tanpa_keterangan'):
            ws[f'{k[kunci]}{r}'] = int((b or {}).get(kunci) or 0)


def isi_rekomendasi(wb, teks: Optional[str]) -> None:
    """Tulis rekomendasi PKB di baris kosong 01-LAPORN (di bawah Deskripsi Capaian) pada salinan cetak, dengan gaya
    baris Deskripsi Capaian; tinggi baris menyesuaikan panjang teks. Berkas master tidak berubah."""
    if not teks:
        return
    peta = PETA_CETAK['instrumen']['rekomendasi']
    ws = wb[peta['sheet']]
    r, asal = peta['baris'], peta['gaya_dari']
    for kol, nilai in ((peta['label'], 'Rekomendasi PKB'), (peta['titik_dua'], ':'), (peta['isi'], teks)):
        sel = ws[f'{kol}{r}']
        sel.value = nilai
        if ws[f'{kol}{asal}'].has_style:
            sel._style = copy(ws[f'{kol}{asal}']._style)
    ws.merge_cells(peta['gabung'])
    baris_teks = max(1, -(-len(teks) // 48))
    ws.row_dimensions[r].height = max(15.0, 13.0 * baris_teks + 2)


# Lembar laporan lengkap untuk PDF, urut seperti berkas resmi. Tidak dicetak: 00-DATA (lembar isian), DUDI (khusus SMK),
# FORM-360-GR (angket kosong; dicetak terpisah lewat Cetak Angket), FORM-INSTR (formulir instrumen kosong), dan
# MODEL-GURU (halaman menu navigasi template: tombol tautan antarsheet & banner, tanpa data penilaian), dan RUBRIK-CAPAIAN
# (tabel acuan deskripsi level; tetap dibaca rumus 01-LAPORN dari lembar tersembunyi).
LEMBAR_PDF_LENGKAP = ('COVER', '01-LAPORN', '02-IDNTY', 'KOMP-1', 'KOMP (2)', 'KOMP (3)', 'KOMP (4)', '04-RKAP-PKG',
                      '05-RKAP-PKGR', 'INDEK-HDIR', 'SEJAWAT', 'SISWA', 'ORTU')


# Lembar angket 360° berlanjut ke beberapa halaman (tinggi bebas, kepala tabel diulang); lembar lain dicetak 1 halaman
# A4 sesuai orientasi template (tegak/lanskap), lebar dan tinggi dimuatkan.
LEMBAR_TINGGI_BEBAS = {'SEJAWAT': '7:8', 'SISWA': '7:8', 'ORTU': '7:8'}
LEMBAR_TEGAK = ('RUBRIK-CAPAIAN',)  # kolom sempit & baris tinggi: tegak agar huruf tidak mengecil pada kertas lanskap


def atur_halaman_lembar(ws: Worksheet) -> None:
    """Setelan cetak satu lembar laporan guru pada salinan: kertas A4, orientasi template, skala otomatis (fit lebar 1
    halaman). SEJAWAT/SISWA/ORTU: tinggi bebas dengan kepala tabel diulang (pemisah halaman manual template dibuang);
    lembar lain: 1 halaman penuh tanpa pemisah halaman tersisa."""
    ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.scale = None
    ws.print_options.horizontalCentered = True
    if ws.title in LEMBAR_TEGAK:
        ws.page_setup.orientation = 'portrait'
    ws.row_breaks.brk = []  # pemisah manual template disetel untuk skala Excel; LibreOffice memotong otomatis mengikuti skala
    if ws.title in LEMBAR_TINGGI_BEBAS:
        ws.print_title_rows = LEMBAR_TINGGI_BEBAS[ws.title]
        muat_lebar_halaman(ws, satu_halaman=False)
    else:
        muat_lebar_halaman(ws, satu_halaman=True)


def laporan_guru_excel(laporan: Dict[str, Any], hanya_rekap: bool = False, lembar: Optional[List[str]] = None) -> bytes:
    """Berkas .xlsx laporan PKG satu guru dari template instrumen resmi (seluruh sheet resmi ikut).
    Untuk PDF, `lembar` (mis. LEMBAR_PDF_LENGKAP) atau `hanya_rekap=True` (04-RKAP-PKG saja) menentukan sheet yang
    terlihat & tercetak, masing-masing selebar 1 halaman; rumusnya tetap menghitung dari sheet tersembunyi."""
    def pengisi(wb):
        isi_laporan_guru(wb, laporan)
        tampil = [PETA_CETAK['instrumen']['sheet_rekap']] if hanya_rekap else list(lembar or [])
        if tampil:
            tampilkan_hanya(wb, tampil)
            for nama in tampil:
                atur_halaman_lembar(wb[nama])
    return isi_template_ke_bytes('instrumen', pengisi)
