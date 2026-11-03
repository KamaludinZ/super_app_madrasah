"""Perapian tata letak salinan cetak laporan PKG agar tidak ada teks terpotong saat diubah ke PDF.

Template resmi dirancang untuk isian pendek: nama bergelar, NIP, nama madrasah, atau tanggal panjang meluber ke sel
sebelah / keluar area cetak dan terpotong. Pada salinan cetak (template master tidak disentuh):
- blok tanda tangan tiap lembar ditata ulang: tiap pihak mendapat kolom gabungan sendiri, label / nama / NIP rata
  tengah pada sumbu yang sama, dan diperkecil otomatis bila tetap tidak muat;
- teks satu baris yang tidak muat di selnya digabung dengan sel kosong di sebelahnya (sampai batas area cetak) lalu
  diberi 'shrink to fit';
- teks terbungkus (wrap) yang lebih tinggi dari barisnya membuat baris ditinggikan; kata tunggal yang lebih lebar dari
  kolom membuat huruf sel itu diperkecil.
Lebar teks diukur dengan metrik Helvetica (identik dengan Arial / Liberation Sans yang dipakai cetak).
"""
import math
import re
from copy import copy
from typing import Any, Dict, Iterable, List, Optional, Tuple

from openpyxl.cell.cell import MergedCell
from openpyxl.styles import Alignment, Border
from openpyxl.utils import column_index_from_string, get_column_letter, range_boundaries
from reportlab.pdfbase.pdfmetrics import stringWidth

# Blok tanda tangan per lembar: tiap pihak = (kolom_awal, kolom_akhir); `baris` = baris yang ditata (label, nama, NIP,
# tempat-tanggal, dst.). Isi baris (nilai pertama di rentang kolom pihak itu) dipindah ke sel gabungan rata tengah.
# `tempat_tanggal`: sel-sel yang digabung jadi satu teks "Kota, tanggal" pada pihak paling kanan.
BLOK_TTD: Dict[str, Dict[str, Any]] = {
    '02-IDNTY': {'pihak': (('B', 'D'), ('E', 'H')), 'baris': (35, 38, 39), 'tempat_tanggal': (34, ('F', 'G'))},
    '04-RKAP-PKG': {'pihak': (('B', 'C'), ('D', 'E'), ('F', 'H')), 'baris': (48, 49, 50, 51),
                    'tempat_tanggal': (47, ('G', 'H'))},
    '05-RKAP-PKGR': {'pihak': (('B', 'D'), ('E', 'F')), 'baris': (48, 49, 52, 53), 'tempat_tanggal': (47, ('E', 'F'))},
    'INDEK-HDIR': {'pihak': (('B', 'D'), ('E', 'H'), ('I', 'K')), 'baris': (32, 35, 36), 'tempat_tanggal': (31, ('J',))},
}

PADDING_PT = 3.0       # jarak tepi sel kiri + kanan
SKALA_TEKS = 0.97      # LibreOffice mencetak Liberation Sans sedikit lebih rapat dari metrik Helvetica murni
FONT_MINIMUM = 6.0


# ---------- ukuran ----------

def _dimensi_kolom(ws, kolom: int):
    """Dimensi kolom; template menyimpan sebagian lebar kolom berkelompok (<col min=1 max=2>) di bawah huruf kolom awal."""
    dim = ws.column_dimensions.get(get_column_letter(kolom))
    if dim is not None and dim.min in (None, kolom) and dim.width:
        return dim
    return next((d for d in ws.column_dimensions.values() if d.min and d.max and d.min <= kolom <= d.max), dim)


def lebar_kolom_pt(ws, kolom: int) -> float:
    dim = _dimensi_kolom(ws, kolom)
    if dim is not None and dim.hidden:
        return 0.0
    lebar = dim.width if dim is not None and dim.width else (ws.sheet_format.defaultColWidth or 8.43)
    return lebar * 7 * 0.75  # lebar karakter Excel -> piksel (7 px) -> poin


