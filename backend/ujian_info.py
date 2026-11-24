"""Ujian Madrasah — halaman publik INFO UJIAN (siswa, tanpa login) & pengumpulan berkas ujian: skema dan aturan murni.

Halaman info (/publik/info-ujian/{token}) menampilkan jadwal (dari `jadwal_ujian`), tata tertib & panduan CBT (konten
info per ujian), dan kisi-kisi per jenjang dengan penghitung unduhan (dari `ujian_berkas`). Akses lewat token tautan
acak (`ujian_tautan_publik`); setiap pembukaan tautan dan unduhan dicatat (pola audit seperti `pkg_audit_log`).

Dokumen `ujian_info_konten` (satu per ujian; diisi admin):
    ujian_id (unik)
    tata_tertib             teks polos ≤ TATA_TERTIB_MAKS; baris "1. …" / "- …" tampil sebagai daftar di halaman publik
    panduan_video_url       tautan http/https video panduan CBT, atau None
    panduan_keterangan      kalimat singkat di bawah judul Panduan CBT
    panduan_pdf             { nama_file (asli), nama_berkas (di folder unggahan `ujian_info/`), ukuran_byte, mime,
                              diunggah_pada, diunggah_oleh, diunggah_oleh_nama } | None   (unggah ulang menimpa)
    diperbarui_pada, diperbarui_oleh, diperbarui_oleh_nama

Dokumen `ujian_tautan_publik` (tiga tautan per ujian: info, monitoring, & portal — masing-masing token, sakelar, dan
jendela sendiri; portal = halaman Portal Ujian tempat siswa membuka soal, lihat ujian_portal.py):
    id (unik), ujian_id, jenis ('info'|'monitoring'|'portal'), token (acak, unik; buat_token), aktif (buka/tutup manual),
    mulai_at, selesai_at (ISO datetime WIB, jendela waktu akses; None = tanpa batas), dibuat_oleh, dibuat_oleh_nama,
    dibuat_pada, diperbarui_pada
    Unik: token; (ujian_id, jenis).

Dokumen `ujian_tautan_riwayat` (jejak perubahan pengaturan tautan; pola seperti pkg_audit_log):
    id, tautan_id, ujian_id, jenis (info|monitoring|portal), aksi (AKSI_TAUTAN), oleh, oleh_nama, waktu, detail (teks ringkas),
    sebelum, sesudah ({aktif, mulai_at, selesai_at} — token TIDAK disimpan)

Dokumen `ujian_berkas` (kisi-kisi & kartu soal; satu per ujian+jenis+jenjang+mapel — unggah ulang MENIMPA):
    id (unik), ujian_id, jenis ('kisi_kisi'|'kartu_soal'), jenjang (7|8|9), mapel (kode baku MAPEL_UJIAN_BAKU),
    guru_pj_id, guru_pj_nama, nama_file (asli), nama_berkas (di folder unggahan `ujian_berkas/`), mime_type,
    ukuran_byte, status ('terkirim'), updated_at, jumlah_unduh (penghitung unduhan kisi-kisi per klik)
    Isi kartu soal RAHASIA: hanya admin yang boleh mengunduh; publik hanya melihat status.

Dokumen `ujian_mapel_baku` (master mapel ujian per jenjang; di-seed dari MAPEL_UJIAN_BAKU — 15 mapel × 3 jenjang):
    jenjang (7|8|9), kode, nama, urutan (1..15), aktif, dibuat_pada
    Unik: (jenjang, kode). Seed memakai $setOnInsert sehingga perubahan nama/aktif oleh admin tidak tertimpa saat
    migrasi diulang. Bila koleksi kosong, kode memakai konstanta MAPEL_UJIAN_BAKU (mapel_jenjang).

Dokumen `ujian_akses_log`: id, tautan_id, ujian_id, jenis_tautan, aksi ('buka_tautan' | 'klik_mengerjakan'; lihat
    ujian_portal.py — klik juga menyimpan link_soal_id, jenjang, mapel, url_host), token (≤ 100 karakter, juga untuk token salah),
    waktu, ip (sumber asli di balik proxy; lihat ip_peminta), ip_rantai (X-Forwarded-For mentah), perangkat (user agent),
    hasil (HASIL_AKSES), jumlah_percobaan (token tidak dikenal: percobaan dari IP sama dalam 1 menit digabung), sesi (id acak per pembukaan halaman dari klien, opsional),
    terakhir_aktif & jumlah_segarkan (diperbarui setiap muat ulang otomatis halaman yang sama — satu entri per
    pembukaan, bukan satu entri per menit)
Dokumen `ujian_unduh_log`: id, berkas_id, ujian_id, jenis_berkas, jenjang, mapel, mode (MODE_UNDUH), tautan_id,
    pengunduh_id, pengunduh_nama (None untuk unduhan publik), waktu, ip, ip_rantai, perangkat
    Panduan CBT publik: jenis_berkas 'panduan_cbt', berkas_id None, mode 'publik'.
    Unduhan ZIP per jenjang (mode 'zip_jenjang'): satu entri per ZIP dengan berkas_id & mapel None, berkas_ids (isi ZIP),
    jumlah_berkas, dan mapel_kosong (mapel yang belum mengirim).
Tanpa aturan hapus arsip: log disimpan selamanya (tanpa TTL).
"""
import logging
import os
import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

from pydantic import BaseModel, Field, field_validator, model_validator
from pymongo.errors import DuplicateKeyError

from penyimpanan import folder_unggahan
from ujian import WIB_TZ, sekarang_wib

logger = logging.getLogger('matsandatama')

KOLEKSI_INFO_KONTEN = 'ujian_info_konten'
KOLEKSI_TAUTAN = 'ujian_tautan_publik'
KOLEKSI_BERKAS = 'ujian_berkas'
KOLEKSI_AKSES_LOG = 'ujian_akses_log'
KOLEKSI_UNDUH_LOG = 'ujian_unduh_log'
KOLEKSI_MAPEL = 'ujian_mapel_baku'
KOLEKSI_TAUTAN_RIWAYAT = 'ujian_tautan_riwayat'

SUBFOLDER_INFO = 'ujian_info'      # PDF panduan CBT
SUBFOLDER_BERKAS = 'ujian_berkas'  # kisi-kisi & kartu soal

# Daftar baku 15 mata pelajaran ujian — urutan tampil. SAMA dengan MAPEL_UJIAN_BAKU di frontend/src/lib/mapelUjian.js
# (dipakai tab jenjang halaman info, monitoring, formulir unggah, dan bundel ZIP). ujian_berkas.mapel menyimpan kodenya.
MAPEL_UJIAN_BAKU = (
    ('bahasa_indonesia', 'Bahasa Indonesia'),
    ('akidah_akhlak', 'Akidah Akhlak'),
    ('matematika', 'Matematika'),
    ('ski', 'SKI'),
    ('bahasa_inggris', 'Bahasa Inggris'),
    ('pkn', 'PKN'),
    ('ipa', 'IPA'),
    ('fiqh', 'Fiqh'),
    ('ips', 'IPS'),
    ('pjok', 'PJOK'),
    ('bahasa_arab', 'Bahasa Arab'),
    ('quran_hadits', 'Quran Hadits'),
    ('seni_budaya', 'Seni Budaya'),
    ('bahasa_jawa', 'Bahasa Jawa'),
    ('informatika', 'Informatika'),
)
KODE_MAPEL = tuple(k for k, _ in MAPEL_UJIAN_BAKU)
NAMA_MAPEL = dict(MAPEL_UJIAN_BAKU)
JENJANG_UJIAN = (7, 8, 9)

