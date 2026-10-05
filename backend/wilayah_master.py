"""Master wilayah Indonesia: skema koleksi `wilayah`, index, dan utilitas kode/nama.

Satu dokumen per wilayah:
  { kode: '35.73.05.1001', nama: 'Lesanpuro', tingkat: 'desa', induk: '35.73.05',
    kode_pos: '65138' (desa saja), nama_key: 'lesanpuro', diperbarui_pada }
Tingkat ditentukan oleh jumlah segmen kode Kemendagri bertitik:
  provinsi '35' -> kabupaten '35.73' -> kecamatan '35.73.05' -> desa '35.73.05.1001'.
"""
import re
from typing import Dict, List, Optional

KOLEKSI_WILAYAH = 'wilayah'
TINGKAT_WILAYAH = ('provinsi', 'kabupaten', 'kecamatan', 'desa')
POLA_KODE_WILAYAH = re.compile(r'^\d{2}(\.\d{2}(\.\d{2}(\.\d{4})?)?)?$')

# 38 provinsi (kode Kemendagri) — satu-satunya data wilayah yang dibenamkan; tingkat di bawahnya
# dimuat admin dari paket data resmi agar tidak ada data wilayah karangan.
PROVINSI_INDONESIA = [
    ('11', 'Aceh'), ('12', 'Sumatera Utara'), ('13', 'Sumatera Barat'), ('14', 'Riau'), ('15', 'Jambi'),
    ('16', 'Sumatera Selatan'), ('17', 'Bengkulu'), ('18', 'Lampung'), ('19', 'Kepulauan Bangka Belitung'),
    ('21', 'Kepulauan Riau'), ('31', 'DKI Jakarta'), ('32', 'Jawa Barat'), ('33', 'Jawa Tengah'),
    ('34', 'Daerah Istimewa Yogyakarta'), ('35', 'Jawa Timur'), ('36', 'Banten'), ('51', 'Bali'),
    ('52', 'Nusa Tenggara Barat'), ('53', 'Nusa Tenggara Timur'), ('61', 'Kalimantan Barat'),
    ('62', 'Kalimantan Tengah'), ('63', 'Kalimantan Selatan'), ('64', 'Kalimantan Timur'), ('65', 'Kalimantan Utara'),
    ('71', 'Sulawesi Utara'), ('72', 'Sulawesi Tengah'), ('73', 'Sulawesi Selatan'), ('74', 'Sulawesi Tenggara'),
    ('75', 'Gorontalo'), ('76', 'Sulawesi Barat'), ('81', 'Maluku'), ('82', 'Maluku Utara'), ('91', 'Papua'),
    ('92', 'Papua Barat'), ('93', 'Papua Selatan'), ('94', 'Papua Tengah'), ('95', 'Papua Pegunungan'),
    ('96', 'Papua Barat Daya'),
]

# Kata awalan yang diabaikan saat mencocokkan nama (impor alamat ketikan bebas).
_AWALAN_NAMA = re.compile(r'^(provinsi|prov\.?|kabupaten|kab\.?|kota|kecamatan|kec\.?|kelurahan|kel\.?|desa|ds\.?)\s+', re.I)


def tingkat_dari_kode(kode: str) -> Optional[str]:
    if not POLA_KODE_WILAYAH.match(kode or ''):
        return None
    return TINGKAT_WILAYAH[len(kode.split('.')) - 1]


def kode_induk(kode: str) -> Optional[str]:
    p = (kode or '').split('.')
    return '.'.join(p[:-1]) if len(p) > 1 else None


def kunci_nama(nama: Optional[str], tingkat: Optional[str] = None) -> str:
    """Kunci pencocokan nama: huruf kecil, tanpa tanda baca/spasi ganda, tanpa awalan 'Kab.', 'Kec.', dst.
    Untuk kabupaten, 'Kota Malang' dan 'Kabupaten Malang' dibedakan (awalan Kota dipertahankan)."""
    t = re.sub(r'\s+', ' ', str(nama or '')).strip().lower()
    if tingkat == 'kabupaten' and t.startswith('kota '):
        inti = re.sub(r'[^a-z0-9 ]', '', t[5:]).strip()
        return f'kota {inti}'
    while True:
        baru = _AWALAN_NAMA.sub('', t)
        if baru == t:
            break
        t = baru
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]', ' ', t)).strip()


