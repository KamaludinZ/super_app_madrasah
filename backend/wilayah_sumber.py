"""Sumber data master wilayah Indonesia (provinsi -> desa/kelurahan + kode pos).

Memakai dump SQL proyek terbuka cahyadsn (lisensi MIT), kode sesuai Kepmendagri No 300.2.2-2138 Tahun 2025:
  - https://github.com/cahyadsn/wilayah          -> db/wilayah.sql          (kode, nama)
  - https://github.com/cahyadsn/wilayah_kodepos  -> db/wilayah_kodepos.sql  (kode desa, kode pos)
Data tidak dibenamkan di repo; diunduh saat migrasi (atau berkasnya diberikan manual), lalu diubah
menjadi baris paket (kode, nama, kode_pos) yang sama dengan unggahan paket di menu Master Wilayah.
"""
import csv
import io
import re
import urllib.request
from typing import Dict, Iterable, List, Tuple

URL_WILAYAH = 'https://raw.githubusercontent.com/cahyadsn/wilayah/master/db/wilayah.sql'
URL_KODEPOS = 'https://raw.githubusercontent.com/cahyadsn/wilayah_kodepos/master/db/wilayah_kodepos.sql'

# ('35.73.05.1001','Tunggulwulung') — nama boleh berisi kutip ganda SQL ('') atau kutip ber-escape (\')
_POLA_BARIS = re.compile(r"\(\s*'([0-9.]+)'\s*,\s*'((?:[^'\\]|\\.|'')*)'\s*\)")


def _nilai(teks: str) -> str:
    return teks.replace("''", "'").replace("\\'", "'").replace('\\\\', '\\').strip()


def pasangan_sql(sql: str) -> Iterable[Tuple[str, str]]:
    """Semua pasangan (kode, nilai) dari pernyataan INSERT ... VALUES (...), (...);"""
    for m in _POLA_BARIS.finditer(sql):
        yield m.group(1), _nilai(m.group(2))


def baris_paket_dari_sql(sql_wilayah: str, sql_kodepos: str = '') -> List[Tuple[str, str, str]]:
    """-> [(kode, nama, kode_pos)] urut kode; kode pos hanya untuk desa/kelurahan (5 digit)."""
    kodepos: Dict[str, str] = {}
    for kode, kp in pasangan_sql(sql_kodepos or ''):
        if re.fullmatch(r'\d{5}', kp):
            kodepos[kode] = kp
    hasil = {}
    for kode, nama in pasangan_sql(sql_wilayah):
        if nama:
            hasil[kode] = (kode, nama, kodepos.get(kode, '') if kode.count('.') == 3 else '')
    return [hasil[k] for k in sorted(hasil, key=lambda k: [int(x) for x in k.split('.')])]


def paket_csv(baris: List[Tuple[str, str, str]]) -> bytes:
    """Baris paket -> CSV (kode,nama,kode_pos) siap diunggah lewat menu Master Wilayah."""
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator='\n')
    w.writerow(['kode', 'nama', 'kode_pos'])
    w.writerows(baris)
    return buf.getvalue().encode('utf-8')


def unduh(url: str, batas_detik: int = 120) -> str:
    with urllib.request.urlopen(url, timeout=batas_detik) as r:  # noqa: S310 — URL tetap (konstanta di atas)
        return r.read().decode('utf-8-sig')
