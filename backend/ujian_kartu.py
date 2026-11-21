"""Kartu Peserta & Kartu Meja ujian (PDF A4, ReportLab).

Satu halaman A4 tegak memuat 8 kartu (2 kolom x 4 baris, ukuran tiap kartu 92 x 65,5 mm) yang tinggal digunting
mengikuti garis tepinya. Dicetak per ruang: peserta satu ruang urut nomor peserta; bila beberapa ruang dicetak
sekaligus, setiap ruang mulai di halaman baru.

- Kartu Peserta: kop (logo Kemenag & madrasah, nama kegiatan + tahun ajaran), kotak pas foto 3x4, nomor peserta,
  nama, kelas, NISN, ruang, dan tanda tangan Ketua Panitia ujian itu.
- Kartu Meja: ditempel di meja — nomor peserta berukuran besar, nama, kelas, dan ruang.

Data masukan (dict) dari `data_kartu`:
  { template: {kop_madrasah, singkatan_ujian, nama_kegiatan, ...}, tahun_pelajaran,
    ketua: {nama, nip} | None, ruang: [{ nama_ruang, peserta: [{nomor_peserta, nama, kelas, nisn, nis}] }] }
"""
import io
from typing import Any, Dict, List

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import simpleSplit
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas

from pkg_identitas import nip_tampil
from ujian_cetak_docx import TEMPLATE_DH
from ujian_cetak_pdf import _FONT, _logo, _siapkan_font

JENIS_KARTU = {
    'peserta': {'label': 'Kartu Peserta', 'judul': 'KARTU PESERTA'},
    'meja': {'label': 'Kartu Meja', 'judul': 'KARTU MEJA PESERTA'},
}
KOLOM, BARIS = 2, 4
KARTU_PER_HALAMAN = KOLOM * BARIS
MARGIN, JARAK_X, JARAK_Y = 10 * mm, 6 * mm, 5 * mm
LEBAR_HAL, TINGGI_HAL = A4
LEBAR_KARTU = (LEBAR_HAL - 2 * MARGIN - (KOLOM - 1) * JARAK_X) / KOLOM
TINGGI_KARTU = (TINGGI_HAL - 2 * MARGIN - (BARIS - 1) * JARAK_Y) / BARIS


def _ukuran_muat(teks: str, font: str, ukuran: float, lebar: float, minimum: float) -> float:
    """Ukuran huruf terbesar (<= ukuran, >= minimum) agar teks satu baris muat di lebar."""
    while ukuran > minimum and pdfmetrics.stringWidth(teks, font, ukuran) > lebar:
        ukuran -= 0.5
    return ukuran


def _teks_muat(c: canvas.Canvas, teks: str, x: float, y: float, font: str, ukuran: float, lebar: float, minimum: float,
               tengah: bool = False) -> None:
    uk = _ukuran_muat(teks, font, ukuran, lebar, minimum)
    c.setFont(font, uk)
    (c.drawCentredString if tengah else c.drawString)(x, y, teks)


def _baris_nama(nama: str, font: str, ukuran: float, lebar: float, minimum: float, maks_baris: int = 2):
    """Nama panjang dipecah paling banyak `maks_baris` baris; huruf dikecilkan bila masih terlalu panjang."""
    uk = ukuran
    while True:
        baris = simpleSplit(nama, font, uk, lebar)
        if len(baris) <= maks_baris or uk <= minimum:
            return baris[:maks_baris], uk
        uk -= 0.5


def _slot(i: int):
    """Pojok kiri-bawah kartu ke-i pada satu halaman (urut baris dari kiri atas)."""
    kol, bar = i % KOLOM, i // KOLOM
    x = MARGIN + kol * (LEBAR_KARTU + JARAK_X)
    y = TINGGI_HAL - MARGIN - (bar + 1) * TINGGI_KARTU - bar * JARAK_Y
    return x, y


def _kop(c: canvas.Canvas, data: Dict[str, Any], x: float, y: float, w: float, h: float, judul: str, logo) -> float:
    """Kop kartu peserta; mengembalikan y garis bawah kop."""
    f, fb = _FONT['biasa'], _FONT['tebal']
    t = data.get('template') or {}
    kiri, kanan = logo
    if kiri:
        c.drawImage(kiri, x + 3 * mm, y + h - 14 * mm, width=11 * mm, height=11 * mm, mask='auto', preserveAspectRatio=True)
    if kanan:
        c.drawImage(kanan, x + w - 14 * mm, y + h - 14 * mm, width=11 * mm, height=11 * mm, mask='auto', preserveAspectRatio=True)
    tengah, lebar_teks = x + w / 2, w - 32 * mm
    _teks_muat(c, judul, tengah, y + h - 5.5 * mm, fb, 10, lebar_teks, 7, tengah=True)
    _teks_muat(c, f"{t.get('singkatan_ujian') or 'ASAS'} TAHUN AJARAN {data.get('tahun_pelajaran') or ''}".strip(),
               tengah, y + h - 9.5 * mm, fb, 7.5, lebar_teks, 5.5, tengah=True)
    _teks_muat(c, t.get('kop_madrasah') or '', tengah, y + h - 13 * mm, f, 7, lebar_teks, 5.5, tengah=True)
    garis = y + h - 16 * mm
    c.setLineWidth(1.2)
    c.line(x + 3 * mm, garis, x + w - 3 * mm, garis)
    c.setLineWidth(0.4)
    c.line(x + 3 * mm, garis - 0.8 * mm, x + w - 3 * mm, garis - 0.8 * mm)
    return garis