def tinggi_baris_pt(ws, baris: int) -> float:
    dim = ws.row_dimensions.get(baris)
    if dim is not None and dim.hidden:
        return 0.0
    return (dim.height if dim is not None and dim.height else None) or ws.sheet_format.defaultRowHeight or 15.0


def lebar_teks(teks: str, ukuran: float, tebal: bool = False) -> float:
    return stringWidth(teks, 'Helvetica-Bold' if tebal else 'Helvetica', ukuran) * SKALA_TEKS


def pecah_baris(teks: str, lebar: float, ukuran: float, tebal: bool = False) -> List[str]:
    """Baris-baris teks bila dibungkus per kata pada lebar `lebar` (seperti wrap text Excel/LibreOffice)."""
    hasil = []
    for paragraf in str(teks).split('\n'):
        isi = ''
        for kata in paragraf.split():
            calon = f'{isi} {kata}' if isi else kata
            if isi and lebar_teks(calon, ukuran, tebal) > lebar:
                hasil.append(isi)
                isi = kata
            else:
                isi = calon
        hasil.append(isi)
    return hasil


def baris_bungkus(teks: str, lebar: float, ukuran: float, tebal: bool = False) -> int:
    return len(pecah_baris(teks, lebar, ukuran, tebal))


def bagi_dua_seimbang(teks: str, ukuran: float, tebal: bool = False) -> Tuple[str, str]:
    """Pecah teks per kata menjadi 2 baris yang lebarnya paling seimbang (baris terpanjang sependek mungkin)."""
    kata = teks.split()
    if len(kata) < 2:
        return teks, ''
    terbaik = min(range(1, len(kata)), key=lambda i: max(lebar_teks(' '.join(kata[:i]), ukuran, tebal),
                                                          lebar_teks(' '.join(kata[i:]), ukuran, tebal)))
    return ' '.join(kata[:terbaik]), ' '.join(kata[terbaik:])


def _kutip(teks: str) -> str:
    return '"' + teks.replace('"', '""') + '"'


def bungkus_dua_baris(wb, ws, sel, lebar_pt: float, ukuran: float, sisi: float = 4.0) -> float:
    """Nama panjang di blok tanda tangan: pindah baris secara eksplisit di titik paling seimbang (bukan bergantung pada
    pembungkusan otomatis LibreOffice yang bisa menempel garis kotak), lalu ukuran huruf diturunkan seperlunya agar
    kedua baris menyisakan jarak `sisi` di kiri-kanan. Rumus tetap merujuk sel sumber (SUBSTITUTE menyisipkan CHAR(10));
    bila isian sumber diubah di Excel, teks tampil utuh dengan pembungkusan biasa. Mengembalikan ukuran huruf."""
    teks = nilai_teks(wb, ws, sel.value)
    atur_rata(sel, wrap_text=True)
    if not teks:
        return ukuran
    tebal = bool(sel.font.b)
    if lebar_teks(teks, ukuran, tebal) <= lebar_pt - 2 * sisi:
        return ukuran
    satu, dua = bagi_dua_seimbang(teks, ukuran, tebal)
    if dua:
        if isinstance(sel.value, str) and sel.value.startswith('='):
            sel.value = f'=SUBSTITUTE({sel.value[1:]},{_kutip(satu + " ")},{_kutip(satu)}&CHAR(10),1)'
        else:
            sel.value = f'{satu}\n{dua}'
    u = ukuran
    while u > FONT_MINIMUM and max(lebar_teks(satu, u, tebal), lebar_teks(dua, u, tebal)) > lebar_pt - 2 * sisi:
        u -= 0.5
    if dua:  # baris cukup untuk 2 baris teks
        tinggi = 2 * u * 1.17 + 3
        if tinggi_baris_pt(ws, sel.row) < tinggi:
            ws.row_dimensions[sel.row].height = tinggi
    return u


# ---------- nilai rumus teks sederhana ----------

_TOKEN = re.compile(r'\s*(?:"((?:[^"]|"")*)"|(UPPER)\(|(\))|(&)|((?:\'[^\']+\'|[A-Za-z0-9_\-]+)!)?\$?([A-Z]{1,3})\$?(\d+))')


