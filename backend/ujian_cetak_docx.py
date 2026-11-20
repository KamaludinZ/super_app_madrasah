"""Pengisi template Word (.docx) lembar ujian: Daftar Hadir Peserta & Berita Acara.

Template asli madrasah (docs/2a. Daftar Hadir Peserta.docx & docs/3. Berita Acara.docx) disalin ke
backend/templates/ujian/ dan diisi langsung di XML-nya, sehingga format (font Arial/Bookman Old Style, logo, garis,
kolom tanda tangan zig-zag) tetap sama persis. Hanya pustaka standar (zipfile + ElementTree) yang dipakai.

Penerapan template & pola tanda tangan per ujian:
- `template` (Pengaturan Formulir): nama/kop madrasah, alamat, kota tanda tangan, singkatan & nama kegiatan, catatan kaki.
- `pola_ttd`: tanda tangan PNG ditempel bila `tampil_di_cetak`, dengan tinggi `tinggi_mm` (daftar hadir dibatasi
  TINGGI_TTD_DH_MAKS agar 32 baris tetap muat satu halaman).

Data masukan (dict):
  Daftar hadir: { template, pola_ttd, tahun_pelajaran, hari_tanggal, pukul, mapel, ruang, kota_tanggal,
                  pengawas: { nama, nip, ttd_png }, peserta: [{ nomor_peserta, nama, kelas, ttd_png }] }
  Berita acara: { template, pola_ttd, tahun_pelajaran, tanggal: 'YYYY-MM-DD', jenjang, jam_mulai, jam_selesai, ruang,
                  mapel, jumlah_peserta, hadir: [nomor], tidak_hadir: [nomor], catatan,
                  pengawas: { nama, nip, ttd_png } }
"""
import copy
import io
import re
import struct
import zipfile
from datetime import date
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
import xml.etree.ElementTree as ET

FOLDER_TEMPLATE = Path(__file__).parent / 'templates' / 'ujian'
TEMPLATE_DH = FOLDER_TEMPLATE / 'daftar_hadir.docx'
TEMPLATE_BA = FOLDER_TEMPLATE / 'berita_acara.docx'

BARIS_PER_LEMBAR_DH = 32
TINGGI_TTD_DH_MAKS = 6  # mm; sel TTD daftar hadir = 2 baris tabel (±9 mm), gambar sebaris dengan nomor
NOMOR_PER_BARIS_BA = 4

NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
}
W = '{%s}' % NS['w']
REL_GAMBAR = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image'
POLA_TITIK = re.compile(r'[.…]{2,}')

HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November',
         'Desember']
_SATUAN = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan', 'sepuluh', 'sebelas']


# ---- Bahasa Indonesia ----
def terbilang(n: int) -> str:
    """Angka -> kata bahasa Indonesia ('dua ribu dua puluh enam')."""
    n = int(n)
    if n < 0:
        return 'minus ' + terbilang(-n)
    if n < 12:
        return _SATUAN[n] or 'nol'
    if n < 20:
        return f'{_SATUAN[n - 10]} belas'
    if n < 100:
        return (f'{_SATUAN[n // 10]} puluh ' + (_SATUAN[n % 10] if n % 10 else '')).strip()
    if n < 200:
        return ('seratus ' + (terbilang(n - 100) if n > 100 else '')).strip()
    if n < 1000:
        return (f'{_SATUAN[n // 100]} ratus ' + (terbilang(n % 100) if n % 100 else '')).strip()
    if n < 2000:
        return ('seribu ' + (terbilang(n - 1000) if n > 1000 else '')).strip()
    if n < 1_000_000:
        return (f'{terbilang(n // 1000)} ribu ' + (terbilang(n % 1000) if n % 1000 else '')).strip()
    return (f'{terbilang(n // 1_000_000)} juta ' + (terbilang(n % 1_000_000) if n % 1_000_000 else '')).strip()


def tanggal_panjang(iso: str) -> str:
    d = date.fromisoformat(iso)
    return f'{d.day} {BULAN[d.month - 1]} {d.year}'


