"""Form isian kosong PKG untuk dicetak (ReportLab, A4): tim penilai mengisi di kertas secara offline, lalu hasilnya
diinput ke aplikasi. Ada empat jenis: `instrumen` (penilaian kinerja per kompetensi/sub dengan kotak centang indikator
Level 1–5), `kehadiran` (rekap bulanan INDEK-HDIR), `pkb` (rekomendasi PKB) dan `paket` (ketiganya per guru).

Isi dibuat dari basis data (instrumen aktif atau instrumen yang dipakai lembar guru, bulan semester periode, opsi PKB
baku), bukan dari template Excel, sehingga ikut berubah bila instrumen direvisi. Ini form isian, bukan salinan dokumen
resmi: tanpa pita/tanda air "CADANGAN" seperti PDF cadangan di pkg_pdf_cadangan.
"""
import io
from datetime import date
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Flowable, KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from pkg_ambang import MENIT_PER_HARI, PEMBAGI_HARI_KEHADIRAN
from pkg_cetak import tanggal_indonesia
from pkg_rekomendasi import FOKUS_KOMPETENSI, OPSI_PKB

JENIS_FORM = ('instrumen', 'kehadiran', 'pkb', 'paket')
JUDUL_FORM = {'instrumen': 'FORM PENILAIAN KINERJA GURU', 'kehadiran': 'FORM REKAP KEHADIRAN GURU',
              'pkb': 'FORM REKOMENDASI PENGEMBANGAN KEPROFESIAN BERKELANJUTAN (PKB)'}
CATATAN_FORM = 'FORM ISIAN — diisi tim penilai, lalu diinput ke aplikasi'
HIJAU = colors.HexColor('#006837')
HIJAU_MUDA = colors.HexColor('#ECFDF5')
KOLOM_KEHADIRAN = (('terlambat_menit', 'Terlambat\n(menit)'), ('pulang_cepat_menit', 'Pulang cepat\n(menit)'),
                   ('tanpa_keterangan', 'Tanpa ket.\n(hari)'), ('hadir', 'Hadir\n(hari)'), ('izin', 'Izin\n(hari)'),
                   ('sakit', 'Sakit\n(hari)'))
LEBAR = A4[0] - 3 * cm  # lebar isi halaman (margin 1,5 cm)
TITIK = '.' * 70
_GAYA = getSampleStyleSheet()
_NORMAL = _GAYA['Normal'].clone('fk_normal', fontSize=9, leading=11)
_SEL = _GAYA['BodyText'].clone('fk_sel', fontSize=8.5, leading=10)
_KECIL = _GAYA['Normal'].clone('fk_kecil', fontSize=7.5, leading=9, textColor=colors.HexColor('#475569'))
_JUDUL = _GAYA['Title'].clone('fk_judul', fontSize=13, leading=16, spaceAfter=2)
_SUB = _GAYA['Normal'].clone('fk_sub', fontSize=9, leading=11, alignment=1, textColor=colors.HexColor('#92400E'))
_TENGAH = _GAYA['Normal'].clone('fk_tengah', alignment=1, fontSize=9, leading=11)


class Kotak(Flowable):
    """Kotak centang kosong bersisi `sisi` pt."""

    def __init__(self, sisi: float = 11):
        super().__init__()
        self.sisi = sisi
        self.width = self.height = sisi

    def draw(self):
        self.canv.setLineWidth(0.8)
        self.canv.rect(0, 0, self.sisi, self.sisi, stroke=1, fill=0)


