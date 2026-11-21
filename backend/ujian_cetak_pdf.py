"""Cadangan ReportLab untuk lembar ujian (Daftar Hadir Peserta & Berita Acara) bila LibreOffice tidak tersedia.

Meniru tata letak template docx madrasah (A4, kop berlogo, tabel 32 baris dengan kolom tanda tangan zig-zag, isian
berita acara) dari data yang SAMA dengan ujian_cetak_docx, termasuk template teks & pola tanda tangan per ujian.
Logo diambil langsung dari berkas template docx sehingga tidak ada aset ganda.
"""
import io
import zipfile
from pathlib import Path
from typing import Any, Dict, List, Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from ujian_cetak_docx import (
    BARIS_PER_LEMBAR_DH, BULAN, HARI, TEMPLATE_BA, TEMPLATE_DH, TINGGI_TTD_DH_MAKS, _png_sah, baris_nomor,
    huruf_besar_madrasah, jam_titik, terbilang,
)

FOLDER_FONT = Path(__file__).parent / 'fonts'
_FONT = {'biasa': 'Helvetica', 'tebal': 'Helvetica-Bold'}


def _siapkan_font() -> None:
    """Arial dari backend/fonts bila ada (sama dengan template daftar hadir); cadangan Helvetica."""
    if _FONT['biasa'] == 'Arial':
        return
    try:
        pdfmetrics.registerFont(TTFont('Arial', str(FOLDER_FONT / 'Arial.ttf')))
        pdfmetrics.registerFont(TTFont('Arial-Bold', str(FOLDER_FONT / 'Arial-Bold.ttf')))
        _FONT.update(biasa='Arial', tebal='Arial-Bold')
    except Exception:  # noqa: BLE001 — font tidak ada: tetap Helvetica
        pass


def _logo(template: Path, nama: str) -> Optional[ImageReader]:
    try:
        with zipfile.ZipFile(template) as z:
            return ImageReader(io.BytesIO(z.read(f'word/media/{nama}')))
    except (KeyError, OSError, zipfile.BadZipFile):
        return None


def _gambar(c: canvas.Canvas, png: bytes, x: float, y: float, tinggi: float, lebar_maks: float) -> None:
    img = ImageReader(io.BytesIO(png))
    w, h = img.getSize()
    lebar = tinggi * w / max(h, 1)
    if lebar > lebar_maks:
        lebar, tinggi = lebar_maks, lebar_maks * h / max(w, 1)
    c.drawImage(img, x, y, width=lebar, height=tinggi, mask='auto')