def hari_tanggal(iso: str) -> str:
    """'Rabu, 2 Desember 2026'."""
    d = date.fromisoformat(iso)
    return f'{HARI[d.weekday()]}, {tanggal_panjang(iso)}'


_SINGKATAN_MADRASAH = {'mtsn': 'MTsN', 'mts': 'MTs', 'min': 'MIN', 'man': 'MAN', 'mis': 'MIS', 'mas': 'MAS'}


def huruf_besar_madrasah(nama: str) -> str:
    """Huruf besar untuk kop, tetapi singkatan madrasah dipertahankan ('MTsN 2 Kota Malang' -> 'MTsN 2 KOTA MALANG')."""
    return ' '.join(_SINGKATAN_MADRASAH.get(k.lower(), k.upper()) for k in (nama or '').split())


def jam_titik(hhmm: str) -> str:
    return (hhmm or '').replace(':', '.')


# ---- XML ----
def _daftar_namespace(xml: bytes) -> None:
    for _ev, (prefix, uri) in ET.iterparse(io.BytesIO(xml), events=('start-ns',)):
        try:
            ET.register_namespace(prefix, uri)
        except ValueError:  # prefix cadangan (mis. 'xml') tidak boleh didaftarkan
            pass


def _tulis_xml(root: ET.Element, xml_asli: bytes) -> bytes:
    """Serialisasi ElementTree dengan tag pembuka akar ASLI (semua deklarasi xmlns tetap ada, sehingga daftar
    mc:Ignorable tetap merujuk prefiks yang dideklarasikan dan Word tidak menganggap berkas rusak)."""
    baru = ET.tostring(root, encoding='unicode')
    pembuka_asli = re.search(rb'<w:document\b[^>]*>', xml_asli).group(0).decode('utf-8')
    pembuka_baru = re.match(r'<w:document\b[^>]*>', baru).group(0)
    # Deklarasi xmlns yang dibutuhkan isi baru (mis. a/pic pada gambar) tetapi belum ada di tag akar asli ditambahkan.
    ada = set(re.findall(r'xmlns:(\w+)=', pembuka_asli))
    tambahan = [d for d in re.findall(r'xmlns:\w+="[^"]*"', pembuka_baru) if d.split('=')[0][6:] not in ada]
    if tambahan:
        pembuka_asli = pembuka_asli[:-1] + ' ' + ' '.join(tambahan) + '>'
    baru = pembuka_asli + baru[len(pembuka_baru):]
    return b'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + baru.encode('utf-8')


def _teks_el(el: ET.Element) -> str:
    return ''.join(t.text or '' for t in el.iter(W + 't'))


def _t_list(p: ET.Element) -> List[ET.Element]:
    return list(p.iter(W + 't'))


def _set_t(t: ET.Element, teks: str) -> None:
    t.text = teks
    t.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')


def ganti_rentang(p: ET.Element, cocok: Iterable[Tuple[int, int]], nilai: List[str]) -> None:
    """Ganti beberapa rentang (awal, akhir) pada teks gabungan paragraf — boleh melintasi beberapa run — dengan nilai
    berurutan. Format run tempat rentang dimulai yang dipakai untuk teks pengganti."""
    ts = _t_list(p)
    batas, pos = [], 0
    for t in ts:
        batas.append((pos, pos + len(t.text or '')))
        pos += len(t.text or '')
    for (awal, akhir), isi in sorted(zip(cocok, nilai), key=lambda x: -x[0][0]):
        for i, t in enumerate(ts):
            a, b = batas[i]
            if b <= awal or a >= akhir or a == b:
                continue
            teks = t.text or ''
            potong_awal, potong_akhir = max(awal, a) - a, min(akhir, b) - a
            pengganti = isi if a <= awal < b else ''
            _set_t(t, teks[:potong_awal] + pengganti + teks[potong_akhir:])