def _esc(teks: Any) -> str:
    return str(teks if teks is not None else '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def _garis(label: str, jumlah: int = 2) -> List[Any]:
    """Label diikuti `jumlah` garis tulis."""
    baris = [[Paragraph(f'<b>{_esc(label)}</b>', _SEL)]] + [[''] for _ in range(jumlah)]
    t = Table(baris, colWidths=[LEBAR], rowHeights=[None] + [0.7 * cm] * jumlah)
    t.setStyle(TableStyle([('LINEBELOW', (0, 1), (-1, -1), 0.4, colors.grey), ('TOPPADDING', (0, 0), (-1, -1), 1),
                           ('BOTTOMPADDING', (0, 0), (-1, -1), 1)]))
    return [t, Spacer(1, 0.15 * cm)]


def _kepala_dokumen(judul: str, ctx: Dict[str, Any]) -> List[Any]:
    periode = ctx['periode']
    return [
        Paragraph(f"<b>{_esc(ctx.get('madrasah') or 'MADRASAH')}</b>", _GAYA['Normal'].clone('fk_mad', alignment=1, fontSize=10)),
        Paragraph(f'<b>{judul}</b>', _JUDUL),
        Paragraph(f"Periode: {_esc(periode.get('nama_periode') or '-')} · Tahun Pelajaran {_esc(periode.get('tahun_pelajaran') or '-')}"
                  f" · Semester {_esc(periode.get('semester') or '-')}", _TENGAH),
        Paragraph(CATATAN_FORM, _SUB), Spacer(1, 0.25 * cm),
    ]


def _identitas(ctx: Dict[str, Any]) -> List[Any]:
    """Identitas guru dinilai & penilai; terisi bila diketahui, selain itu titik-titik untuk ditulis tangan."""
    g, p = ctx.get('guru') or {}, ctx.get('penilai') or {}
    baris = [['Nama guru dinilai', f": {g.get('nama') or TITIK}"], ['NIP', f": {g.get('nip') or TITIK}"],
             ['Mata pelajaran / tugas', f": {g.get('mapel') or g.get('tugas_tambahan') or TITIK}"],
             ['Nama penilai', f": {p.get('nama') or TITIK}"], ['NIP penilai', f": {p.get('nip') or TITIK}"]]
    t = Table(baris, colWidths=[4 * cm, LEBAR - 4 * cm])
    t.setStyle(TableStyle([('FONTSIZE', (0, 0), (-1, -1), 9), ('TOPPADDING', (0, 0), (-1, -1), 1.5), ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5)]))
    return [t, Spacer(1, 0.3 * cm)]


def _tanda_tangan(*peran: str) -> List[Any]:
    """Tanggal dan tempat tanda tangan; `peran` = jabatan penanda tangan."""
    sel = [Paragraph(f'{_esc(p)},<br/><br/><br/><br/>(.........................................)', _TENGAH) for p in peran]
    t = Table([sel], colWidths=[LEBAR / len(peran)] * len(peran))
    t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP')]))
    tanggal = Paragraph('.................., ........................ 20....', _GAYA['Normal'].clone('fk_tgl', alignment=2, fontSize=9))
    return [Spacer(1, 0.4 * cm), KeepTogether([tanggal, Spacer(1, 0.15 * cm), t])]


def _gaya_daftar_centang() -> TableStyle:
    return TableStyle([('GRID', (0, 0), (-1, -1), 0.4, colors.grey), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('ALIGN', (0, 0), (0, -1), 'CENTER')])


# ---------------------------------------------------------------- bagian-bagian form