def nilai_teks(wb, ws, nilai: Any, kedalaman: int = 0) -> Optional[str]:
    """Teks hasil sel: string biasa, atau rumus gabungan sederhana ("teks" & ref & UPPER(...)) yang bisa dihitung dari
    isian workbook. None bila bukan teks atau rumus tidak dikenali (mis. IF/SUM)."""
    if nilai is None:
        return ''
    if isinstance(nilai, (int, float)):
        return None
    if not isinstance(nilai, str):
        return str(nilai)
    if not nilai.startswith('='):
        return nilai
    if kedalaman > 6:
        return None
    src, pos, tumpuk, hasil = nilai[1:], 0, [], ['']
    while pos < len(src):
        m = _TOKEN.match(src, pos)
        if not m or m.end() == pos:
            return None
        pos = m.end()
        lit, fungsi, tutup, sambung, lembar, kol, brs = m.groups()
        if sambung:
            continue
        if fungsi:
            tumpuk.append(fungsi)
            hasil.append('')
        elif tutup:
            if not tumpuk:
                return None
            tumpuk.pop()
            isi = hasil.pop().upper()
            hasil[-1] += isi
        elif lit is not None:
            hasil[-1] += lit.replace('""', '"')
        elif kol:
            nama = lembar[:-1].strip("'") if lembar else ws.title
            if nama not in wb.sheetnames:
                return None
            sumber = wb[nama]
            t = nilai_teks(wb, sumber, sumber[f'{kol}{brs}'].value, kedalaman + 1)
            if t is None:
                angka = sumber[f'{kol}{brs}'].value
                if not isinstance(angka, (int, float)):
                    return None
                t = str(angka)
            hasil[-1] += t
    return hasil[0] if not tumpuk else None


def adalah_teks(nilai: Any) -> bool:
    if isinstance(nilai, str):
        return not nilai.startswith('=') or '&' in nilai or '"' in nilai
    return False


# ---------- gabung sel dengan border tepi tetap ----------

def peta_gabungan(ws) -> Tuple[Dict[Tuple[int, int], Any], set]:
    jangkar, tertutup = {}, set()
    for rg in ws.merged_cells.ranges:
        jangkar[(rg.min_row, rg.min_col)] = rg
        for r in range(rg.min_row, rg.max_row + 1):
            for c in range(rg.min_col, rg.max_col + 1):
                if (r, c) != (rg.min_row, rg.min_col):
                    tertutup.add((r, c))
    return jangkar, tertutup


def gabung(ws, baris: int, kol_awal: int, kol_akhir: int) -> None:
    """Gabung baris:kol_awal..kol_akhir; border kiri sel pertama & kanan sel terakhir (garis kotak) dipertahankan."""
    if kol_akhir <= kol_awal:
        return
    awal, akhir = ws.cell(baris, kol_awal), ws.cell(baris, kol_akhir)
    b = copy(awal.border)
    awal.border = Border(left=copy(b.left), right=copy(akhir.border.right), top=copy(b.top), bottom=copy(b.bottom))
    ws.merge_cells(start_row=baris, start_column=kol_awal, end_row=baris, end_column=kol_akhir)


def lepas_gabungan(ws, baris: int, kol_awal: int, kol_akhir: int) -> None:
    for rg in list(ws.merged_cells.ranges):
        if rg.min_row <= baris <= rg.max_row and rg.min_col <= kol_akhir and rg.max_col >= kol_awal:
            ws.unmerge_cells(str(rg))


def atur_rata(sel, **ubah) -> None:
    a = copy(sel.alignment)
    nilai = {k: getattr(a, k) for k in ('horizontal', 'vertical', 'wrap_text', 'shrink_to_fit', 'indent', 'text_rotation')}
    nilai.update(ubah)
    if nilai.get('wrap_text'):
        nilai['shrink_to_fit'] = False
    sel.alignment = Alignment(**nilai)