def ganti_titik(p: ET.Element, nilai: List[str]) -> None:
    """Isi tempat titik-titik (… atau ....) pada paragraf secara berurutan; sisa tempat titik dikosongkan."""
    cocok = [(m.start(), m.end()) for m in POLA_TITIK.finditer(_teks_el(p))]
    ganti_rentang(p, cocok, (list(nilai) + [''] * len(cocok))[:len(cocok)])


def ganti_teks(p: ET.Element, lama: str, baru: str) -> None:
    teks = _teks_el(p)
    cocok = [(m.start(), m.end()) for m in re.finditer(re.escape(lama), teks)]
    if cocok:
        ganti_rentang(p, cocok, [baru] * len(cocok))


def isi_paragraf(p: ET.Element, teks: str) -> None:
    """Ganti seluruh teks paragraf: run pertama yang bertulisan dipertahankan (format), run teks lain dikosongkan.
    Paragraf tanpa run diberi run baru berformat tanda paragraf (pPr/rPr)."""
    ts = _t_list(p)
    if ts:
        _set_t(ts[0], teks)
        for t in ts[1:]:
            _set_t(t, '')
        return
    r = ET.SubElement(p, W + 'r')
    rpr = p.find(f'{W}pPr/{W}rPr')
    if rpr is not None:
        r.append(copy.deepcopy(rpr))
    _set_t(ET.SubElement(r, W + 't'), teks)


def isi_sel(tc: ET.Element, teks: str) -> ET.Element:
    p = tc.find(W + 'p')
    isi_paragraf(p, teks)
    return p


