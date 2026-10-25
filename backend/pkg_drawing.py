"""Pemulihan drawing (kotak teks, label, garis, gambar) template resmi pada salinan hasil cetak PKG.

openpyxl membuang seluruh shape (kotak teks/label/garis) saat menyimpan dan hanya mempertahankan gambar, padahal template
memuat elemen isi yang harus tercetak: kotak "IDENTITAS RA / MADRASAH" pada rekap, kotak "CATATAN", label dan garis pada
04/05-RKAP, dsb. Setelah workbook disimpan, bagian drawing tiap lembar disuntikkan kembali dari berkas template di tingkat
paket zip (drawing XML + relasi + media + content types), menggantikan drawing hasil openpyxl lembar itu (gambar tidak dobel).

Tombol navigasi makro template (MENU, RKAP, DATA, dsb.; ditandai tautan `hlinkClick`) dibuang karena hanya berguna di Excel
dan tidak boleh tercetak. Teks shape dapat disesuaikan lewat `ubah_xml(judul_lembar, xml_drawing) -> xml`.
"""
import io
import logging
import posixpath
import re
import zipfile
from typing import Callable, Dict, List, Optional

logger = logging.getLogger('matsandatama')

NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
TIPE_DRAWING = f'{NS_REL}/drawing'
CT_DRAWING = 'application/vnd.openxmlformats-officedocument.drawing+xml'
CT_MEDIA = {'png': 'image/png', 'jpeg': 'image/jpeg', 'jpg': 'image/jpeg', 'gif': 'image/gif', 'emf': 'image/x-emf',
            'wmf': 'image/x-wmf', 'wdp': 'image/vnd.ms-photo', 'svg': 'image/svg+xml'}
ANCHOR = re.compile(r'<xdr:(twoCellAnchor|oneCellAnchor|absoluteAnchor)\b.*?</xdr:\1>', re.S)
SESUDAH_DRAWING = re.compile(r'<(legacyDrawing|legacyDrawingHF|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b')


def _rels(xml: str) -> List[Dict[str, str]]:
    hasil = []
    for tag in re.findall(r'<Relationship\b[^>]*?/>', xml):
        atribut = dict(re.findall(r'(\w+)="([^"]*)"', tag))
        hasil.append(atribut)
    return hasil


def _jalur(basis: str, target: str) -> str:
    """Jalur zip dari Target relasi (absolut '/xl/..' atau relatif terhadap folder berkas pemilik relasi)."""
    if target.startswith('/'):
        return target.lstrip('/')
    return posixpath.normpath(posixpath.join(posixpath.dirname(basis), target))


def _peta_sheet(z: zipfile.ZipFile) -> Dict[str, str]:
    """{judul lembar: jalur xml lembar}."""
    wb = z.read('xl/workbook.xml').decode('utf-8')
    rid = {r['Id']: _jalur('xl/workbook.xml', r['Target']) for r in _rels(z.read('xl/_rels/workbook.xml.rels').decode('utf-8'))}
    hasil = {}
    for tag in re.findall(r'<sheet\b[^>]*?/>', wb):
        a = dict(re.findall(r'([\w:]+)="([^"]*)"', tag))
        hasil[a['name'].replace('&amp;', '&')] = rid[a['r:id']]
    return hasil


def _path_rels(path: str) -> str:
    return f"{posixpath.dirname(path)}/_rels/{posixpath.basename(path)}.rels"


def _drawing_template(z: zipfile.ZipFile, sheet: str) -> Optional[str]:
    rp = _path_rels(sheet)
    if rp not in z.namelist():
        return None
    for r in _rels(z.read(rp).decode('utf-8')):
        if r.get('Type') == TIPE_DRAWING:
            return _jalur(sheet, r['Target'])
    return None


def _buang_navigasi(xml: str) -> str:
    """Hapus anchor berisi tautan (tombol navigasi) dan sisakan shape isi."""
    return ANCHOR.sub(lambda m: '' if '<a:hlinkClick' in m.group(0) else m.group(0), xml)


def pulihkan_drawing(isi_xlsx: bytes, path_template: str, ubah_xml: Optional[Callable[[str, str], str]] = None) -> bytes:
    """Kembalikan bytes .xlsx baru dengan drawing template pada tiap lembar bernama sama. Galat apa pun: berkas asli
    dikembalikan apa adanya (cetak tetap jalan tanpa shape) dan dicatat ke logger."""
    try:
        return _pulihkan(isi_xlsx, path_template, ubah_xml)
    except Exception as e:  # noqa: BLE001
        logger.warning(f'[pkg_drawing] drawing template tidak dapat dipulihkan: {e}')
        return isi_xlsx