# ---- Daftar Hadir ----
def pdf_daftar_hadir(data: Dict[str, Any]) -> bytes:
    _siapkan_font()
    f, fb = _FONT['biasa'], _FONT['tebal']
    t = data.get('template') or {}
    pola = data.get('pola_ttd') or {}
    tampil = pola.get('tampil_di_cetak', True)
    peserta = list(data.get('peserta') or [])
    lembar = [peserta[i:i + BARIS_PER_LEMBAR_DH] for i in range(0, len(peserta), BARIS_PER_LEMBAR_DH)] or [[]]
    logo_kiri, logo_kanan = _logo(TEMPLATE_DH, 'image1.png'), _logo(TEMPLATE_DH, 'image2.png')
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    lebar_hal, tinggi_hal = A4
    kiri, kanan = 12.7 * mm, lebar_hal - 12.7 * mm
    peng = data.get('pengawas') or {}
    for k, isi in enumerate(lembar):
        y = tinggi_hal - 12.7 * mm
        # Kop
        if logo_kiri:
            c.drawImage(logo_kiri, kiri + 4 * mm, y - 22 * mm, width=20 * mm, height=20 * mm, mask='auto', preserveAspectRatio=True)
        if logo_kanan:
            c.drawImage(logo_kanan, kanan - 24 * mm, y - 22 * mm, width=20 * mm, height=20 * mm, mask='auto', preserveAspectRatio=True)
        tengah = lebar_hal / 2
        for teks, font, uk, dy in (('DAFTAR HADIR PESERTA', fb, 11, 6),
                                    (f"{t.get('singkatan_ujian', 'ASAS')} TAHUN AJARAN {data.get('tahun_pelajaran') or ''}", fb, 11, 11),
                                    (t.get('kop_madrasah') or '', f, 11, 16), (t.get('alamat') or '', f, 8.5, 20.5)):
            c.setFont(font, uk)
            c.drawCentredString(tengah, y - dy * mm, teks)
        # Info
        y -= 32 * mm
        c.setFont(f, 11)
        for i, (lab, nilai, x0) in enumerate((('Hari, tanggal', data.get('hari_tanggal'), kiri), ('Pukul', data.get('pukul'), kiri),
                                               ('Mata Pelajaran', data.get('mapel'), tengah + 5 * mm), ('Ruang', data.get('ruang'), tengah + 5 * mm))):
            yy = y - (i % 2) * 5.5 * mm
            c.drawString(x0, yy, lab)
            c.drawString(x0 + 34 * mm, yy, ':')
            # Isian panjang (mis. mapel per ruang campuran "Matematika (kelas 7); IPA (kelas 8)") dikecilkan agar muat.
            teks, uk = str(nilai or ''), 11.0
            while uk > 6 and pdfmetrics.stringWidth(teks, f, uk) > 50 * mm:
                uk -= 0.5
            c.setFont(f, uk)
            c.drawString(x0 + 37 * mm, yy, teks)
            c.setFont(f, 11)
            c.setDash(1, 1)
            c.line(x0 + 37 * mm, yy - 1, x0 + 80 * mm, yy - 1)
            c.setDash()
        # Tabel
        y -= 12 * mm
        # NO | NO. PESERTA | NAMA | KELAS | TTD ganjil | TTD genap (dua kolom TTD sama lebar, seperti template).
        kol = [kiri, kiri + 10 * mm, kiri + 37 * mm, kiri + 118 * mm, kiri + 132 * mm, (kiri + 132 * mm + kanan) / 2, kanan]
        tb = 4.3 * mm
        c.setFillColorRGB(0.776, 0.878, 0.706)
        c.rect(kiri, y - tb, kanan - kiri, tb, fill=1, stroke=0)
        c.setFillColorRGB(0, 0, 0)
        c.setFont(fb, 8.5)
        for x0, x1, judul in ((kol[0], kol[1], 'NO'), (kol[1], kol[2], 'NO. PESERTA'), (kol[2], kol[3], 'NAMA'),
                              (kol[3], kol[4], 'KELAS'), (kol[4], kol[6], 'TANDA TANGAN')):
            c.drawCentredString((x0 + x1) / 2, y - tb + 1.3 * mm, judul)
        c.setLineWidth(0.5)
        c.rect(kiri, y - tb * 33, kanan - kiri, tb * 33)
        for x in kol[1:-1]:
            c.line(x, y, x, y - tb * 33) if x != kol[5] else c.line(x, y - tb, x, y - tb * 33)
        c.line(kiri, y - tb, kanan, y - tb)
        c.setFont(f, 8.5)
        tinggi_ttd = min(float(pola.get('tinggi_mm') or TINGGI_TTD_DH_MAKS), TINGGI_TTD_DH_MAKS) * mm
        for i in range(BARIS_PER_LEMBAR_DH):
            no = k * BARIS_PER_LEMBAR_DH + i + 1
            yb = y - tb * (i + 2)
            c.line(kiri, yb, kol[4], yb)
            if i % 2 == 1:
                c.line(kol[4], yb, kanan, yb)
            p = isi[i] if i < len(isi) else {}
            c.drawCentredString((kol[0] + kol[1]) / 2, yb + 1.2 * mm, str(no))
            c.drawCentredString((kol[1] + kol[2]) / 2, yb + 1.2 * mm, p.get('nomor_peserta') or '')
            c.drawString(kol[2] + 1 * mm, yb + 1.2 * mm, (p.get('nama') or '')[:60])
            c.drawCentredString((kol[3] + kol[4]) / 2, yb + 1.2 * mm, p.get('kelas') or '')
            x_ttd = kol[4] if i % 2 == 0 else kol[5]
            atas_blok = y - tb * (i + 1 - (i % 2))
            c.drawString(x_ttd + 1 * mm, (atas_blok - 3 * mm) if i % 2 == 0 else (atas_blok - tb * 2 + 1.2 * mm), str(no))
            png = _png_sah(p.get('ttd_png')) if tampil else None
            if png:
                _gambar(c, png, x_ttd + 5 * mm, atas_blok - tb * 2 + 0.6 * mm, tinggi_ttd, (kol[5] - kol[4]) - 6 * mm)
        # Penutup
        y = y - tb * 33 - 10 * mm
        x_ttd = tengah + 25 * mm
        c.setFont(f, 11)
        c.drawString(x_ttd, y, data.get('kota_tanggal') or '')
        c.drawString(x_ttd, y - 5 * mm, 'Pengawas Ruang')
        png = _png_sah(peng.get('ttd_png')) if tampil else None
        if png:
            _gambar(c, png, x_ttd, y - 20 * mm, min(float(pola.get('tinggi_mm') or 12), 12) * mm, 50 * mm)
        c.drawString(x_ttd + 1 * mm, y - 24 * mm, peng.get('nama') or '')
        c.setLineWidth(1.2)
        c.line(x_ttd, y - 25.5 * mm, kanan, y - 25.5 * mm)
        c.setLineWidth(0.5)
        c.drawString(x_ttd + 1 * mm, y - 30 * mm, f"NIP {peng.get('nip') or ''}".rstrip())
        c.showPage()
    c.save()
    return buf.getvalue()