JENIS_TAUTAN = ('info', 'monitoring', 'portal')
JENIS_BERKAS = ('kisi_kisi', 'kartu_soal')
MODE_UNDUH = ('publik', 'tunggal', 'zip_jenjang')
# 'kartu_soal_ditolak': percobaan mengunduh kartu soal (rahasia) lewat tautan publik — dijawab 404, dicatat untuk admin.
# 'mapel_belum_siap' / 'mapel_ditahan': klik "Mengerjakan" portal pada mapel tanpa tautan soal sah / yang tombolnya
# dimatikan admin (belum_mulai/sudah_selesai juga dipakai untuk klik di luar jendela mapel). Hanya hasil 'ok' yang dihitung.
AKSI_TAUTAN = ('buat', 'buka', 'tutup', 'jendela', 'ganti_token')
HASIL_AKSES = ('ok', 'tidak_dikenal', 'nonaktif', 'belum_mulai', 'sudah_selesai', 'kartu_soal_ditolak', 'mapel_belum_siap', 'mapel_ditahan')

TATA_TERTIB_MAKS = 10000
PANDUAN_KETERANGAN_MAKS = 300
URL_VIDEO_MAKS = 500
BERKAS_MAKS_BITA = 10 * 1024 * 1024  # kisi-kisi, kartu soal, dan panduan CBT: maksimal 10 MB
TOKEN_MAKS = 100                     # token lebih panjang dari ini pasti bukan token sah (ditolak tanpa query)
PERANGKAT_MAKS = 300

INDEX_UJIAN_INFO = [
    (KOLEKSI_INFO_KONTEN, [('ujian_id', 1)], {'unique': True}),
    (KOLEKSI_TAUTAN, [('id', 1)], {'unique': True}),
    (KOLEKSI_TAUTAN, [('token', 1)], {'unique': True, 'name': 'tautan_unik_token'}),
    (KOLEKSI_TAUTAN, [('ujian_id', 1), ('jenis', 1)], {'unique': True, 'name': 'tautan_unik_jenis'}),
    (KOLEKSI_BERKAS, [('id', 1)], {'unique': True}),
    # Unggah ulang menimpa: satu berkas per ujian + jenis + jenjang + mapel.
    (KOLEKSI_BERKAS, [('ujian_id', 1), ('jenis', 1), ('jenjang', 1), ('mapel', 1)], {'unique': True, 'name': 'berkas_unik_mapel'}),
    (KOLEKSI_BERKAS, [('guru_pj_id', 1)], {}),
    (KOLEKSI_AKSES_LOG, [('ujian_id', 1), ('waktu', -1)], {}),
    (KOLEKSI_AKSES_LOG, [('tautan_id', 1), ('waktu', -1)], {}),
    (KOLEKSI_AKSES_LOG, [('tautan_id', 1), ('sesi', 1)], {}),
    (KOLEKSI_UNDUH_LOG, [('ujian_id', 1), ('waktu', -1)], {}),
    (KOLEKSI_UNDUH_LOG, [('berkas_id', 1), ('waktu', -1)], {}),
]

# Riwayat akses tautan disaring per jenis, hasil, & IP (GET /ujian/{id}/tautan-publik/audit).
INDEX_AKSES_LOG = [
    (KOLEKSI_AKSES_LOG, [('ujian_id', 1), ('waktu', -1)], {}),
    (KOLEKSI_AKSES_LOG, [('ujian_id', 1), ('jenis_tautan', 1), ('waktu', -1)], {'name': 'akses_ujian_jenis_waktu'}),
    (KOLEKSI_AKSES_LOG, [('ujian_id', 1), ('hasil', 1), ('waktu', -1)], {'name': 'akses_ujian_hasil_waktu'}),
    (KOLEKSI_AKSES_LOG, [('ujian_id', 1), ('ip', 1)], {'name': 'akses_ujian_ip'}),
]

# Riwayat unduhan admin disaring per mode & jenis (GET /ujian/{id}/berkas/unduhan).
INDEX_UNDUH_LOG = [
    (KOLEKSI_UNDUH_LOG, [('ujian_id', 1), ('waktu', -1)], {}),
    (KOLEKSI_UNDUH_LOG, [('ujian_id', 1), ('mode', 1), ('waktu', -1)], {'name': 'unduh_ujian_mode_waktu'}),
    (KOLEKSI_UNDUH_LOG, [('ujian_id', 1), ('jenis_berkas', 1), ('waktu', -1)], {'name': 'unduh_ujian_jenis_waktu'}),
    (KOLEKSI_UNDUH_LOG, [('pengunduh_id', 1), ('waktu', -1)], {}),
]


INDEX_TAUTAN_PUBLIK = [
    (KOLEKSI_TAUTAN, [('id', 1)], {'unique': True}),
    (KOLEKSI_TAUTAN, [('token', 1)], {'unique': True, 'name': 'tautan_unik_token'}),
    (KOLEKSI_TAUTAN, [('ujian_id', 1), ('jenis', 1)], {'unique': True, 'name': 'tautan_unik_jenis'}),
    (KOLEKSI_TAUTAN_RIWAYAT, [('id', 1)], {'unique': True}),
    (KOLEKSI_TAUTAN_RIWAYAT, [('ujian_id', 1), ('waktu', -1)], {}),
    (KOLEKSI_TAUTAN_RIWAYAT, [('tautan_id', 1), ('waktu', -1)], {}),
]

INDEX_MAPEL_BAKU = [
    (KOLEKSI_MAPEL, [('jenjang', 1), ('kode', 1)], {'unique': True, 'name': 'mapel_unik_jenjang'}),
    (KOLEKSI_MAPEL, [('jenjang', 1), ('urutan', 1)], {}),
]


async def pastikan_index_ujian_info(db) -> None:
    for koleksi, keys, opsi in INDEX_UJIAN_INFO:
        await db[koleksi].create_index(keys, **opsi)


def boleh_unduh_publik(berkas: Optional[Dict[str, Any]]) -> bool:
    """Penjaga terpusat jalur publik: HANYA kisi-kisi yang terkirim boleh diunduh tanpa login. Kartu soal (rahasia)
    dan jenis lain apa pun selalu ditolak, apa pun isi kueri pemanggilnya."""
    return bool(berkas) and berkas.get('jenis') == 'kisi_kisi' and berkas.get('status') == 'terkirim'


def nama_mapel(kode: str) -> str:
    return NAMA_MAPEL.get(kode, kode or '-')