def ukuran_pas(wb, ws, sel, lebar_pt: float) -> Optional[float]:
    """Ukuran huruf terbesar (<= ukuran sel, kelipatan 0,5) agar teks sel muat satu baris selebar `lebar_pt`.
    None bila teks tidak bisa dihitung (rumus kompleks) — sel itu diserahkan ke 'shrink to fit'."""
    teks = nilai_teks(wb, ws, sel.value)
    if teks is None:
        return None
    ukuran, tebal = _ukuran_font(sel), bool(sel.font.b)
    butuh = lebar_teks(teks, ukuran, tebal) + PADDING_PT
    if butuh <= lebar_pt:
        return ukuran
    return max(FONT_MINIMUM, math.floor(ukuran * (lebar_pt - PADDING_PT) / (butuh - PADDING_PT) * 2) / 2)


def set_ukuran(sel, ukuran: Optional[float]) -> None:
    if ukuran is not None and ukuran != _ukuran_font(sel):
        f = copy(sel.font)
        f.sz = ukuran
        sel.font = f


def lebar_rentang_pt(ws, kol_awal: int, kol_akhir: int) -> float:
    return sum(lebar_kolom_pt(ws, k) for k in range(kol_awal, kol_akhir + 1))


# ---------- blok tanda tangan ----------

def tata_blok_ttd(ws, cfg: Dict[str, Any]) -> None:
    pihak = [(column_index_from_string(a), column_index_from_string(b)) for a, b in cfg['pihak']]
    kiri, kanan = pihak[0][0], pihak[-1][1]
    tt = cfg.get('tempat_tanggal')
    if tt:
        r, sel_tt = tt
        bagian = [ws[f'{k}{r}'].value for k in sel_tt]
        bagian = [v for v in bagian if v not in (None, '')]
        if bagian:
            gaya = copy(ws[f'{sel_tt[0]}{r}']._style)
            lepas_gabungan(ws, r, kiri, kanan)
            for c in range(kiri, kanan + 1):
                ws.cell(r, c).value = None
            # "Kota, tanggal": koma dari template (mis. 'Kota, ' atau ',' di rumus) dirapikan menjadi satu ", ".
            ekspr = [v[1:] if isinstance(v, str) and v.startswith('=') else '"' + str(v).replace('"', '""') + '"' for v in bagian]
            gabungan = ekspr[0].replace('&","&', '&", "&') if len(ekspr) == 1 else f'TRIM(SUBSTITUTE({ekspr[0]},",",""))&", "&TRIM({"&".join(ekspr[1:])})'
            a, b = pihak[-1]
            sel = ws.cell(r, a)
            sel._style = gaya
            sel.value = f'={gabungan}' if len(ekspr) > 1 or (isinstance(bagian[0], str) and bagian[0].startswith('=')) else bagian[0]
            gabung(ws, r, a, b)
            atur_rata(sel, horizontal='center', vertical='center', wrap_text=False, shrink_to_fit=True)
    for r in cfg['baris']:
        isi = []
        for a, b in pihak:
            sel = next((ws.cell(r, c) for c in range(a, b + 1)
                        if not isinstance(ws.cell(r, c), MergedCell) and ws.cell(r, c).value not in (None, '')), None)
            isi.append((sel.value, copy(sel._style)) if sel is not None else None)
        lepas_gabungan(ws, r, kiri, kanan)
        for c in range(kiri, kanan + 1):
            ws.cell(r, c).value = None
        ukuran = []
        for (a, b), data in zip(pihak, isi):
            if data is None:
                continue
            sel = ws.cell(r, a)
            sel.value, sel._style = data[0], data[1]
            gabung(ws, r, a, b)
            atur_rata(sel, horizontal='center', vertical='center', wrap_text=False, shrink_to_fit=True, indent=0)
            ukuran.append((sel, ukuran_pas(ws.parent, ws, sel, lebar_rentang_pt(ws, a, b))))
        # Satu baris (mis. semua nama) memakai ukuran huruf yang sama: yang terkecil agar semua muat. Bila harus
        # diperkecil terlalu banyak (nama bergelar panjang), teks dibungkus 2 baris dengan ukuran asli.
        pas = [u for _, u in ukuran if u is not None]
        asli = min((_ukuran_font(sel) for sel, _ in ukuran), default=0)
        bungkus = bool(pas) and min(pas) < asli * 0.85
        if bungkus:
            rentang = [p for p, d in zip(pihak, isi) if d is not None]
            ukuran_baris = min(bungkus_dua_baris(ws.parent, ws, sel, lebar_rentang_pt(ws, a, b), asli)
                               for (sel, _), (a, b) in zip(ukuran, rentang))
        for sel, _ in ukuran:
            if bungkus:
                set_ukuran(sel, ukuran_baris)
            else:
                set_ukuran(sel, min(pas) if pas else None)


