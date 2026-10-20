"""PDF cadangan PKG dengan ReportLab, dipakai bila LibreOffice tidak tersedia/gagal (pola seperti routers/uks.py).

Hasilnya BUKAN salinan identik berkas Excel resmi: setiap halaman diberi pita penanda "VERSI CADANGAN" di atas
dan tanda air diagonal, serta catatan di kaki halaman. Nilai dihitung dengan rumus yang sama dengan template
(pkg_nilai untuk laporan per guru, pkg_cetak.predikat_rekap untuk rekap).
"""
import io
from datetime import date
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from pkg_cetak import predikat_rekap, tanggal_indonesia
from pkg_nilai import hitung_nilai, level_guru, skor_sub

PENANDA = 'VERSI CADANGAN — bukan salinan identik berkas Excel resmi PKG'
HIJAU = colors.HexColor('#006837')


def _penanda_halaman(kanvas, doc) -> None:
    """Pita penanda di atas, tanda air diagonal, dan kaki halaman pada setiap halaman."""
    lebar, tinggi = doc.pagesize
    kanvas.saveState()
    kanvas.setFillColor(colors.HexColor('#FEF3C7'))
    kanvas.rect(0, tinggi - 0.9 * cm, lebar, 0.9 * cm, stroke=0, fill=1)
    kanvas.setFillColor(colors.HexColor('#92400E'))
    kanvas.setFont('Helvetica-Bold', 9)
    kanvas.drawCentredString(lebar / 2, tinggi - 0.6 * cm, PENANDA)
    kanvas.setFillColor(colors.Color(0.85, 0.85, 0.85, alpha=0.35))
    kanvas.setFont('Helvetica-Bold', 60)
    kanvas.translate(lebar / 2, tinggi / 2)
    kanvas.rotate(35)
    kanvas.drawCentredString(0, 0, 'CADANGAN')
    kanvas.restoreState()
    kanvas.saveState()
    kanvas.setFont('Helvetica', 7)
    kanvas.setFillColor(colors.grey)
    kanvas.drawString(1.5 * cm, 0.7 * cm, f'Dibuat otomatis dengan mesin cadangan (ReportLab) · {tanggal_indonesia(date.today())}')
    kanvas.drawRightString(lebar - 1.5 * cm, 0.7 * cm, f'Halaman {doc.page}')
    kanvas.restoreState()