def _kartu_peserta(c: canvas.Canvas, data: Dict[str, Any], ruang: Dict[str, Any], p: Dict[str, Any], x: float, y: float, logo) -> None:
    f, fb = _FONT['biasa'], _FONT['tebal']
    w, h = LEBAR_KARTU, TINGGI_KARTU
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, 2.5 * mm)
    garis = _kop(c, data, x, y, w, h, JENIS_KARTU['peserta']['judul'], logo)
    # Kotak pas foto 3x4.
    fx, fy, fw, fh = x + 4 * mm, garis - 31 * mm, 22 * mm, 28 * mm
    c.setLineWidth(0.5)
    c.setDash(2, 2)
    c.rect(fx, fy, fw, fh)
    c.setDash()
    c.setFont(f, 6.5)
    c.drawCentredString(fx + fw / 2, fy + fh / 2 + 1 * mm, 'Pas Foto')
    c.drawCentredString(fx + fw / 2, fy + fh / 2 - 2 * mm, '3 x 4')
    # Isian.
    lx, vx = x + 30 * mm, x + 51 * mm
    lebar_nilai = x + w - 3 * mm - vx
    yy = garis - 5 * mm
    nisn = p.get('nisn') or p.get('nis') or '-'
    for label, nilai in (('No. Peserta', p.get('nomor_peserta') or '-'), ('Nama', p.get('nama') or '-'), ('Kelas', p.get('kelas') or '-'),
                         ('NISN', nisn), ('Ruang', ruang.get('nama_ruang') or '-')):
        c.setFont(f, 7.5)
        c.drawString(lx, yy, label)
        c.drawString(vx - 2.5 * mm, yy, ':')
        if label == 'Nama':
            baris, uk = _baris_nama(str(nilai), fb, 8, lebar_nilai, 6)
            c.setFont(fb, uk)
            for i, b in enumerate(baris):
                c.drawString(vx, yy - i * (uk + 1), b)
            yy -= (len(baris) - 1) * (uk + 1)
        else:
            _teks_muat(c, str(nilai), vx, yy, fb if label == 'No. Peserta' else f, 9 if label == 'No. Peserta' else 7.5, lebar_nilai, 5.5)
        yy -= 4.6 * mm
    # Tanda tangan Ketua Panitia.
    ketua = data.get('ketua') or {}
    tx = x + w - 24 * mm
    c.setFont(f, 7)
    c.drawCentredString(tx, y + 15.5 * mm, 'Ketua Panitia,')
    nama_ketua = ketua.get('nama') or '.' * 30
    _teks_muat(c, nama_ketua, tx, y + 5.5 * mm, fb, 7, 42 * mm, 5, tengah=True)
    if ketua.get('nama'):
        lebar = pdfmetrics.stringWidth(nama_ketua, fb, _ukuran_muat(nama_ketua, fb, 7, 42 * mm, 5))
        c.setLineWidth(0.4)
        c.line(tx - lebar / 2, y + 5 * mm, tx + lebar / 2, y + 5 * mm)
    c.setFont(f, 6.5)
    c.drawCentredString(tx, y + 2.5 * mm, f"NIP {ketua.get('nip') or '-'}")
    c.setFont(f, 5.5)
    c.drawString(x + 4 * mm, y + 3 * mm, '*Kartu wajib dibawa selama ujian')