# ---- Gambar tanda tangan ----
def ukuran_png(png: bytes) -> Tuple[int, int]:
    if png[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError('Tanda tangan bukan PNG')
    return struct.unpack('>II', png[16:24])


class Paket:
    """Isi berkas .docx (zip) yang sedang diisi: dokumen, relasi, dan gambar tambahan."""

    def __init__(self, path: Path):
        self.berkas: Dict[str, bytes] = {}
        with zipfile.ZipFile(path) as z:
            for n in z.namelist():
                self.berkas[n] = z.read(n)
        self.xml_asli = self.berkas['word/document.xml']
        _daftar_namespace(self.xml_asli)
        self.root = ET.fromstring(self.xml_asli)
        self.body = self.root.find(W + 'body')
        self._rels_baru: List[str] = []  # relasi gambar tambahan (disisipkan sebagai teks agar prefiks tetap default)
        self._no_gambar = 0
        self._no_docpr = 900

    def tambah_png(self, png: bytes) -> str:
        """Simpan PNG sebagai media baru -> rId relasinya."""
        self._no_gambar += 1
        nama = f'media/ttd_{self._no_gambar}.png'
        self.berkas[f'word/{nama}'] = png
        rid = f'rIdTtd{self._no_gambar}'
        self._rels_baru.append(f'<Relationship Id="{rid}" Type="{REL_GAMBAR}" Target="{nama}"/>')
        return rid

    def run_gambar(self, png: bytes, tinggi_mm: float, lebar_maks_mm: float) -> ET.Element:
        """Run berisi gambar inline (tinggi tetap, lebar menurut rasio, dibatasi lebar_maks_mm)."""
        lebar_px, tinggi_px = ukuran_png(png)
        tinggi = tinggi_mm
        lebar = tinggi * lebar_px / max(tinggi_px, 1)
        if lebar > lebar_maks_mm:
            lebar, tinggi = lebar_maks_mm, lebar_maks_mm * tinggi_px / max(lebar_px, 1)
        cx, cy = int(lebar * 36000), int(tinggi * 36000)
        rid = self.tambah_png(png)
        self._no_docpr += 1
        n = self._no_docpr
        xml = (
            f'<w:r xmlns:w="{NS["w"]}" xmlns:r="{NS["r"]}" xmlns:wp="{NS["wp"]}" xmlns:a="{NS["a"]}" xmlns:pic="{NS["pic"]}">'
            f'<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="{cx}" cy="{cy}"/>'
            f'<wp:docPr id="{n}" name="Tanda tangan {n}"/><wp:cNvGraphicFramePr/>'
            f'<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
            f'<pic:pic><pic:nvPicPr><pic:cNvPr id="{n}" name="ttd_{n}.png"/><pic:cNvPicPr/></pic:nvPicPr>'
            f'<pic:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>'
            f'<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="{cx}" cy="{cy}"/></a:xfrm>'
            f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic>'
            f'</wp:inline></w:drawing></w:r>'
        )
        return ET.fromstring(xml)

    def simpan(self) -> bytes:
        self.berkas['word/document.xml'] = _tulis_xml(self.root, self.xml_asli)
        if self._rels_baru:
            rels = self.berkas['word/_rels/document.xml.rels'].decode('utf-8')
            self.berkas['word/_rels/document.xml.rels'] = rels.replace(
                '</Relationships>', ''.join(self._rels_baru) + '</Relationships>').encode('utf-8')
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
            for n, isi in self.berkas.items():
                z.writestr(n, isi)
        return buf.getvalue()


def _png_sah(png: Optional[bytes]) -> Optional[bytes]:
    try:
        return png if png and ukuran_png(png) else None
    except (ValueError, struct.error):
        return None


# ---- Daftar Hadir ----
def lebar_sel_mm(tc: ET.Element, cadangan: float = 18.0) -> float:
    """Lebar sel tabel (tcW, satuan twip) dalam mm."""
    w = tc.find(f'{W}tcPr/{W}tcW')
    try:
        return int(w.get(W + 'w')) / 56.7 if w is not None and w.get(W + 'type') == 'dxa' else cadangan
    except (TypeError, ValueError):
        return cadangan


def _paragraf_sel(tc: ET.Element) -> List[ET.Element]:
    return tc.findall(W + 'p')


def isi_daftar_hadir(data: Dict[str, Any]) -> bytes:
    """Isi template daftar hadir untuk SATU ruang & SATU jenjang pada satu sesi. Peserta > 32 dicetak di lembar
    berikutnya (salinan halaman yang sama, nomor urut berlanjut)."""
    pk = Paket(TEMPLATE_DH)
    t = data.get('template') or {}
    pola = data.get('pola_ttd') or {}
    tampil_ttd = pola.get('tampil_di_cetak', True)
    tinggi = min(float(pola.get('tinggi_mm') or TINGGI_TTD_DH_MAKS), TINGGI_TTD_DH_MAKS)
    elemen = list(pk.body)
    sect = elemen[-1]
    halaman = elemen[:-1]  # 0 kop, 2 info, 4 tabel peserta, 6 kota/tanggal, 7 "Pengawas Ruang", 11 tabel nama/NIP
    peserta = list(data.get('peserta') or [])
    lembar = [peserta[i:i + BARIS_PER_LEMBAR_DH] for i in range(0, len(peserta), BARIS_PER_LEMBAR_DH)] or [[]]
    for el in halaman:
        pk.body.remove(el)
    pk.body.remove(sect)
    for k, isi in enumerate(lembar):
        salinan = [copy.deepcopy(el) for el in halaman]
        kop, info, tabel, kota, sign = salinan[0], salinan[2], salinan[4], salinan[6], salinan[11]
        # Kop: judul, singkatan + TP, nama madrasah, alamat.
        p_kop = [p for p in kop.iter(W + 'p') if _teks_el(p).strip()]
        if len(p_kop) >= 4:
            isi_paragraf(p_kop[1], f"{t.get('singkatan_ujian', 'ASAS')} TAHUN AJARAN {data.get('tahun_pelajaran') or ''}".strip())
            isi_paragraf(p_kop[2], t.get('kop_madrasah') or '')
            isi_paragraf(p_kop[3], t.get('alamat') or '')
        # Info: Hari, tanggal | Mata Pelajaran / Pukul | Ruang.
        b1, b2 = info.findall(W + 'tr')[:2]
        s1, s2 = b1.findall(W + 'tc'), b2.findall(W + 'tc')
        isi_sel(s1[2], data.get('hari_tanggal') or '')
        isi_sel(s1[6], data.get('mapel') or '')
        isi_sel(s2[2], data.get('pukul') or '')
        isi_sel(s2[6], data.get('ruang') or '')
        # Tabel peserta: 32 baris; kolom TTD zig-zag (ganjil kiri, genap kanan; sel gabungan 2 baris).
        baris = tabel.findall(W + 'tr')[1:]
        for i, tr in enumerate(baris):
            no = k * BARIS_PER_LEMBAR_DH + i + 1
            sel = tr.findall(W + 'tc')
            isi_sel(sel[0], str(no))
            p = isi[i] if i < len(isi) else None
            isi_sel(sel[1], (p or {}).get('nomor_peserta') or '')
            isi_sel(sel[2], (p or {}).get('nama') or '')
            isi_sel(sel[3], (p or {}).get('kelas') or '')
            if i % 2 == 0 and len(sel) >= 6:  # baris awal blok: dua sel TTD (no ganjil & genap)
                for j, sel_ttd in enumerate((sel[4], sel[5])):
                    isi_sel(sel_ttd, str(no + j))
                    pemilik = isi[i + j] if i + j < len(isi) else None
                    png = _png_sah((pemilik or {}).get('ttd_png')) if tampil_ttd else None
                    if png:  # sebaris dengan nomor agar tinggi blok 2 baris tidak bertambah
                        par = _paragraf_sel(sel_ttd)[0]
                        ts = _t_list(par)
                        if ts:
                            _set_t(ts[-1], (ts[-1].text or '') + ' ')
                        par.append(pk.run_gambar(png, tinggi, max(8.0, lebar_sel_mm(sel_ttd) - 6)))
        # Kota, tanggal & pengawas.
        isi_paragraf(kota, data.get('kota_tanggal') or '')
        peng = data.get('pengawas') or {}
        sign_baris = sign.findall(W + 'tr')
        isi_sel(sign_baris[0].find(W + 'tc'), peng.get('nama') or '')
        isi_sel(sign_baris[1].find(W + 'tc'), f"NIP {peng.get('nip') or ''}".rstrip())
        png = _png_sah(peng.get('ttd_png')) if tampil_ttd else None
        if png:
            # Tiga baris kosong ruang tanda tangan (8–10) diganti satu paragraf berisi gambar, menjorok seperti
            # "Pengawas Ruang", sehingga tinggi halaman tetap.
            ruang_ttd = copy.deepcopy(salinan[7])
            for r in ruang_ttd.findall(W + 'r'):
                ruang_ttd.remove(r)
            ruang_ttd.append(pk.run_gambar(png, min(float(pola.get('tinggi_mm') or 12), 12.0), 50))
            salinan[8:11] = [ruang_ttd]
        if k:  # paragraf 1 pt ber-pageBreakBefore: lembar berikutnya mulai di halaman baru tanpa halaman kosong
            pk.body.append(ET.fromstring(
                f'<w:p xmlns:w="{NS["w"]}"><w:pPr><w:pageBreakBefore/><w:spacing w:before="0" w:after="0" w:line="20" '
                f'w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>'))
        if k < len(lembar) - 1 and not _teks_el(salinan[-1]).strip():
            salinan = salinan[:-1]  # paragraf kosong penutup lembar penuh akan tumpah ke halaman berikutnya
        for el in salinan:
            pk.body.append(el)
    pk.body.append(sect)
    return pk.simpan()


# ---- Berita Acara ----
def baris_nomor(nomor: List[str], per_baris: int = NOMOR_PER_BARIS_BA) -> List[str]:
    """Nomor peserta -> baris teks berisi `per_baris` nomor dipisah koma (seperti template)."""
    if not nomor:
        return ['-']
    return [', '.join(nomor[i:i + per_baris]) + (',' if i + per_baris < len(nomor) else '')
            for i in range(0, len(nomor), per_baris)]


def _ganti_baris(body: ET.Element, prototipe: ET.Element, buang: List[ET.Element], teks: List[str]) -> None:
    posisi = list(body).index(prototipe)
    for el in [prototipe] + buang:
        body.remove(el)
    for i, s in enumerate(teks):
        p = copy.deepcopy(prototipe)
        isi_paragraf(p, s)
        body.insert(posisi + i, p)


def isi_berita_acara(data: Dict[str, Any]) -> bytes:
    """Isi template berita acara untuk SATU ruang & SATU jenjang pada satu sesi."""
    pk = Paket(TEMPLATE_BA)
    t = data.get('template') or {}
    pola = data.get('pola_ttd') or {}
    p = list(pk.body)
    kegiatan = t.get('nama_kegiatan') or 'Asesmen Sumatif Akhir Semester'
    tp = data.get('tahun_pelajaran') or ''
    jenjang = str(data.get('jenjang') or '')
    tgl = date.fromisoformat(data['tanggal']) if data.get('tanggal') else None
    peng = data.get('pengawas') or {}
    n = int(data.get('jumlah_peserta') or 0)
    hadir, tidak = list(data.get('hadir') or []), list(data.get('tidak_hadir') or [])

    ganti_teks(p[2], 'ASESMEN SUMATIF AKHIR SEMESTER', kegiatan.upper())
    isi_paragraf(p[3], huruf_besar_madrasah(t.get('nama_madrasah') or ''))
    ganti_teks(p[4], '2025/2026', tp)
    if tgl:
        ganti_titik(p[6], [HARI[tgl.weekday()], terbilang(tgl.day), BULAN[tgl.month - 1]])
        ganti_teks(p[6], 'dua ribu dua puluh enam', terbilang(tgl.year))
    ganti_teks(p[7], 'Asesmen Sumatif Akhir Semester', kegiatan)
    ganti_teks(p[7], '2026/2027dari', f'{tp} dari')
    ganti_titik(p[7], [jenjang, jam_titik(data.get('jam_mulai')), jam_titik(data.get('jam_selesai'))])
    ganti_teks(p[8], 'MTsN 2 Kota Malang', t.get('nama_madrasah') or '')
    ganti_titik(p[9], [data.get('ruang') or ''])
    ganti_teks(p[10], 'Jalan Raya Cemorokandang No. 77, Kota Malang', t.get('alamat') or '')
    ganti_titik(p[11], [str(n), terbilang(n)])
    ganti_titik(p[12], [str(len(hadir))])
    ganti_titik(p[20], [str(len(tidak))])
    ganti_teks(p[23], 'Asesmen Sumatif Akhir Semester', kegiatan)
    ganti_teks(p[23], '2026/2027untuk', f'{tp} untuk')
    ganti_titik(p[23], [jenjang, data.get('mapel') or '-'])
    ganti_teks(p[24], 'Asesmen Sumatif Akhir Semester', kegiatan)
    ganti_titik(p[25], [data.get('catatan') or '-'])
    png = _png_sah(peng.get('ttd_png')) if pola.get('tampil_di_cetak', True) else None
    if png:  # titik-titik tanda tangan diganti gambar PNG
        ganti_titik(p[31], [''])
        p[31].append(pk.run_gambar(png, float(pola.get('tinggi_mm') or 12), 45))
    ganti_titik(p[32], [peng.get('nama') or ''])
    ganti_titik(p[33], [peng.get('nip') or '-'])
    ganti_teks(p[35], 'Diisi dengan Mata Pelajaran pada waktu itu', t.get('catatan_kaki') or '')
    # Daftar nomor hadir (prototipe paragraf 13, buang 14–19) & tidak hadir (21, buang 22).
    _ganti_baris(pk.body, p[21], [p[22]], baris_nomor(tidak))
    _ganti_baris(pk.body, p[13], p[14:20], baris_nomor(hadir))
    return pk.simpan()


def teks_dokumen(docx: bytes) -> str:
    """Seluruh teks dokumen (untuk uji & pencarian arsip)."""
    with zipfile.ZipFile(io.BytesIO(docx)) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    return '\n'.join(_teks_el(p) for p in root.iter(W + 'p'))