def _gaya_tabel(header_baris: int = 1) -> TableStyle:
    return TableStyle([
        ('GRID', (0, 0), (-1, -1), 0.4, colors.grey),
        ('BACKGROUND', (0, 0), (-1, header_baris - 1), HIJAU),
        ('TEXTCOLOR', (0, 0), (-1, header_baris - 1), colors.white),
        ('FONTNAME', (0, 0), (-1, header_baris - 1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ])


def _dokumen(output, pagesize) -> SimpleDocTemplate:
    return SimpleDocTemplate(output, pagesize=pagesize, topMargin=1.5 * cm, bottomMargin=1.4 * cm,
                             leftMargin=1.5 * cm, rightMargin=1.5 * cm, title='PKG (versi cadangan)')


def rekap_pdf_cadangan(guru: List[Dict[str, Any]], periode: Dict[str, Any], kepala: Optional[str] = None) -> bytes:
    """PDF cadangan rekap hasil PKG (A4 lanskap): tabel guru, jumlah & rata-rata NKG, predikat skala rekap."""
    gaya = getSampleStyleSheet()
    sel = gaya['BodyText'].clone('sel', fontSize=8.5, leading=10)
    tahun = str((periode.get('tanggal_tutup') or periode.get('tanggal_buka') or '')[:4])
    isi = [
        Paragraph(f'<b>REKAP HASIL PENILAIAN KINERJA GURU (PKG) TAHUN {tahun}</b>', gaya['Title']),
        Paragraph(f"Semester {periode.get('semester') or '-'} Tahun Pelajaran {periode.get('tahun_pelajaran') or '-'}", gaya['Normal']),
        Spacer(1, 0.4 * cm),
    ]
    baris = [['No', 'Nama Guru', 'Pangkat / Gol', 'Guru Kelas/Mapel', 'Tugas Tambahan', 'Nilai Kompetensi Guru (NKG)', 'Predikat']]
    nkg = []
    for i, g in enumerate(guru, 1):
        n = round(float(g['capaian_persen']), 2) if g.get('capaian_persen') is not None else None
        if n is not None:
            nkg.append(n)
        baris.append([str(i), Paragraph(g.get('nama') or '-', sel), g.get('pangkat') or '', Paragraph(g.get('mapel') or '', sel),
                      g.get('tugas_tambahan') or '', f'{n:.2f}' if n is not None else '-', predikat_rekap(n)])
    rata = round(sum(nkg) / len(nkg), 2) if nkg else None
    baris.append(['', 'Jumlah', '', '', '', f'{sum(nkg):.2f}', ''])
    baris.append(['', 'Rata-rata', '', '', '', f'{rata:.2f}' if rata is not None else '-', predikat_rekap(rata)])
    tabel = Table(baris, colWidths=[1.2 * cm, 7 * cm, 3 * cm, 4.5 * cm, 3.5 * cm, 4 * cm, 3 * cm], repeatRows=1)
    gaya_tabel = _gaya_tabel()
    gaya_tabel.add('ALIGN', (0, 0), (0, -1), 'CENTER')
    gaya_tabel.add('ALIGN', (5, 0), (6, -1), 'CENTER')
    gaya_tabel.add('FONTNAME', (0, -2), (-1, -1), 'Helvetica-Bold')
    isi += [tabel, Spacer(1, 0.8 * cm),
            Paragraph(f'{tanggal_indonesia(date.today())}<br/>Kepala Madrasah<br/><br/><br/><b>{kepala or "(...............................)"}</b>',
                      gaya['Normal'].clone('ttd', leftIndent=17 * cm))]
    output = io.BytesIO()
    _dokumen(output, landscape(A4)).build(isi, onFirstPage=_penanda_halaman, onLaterPages=_penanda_halaman)
    return output.getvalue()


def _baris_level_guru(lv: Dict[str, Any], sel) -> List[list]:
    """Baris level guru seperti 01-LAPORN: Normal, Plus 360, simpulan, dan deskripsi capaian (RUBRIK-CAPAIAN)."""
    baris = [['Level guru (Normal / Plus 360)', f"{lv.get('normal') or '-'} / {lv.get('plus_360') or '-'}"],
             ['Hasil evaluasi (simpulan)', lv.get('simpulan') or '-']]
    if (lv.get('deskripsi') or {}).get('umum'):
        baris.append(['Deskripsi capaian', Paragraph(lv['deskripsi']['umum'], sel)])
    return baris


def laporan_guru_pdf_cadangan(laporan: Dict[str, Any]) -> bytes:
    """PDF cadangan rekapitulasi hasil PKG satu guru (A4 tegak): identitas, tingkat per sub-kompetensi, jumlah,
    capaian, level, predikat jenjang (rumus template resmi), serta level guru & deskripsi capaian (01-LAPORN)."""
    gaya = getSampleStyleSheet()
    sel = gaya['BodyText'].clone('sel', fontSize=8.5, leading=10)
    instrumen = laporan.get('instrumen') or {}
    isian = laporan.get('isian') or {}
    nilai = hitung_nilai(instrumen, isian)
    g, p = laporan.get('guru') or {}, laporan.get('periode') or {}
    identitas = [
        ['Nama Guru', g.get('nama') or '-'], ['NIP', g.get('nip') or '-'],
        ['Periode', f"{tanggal_indonesia(date.fromisoformat(p['tanggal_buka']))} s.d. {tanggal_indonesia(date.fromisoformat(p['tanggal_tutup']))}"
         if p.get('tanggal_buka') and p.get('tanggal_tutup') else '-'],
        ['Penilai', (laporan.get('penilai') or {}).get('nama') or '-'], ['Nomor SK', (laporan.get('sk') or {}).get('nomor_sk') or '-'],
    ]
    t_id = Table(identitas, colWidths=[4 * cm, 13 * cm])
    t_id.setStyle(TableStyle([('FONTSIZE', (0, 0), (-1, -1), 9), ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold')]))
    baris = [['No', 'Kompetensi', 'Tingkat Kompetensi', 'Nilai']]
    no = 0
    for k in instrumen.get('kompetensi') or []:
        baris.append(['', Paragraph(f"<b>{k.get('kode')}. {k.get('nama')}</b>", sel), '', ''])
        for s in k.get('sub') or []:
            no += 1
            skor = skor_sub((isian.get(s['kode']) or {}).get('centang'))
            baris.append([str(no), Paragraph(f"{s['kode']} {s.get('nama')}", sel), f'Level {skor}' if skor else '-', str(skor)])
    baris.append(['', 'Jumlah', '', str(nilai['nilai_akhir'])])
    tabel = Table(baris, colWidths=[1.2 * cm, 11.3 * cm, 3 * cm, 2 * cm], repeatRows=1)
    gaya_tabel = _gaya_tabel()
    gaya_tabel.add('ALIGN', (2, 0), (-1, -1), 'CENTER')
    gaya_tabel.add('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold')
    ringkas = Table([
        ['Capaian', f"{nilai['capaian_persen']:.2f}%"], ['Tingkat capaian', nilai['level_capaian'] or '-'],
        ['Predikat', Paragraph(nilai['predikat'] or '-', sel)],
        *_baris_level_guru(laporan.get('level_guru') or level_guru(nilai['level_capaian']), sel),
    ], colWidths=[4 * cm, 13.5 * cm])
    ringkas.setStyle(_gaya_tabel(header_baris=0))
    isi = [Paragraph('<b>REKAPITULASI HASIL PENILAIAN KINERJA GURU</b>', gaya['Title']), t_id, Spacer(1, 0.4 * cm), tabel,
           Spacer(1, 0.3 * cm), ringkas]
    output = io.BytesIO()
    _dokumen(output, A4).build(isi, onFirstPage=_penanda_halaman, onLaterPages=_penanda_halaman)
    return output.getvalue()