def _kartu_meja(c: canvas.Canvas, data: Dict[str, Any], ruang: Dict[str, Any], p: Dict[str, Any], x: float, y: float, logo) -> None:
    f, fb = _FONT['biasa'], _FONT['tebal']
    w, h = LEBAR_KARTU, TINGGI_KARTU
    t = data.get('template') or {}
    # Pita kop abu-abu.
    pita = 12 * mm
    c.setFillGray(0.9)
    c.roundRect(x, y + h - pita, w, pita, 2.5 * mm, stroke=0, fill=1)
    c.rect(x, y + h - pita, w, pita / 2, stroke=0, fill=1)
    c.setFillGray(0)
    kiri, kanan = logo
    if kiri:
        c.drawImage(kiri, x + 2.5 * mm, y + h - 10.5 * mm, width=9 * mm, height=9 * mm, mask='auto', preserveAspectRatio=True)
    if kanan:
        c.drawImage(kanan, x + w - 11.5 * mm, y + h - 10.5 * mm, width=9 * mm, height=9 * mm, mask='auto', preserveAspectRatio=True)
    tengah = x + w / 2
    _teks_muat(c, JENIS_KARTU['meja']['judul'], tengah, y + h - 5 * mm, fb, 9.5, w - 26 * mm, 7, tengah=True)
    _teks_muat(c, f"{t.get('singkatan_ujian') or 'ASAS'} {data.get('tahun_pelajaran') or ''} · {t.get('kop_madrasah') or ''}".strip(' ·'),
               tengah, y + h - 9 * mm, f, 6.5, w - 26 * mm, 5, tengah=True)
    c.setLineWidth(0.8)
    c.roundRect(x, y, w, h, 2.5 * mm)
    c.line(x, y + h - pita, x + w, y + h - pita)
    # Nomor peserta besar.
    c.setFont(f, 7)
    c.drawCentredString(tengah, y + h - pita - 5 * mm, 'NOMOR PESERTA')
    _teks_muat(c, p.get('nomor_peserta') or '-', tengah, y + h - pita - 15.5 * mm, fb, 28, w - 8 * mm, 14, tengah=True)
    # Nama (paling banyak 2 baris) & NISN.
    baris, uk = _baris_nama(p.get('nama') or '-', fb, 12, w - 8 * mm, 8)
    c.setFont(fb, uk)
    ny = y + h - pita - 23 * mm
    for i, b in enumerate(baris):
        c.drawCentredString(tengah, ny - i * (uk + 1.5), b)
    nisn = p.get('nisn') or p.get('nis')
    if nisn:
        c.setFont(f, 7)
        c.drawCentredString(tengah, ny - (len(baris) - 1) * (uk + 1.5) - 4 * mm, f'NISN {nisn}')
    # Kotak kelas & ruang.
    kw, kh = (w - 10 * mm) / 2, 9.5 * mm
    for i, (label, nilai) in enumerate((('KELAS', p.get('kelas') or '-'), ('RUANG', ruang.get('nama_ruang') or '-'))):
        kx = x + 4 * mm + i * (kw + 2 * mm)
        c.setLineWidth(0.6)
        c.roundRect(kx, y + 3.5 * mm, kw, kh, 1.5 * mm)
        c.setFont(f, 6)
        c.drawCentredString(kx + kw / 2, y + 3.5 * mm + kh - 3 * mm, label)
        _teks_muat(c, str(nilai), kx + kw / 2, y + 5 * mm, fb, 11, kw - 3 * mm, 7, tengah=True)


PENGGAMBAR = {'peserta': _kartu_peserta, 'meja': _kartu_meja}


def pdf_kartu(jenis: str, data: Dict[str, Any]) -> bytes:
    """PDF A4 berisi kartu seluruh peserta ruang-ruang dalam data (8 kartu/halaman, tiap ruang mulai halaman baru)."""
    if jenis not in PENGGAMBAR:
        raise ValueError(f'Jenis kartu tidak dikenal: {jenis}')
    _siapkan_font()
    logo = (_logo(TEMPLATE_DH, 'image1.png'), _logo(TEMPLATE_DH, 'image2.png'))
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(f"{JENIS_KARTU[jenis]['label']} {(data.get('template') or {}).get('singkatan_ujian') or ''} {data.get('tahun_pelajaran') or ''}".strip())
    halaman = 0
    for ruang in data.get('ruang') or []:
        peserta = ruang.get('peserta') or []
        for mulai in range(0, len(peserta), KARTU_PER_HALAMAN):
            if halaman:
                c.showPage()
            halaman += 1
            for i, p in enumerate(peserta[mulai:mulai + KARTU_PER_HALAMAN]):
                x, y = _slot(i)
                c.setFillGray(0)
                c.setStrokeGray(0)
                PENGGAMBAR[jenis](c, data, ruang, p, x, y, logo)
            c.setFont(_FONT['biasa'], 6.5)
            c.setFillGray(0.4)
            c.drawCentredString(LEBAR_HAL / 2, MARGIN / 2,
                                f"{JENIS_KARTU[jenis]['label']} · Ruang {ruang.get('nama_ruang') or '-'} · gunting mengikuti garis tepi kartu")
            c.setFillGray(0)
    if not halaman:
        c.setFont(_FONT['biasa'], 11)
        c.drawCentredString(LEBAR_HAL / 2, TINGGI_HAL / 2, 'Belum ada peserta pada ruang yang dipilih.')
    c.save()
    return buf.getvalue()


def ringkas_ketua(akun: Dict[str, Any], panitia: Dict[str, Any]) -> Dict[str, str]:
    """{nama, nip} Ketua Panitia; NIP mengikuti aturan tampil NIP (ASN dulu, lalu salinan, Peg ID, NIPM)."""
    nip = nip_tampil(panitia.get('nip'), akun) or str(akun.get('nipm') or '').strip()
    return {'nama': akun.get('full_name') or panitia.get('nama') or akun.get('username') or '', 'nip': nip or ''}


def peserta_kartu(peserta: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [{k: p.get(k) for k in ('nomor_peserta', 'nama', 'kelas', 'nisn', 'nis')} for p in peserta]