# ---- Master mapel baku per jenjang ----
def baris_mapel_baku(waktu: datetime = None) -> list:
    """45 baris seed: setiap mapel baku untuk setiap jenjang, urutan sesuai MAPEL_UJIAN_BAKU."""
    t = (waktu or sekarang_wib()).isoformat()
    return [{'jenjang': j, 'kode': kode, 'nama': nama, 'urutan': i + 1, 'aktif': True, 'dibuat_pada': t}
            for j in JENJANG_UJIAN for i, (kode, nama) in enumerate(MAPEL_UJIAN_BAKU)]


async def seed_mapel_baku(db, dry_run: bool = False) -> Dict[str, int]:
    """Pastikan 15 mapel baku ada untuk jenjang 7, 8, 9 (idempoten; baris yang sudah ada tidak diubah).
    -> { ditambah, total } (dry_run: ditambah = jumlah yang AKAN ditambah)."""
    for koleksi, keys, opsi in ([] if dry_run else INDEX_MAPEL_BAKU):
        await db[koleksi].create_index(keys, **opsi)
    ditambah = 0
    for b in baris_mapel_baku():
        kunci = {'jenjang': b['jenjang'], 'kode': b['kode']}
        if await db[KOLEKSI_MAPEL].find_one(kunci, {'_id': 1}):
            continue
        ditambah += 1
        if not dry_run:
            await db[KOLEKSI_MAPEL].update_one(kunci, {'$setOnInsert': {k: v for k, v in b.items() if k not in kunci}}, upsert=True)
    return {'ditambah': ditambah, 'total': await db[KOLEKSI_MAPEL].count_documents({})}


async def mapel_semua_jenjang(db) -> Dict[str, list]:
    """Mapel baku aktif tiap jenjang untuk klien: { '7': [{kode, nama}], '8': [...], '9': [...] } (urutan baku)."""
    return {str(j): [{'kode': m['kode'], 'nama': m['nama']} for m in await mapel_jenjang(db, j)] for j in JENJANG_UJIAN}


async def mapel_jenjang(db, jenjang: int) -> list:
    """Mapel aktif satu jenjang [{kode, nama, urutan}] urut baku; cadangan konstanta bila master belum di-seed."""
    docs = await db[KOLEKSI_MAPEL].find({'jenjang': int(jenjang)}, {'_id': 0}).to_list(100)
    if not docs:
        return [{'kode': k, 'nama': n, 'urutan': i + 1} for i, (k, n) in enumerate(MAPEL_UJIAN_BAKU)]
    return [{'kode': d['kode'], 'nama': d.get('nama') or nama_mapel(d['kode']), 'urutan': d.get('urutan') or 999}
            for d in sorted(docs, key=lambda d: (d.get('urutan') or 999, d['kode'])) if d.get('aktif', True)]


def jalur_unggahan(subfolder: str, nama_berkas: str) -> str:
    """Path absolut berkas di folder unggahan; nama dipangkas ke basename agar tidak bisa keluar folder."""
    return os.path.join(folder_unggahan(subfolder), os.path.basename(str(nama_berkas or '')))


def buat_token() -> str:
    """Token tautan publik: 32 karakter URL-safe dari 24 bita acak kriptografis (tidak dapat ditebak dari id/tanggal)."""
    return secrets.token_urlsafe(24)


# ---- Isian konten info ----
_URL_HTTP = re.compile(r'^https?://\S+$', re.IGNORECASE)


def _rapikan_teks_panjang(v: str) -> str:
    """Rapikan teks multibaris: CRLF -> LF, buang spasi di ujung baris, maksimal satu baris kosong berurutan."""
    baris = [b.rstrip() for b in str(v or '').replace('\r\n', '\n').replace('\r', '\n').split('\n')]
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(baris)).strip('\n').strip()


class KontenInfoIn(BaseModel):
    """Isian admin untuk konten halaman info ujian (tata tertib & panduan CBT; PDF panduan diunggah terpisah)."""
    tata_tertib: str = Field('', max_length=TATA_TERTIB_MAKS + 2000)  # batas akhir diperiksa setelah dirapikan
    panduan_video_url: Optional[str] = Field(None, max_length=URL_VIDEO_MAKS + 50)
    panduan_keterangan: str = Field('', max_length=PANDUAN_KETERANGAN_MAKS + 100)

    @field_validator('tata_tertib')
    @classmethod
    def _tata_tertib(cls, v):
        v = _rapikan_teks_panjang(v)
        if len(v) > TATA_TERTIB_MAKS:
            raise ValueError(f'Tata tertib maksimal {TATA_TERTIB_MAKS} karakter')
        return v

    @field_validator('panduan_video_url', mode='before')
    @classmethod
    def _video(cls, v):
        v = str(v or '').strip()
        if not v:
            return None
        if len(v) > URL_VIDEO_MAKS or not _URL_HTTP.match(v):
            raise ValueError('Tautan video harus diawali http:// atau https:// (maksimal 500 karakter)')
        return v

    @field_validator('panduan_keterangan')
    @classmethod
    def _keterangan(cls, v):
        v = ' '.join(str(v or '').split())
        if len(v) > PANDUAN_KETERANGAN_MAKS:
            raise ValueError(f'Keterangan panduan maksimal {PANDUAN_KETERANGAN_MAKS} karakter')
        return v


class SimpanKontenInfoIn(KontenInfoIn):
    """Isian menu Info Ujian. `versi` = diperbarui_pada yang terakhir dimuat (None bila belum pernah diisi); bila berbeda
    dengan yang tersimpan, penyimpanan ditolak agar isian admin lain tidak tertimpa diam-diam."""
    versi: Optional[str] = Field(None, max_length=64)


FIELD_KONTEN_TEKS = ('tata_tertib', 'panduan_video_url', 'panduan_keterangan')


def nama_berkas_panduan(ujian_id: str) -> str:
    """Nama acak PDF panduan CBT di folder `ujian_info/` (bukan nama asli; baru tiap unggah sehingga berkas lama tidak
    tertimpa sebelum DB tercatat)."""
    aman = re.sub(r'[^A-Za-z0-9_-]', '', str(ujian_id))[:40] or 'ujian'
    return f'panduan-{aman}-{secrets.token_hex(8)}.pdf'


def ringkas_konten_admin(konten: Optional[Dict[str, Any]], ujian_id: str, pdf_ada_di_disk: bool = True) -> Dict[str, Any]:
    """Konten info untuk menu Info Ujian (ber-login): isian teks, metadata PDF panduan (tanpa nama berkas di disk),
    dan siapa/kapan terakhir mengubah. `versi` dikirim balik saat menyimpan."""
    k = {**konten_kosong(ujian_id), **(konten or {})}
    pdf = k.get('panduan_pdf') or None
    return {
        'tata_tertib': k.get('tata_tertib') or '',
        'panduan_video_url': k.get('panduan_video_url') or '',
        'panduan_keterangan': k.get('panduan_keterangan') or '',
        'panduan_pdf': {
            'nama_file': pdf.get('nama_file') or 'Panduan CBT.pdf', 'ukuran_byte': pdf.get('ukuran_byte'),
            'diunggah_pada': pdf.get('diunggah_pada'), 'diunggah_oleh_nama': pdf.get('diunggah_oleh_nama'),
            'ada_di_disk': bool(pdf_ada_di_disk),
        } if pdf and pdf.get('nama_berkas') else None,
        'diperbarui_pada': k.get('diperbarui_pada'),
        'diperbarui_oleh_nama': k.get('diperbarui_oleh_nama'),
        'versi': k.get('diperbarui_pada'),
    }


