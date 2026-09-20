import io
from datetime import datetime
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

SCHOOL_NAME = "MTsN 2 Kota Malang"
BRAND_HEX = "006837"


def export_lckb_pdf(
    gtk_name: str,
    gtk_nip: str,
    pangkat_golongan: str,
    jabatan: str,
    month: str,
    year: int,
    rows: List[Dict[str, Any]],
    ktu_name: str = "-",
    ktu_nip: str = "-",
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=28,
        bottomMargin=28,
    )

    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("LAPORAN CAPAIAN KINERJA BULANAN", styles["Heading2"]))
    story.append(Paragraph(f"BULAN {month.upper()} {year}", styles["Heading3"]))
    story.append(Spacer(1, 10))

    identity_data = [
        ["NAMA", f": {gtk_name}"],
        ["NIP", f": {gtk_nip}"],
        ["PANGKAT/ GOL. RUANG", f": {pangkat_golongan}"],
        ["JABATAN", f": {jabatan}"],
        ["UNIT KERJA", f": {SCHOOL_NAME}"],
    ]
    identity_tbl = Table(identity_data, colWidths=[140, 300])
    identity_tbl.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ]))
    story.append(identity_tbl)
    story.append(Spacer(1, 12))

    cell_style = styles["BodyText"]
    cell_style.fontSize = 8.5
    cell_style.leading = 10

    table_data = [["NO", "URAIAN TUGAS / PROGRAM", "VOLUME", "SATUAN", "BUKTI DUKUNG"]]
    for idx, r in enumerate(rows, start=1):
        indikator = Paragraph(r.get('indikator_kinerja_individu') or '-', cell_style)
        bukti = r.get('output_url') or '-'
        bukti_para = Paragraph(bukti, cell_style) if bukti != '-' else '-'
        table_data.append([
            str(idx),
            indikator,
            r.get('realisasi_volume') if r.get('realisasi_volume') not in (None, '') else '0',
            r.get('satuan_hasil') or '-',
            bukti_para,
        ])

    if len(table_data) == 1:
        table_data.append(["-", "Belum ada RHK yang diambil untuk bulan ini", "-", "-", "-"])

    col_widths = [26, 190, 44, 90, 150]
    tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{BRAND_HEX}")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        ("ALIGN", (0, 1), (0, -1), "CENTER"),
        ("ALIGN", (2, 1), (2, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 14))

    story.append(Paragraph(
        f"Keterangan: Jam Kerja seluruh GTK {SCHOOL_NAME} Senin - Kamis pukul 07.00 - 15.30 WIB, "
        "Jum'at pukul 07.00 - 16.00 WIB.",
        styles["BodyText"],
    ))
    story.append(Spacer(1, 18))

    today_str = datetime.now().strftime("%d %B %Y")
    sign_data = [
        ["", f"Malang, {today_str}"],
        ["Mengetahui,", ""],
        ["Kepala Urusan Tata Usaha", "Yang Bersangkutan"],
        ["", ""],
        ["", ""],
        [ktu_name, gtk_name],
        [f"NIP. {ktu_nip}" if ktu_nip != '-' else '-', f"NIP. {gtk_nip}"],
    ]
    sign_tbl = Table(sign_data, colWidths=[250, 250])
    sign_tbl.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("FONTNAME", (0, 5), (-1, 5), "Helvetica-Bold"),
    ]))
    story.append(sign_tbl)

    doc.build(story)
    pdf = buffer.getvalue()
    buffer.close()
    return pdf
