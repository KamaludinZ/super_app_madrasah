"""Nama & gelar GTK: susun nama lengkap dari nama tanpa gelar + gelar depan/belakang, dan
pecah nama lengkap lama menjadi bagian-bagiannya (untuk migrasi data yang sudah ada).

Aturan susun (sama dengan frontend lib/namaGelar.js):
  gelar depan + spasi + nama, lalu ", " + gelar belakang  ->  "Dr. H. Ahmad Fauzi, S.Pd., M.Pd."
"""
import re
from typing import Dict, Optional, Tuple

FIELD_NAMA_GELAR = ('nama_tanpa_gelar', 'gelar_depan', 'gelar_belakang')

# Gelar depan yang umum dipakai GTK madrasah (dibandingkan tanpa beda huruf besar/kecil).
GELAR_DEPAN_UMUM = {
    'dr.', 'drs.', 'dra.', 'ir.', 'prof.', 'h.', 'hj.', 'kh.', 'ust.', 'ustd.', 'ustz.', 'ns.', 'apt.', 'dr', 'h', 'hj',
}


def _rapikan(t: Optional[str]) -> str:
    return re.sub(r'\s+', ' ', str(t or '')).strip()


def _rapikan_gelar(t: Optional[str]) -> str:
    return re.sub(r'^[,\s]+|[,\s]+$', '', _rapikan(t))


def susun_nama_lengkap(nama_tanpa_gelar: Optional[str], gelar_depan: Optional[str] = None, gelar_belakang: Optional[str] = None) -> str:
    """Nama lengkap tersusun; '' bila nama tanpa gelar kosong."""
    n = _rapikan(nama_tanpa_gelar)
    if not n:
        return ''
    d = _rapikan_gelar(gelar_depan)
    b = _rapikan_gelar(gelar_belakang)
    return f"{d + ' ' if d else ''}{n}{', ' + b if b else ''}"


def _token_gelar_depan(tok: str) -> bool:
    t = tok.lower()
    return t in GELAR_DEPAN_UMUM or bool(re.fullmatch(r'(dr|drs|dra|ir|prof|hj?|kh)\.', t))


def pecah_nama_gelar(full_name: Optional[str]) -> Tuple[str, str, str]:
    """(gelar_depan, nama_tanpa_gelar, gelar_belakang) dari nama lengkap lama.
    - gelar belakang = semua teks setelah koma pertama (mis. "S.Pd, M.Pd")
    - gelar depan    = token di awal yang berupa gelar umum (Drs., Dra., Dr., H., Hj., Ir., Prof., ...)
    Bila tidak yakin, seluruh teks dianggap nama (tidak ada isi yang hilang)."""
    teks = _rapikan(full_name)
    if not teks:
        return '', '', ''
    kiri, _, kanan = teks.partition(',')
    belakang = _rapikan_gelar(kanan)
    tokens = kiri.split()
    depan = []
    while len(tokens) > 1 and _token_gelar_depan(tokens[0]):
        depan.append(tokens.pop(0))
    nama = ' '.join(tokens)
    if not nama:
        return '', teks, ''
    return ' '.join(depan), nama, belakang


def lengkapi_nama(update: Dict, tersimpan: Optional[Dict] = None) -> Dict:
    """Bila `update` memuat salah satu field nama/gelar: rapikan nilainya, gabungkan dengan nilai
    tersimpan untuk field yang tidak dikirim, lalu isi `full_name` hasil susunan.
    Nama tanpa gelar (gabungan) kosong -> full_name tidak diubah (tetap memakai nilai lama).
    Tanpa field nama/gelar -> `update` dikembalikan apa adanya. `update` diubah di tempat."""
    if not any(k in update for k in FIELD_NAMA_GELAR):
        return update
    for k in FIELD_NAMA_GELAR:
        if k in update:
            update[k] = (_rapikan if k == 'nama_tanpa_gelar' else _rapikan_gelar)(update[k])
    tersimpan = tersimpan or {}
    gabung = {k: update[k] if k in update else (tersimpan.get(k) or '') for k in FIELD_NAMA_GELAR}
    full = susun_nama_lengkap(gabung['nama_tanpa_gelar'], gabung['gelar_depan'], gabung['gelar_belakang'])
    if full:
        update['full_name'] = full
    return update