# ---------- teks satu baris & teks terbungkus ----------

def area_cetak(ws) -> Tuple[int, int, int, int]:
    pa = ws.print_area
    if isinstance(pa, (list, tuple)):
        pa = pa[0] if pa else None
    if pa:
        rng = str(pa).split(',')[0].split('!')[-1].replace('$', '')
        c1, r1, c2, r2 = range_boundaries(rng)
        return r1, r2, c1, c2
    return 1, ws.max_row, 1, ws.max_column


def _ada_garis_tegak(ws, r: int, c_kiri: int, c_kanan: int) -> bool:
    """Ada garis border di antara kolom c_kiri dan c_kanan (bersebelahan) pada baris r."""
    return bool(ws.cell(r, c_kiri).border.right.style or ws.cell(r, c_kanan).border.left.style)


def _ukuran_font(sel) -> float:
    return float(sel.font.sz or 11)


def lebarkan_teks_satu_baris(wb, ws) -> None:
    r1, r2, c1, c2 = area_cetak(ws)
    jangkar, tertutup = peta_gabungan(ws)
    for r in range(r1, r2 + 1):
        terisi = {c for c in range(c1, c2 + 1)
                  if (r, c) in tertutup or (not isinstance(ws.cell(r, c), MergedCell) and ws.cell(r, c).value not in (None, ''))}
        for c in sorted(terisi):
            if (r, c) in tertutup:
                continue
            sel = ws.cell(r, c)
            if sel.alignment.wrap_text or not adalah_teks(sel.value) or sel.alignment.text_rotation:
                continue
            rg = jangkar.get((r, c))
            if rg is not None:
                if rg.min_row == rg.max_row:
                    atur_rata(sel, shrink_to_fit=True)
                    set_ukuran(sel, ukuran_pas(wb, ws, sel, lebar_rentang_pt(ws, rg.min_col, rg.max_col)))
                continue
            teks = nilai_teks(wb, ws, sel.value)
            ukuran, tebal = _ukuran_font(sel), bool(sel.font.b)
            butuh = (lebar_teks(teks, ukuran, tebal) + PADDING_PT) if teks is not None else math.inf
            punya = lebar_kolom_pt(ws, c)
            if butuh <= punya:
                continue
            h = sel.alignment.horizontal or 'general'
            ke_kanan, ke_kiri = h in ('general', 'left', 'justify', 'distributed', 'fill', 'center'), h in ('right', 'center')
            # Sel kosong di kanan/kiri yang boleh dipakai (berhenti di sel terisi / garis tegak / batas area cetak);
            # celah yang juga diincar tetangga dibagi dua.
            kanan, kiri = [], []
            if ke_kanan:
                k = c + 1
                while k <= c2 and k not in terisi and (r, k) not in tertutup and not _ada_garis_tegak(ws, r, k - 1, k):
                    kanan.append(k)
                    k += 1
                if k in terisi and k <= c2:
                    tetangga = ws.cell(r, k)
                    if (tetangga.alignment.horizontal or 'general') in ('right', 'center') and adalah_teks(tetangga.value):
                        kanan = kanan[:math.ceil(len(kanan) / 2)]
            if ke_kiri:
                k = c - 1
                while k >= c1 and k not in terisi and (r, k) not in tertutup and not _ada_garis_tegak(ws, r, k, k + 1):
                    kiri.append(k)
                    k -= 1
                if k in terisi and k >= c1:
                    tetangga = ws.cell(r, k)
                    if (tetangga.alignment.horizontal or 'general') in ('general', 'left', 'center') and adalah_teks(tetangga.value):
                        kiri = kiri[:len(kiri) // 2]
            if h == 'center':
                n = min(len(kiri), len(kanan))
                kiri, kanan = kiri[:n], kanan[:n]
                if not n and (kiri or kanan):
                    continue  # teks rata tengah meluber ke sel kosong (tidak terpotong)
            awal, akhir, lebar = c, c, punya
            for kk in kanan:  # ambil secukupnya
                if lebar >= butuh:
                    break
                akhir, lebar = kk, lebar + lebar_kolom_pt(ws, kk)
            for kk in kiri:
                if lebar >= butuh:
                    break
                awal, lebar = kk, lebar + lebar_kolom_pt(ws, kk)
            if h == 'center':
                n = max(akhir - c, c - awal)
                awal, akhir = c - n, c + n
            if awal != c:
                tujuan = ws.cell(r, awal)
                tujuan.value, tujuan._style, sel.value = sel.value, copy(sel._style), None
                sel = tujuan
            terisi.update(range(awal, akhir + 1))
            gabung(ws, r, awal, akhir)
            atur_rata(sel, shrink_to_fit=True)
            set_ukuran(sel, ukuran_pas(wb, ws, sel, lebar_rentang_pt(ws, awal, akhir)))
            jangkar, tertutup = peta_gabungan(ws)


def tinggikan_baris_bungkus(wb, ws) -> None:
    r1, r2, c1, c2 = area_cetak(ws)
    jangkar, tertutup = peta_gabungan(ws)
    for r in range(r1, r2 + 1):
        for c in range(c1, c2 + 1):
            if (r, c) in tertutup:
                continue
            sel = ws.cell(r, c)
            if not sel.alignment.wrap_text or sel.value in (None, '') or sel.alignment.text_rotation:
                continue
            teks = nilai_teks(wb, ws, sel.value)
            if not teks:
                continue
            rg = jangkar.get((r, c))
            baris_akhir, kol_akhir = (rg.max_row, rg.max_col) if rg is not None else (r, c)
            lebar = sum(lebar_kolom_pt(ws, k) for k in range(c, kol_akhir + 1)) - PADDING_PT
            if lebar <= 0:
                continue
            ukuran, tebal = _ukuran_font(sel), bool(sel.font.b)
            terpanjang = max((lebar_teks(k, ukuran, tebal) for k in teks.split()), default=0)
            if terpanjang > lebar:  # satu kata tidak muat selebar kolom: perkecil huruf sel ini
                baru = max(FONT_MINIMUM, math.floor(ukuran * lebar / terpanjang * 2) / 2)
                if baru < ukuran:
                    f = copy(sel.font)
                    f.sz = baru
                    sel.font = f
                    ukuran = baru
            butuh = baris_bungkus(teks, lebar, ukuran, tebal) * ukuran * 1.17 + 2
            punya = sum(tinggi_baris_pt(ws, k) for k in range(r, baris_akhir + 1))
            if butuh > punya + 0.5:
                ws.row_dimensions[baris_akhir].height = tinggi_baris_pt(ws, baris_akhir) + (butuh - punya)


def rapikan_cetak(wb, lembar: Iterable[str]) -> None:
    """Rapikan blok tanda tangan, teks satu baris, dan teks terbungkus pada lembar-lembar cetak (yang ada di wb)."""
    for nama in lembar:
        if nama not in wb.sheetnames:
            continue
        ws = wb[nama]
        if nama in BLOK_TTD:
            tata_blok_ttd(ws, BLOK_TTD[nama])
        lebarkan_teks_satu_baris(wb, ws)
        tinggikan_baris_bungkus(wb, ws)