# ---- Berita Acara ----
def pdf_berita_acara(data: Dict[str, Any]) -> bytes:
    from datetime import date
    t = data.get('template') or {}
    pola = data.get('pola_ttd') or {}
    peng = data.get('pengawas') or {}
    kegiatan = t.get('nama_kegiatan') or 'Asesmen Sumatif Akhir Semester'
    tp = data.get('tahun_pelajaran') or ''
    jenjang = str(data.get('jenjang') or '')
    n = int(data.get('jumlah_peserta') or 0)
    hadir, tidak = list(data.get('hadir') or []), list(data.get('tidak_hadir') or [])
    tgl = date.fromisoformat(data['tanggal']) if data.get('tanggal') else None
    f, fb = 'Times-Roman', 'Times-Bold'
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    lebar_hal, tinggi_hal = A4
    kiri, kanan = 25.4 * mm, lebar_hal - 25.4 * mm
    tengah = lebar_hal / 2
    y = tinggi_hal - 17.5 * mm
    logo = _logo(TEMPLATE_BA, 'image1.png')
    if logo:
        c.drawImage(logo, tengah - 13 * mm, y - 22 * mm, width=26 * mm, height=22 * mm, mask='auto', preserveAspectRatio=True)
    y -= 29 * mm
    c.setFont(fb, 17)
    c.drawCentredString(tengah, y, 'BERITA ACARA')
    c.setFont(fb, 11)
    c.drawCentredString(tengah, y - 6 * mm, f'PENYELENGGARAAN {kegiatan.upper()}')
    c.drawCentredString(tengah, y - 11 * mm, huruf_besar_madrasah(t.get('nama_madrasah') or ''))
    c.setFont(f, 10)
    c.drawCentredString(tengah, y - 16 * mm, f'TAHUN AJARAN {tp}')
    y -= 25 * mm
    baris = 5 * mm

    def tulis(teks, x=kiri, font=f, uk=10):
        nonlocal y
        c.setFont(font, uk)
        c.drawString(x, y, teks)
        y -= baris

    def label(lab, nilai, x=kiri + 7 * mm, tebal=False):
        nonlocal y
        c.setFont(f, 10)
        c.drawString(x, y, lab)
        c.drawString(x + 33 * mm, y, ':')
        c.setFont(fb if tebal else f, 10)
        c.drawString(x + 35 * mm, y, nilai)
        y -= baris

    if tgl:
        tulis(f'Pada hari ini {HARI[tgl.weekday()]} tanggal {terbilang(tgl.day)} bulan {BULAN[tgl.month - 1]} tahun {terbilang(tgl.year)}.')
    tulis(f'a.  Telah diselenggarakan {kegiatan} kelas {jenjang} Tahun Ajaran {tp}')
    tulis(f'dari Pukul {jam_titik(data.get("jam_mulai"))} WIB sampai dengan Pukul {jam_titik(data.get("jam_selesai"))} WIB.', kiri + 7 * mm)
    label('Pada Madrasah', t.get('nama_madrasah') or '', tebal=True)
    label('Ruang', str(data.get('ruang') or ''))
    label('Alamat', t.get('alamat') or '')
    label('Jumlah Peserta', f'{n} ({terbilang(n)})')
    label('Yang Hadir', f'{len(hadir)} orang, yakni nomor dengan :')
    for b in baris_nomor(hadir):
        tulis(b, kiri + 14 * mm)
    label('Yang tidak hadir', f'{len(tidak)} orang, yakni nomor:', x=kiri + 14 * mm)
    for b in baris_nomor(tidak):
        tulis(b, kiri + 14 * mm)
    tulis(f'b.  Telah dibuka akses link {kegiatan} kelas {jenjang} Tahun Ajaran {tp}', kiri + 4 * mm)
    tulis(f'untuk mata pelajaran *{data.get("mapel") or "-"} dengan satu lembar Blanko Berita Acara dan satu', kiri + 11 * mm)
    tulis('lembar Daftar Hadir.', kiri + 11 * mm)
    tulis(f'c.  Catatan selama Pelaksanaan {kegiatan}', kiri + 4 * mm)
    for i in range(0, max(len(data.get('catatan') or '-'), 1), 95):
        tulis((data.get('catatan') or '-')[i:i + 95], kiri + 11 * mm)
    y -= baris
    c.setFont(f, 10)
    c.drawCentredString(tengah, y, 'Berita Acara ini dibuat dengan sesungguhnya.')
    c.drawCentredString(tengah, y - baris, 'Yang membuat Berita Acara :')
    y -= 4 * baris
    x = kiri + 47 * mm
    c.drawString(x, y, 'Tanda Tangan')
    c.drawString(x + 32 * mm, y, ':')
    png = _png_sah(peng.get('ttd_png')) if pola.get('tampil_di_cetak', True) else None
    if png:
        _gambar(c, png, x + 34 * mm, y - 2 * mm, float(pola.get('tinggi_mm') or 12) * mm, 45 * mm)
    else:
        c.drawString(x + 34 * mm, y, '..............................')
    y -= baris
    for lab, nilai in (('Nama', peng.get('nama') or ''), ('NIP.', peng.get('nip') or '-')):
        c.drawString(x, y, lab)
        c.drawString(x + 32 * mm, y, f': {nilai}')
        y -= baris
    c.setFont(f, 7)
    c.drawString(kiri + 4 * mm, y - 2 * baris, f"*     {t.get('catatan_kaki') or ''}")
    c.showPage()
    c.save()
    return buf.getvalue()
