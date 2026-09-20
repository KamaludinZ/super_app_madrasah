import io
from datetime import datetime
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

BRAND_HEX = "006837"


def _kop_surat(story, styles, settings: Dict[str, Any], title: str):
    school_name = (settings.get('school_name') or 'MTsN 2 Kota Malang').upper()
    address = settings.get('address') or ''
    phone = settings.get('phone') or ''
    addr_line = address
    if phone:
        addr_line = f"{address} | Telp: {phone}" if address else f"Telp: {phone}"

    story.append(Paragraph("KEMENTERIAN AGAMA REPUBLIK INDONESIA", styles['Heading4']))
    story.append(Paragraph(school_name, styles['Heading3']))
    if addr_line:
        story.append(Paragraph(addr_line, styles['Normal']))
    story.append(Paragraph(f"<u>{title}</u>", styles['Heading4']))
    story.append(Spacer(1, 10))


def _signature_block(story, city_label: str, kepala_madrasah: Dict[str, str], penyusun_label: str, penyusun: Dict[str, str]):
    today_str = datetime.now().strftime("%d %B %Y")
    sign_data = [
        ["Mengetahui,", f"{city_label}, {today_str}"],
        ["Kepala Madrasah", penyusun_label],
        ["", ""],
        ["", ""],
        [kepala_madrasah.get('name', '-'), penyusun.get('name', '-')],
        [f"NIP. {kepala_madrasah.get('nip', '-')}", f"NIP. {penyusun.get('nip', '-')}"],
    ]
    sign_tbl = Table(sign_data, colWidths=[260, 260])
    sign_tbl.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('FONTNAME', (0, 4), (-1, 4), 'Helvetica-Bold'),
    ]))
    story.append(sign_tbl)


def export_jurnal_penggunaan_pdf(
    settings: Dict[str, Any],
    lab_name: str,
    rows: List[Dict[str, Any]],
    penyusun: Dict[str, str],
    kepala_madrasah: Dict[str, str],
    city_label: str = "Malang",
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), leftMargin=28, rightMargin=28, topMargin=24, bottomMargin=24)
    styles = getSampleStyleSheet()
    story = []

    _kop_surat(story, styles, settings, f"JURNAL PENGGUNAAN LABORATORIUM {lab_name.upper()}")

    cell_style = styles['BodyText']
    cell_style.fontSize = 8.5
    cell_style.leading = 10

    table_data = [["NO", "PENGGUNA/GURU", "TANGGAL & WAKTU", "JUDUL PERCOBAAN/EKSPERIMEN", "ALAT & BAHAN DIGUNAKAN", "CATATAN PENTING"]]
    for idx, r in enumerate(rows, start=1):
        jp = f" (JP {r['jp_mulai']}-{r['jp_selesai']})" if r.get('jp_mulai') and r.get('jp_selesai') else ''
        waktu = f"{r.get('tanggal', '-')}\n{r.get('jam_mulai', '')}-{r.get('jam_selesai', '')}{jp}"
        table_data.append([
            str(idx),
            Paragraph(r.get('pengguna_nama') or r.get('penanggung_jawab_nama') or '-', cell_style),
            Paragraph(waktu, cell_style),
            Paragraph(r.get('judul_percobaan') or r.get('kegiatan') or '-', cell_style),
            Paragraph(r.get('alat_bahan_digunakan') or '-', cell_style),
            Paragraph(r.get('keterangan') or '-', cell_style),
        ])
    if len(table_data) == 1:
        table_data.append(['-', 'Belum ada data jurnal penggunaan', '-', '-', '-', '-'])

    col_widths = [24, 110, 90, 150, 150, 150]
    tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(f'#{BRAND_HEX}')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (0, 1), (0, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 16))

    _signature_block(story, city_label, kepala_madrasah, "Kepala Laboratorium", penyusun)
    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf


def export_jurnal_pengelolaan_pdf(
    settings: Dict[str, Any],
    lab_name: str,
    rows: List[Dict[str, Any]],
    penyusun: Dict[str, str],
    kepala_madrasah: Dict[str, str],
    city_label: str = "Malang",
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=landscape(A4), leftMargin=28, rightMargin=28, topMargin=24, bottomMargin=24)
    styles = getSampleStyleSheet()
    story = []

    _kop_surat(story, styles, settings, f"JURNAL PENGELOLAAN LABORATORIUM {lab_name.upper()}")

    cell_style = styles['BodyText']
    cell_style.fontSize = 9
    cell_style.leading = 11

    table_data = [["NO", "TAHUN AJARAN", "HARI/TANGGAL", "KEGIATAN PENGELOLAAN", "KETERANGAN"]]
    for idx, r in enumerate(rows, start=1):
        table_data.append([
            str(idx),
            r.get('tahun_ajaran') or '-',
            r.get('tanggal', '-'),
            Paragraph(r.get('jenis_perawatan') or '-', cell_style),
            Paragraph(r.get('keterangan') or r.get('hasil') or '-', cell_style),
        ])
    if len(table_data) == 1:
        table_data.append(['-', '-', '-', 'Belum ada data jurnal pengelolaan', '-'])

    col_widths = [28, 80, 100, 260, 260]
    tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(f'#{BRAND_HEX}')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('ALIGN', (0, 1), (2, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTSIZE', (0, 0), (-1, -1), 9),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 16))

    _signature_block(story, city_label, kepala_madrasah, "Kepala Laboratorium", penyusun)
    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