def _pulihkan(isi_xlsx: bytes, path_template: str, ubah_xml: Optional[Callable[[str, str], str]]) -> bytes:
    with zipfile.ZipFile(path_template) as tz, zipfile.ZipFile(io.BytesIO(isi_xlsx)) as oz:
        berkas = {n: oz.read(n) for n in oz.namelist()}
        sheet_t, sheet_o = _peta_sheet(tz), _peta_sheet(oz)
        ct = berkas['[Content_Types].xml'].decode('utf-8')
        ekstensi_media, nomor = set(), 0
        for judul, sheet_tpl in sheet_t.items():
            sheet_out = sheet_o.get(judul)
            drawing_tpl = _drawing_template(tz, sheet_tpl)
            if not sheet_out or not drawing_tpl:
                continue
            xml = _buang_navigasi(tz.read(drawing_tpl).decode('utf-8'))
            if ubah_xml:
                xml = ubah_xml(judul, xml)
            if not ANCHOR.search(xml):
                continue  # tidak ada shape isi (hanya tombol navigasi)
            nomor += 1
            nama = f'xl/drawings/drawingT{nomor}.xml'
            # Relasi drawing: salin gambar/hdphoto dengan nama unik; tautan (hyperlink) tombol navigasi dibuang.
            rels_baru = []
            rp = _path_rels(drawing_tpl)
            for r in _rels(tz.read(rp).decode('utf-8')) if rp in tz.namelist() else []:
                if r.get('TargetMode') == 'External' or 'hyperlink' in r.get('Type', ''):
                    continue
                if f'"{r["Id"]}"' not in xml and f'{r["Id"]}"' not in xml:
                    continue  # tidak dipakai shape yang tersisa
                sumber = _jalur(drawing_tpl, r['Target'])
                tujuan = f"xl/media/t{nomor}_{posixpath.basename(sumber)}"
                berkas[tujuan] = tz.read(sumber)
                ekstensi_media.add(tujuan.rsplit('.', 1)[-1].lower())
                rels_baru.append(f'<Relationship Id="{r["Id"]}" Type="{r["Type"]}" Target="../media/{posixpath.basename(tujuan)}"/>')
            berkas[nama] = xml.encode('utf-8')
            berkas[_path_rels(nama)] = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                                       '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                                       + ''.join(rels_baru) + '</Relationships>').encode('utf-8')
            ct = ct.replace('</Types>', f'<Override PartName="/{nama}" ContentType="{CT_DRAWING}"/></Types>')

            # Lembar hasil: buang <drawing> bawaan openpyxl, lalu pasang drawing template.
            rel_lembar = _path_rels(sheet_out)
            daftar = _rels(berkas[rel_lembar].decode('utf-8')) if rel_lembar in berkas else []
            daftar = [r for r in daftar if r.get('Type') != TIPE_DRAWING]
            rid = 'rIdDrawT'
            daftar.append({'Id': rid, 'Type': TIPE_DRAWING, 'Target': f'/{nama}'})
            berkas[rel_lembar] = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                                  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                                  + ''.join('<Relationship ' + ' '.join(f'{k}="{v}"' for k, v in r.items()) + '/>' for r in daftar)
                                  + '</Relationships>').encode('utf-8')
            sx = re.sub(r'<drawing\b[^>]*/>', '', berkas[sheet_out].decode('utf-8'))
            elemen = f'<drawing xmlns:r="{NS_REL}" r:id="{rid}"/>'
            m = SESUDAH_DRAWING.search(sx)
            sx = sx[:m.start()] + elemen + sx[m.start():] if m else sx.replace('</worksheet>', elemen + '</worksheet>')
            berkas[sheet_out] = sx.encode('utf-8')

        for e in sorted(ekstensi_media):
            if f'Extension="{e}"' not in ct and e in CT_MEDIA:
                ct = ct.replace('<Default ', f'<Default Extension="{e}" ContentType="{CT_MEDIA[e]}"/><Default ', 1)
        berkas['[Content_Types].xml'] = ct.encode('utf-8')

        # Buang drawing & media yatim (mis. drawing hasil openpyxl yang sudah digantikan).
        dirujuk = set()
        for n, b in berkas.items():
            if n.endswith('.rels') and n != '_rels/.rels':
                basis = posixpath.join(posixpath.dirname(posixpath.dirname(n)), posixpath.basename(n)[:-5])
                dirujuk |= {_jalur(basis, r['Target']) for r in _rels(b.decode('utf-8')) if r.get('TargetMode') != 'External'}
        for n in list(berkas):
            if (n.startswith('xl/drawings/') or n.startswith('xl/media/')) and n not in dirujuk and not n.endswith('.rels'):
                del berkas[n]
                berkas.pop(_path_rels(n), None)
                ct = berkas['[Content_Types].xml'].decode('utf-8')
                berkas['[Content_Types].xml'] = re.sub(rf'<Override PartName="/{re.escape(n)}"[^>]*/>', '', ct).encode('utf-8')

    keluaran = io.BytesIO()
    with zipfile.ZipFile(keluaran, 'w', zipfile.ZIP_DEFLATED) as zout:
        zout.writestr('[Content_Types].xml', berkas.pop('[Content_Types].xml'))
        for n, b in berkas.items():
            zout.writestr(n, b)
    return keluaran.getvalue()