def bagian_instrumen(ctx: Dict[str, Any]) -> List[Any]:
    """Penilaian kinerja: per kompetensi → sub, indikator Level 1–5 berkotak centang, kotak skor sub (jumlah centang),
    garis catatan bukti & tanggapan; di akhir catatan umum, ringkasan skor per kompetensi, dan tanda tangan."""
    instrumen = ctx['instrumen']
    isi = _kepala_dokumen(JUDUL_FORM['instrumen'], ctx) + _identitas(ctx)
    isi.append(Paragraph('Petunjuk: centang kotak pada setiap indikator perilaku yang teramati/terbukti. Skor sub-kompetensi = '
                         'jumlah indikator yang dicentang. Tulis di kotak skor, lalu input ke aplikasi.', _KECIL))
    isi.append(Spacer(1, 0.2 * cm))
    ringkas = []
    for k in instrumen.get('kompetensi') or []:
        judul_k = Paragraph(f"<b>KOMPETENSI {_esc(k.get('nama') or k.get('kode')).upper()}</b>", _GAYA['Normal'].clone(
            'fk_kom', fontSize=10, textColor=colors.white))
        isi.append(Table([[judul_k]], colWidths=[LEBAR], style=[('BACKGROUND', (0, 0), (-1, -1), HIJAU)]))
        isi.append(Spacer(1, 0.15 * cm))
        maks = 0
        for s in k.get('sub') or []:
            indikator = sorted(s.get('indikator') or [], key=lambda i: i.get('level') or 0)
            maks += len(indikator)
            baris = [[Paragraph(f"<b>{_esc(s.get('kode'))} · {_esc(s.get('nama'))}</b>", _SEL), '', '']]
            baris += [[Kotak(), Paragraph(f"<b>L{i.get('level')}</b>", _SEL), Paragraph(_esc(i.get('teks')), _SEL)] for i in indikator]
            t = Table(baris, colWidths=[0.9 * cm, 1 * cm, LEBAR - 1.9 * cm])
            t.setStyle(TableStyle([('SPAN', (0, 0), (-1, 0)), ('BACKGROUND', (0, 0), (-1, 0), HIJAU_MUDA), ('GRID', (0, 0), (-1, -1), 0.4, colors.grey),
                                   ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('ALIGN', (0, 1), (0, -1), 'CENTER')]))
            skor = Table([[Paragraph(f'<b>Skor sub (jumlah centang, 0–{len(indikator)})</b>', _SEL), '']],
                         colWidths=[LEBAR - 2 * cm, 2 * cm], rowHeights=[0.8 * cm])
            skor.setStyle(TableStyle([('BOX', (1, 0), (1, 0), 1, colors.black), ('ALIGN', (0, 0), (0, 0), 'RIGHT'), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
            isi.append(KeepTogether([t, Spacer(1, 0.1 * cm), skor, *_garis('Catatan bukti', 1), *_garis('Tanggapan guru', 1), Spacer(1, 0.15 * cm)]))
        ringkas.append((k.get('nama') or k.get('kode'), maks))
    rangkum = [['Kompetensi', 'Skor (jumlah skor sub)', 'Skor maksimum']]
    rangkum += [[str(n), '', str(m)] for n, m in ringkas]
    rangkum.append(['Nilai akhir (jumlah seluruh sub)', '', str(sum(m for _, m in ringkas))])
    tr = Table(rangkum, colWidths=[LEBAR - 8 * cm, 4.5 * cm, 3.5 * cm], rowHeights=[None] + [0.8 * cm] * (len(rangkum) - 1))
    tr.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 0.4, colors.grey), ('BACKGROUND', (0, 0), (-1, 0), HIJAU), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                            ('FONTSIZE', (0, 0), (-1, -1), 8.5), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('ALIGN', (1, 0), (-1, -1), 'CENTER')]))
    isi += [Spacer(1, 0.2 * cm), *_garis('Catatan umum', 3), Paragraph('<b>Ringkasan skor</b>', _NORMAL), Spacer(1, 0.1 * cm), KeepTogether([tr]),
            *_tanda_tangan('Penilai', 'Guru yang dinilai')]
    return isi


def bagian_kehadiran(ctx: Dict[str, Any]) -> List[Any]:
    """Rekap kehadiran per bulan semester periode (kolom INDEK-HDIR), baris jumlah, dan keterangan rumus indeks."""
    isi = _kepala_dokumen(JUDUL_FORM['kehadiran'], ctx) + _identitas(ctx)
    bulan = ctx.get('bulan') or [''] * 6  # bulan semester tak diketahui: enam baris kosong
    baris = [['No', 'Bulan'] + [n for _, n in KOLOM_KEHADIRAN]]
    baris += [[str(i), b] + [''] * len(KOLOM_KEHADIRAN) for i, b in enumerate(bulan, 1)]
    baris.append(['', 'Jumlah'] + [''] * len(KOLOM_KEHADIRAN))
    lebar_kolom = [1 * cm, 3.4 * cm] + [(LEBAR - 4.4 * cm) / len(KOLOM_KEHADIRAN)] * len(KOLOM_KEHADIRAN)
    t = Table(baris, colWidths=lebar_kolom, rowHeights=[1.1 * cm] + [0.9 * cm] * (len(baris) - 1), repeatRows=1)
    t.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 0.5, colors.grey), ('BACKGROUND', (0, 0), (-1, 0), HIJAU), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                           ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'), ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                           ('BACKGROUND', (0, -1), (-1, -1), HIJAU_MUDA), ('FONTSIZE', (0, 0), (-1, -1), 8.5),
                           ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('ALIGN', (0, 0), (0, -1), 'CENTER'), ('ALIGN', (2, 0), (-1, 0), 'CENTER')]))
    isi += [t, Spacer(1, 0.4 * cm), Paragraph(
        '<b>Cara menghitung (sheet INDEK-HDIR)</b><br/>'
        f'Konversi hari = (terlambat + pulang cepat, dalam menit) / {MENIT_PER_HARI}. '
        'Tidak hadir = konversi hari + hari tanpa keterangan. '
        f'Indeks kehadiran = 1 − (jumlah tidak hadir / {PEMBAGI_HARI_KEHADIRAN}). '
        'Cukup tulis angka per bulan di atas; konversi dan indeks dihitung otomatis oleh aplikasi.', _KECIL),
        Spacer(1, 0.3 * cm), *_garis('Catatan', 2), *_tanda_tangan('Penilai', 'Guru yang dinilai')]
    return isi