def dokumen_wilayah(kode: str, nama: str, kode_pos: Optional[str] = None, sekarang: Optional[str] = None) -> Dict:
    tingkat = tingkat_dari_kode(kode)
    if not tingkat:
        raise ValueError(f'Kode wilayah tidak valid: {kode}')
    doc = {'kode': kode, 'nama': re.sub(r'\s+', ' ', nama).strip(), 'tingkat': tingkat, 'induk': kode_induk(kode),
           'nama_key': kunci_nama(nama, tingkat)}
    if tingkat == 'desa':
        doc['kode_pos'] = (kode_pos or '').strip() or None
    if sekarang:
        doc['diperbarui_pada'] = sekarang
    return doc


async def ensure_wilayah_indexes(database) -> List[str]:
    """Index master wilayah (idempotent). Mengembalikan daftar index yang gagal dibuat."""
    specs = [
        ('kode', {'unique': True}),
        ([('tingkat', 1), ('induk', 1), ('nama', 1)], {}),
        ([('induk', 1), ('nama_key', 1)], {}),
        ('kode_pos', {'sparse': True}),
        ([('tingkat', 1), ('nama_key', 1)], {}),
        ('diperbarui_pada', {}),  # versi master untuk cache pencocokan (wilayah_cocok.pencocok)
    ]
    gagal = []
    for keys, kwargs in specs:
        try:
            await database[KOLEKSI_WILAYAH].create_index(keys, **kwargs)
        except Exception as e:  # noqa: BLE001
            gagal.append(f'wilayah {keys}: {e}')
    # Kode wilayah pada alamat siswa (per blok) & GTK — untuk laporan pencocokan & rekap per wilayah.
    alamat = [('users', 'kode_wilayah')] + [('student_details', f'{b}.kode_wilayah') for b in BLOK_ALAMAT_SISWA]
    for koleksi, field in alamat:
        try:
            await database[koleksi].create_index(field, sparse=True)
        except Exception as e:  # noqa: BLE001
            gagal.append(f'{koleksi} {field}: {e}')
    return gagal


async def seed_provinsi(database, sekarang: str) -> int:
    """Isi 38 provinsi bila belum ada (tidak menimpa nama yang sudah dimuat dari paket resmi)."""
    n = 0
    for kode, nama in PROVINSI_INDONESIA:
        r = await database[KOLEKSI_WILAYAH].update_one(
            {'kode': kode}, {'$setOnInsert': {**dokumen_wilayah(kode, nama), 'diperbarui_pada': sekarang, 'sumber': 'seed'}}, upsert=True)
        n += 1 if r.upserted_id else 0
    return n


# Nama field alamat per tingkat — HARUS sama dengan KOLOM_ALAMAT_SISWA / KOLOM_ALAMAT_GTK di frontend/src/lib/wilayah.js.
KOLOM_ALAMAT_SISWA = {'provinsi': 'provinsi', 'kabupaten': 'kabupaten', 'kecamatan': 'kecamatan', 'desa': 'kelurahan'}
KOLOM_ALAMAT_GTK = {'provinsi': 'provinsi', 'kabupaten': 'kab_kota', 'kecamatan': 'kecamatan', 'desa': 'kelurahan'}
BLOK_ALAMAT_SISWA = ('alamat_siswa', 'alamat_ayah', 'alamat_ibu', 'alamat_wali')


async def selaraskan_alamat(database, alamat: Dict, kolom: Dict[str, str]) -> None:
    """Rapikan `kode_wilayah` pada satu alamat (diubah di tempat). Kode harus berformat Kemendagri;
    nama tiap tingkat yang ada di master ditimpa nama resmi, dan kode pos desa dipakai bila kosong.
    Kode yang belum ada di master (mis. master belum dimuat) disimpan apa adanya beserta nama kiriman."""
    if not isinstance(alamat, dict) or 'kode_wilayah' not in alamat:
        return
    kode = str(alamat.get('kode_wilayah') or '').strip()
    alamat['kode_wilayah'] = kode
    if not kode:
        return
    if not tingkat_dari_kode(kode):
        raise ValueError(f'Kode wilayah tidak valid: {kode}')
    p = kode.split('.')
    leluhur = ['.'.join(p[:i]) for i in range(1, len(p) + 1)]
    docs = {d['kode']: d async for d in database[KOLEKSI_WILAYAH].find({'kode': {'$in': leluhur}}, {'_id': 0, 'kode': 1, 'nama': 1, 'kode_pos': 1})}
    for t, k in zip(TINGKAT_WILAYAH, leluhur):
        if k in docs:
            alamat[kolom[t]] = docs[k]['nama']
    desa = docs.get(kode) if len(p) == 4 else None
    if desa and desa.get('kode_pos') and not str(alamat.get('kode_pos') or '').strip():
        alamat['kode_pos'] = desa['kode_pos']