def konten_kosong(ujian_id: str) -> Dict[str, Any]:
    return {'ujian_id': ujian_id, 'tata_tertib': '', 'panduan_video_url': None, 'panduan_keterangan': '', 'panduan_pdf': None,
            'diperbarui_pada': None, 'diperbarui_oleh': None, 'diperbarui_oleh_nama': None}


def dokumen_konten(ujian_id: str, isi: KontenInfoIn, user: Dict[str, Any], lama: Optional[Dict[str, Any]] = None,
                   waktu: datetime = None) -> Dict[str, Any]:
    """Dokumen konten info baru dari isian admin; PDF panduan yang sudah diunggah dipertahankan."""
    return {
        **konten_kosong(ujian_id),
        'tata_tertib': isi.tata_tertib,
        'panduan_video_url': isi.panduan_video_url,
        'panduan_keterangan': isi.panduan_keterangan,
        'panduan_pdf': (lama or {}).get('panduan_pdf'),
        'diperbarui_pada': (waktu or sekarang_wib()).isoformat(),
        'diperbarui_oleh': user.get('id'),
        'diperbarui_oleh_nama': user.get('full_name') or user.get('username'),
    }


def ringkas_konten_publik(konten: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Bagian konten untuk respons publik halaman info (sama dengan kontrak frontend/src/lib/ujianInfoPublik.js):
    { tata_tertib, panduan_cbt: { ada_pdf, nama_file, video_url, keterangan } } — tanpa lokasi berkas & pengunggah."""
    k = konten or {}
    pdf = k.get('panduan_pdf') or None
    return {
        'tata_tertib': k.get('tata_tertib') or '',
        'panduan_cbt': {
            'ada_pdf': bool(pdf and pdf.get('nama_berkas')),
            'nama_file': (pdf or {}).get('nama_file'),
            'video_url': k.get('panduan_video_url') or None,
            'keterangan': k.get('panduan_keterangan') or None,
        },
    }


# ---- Tautan publik: token & jendela waktu ----
PESAN_TOKEN = 'Tautan tidak ditemukan atau sudah diganti panitia.'
LABEL_TAUTAN = {'info': 'informasi ujian', 'monitoring': 'monitoring pengumpulan berkas', 'portal': 'portal ujian'}


def dokumen_tautan_baru(ujian_id: str, jenis: str, user: Dict[str, Any], waktu: datetime = None) -> Dict[str, Any]:
    """Tautan publik baru: token acak, DITUTUP sampai admin membukanya, tanpa jendela waktu."""
    if jenis not in JENIS_TAUTAN:
        raise ValueError(f'Jenis tautan tidak dikenal: {jenis}')
    t = (waktu or sekarang_wib()).isoformat()
    return {'id': str(uuid.uuid4()), 'ujian_id': ujian_id, 'jenis': jenis, 'token': buat_token(), 'aktif': False,
            'mulai_at': None, 'selesai_at': None, 'dibuat_oleh': user.get('id'),
            'dibuat_oleh_nama': user.get('full_name') or user.get('username'), 'dibuat_pada': t, 'diperbarui_pada': t}


def baca_waktu(nilai: Any) -> Optional[datetime]:
    """ISO datetime (ber-zona, atau tanpa zona = WIB) / datetime -> datetime ber-zona; None bila kosong/tidak terbaca."""
    if not nilai:
        return None
    if isinstance(nilai, datetime):
        d = nilai
    else:
        try:
            d = datetime.fromisoformat(str(nilai).strip().replace('Z', '+00:00'))
        except ValueError:
            return None
    return d if d.tzinfo else d.replace(tzinfo=WIB_TZ)


def token_layak(token: Optional[str]) -> bool:
    """Bentuk token masuk akal (dicek sebelum query): tidak kosong, ≤ TOKEN_MAKS, karakter URL-safe saja."""
    return bool(token) and len(token) <= TOKEN_MAKS and re.fullmatch(r'[A-Za-z0-9_-]+', token) is not None


def cek_tautan(tautan: Optional[Dict[str, Any]], sekarang: datetime = None) -> Dict[str, Any]:
    """Validator token + jendela waktu (murni). -> { berlaku, alasan (HASIL_AKSES), pesan, mulai_at, selesai_at }.
    Urutan: tidak dikenal -> ditutup manual -> waktu tidak terbaca -> belum masuk jendela -> sudah lewat jendela -> berlaku.
    Jendela: mulai_at ≤ sekarang < selesai_at (batas yang kosong = tanpa batas). Batas yang terisi tetapi tidak terbaca
    membuat tautan DITOLAK (fail-closed), bukan dianggap tanpa batas."""
    if not tautan:
        return {'berlaku': False, 'alasan': 'tidak_dikenal', 'pesan': PESAN_TOKEN, 'mulai_at': None, 'selesai_at': None}
    label = LABEL_TAUTAN.get(tautan.get('jenis'), 'ini')
    jendela = {'mulai_at': tautan.get('mulai_at'), 'selesai_at': tautan.get('selesai_at')}
    if not tautan.get('aktif'):
        return {'berlaku': False, 'alasan': 'nonaktif', 'pesan': f'Tautan {label} sedang ditutup panitia.', **jendela}
    kini = (sekarang or sekarang_wib()).astimezone(WIB_TZ)
    mulai, selesai = baca_waktu(tautan.get('mulai_at')), baca_waktu(tautan.get('selesai_at'))
    if (tautan.get('mulai_at') and not mulai) or (tautan.get('selesai_at') and not selesai):
        return {'berlaku': False, 'alasan': 'nonaktif', 'pesan': f'Tautan {label} belum dapat dibuka: pengaturan waktunya tidak valid. '
                'Hubungi panitia.', **jendela}
    if mulai and kini < mulai:
        return {'berlaku': False, 'alasan': 'belum_mulai', 'pesan': f'Tautan {label} belum dibuka.', **jendela}
    if selesai and kini >= selesai:
        return {'berlaku': False, 'alasan': 'sudah_selesai', 'pesan': f'Masa akses tautan {label} sudah berakhir.', **jendela}
    return {'berlaku': True, 'alasan': 'ok', 'pesan': None, **jendela}


# Jalur halaman publik tiap jenis tautan (frontend: /publik/info-ujian/:token, /publik/monitoring-ujian/:token,
# /publik/portal-ujian/:token).
JALUR_TAUTAN = {'info': '/publik/info-ujian/{token}', 'monitoring': '/publik/monitoring-ujian/{token}',
                'portal': '/publik/portal-ujian/{token}'}


def jalur_tautan(tautan: Dict[str, Any]) -> Optional[str]:
    """Jalur relatif halaman publik sebuah tautan (klien menambahkan origin), atau None."""
    pola = JALUR_TAUTAN.get(tautan.get('jenis'))
    return pola.format(token=tautan['token']) if pola and tautan.get('token') else None


def ringkas_tautan(tautan: Optional[Dict[str, Any]], sekarang: datetime = None) -> Optional[Dict[str, Any]]:
    """Tautan untuk panel admin: pengaturan, jalur publik, dan status berlaku saat ini (cek_tautan)."""
    if not tautan:
        return None
    cek = cek_tautan(tautan, sekarang)
    return {k: tautan.get(k) for k in ('id', 'ujian_id', 'jenis', 'token', 'aktif', 'mulai_at', 'selesai_at', 'diperbarui_pada')} | {
        'jalur': jalur_tautan(tautan), 'berlaku': cek['berlaku'], 'alasan': cek['alasan'], 'pesan': cek['pesan']}


TOKEN_COBA_MAKS = 3  # tabrakan token acak 192-bit praktis mustahil; tetap dicoba ulang agar tidak pernah gagal diam-diam


async def _pastikan(db, ujian_id: str, jenis: str, user: Dict[str, Any]) -> Tuple[Dict[str, Any], bool]:
    """(tautan, dibuat_sekarang). Bila insert ditolak index unik: (ujian_id, jenis) sudah ada -> pakai yang ada;
    selain itu (tabrakan token) -> coba lagi dengan token baru."""
    for _ in range(TOKEN_COBA_MAKS):
        ada = await db[KOLEKSI_TAUTAN].find_one({'ujian_id': ujian_id, 'jenis': jenis}, {'_id': 0})
        if ada:
            return ada, False
        baru = dokumen_tautan_baru(ujian_id, jenis, user)
        try:
            await db[KOLEKSI_TAUTAN].insert_one(dict(baru))
            return baru, True
        except DuplicateKeyError:
            continue
    ada = await db[KOLEKSI_TAUTAN].find_one({'ujian_id': ujian_id, 'jenis': jenis}, {'_id': 0})
    if ada:
        return ada, False
    raise RuntimeError(f'Gagal membuat tautan {jenis} untuk ujian {ujian_id}')


async def pastikan_tautan(db, ujian_id: str, jenis: str, user: Dict[str, Any]) -> Dict[str, Any]:
    """Tautan jenis `jenis` milik ujian; dibuat (ditutup, token acak) bila belum ada. Aman bila dua permintaan
    bersamaan: index unik (ujian_id, jenis) menolak dokumen kedua, lalu dokumen yang sudah ada yang dipakai."""
    return (await _pastikan(db, ujian_id, jenis, user))[0]


async def inisialisasi_tautan(db, ujian_id: str, user: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Service inisialisasi: pastikan TIGA tautan ber-token acak (info, monitoring, portal) milik ujian ada — baru dibuat
    dalam keadaan DITUTUP tanpa jendela waktu, dan pembuatannya dicatat di riwayat. Idempoten.
    -> { 'info': …, 'monitoring': …, 'portal': … }"""
    hasil = {}
    for jenis in JENIS_TAUTAN:
        t, dibuat = await _pastikan(db, ujian_id, jenis, user)
        if dibuat:
            await catat_riwayat_tautan(db, t, 'buat', user, detail='Tautan dibuat dalam keadaan ditutup', sesudah=t)
        hasil[jenis] = t
    return hasil


async def ganti_token(db, tautan_id: str, waktu: datetime = None) -> Optional[Dict[str, Any]]:
    """Ganti token sebuah tautan (tautan lama langsung tidak dikenal). Status buka/tutup & jendela tidak berubah."""
    await db[KOLEKSI_TAUTAN].update_one({'id': tautan_id}, {'$set': {'token': buat_token(), 'diperbarui_pada': (waktu or sekarang_wib()).isoformat()}})
    return await db[KOLEKSI_TAUTAN].find_one({'id': tautan_id}, {'_id': 0})


async def cari_tautan(db, token: Optional[str], jenis: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Tautan dari token (tanpa query bila bentuk token mustahil); `jenis` membatasi info/monitoring/portal — token portal
    tidak pernah membuka halaman info, dan sebaliknya."""
    if not token_layak(token):
        return None
    q = {'token': token, **({'jenis': jenis} if jenis else {})}
    return await db[KOLEKSI_TAUTAN].find_one(q, {'_id': 0})


# ---- Penghitung unduhan ----
async def tambah_jumlah_unduh(db, berkas_id: str) -> int:
    """Tambah penghitung unduhan satu berkas secara atomik ($inc) -> jumlah terbaru (0 bila berkas tidak ada)."""
    await db[KOLEKSI_BERKAS].update_one({'id': berkas_id}, {'$inc': {'jumlah_unduh': 1}})
    d = await db[KOLEKSI_BERKAS].find_one({'id': berkas_id}, {'_id': 0, 'jumlah_unduh': 1})
    return int((d or {}).get('jumlah_unduh') or 0)


# ---- Jejak audit akses & unduhan (pola pkg_audit_log: galat audit tidak pernah menggagalkan permintaan) ----
IP_RANTAI_MAKS = 200
_POLA_IP = re.compile(r'^[0-9A-Fa-f:.]{2,45}$')


def ip_peminta(request) -> Tuple[Optional[str], Optional[str]]:
    """(ip, rantai_x_forwarded_for) sumber akses. Aplikasi berjalan di balik reverse proxy (Traefik/Coolify) yang tidak
    dipercaya uvicorn, sehingga request.client.host berisi IP proxy. Urutan: X-Real-IP (diisi proxy) -> entri PALING KANAN
    X-Forwarded-For (ditambahkan proxy kita; entri kiri dapat dipalsukan klien) -> client.host. Nilai yang bukan bentuk
    IP diabaikan."""
    if request is None:
        return None, None
    h = getattr(request, 'headers', None) or {}
    rantai = (h.get('x-forwarded-for') or '').strip() or None
    calon = [h.get('x-real-ip'), *(reversed([x.strip() for x in rantai.split(',')]) if rantai else [])]
    ip = next((c.strip() for c in calon if c and _POLA_IP.match(c.strip())), None)
    if not ip:
        ip = request.client.host if getattr(request, 'client', None) else None
    return ip, (rantai[:IP_RANTAI_MAKS] if rantai else None)


def peminta(request) -> Tuple[Optional[str], Optional[str]]:
    """(ip, perangkat) dari permintaan HTTP (ip: lihat ip_peminta)."""
    if request is None:
        return None, None
    return ip_peminta(request)[0], ((getattr(request, 'headers', None) or {}).get('user-agent') or '')[:PERANGKAT_MAKS] or None


def sesi_sah(sesi: Optional[str]) -> Optional[str]:
    """Id sesi halaman dari klien (acak, ≤ 40 karakter URL-safe) atau None bila kosong/tidak berbentuk sah."""
    return sesi if sesi and len(sesi) <= 40 and re.fullmatch(r'[A-Za-z0-9_-]+', sesi) else None


def dokumen_akses_log(tautan: Optional[Dict[str, Any]], token: Optional[str], hasil: str, ip: Optional[str] = None,
                      perangkat: Optional[str] = None, waktu: datetime = None, sesi: Optional[str] = None,
                      aksi: str = 'buka_tautan') -> Dict[str, Any]:
    """Satu baris jejak akses publik. `aksi`: 'buka_tautan' (pembukaan halaman) atau 'klik_mengerjakan' (klik sah portal;
    pemanggil menambahkan link_soal_id, jenjang, mapel, url_host)."""
    if hasil not in HASIL_AKSES:
        raise ValueError(f'Hasil akses tidak dikenal: {hasil}')
    if aksi not in ('buka_tautan', 'klik_mengerjakan'):
        raise ValueError(f'Aksi akses tidak dikenal: {aksi}')
    t = tautan or {}
    w = (waktu or sekarang_wib()).isoformat()
    return {'id': str(uuid.uuid4()), 'tautan_id': t.get('id'), 'ujian_id': t.get('ujian_id'), 'jenis_tautan': t.get('jenis'), 'aksi': aksi,
            'token': (token or '')[:TOKEN_MAKS], 'waktu': w, 'ip': ip, 'perangkat': (perangkat or '')[:PERANGKAT_MAKS] or None,
            'hasil': hasil, 'sesi': sesi_sah(sesi), 'terakhir_aktif': w, 'jumlah_segarkan': 0}


def dokumen_unduh_log(berkas: Dict[str, Any], mode: str, ip: Optional[str] = None, perangkat: Optional[str] = None,
                      tautan: Optional[Dict[str, Any]] = None, pengunduh: Optional[Dict[str, Any]] = None,
                      waktu: datetime = None) -> Dict[str, Any]:
    """Satu baris log unduhan. Unduhan publik (mode 'publik') tanpa pengunduh; unduhan admin menyimpan akunnya."""
    if mode not in MODE_UNDUH:
        raise ValueError(f'Mode unduh tidak dikenal: {mode}')
    p = pengunduh or {}
    return {'id': str(uuid.uuid4()), 'berkas_id': berkas.get('id'), 'ujian_id': berkas.get('ujian_id'),
            'jenis_berkas': berkas.get('jenis'), 'jenjang': berkas.get('jenjang'), 'mapel': berkas.get('mapel'), 'mode': mode,
            'tautan_id': (tautan or {}).get('id'), 'pengunduh_id': p.get('id'),
            'pengunduh_nama': (p.get('full_name') or p.get('username')) if p else None,
            'waktu': (waktu or sekarang_wib()).isoformat(), 'ip': ip, 'perangkat': (perangkat or '')[:PERANGKAT_MAKS] or None}


GABUNG_TIDAK_DIKENAL_DETIK = 60


async def catat_akses(db, tautan: Optional[Dict[str, Any]], token: Optional[str], hasil: str, request=None,
                      sesi: Optional[str] = None) -> None:
    """Catat satu pembukaan tautan publik (berhasil maupun ditolak) ke ujian_akses_log. Percobaan token TIDAK DIKENAL dari
    IP yang sama dalam GABUNG_TIDAK_DIKENAL_DETIK digabung ke satu entri (jumlah_percobaan, terakhir_aktif, token_terakhir)
    agar penebakan token tidak membanjiri log namun tetap terlihat sebagai pola."""
    try:
        ip, perangkat = peminta(request)
        if hasil == 'tidak_dikenal' and ip:
            kini = sekarang_wib()
            batas = (kini - timedelta(seconds=GABUNG_TIDAK_DIKENAL_DETIK)).isoformat()
            r = await db[KOLEKSI_AKSES_LOG].update_one(
                {'hasil': 'tidak_dikenal', 'ip': ip, 'waktu': {'$gte': batas}},
                {'$inc': {'jumlah_percobaan': 1}, '$set': {'terakhir_aktif': kini.isoformat(), 'token_terakhir': (token or '')[:TOKEN_MAKS]}})
            if r.matched_count:
                return
        doc = dokumen_akses_log(tautan, token, hasil, ip, perangkat, sesi=sesi)
        if hasil == 'tidak_dikenal':
            doc['jumlah_percobaan'] = 1
        doc['ip_rantai'] = ip_peminta(request)[1]
        await db[KOLEKSI_AKSES_LOG].insert_one(doc)
    except Exception as e:  # noqa: BLE001 — audit tidak boleh menggagalkan permintaan
        logger.error(f'[ujian_info] gagal mencatat akses tautan: {e}')


async def catat_klik(db, tautan: Optional[Dict[str, Any]], token: Optional[str], link: Optional[Dict[str, Any]], hasil: str,
                     request=None, sesi: Optional[str] = None, waktu: datetime = None) -> Optional[Dict[str, Any]]:
    """Catat satu klik tombol "Mengerjakan" portal ke ujian_akses_log (aksi 'klik_mengerjakan'), sah maupun ditolak.
    `link` = { id, jenjang, mapel, url_host } (nama host tujuan saja, bukan tautan lengkap) atau None bila mapel tidak
    dikenal. Hanya entri ber-hasil 'ok' yang dihitung sebagai klik sah (penghitung & intensitas). -> dokumen log (None
    bila gagal dicatat — audit tidak boleh menggagalkan permintaan)."""
    try:
        ip, perangkat = peminta(request)
        doc = dokumen_akses_log(tautan, token, hasil, ip, perangkat, waktu=waktu, sesi=sesi, aksi='klik_mengerjakan')
        l = link or {}
        doc.update({'link_soal_id': l.get('id'), 'jenjang': l.get('jenjang'), 'mapel': l.get('mapel'), 'url_host': l.get('url_host') or None,
                    'ip_rantai': ip_peminta(request)[1]})
        await db[KOLEKSI_AKSES_LOG].insert_one(dict(doc))
        return doc
    except Exception as e:  # noqa: BLE001 — audit tidak boleh menggagalkan permintaan
        logger.error(f'[ujian_info] gagal mencatat klik Mengerjakan: {e}')
        return None


async def catat_segarkan(db, tautan: Dict[str, Any], sesi: Optional[str], waktu: datetime = None) -> bool:
    """Muat ulang halaman yang sudah dibuka: perbarui entri pembukaannya (terakhir_aktif, jumlah_segarkan) alih-alih
    menambah entri baru. -> True bila entri sesi ditemukan. Tanpa sesi sah: tidak dicatat."""
    sesi = sesi_sah(sesi)
    if not sesi or not tautan:
        return False
    try:
        r = await db[KOLEKSI_AKSES_LOG].update_one(  # hanya entri pembukaan (bukan klik Mengerjakan dari sesi yang sama)
            {'tautan_id': tautan.get('id'), 'sesi': sesi, 'aksi': {'$ne': 'klik_mengerjakan'}},
            {'$inc': {'jumlah_segarkan': 1}, '$set': {'terakhir_aktif': (waktu or sekarang_wib()).isoformat()}})
        return bool(r.matched_count)
    except Exception as e:  # noqa: BLE001 — audit tidak boleh menggagalkan permintaan
        logger.error(f'[ujian_info] gagal memperbarui sesi akses: {e}')
        return False


async def catat_unduh(db, berkas: Dict[str, Any], mode: str, request=None, tautan: Optional[Dict[str, Any]] = None,
                      pengunduh: Optional[Dict[str, Any]] = None) -> None:
    """Catat satu unduhan berkas ke ujian_unduh_log."""
    try:
        ip, perangkat = peminta(request)
        doc = dokumen_unduh_log(berkas, mode, ip, perangkat, tautan, pengunduh)
        doc['ip_rantai'] = ip_peminta(request)[1]
        await db[KOLEKSI_UNDUH_LOG].insert_one(doc)
    except Exception as e:  # noqa: BLE001 — audit tidak boleh menggagalkan permintaan
        logger.error(f'[ujian_info] gagal mencatat unduhan berkas: {e}')


# ---- Isian jendela waktu tautan (dipakai panel admin) ----
def normalisasi_waktu(nilai: Any) -> Optional[str]:
    """Isian waktu (ISO ber-zona, 'YYYY-MM-DDTHH:MM' WIB dari datetime-local, atau datetime) -> ISO WIB
    'YYYY-MM-DDTHH:MM:SS+07:00'; None bila kosong. ValueError bila tidak terbaca / di luar tahun 2000–2100."""
    if nilai in (None, ''):
        return None
    d = baca_waktu(nilai)
    if not d or not (2000 <= d.year <= 2100):
        raise ValueError('Format waktu tidak valid (contoh: 2026-12-01T07:00)')
    return d.astimezone(WIB_TZ).replace(microsecond=0).isoformat()


class JendelaTautanIn(BaseModel):
    """Pengaturan buka/tutup & jendela waktu akses satu tautan publik. Batas kosong = tanpa batas."""
    aktif: bool = False
    mulai_at: Optional[str] = Field(None, max_length=40)
    selesai_at: Optional[str] = Field(None, max_length=40)

    @field_validator('mulai_at', 'selesai_at', mode='before')
    @classmethod
    def _waktu(cls, v):
        return normalisasi_waktu(v.strip() if isinstance(v, str) else v)

    @model_validator(mode='after')
    def _urutan(self):
        if self.mulai_at and self.selesai_at and baca_waktu(self.selesai_at) <= baca_waktu(self.mulai_at):
            raise ValueError('Waktu selesai harus setelah waktu mulai')
        return self


# ---- Riwayat perubahan tautan ----
def _pengaturan(t: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return {k: (t or {}).get(k) for k in ('aktif', 'mulai_at', 'selesai_at')} if t else None


def dokumen_riwayat_tautan(tautan: Dict[str, Any], aksi: str, user: Dict[str, Any], detail: Optional[str] = None,
                           sebelum: Optional[Dict[str, Any]] = None, sesudah: Optional[Dict[str, Any]] = None,
                           waktu: datetime = None) -> Dict[str, Any]:
    """Satu baris riwayat perubahan tautan. Hanya pengaturan (aktif & jendela) yang disalin — token tidak pernah."""
    if aksi not in AKSI_TAUTAN:
        raise ValueError(f'Aksi tautan tidak dikenal: {aksi}')
    return {'id': str(uuid.uuid4()), 'tautan_id': tautan.get('id'), 'ujian_id': tautan.get('ujian_id'), 'jenis': tautan.get('jenis'),
            'aksi': aksi, 'oleh': user.get('id'), 'oleh_nama': user.get('full_name') or user.get('username'),
            'waktu': (waktu or sekarang_wib()).isoformat(), 'detail': (detail or '')[:300] or None,
            'sebelum': _pengaturan(sebelum), 'sesudah': _pengaturan(sesudah)}


async def catat_riwayat_tautan(db, tautan: Dict[str, Any], aksi: str, user: Dict[str, Any], detail: Optional[str] = None,
                               sebelum: Optional[Dict[str, Any]] = None, sesudah: Optional[Dict[str, Any]] = None) -> None:
    """Catat perubahan pengaturan tautan; galat dicatat ke logger dan tidak menggagalkan permintaan."""
    try:
        await db[KOLEKSI_TAUTAN_RIWAYAT].insert_one(dokumen_riwayat_tautan(tautan, aksi, user, detail, sebelum, sesudah))
    except Exception as e:  # noqa: BLE001 — audit tidak boleh menggagalkan permintaan
        logger.error(f'[ujian_info] gagal mencatat riwayat tautan: {e}')


def jendela_rusak(t: Dict[str, Any]) -> bool:
    """Batas waktu tersimpan tetapi tidak terbaca (tautan akan ditolak fail-closed sampai diperbaiki admin)."""
    return bool((t.get('mulai_at') and not baca_waktu(t['mulai_at'])) or (t.get('selesai_at') and not baca_waktu(t['selesai_at'])))


class UbahTautanIn(BaseModel):
    """Perubahan PARSIAL pengaturan tautan: hanya field yang dikirim yang diubah (aktif tidak ikut berubah saat jendela
    disimpan, dan sebaliknya) — mencegah perubahan admin lain tertimpa oleh tampilan yang sudah basi. Validasi waktu
    dilakukan terapkan_ubah_tautan agar pesannya berupa kalimat jelas."""
    aktif: Optional[bool] = None
    mulai_at: Optional[str] = Field(None, max_length=40)
    selesai_at: Optional[str] = Field(None, max_length=40)


def terapkan_ubah_tautan(lama: Dict[str, Any], isi: UbahTautanIn) -> Dict[str, Any]:
    """Pengaturan baru {aktif, mulai_at, selesai_at} = lama + field yang dikirim (waktu dinormalkan ke ISO WIB).
    ValueError (pesan siap tampil) bila waktu tidak terbaca atau selesai tidak setelah mulai."""
    dikirim = isi.model_fields_set
    baru = {k: lama.get(k) for k in ('aktif', 'mulai_at', 'selesai_at')}
    baru['aktif'] = bool(baru['aktif'])
    if 'aktif' in dikirim and isi.aktif is not None:
        baru['aktif'] = isi.aktif
    for k, label in (('mulai_at', 'mulai'), ('selesai_at', 'selesai')):
        if k in dikirim:
            v = getattr(isi, k)
            try:
                baru[k] = normalisasi_waktu(v.strip() if isinstance(v, str) else v)
            except ValueError:
                raise ValueError(f'Waktu {label} tidak valid. Gunakan tanggal & jam lengkap, mis. 2026-12-01T07:00.') from None
    m, sl = baca_waktu(baru['mulai_at']), baca_waktu(baru['selesai_at'])
    if m and sl and sl <= m:
        raise ValueError('Waktu selesai harus setelah waktu mulai.')
    return baru


def peringatan_jendela(t: Dict[str, Any], ujian: Optional[Dict[str, Any]], sekarang: datetime = None) -> list:
    """Peringatan (bukan galat) atas pengaturan tautan -> [{kode, pesan}] — sama dengan peringatanTautan di frontend."""
    kini = (sekarang or sekarang_wib()).astimezone(WIB_TZ)
    hasil = []
    selesai = baca_waktu(t.get('selesai_at'))
    if t.get('aktif') and selesai and selesai <= kini:
        hasil.append({'kode': 'aktif_berakhir', 'pesan': 'Tautan dibuka tetapi waktu selesainya sudah lewat — pengunjung melihat "masa akses berakhir".'})
    akhir_ujian = baca_waktu(f"{(ujian or {}).get('selesai')}T00:00:00") if (ujian or {}).get('selesai') else None
    if t.get('jenis') == 'info' and selesai and akhir_ujian and selesai < akhir_ujian:
        hasil.append({'kode': 'berakhir_sebelum_ujian', 'pesan': 'Jendela waktu berakhir sebelum hari terakhir ujian.'})
    if t.get('jenis') == 'portal' and t.get('aktif') and (not t.get('mulai_at') or not t.get('selesai_at')):
        hasil.append({'kode': 'portal_ikut_masa_ujian', 'pesan': 'Portal dibuka tanpa jendela waktu lengkap: batas yang kosong mengikuti '
                      'masa ujian, sehingga portal tetap terkunci di luar masa ujian.'})
    return hasil


def dokumen_unduh_zip_log(ujian_id: str, jenis: str, jenjang: int, berkas: list, mapel_kosong: list, pengunduh: Dict[str, Any],
                          ip: Optional[str] = None, perangkat: Optional[str] = None, waktu: datetime = None) -> Dict[str, Any]:
    """Satu baris log untuk satu unduhan ZIP per jenjang (mode zip_jenjang): isi ZIP dicatat sebagai daftar id berkas."""
    if jenis not in JENIS_BERKAS:
        raise ValueError(f'Jenis berkas tidak dikenal: {jenis}')
    p = pengunduh or {}
    return {'id': str(uuid.uuid4()), 'berkas_id': None, 'ujian_id': ujian_id, 'jenis_berkas': jenis, 'jenjang': jenjang, 'mapel': None,
            'mode': 'zip_jenjang', 'tautan_id': None, 'pengunduh_id': p.get('id'), 'pengunduh_nama': p.get('full_name') or p.get('username'),
            'berkas_ids': [b.get('id') for b in berkas], 'jumlah_berkas': len(berkas), 'mapel_kosong': list(mapel_kosong),
            'waktu': (waktu or sekarang_wib()).isoformat(), 'ip': ip, 'perangkat': (perangkat or '')[:PERANGKAT_MAKS] or None}


async def catat_unduh_zip(db, ujian_id: str, jenis: str, jenjang: int, berkas: list, mapel_kosong: list, pengunduh: Dict[str, Any],
                          request=None) -> None:
    """Catat satu unduhan ZIP ke ujian_unduh_log; galat audit tidak menggagalkan permintaan."""
    try:
        ip, perangkat = peminta(request)
        doc = dokumen_unduh_zip_log(ujian_id, jenis, jenjang, berkas, mapel_kosong, pengunduh, ip, perangkat)
        doc['ip_rantai'] = ip_peminta(request)[1]
        await db[KOLEKSI_UNDUH_LOG].insert_one(doc)
    except Exception as e:  # noqa: BLE001 — audit tidak boleh menggagalkan permintaan
        logger.error(f'[ujian_info] gagal mencatat unduhan ZIP: {e}')


# ---- Saringan riwayat audit (akses & unduhan) ----
_POLA_TANGGAL = re.compile(r'^\d{4}-\d{2}-\d{2}$')
CARI_AUDIT_MAKS = 60


def galat_saringan_audit(dari: Optional[str], sampai: Optional[str], cari: Optional[str]) -> Optional[str]:
    """Validasi saringan riwayat -> pesan galat atau None. Tanggal 'YYYY-MM-DD' (WIB), dari <= sampai, cari <= 60 karakter."""
    for nama, v in (('dari', dari), ('sampai', sampai)):
        if v:
            if not _POLA_TANGGAL.match(v):
                return f'Tanggal "{nama}" harus berformat YYYY-MM-DD.'
            try:
                datetime.strptime(v, '%Y-%m-%d')
            except ValueError:
                return f'Tanggal "{nama}" tidak valid.'
    if dari and sampai and dari > sampai:
        return 'Tanggal "dari" harus sebelum atau sama dengan "sampai".'
    if cari and len(cari) > CARI_AUDIT_MAKS:
        return f'Kata pencarian maksimal {CARI_AUDIT_MAKS} karakter.'
    return None


def kueri_saringan_audit(ujian_id: str, dari: Optional[str] = None, sampai: Optional[str] = None, cari: Optional[str] = None) -> Dict[str, Any]:
    """Kueri Mongo untuk log audit satu ujian. Waktu log disimpan ISO WIB (+07:00), jadi rentang tanggal WIB inklusif cukup
    dibandingkan sebagai teks: waktu >= 'dari T00:00:00' dan < 'sampai T99' (setelah jam terakhir hari itu). `cari` dicocokkan
    sebagai teks biasa (di-escape — tidak bisa menyuntikkan regex) pada ip atau perangkat, tanpa beda huruf besar/kecil."""
    q: Dict[str, Any] = {'ujian_id': ujian_id}
    rentang = {}
    if dari:
        rentang['$gte'] = f'{dari}T00:00:00'
    if sampai:
        rentang['$lt'] = f'{sampai}T99'
    if rentang:
        q['waktu'] = rentang
    c = (cari or '').strip()
    if c:
        pola = re.escape(c[:CARI_AUDIT_MAKS])
        q['$or'] = [{'ip': {'$regex': pola, '$options': 'i'}}, {'perangkat': {'$regex': pola, '$options': 'i'}}]
    return q


# ---- Rekonsiliasi penghitung unduhan kisi-kisi ----
async def rekonsiliasi_jumlah_unduh(db, ujian_id: Optional[str] = None, terapkan: bool = False) -> Dict[str, Any]:
    """Bandingkan ujian_berkas.jumlah_unduh (kisi-kisi) dengan jumlah entri ujian_unduh_log mode 'publik' untuk berkas itu.
    Penghitung tidak pernah diturunkan (unduhan sebelum log ada tetap dihitung); bila lebih kecil dari log, dinaikkan ke
    jumlah log saat `terapkan`. -> { diperiksa, selisih: [{ id, jumlah_unduh, jumlah_log }], diperbaiki }"""
    q = {'jenis': 'kisi_kisi', **({'ujian_id': ujian_id} if ujian_id else {})}
    berkas = await db[KOLEKSI_BERKAS].find(q, {'_id': 0, 'id': 1, 'jumlah_unduh': 1}).to_list(5000)
    selisih, diperbaiki = [], 0
    for b in berkas:
        n_log = await db[KOLEKSI_UNDUH_LOG].count_documents({'berkas_id': b['id'], 'mode': 'publik'})
        n = int(b.get('jumlah_unduh') or 0)
        if n < n_log:
            selisih.append({'id': b['id'], 'jumlah_unduh': n, 'jumlah_log': n_log})
            if terapkan:
                await db[KOLEKSI_BERKAS].update_one({'id': b['id']}, {'$set': {'jumlah_unduh': n_log}})
                diperbaiki += 1
    return {'diperiksa': len(berkas), 'selisih': selisih, 'diperbaiki': diperbaiki}