def bagian_pkb(ctx: Dict[str, Any]) -> List[Any]:
    """Rekomendasi PKB: kotak centang opsi baku & fokus kompetensi, garis catatan, dan tanda tangan."""
    isi = _kepala_dokumen(JUDUL_FORM['pkb'], ctx) + _identitas(ctx)
    isi += [Paragraph('<b>Rekomendasi PKB</b> (centang satu atau lebih)', _NORMAL), Spacer(1, 0.15 * cm)]
    t = Table([[Kotak(), Paragraph(_esc(label), _SEL)] for label in OPSI_PKB.values()], colWidths=[1 * cm, LEBAR - 1 * cm],
              rowHeights=[0.8 * cm] * len(OPSI_PKB))
    t.setStyle(_gaya_daftar_centang())
    isi += [t, Spacer(1, 0.4 * cm), Paragraph('<b>Fokus kompetensi</b> (centang bila ada)', _NORMAL), Spacer(1, 0.15 * cm)]
    f = Table([[Kotak(), Paragraph(_esc(label), _SEL)] for label in FOKUS_KOMPETENSI.values()], colWidths=[1 * cm, LEBAR - 1 * cm],
              rowHeights=[0.8 * cm] * len(FOKUS_KOMPETENSI))
    f.setStyle(_gaya_daftar_centang())
    isi += [f, Spacer(1, 0.4 * cm), *_garis('Catatan rekomendasi (maks. 1000 karakter)', 5), *_tanda_tangan('Penilai', 'Guru yang dinilai')]
    return isi


BAGIAN = {'instrumen': [bagian_instrumen], 'kehadiran': [bagian_kehadiran], 'pkb': [bagian_pkb],
          'paket': [bagian_instrumen, bagian_kehadiran, bagian_pkb]}


class _Kanvas(Canvas):
    """Kanvas dengan kaki halaman "Halaman n dari N" (jumlah halaman baru diketahui setelah seluruh isi tersusun)."""

    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self._halaman: List[Dict[str, Any]] = []

    def showPage(self):
        self._halaman.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._halaman)
        for keadaan in self._halaman:
            self.__dict__.update(keadaan)
            self.setFont('Helvetica', 7)
            self.setFillColor(colors.grey)
            self.drawString(1.5 * cm, 0.8 * cm, f'{CATATAN_FORM} · dicetak {tanggal_indonesia(date.today())}')
            self.drawRightString(A4[0] - 1.5 * cm, 0.8 * cm, f'Halaman {self._pageNumber} dari {total}')
            super().showPage()
        super().save()


def form_kosong_pdf(jenis: str, konteks: List[Dict[str, Any]]) -> bytes:
    """PDF form isian. `konteks` = satu entri per guru (atau satu entri tanpa guru untuk form kosong):
    {madrasah, periode, guru|None, penilai|None, instrumen, bulan: ['Juli 2026', ...]}. Tiap bagian & tiap guru
    dimulai di halaman baru."""
    if jenis not in JENIS_FORM:
        raise ValueError(f'jenis form tidak dikenal: {jenis}')
    isi: List[Any] = []
    for ctx in konteks:
        for bagian in BAGIAN[jenis]:
            if isi:
                isi.append(PageBreak())
            isi += bagian(ctx)
    output = io.BytesIO()
    SimpleDocTemplate(output, pagesize=A4, topMargin=1.4 * cm, bottomMargin=1.5 * cm, leftMargin=1.5 * cm, rightMargin=1.5 * cm,
                      title=f'Form isian PKG ({jenis})').build(isi, canvasmaker=_Kanvas)
    return output.getvalue()
