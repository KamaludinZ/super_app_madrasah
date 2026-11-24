"""Ujian Madrasah — PORTAL UJIAN publik & LINK SOAL: skema dan aturan murni.

Portal ujian (/publik/portal-ujian/{token}) adalah halaman publik TERPISAH dari halaman info: token jenis `portal` di
`ujian_tautan_publik` (lihat ujian_info.JENIS_TAUTAN) dengan sakelar & jendela waktu sendiri (= masa ujian; di luar itu
portal ditolak server). Portal hanya memuat jadwal mapel dan tombol "Mengerjakan"; tautan soal eksternal tidak pernah
ikut payload — baru keluar lewat rute kerjakan (302) saat jendela mapel berlangsung menurut waktu server.

Dokumen `ujian_link_soal` (satu per ujian + jenjang + mapel — simpan ulang MENIMPA, tidak menambah baris):
    id (unik), ujian_id, jenjang (7|8|9), mapel (kode baku ujian_mapel_baku),
    url                 tautan soal eksternal; hanya http/https (url_soal_aman); '' = belum diisi (mapel "belum siap")
    mulai_at, selesai_at  ISO datetime WIB — jendela tombol "Mengerjakan" (nilai awal dari sesi jadwal_ujian mapel itu;
                        admin boleh mempersempit). Jendela [mulai_at, selesai_at): tepat pada selesai_at sudah ditutup.
    aktif               tombol dapat dimatikan admin walau jendela berlangsung ("ditahan")
    jumlah_klik         CACHE klik sah "Mengerjakan" (dinaikkan atomik $inc bersama klik_terakhir_at); sumber kebenaran
                        tetap ujian_akses_log aksi=klik_mengerjakan — dapat dibangun ulang dari log kapan saja
    klik_terakhir_at    waktu klik sah terakhir (cache, ikut dibangun ulang)
    dibuat_pada, diperbarui_pada (= versi untuk cek bentrok antar-admin), diperbarui_oleh, diperbarui_oleh_nama
    Unik: id; (ujian_id, jenjang, mapel).

`ujian_akses_log` (skema di ujian_info.py) mendapat field `aksi` (AKSI_AKSES) agar jejak audit publik tetap satu tempat:
    'buka_tautan'      pembukaan halaman publik (info/monitoring/portal). Entri lama tanpa `aksi` TIDAK diubah (log audit
                       tidak pernah diubah massal) — pembaca memperlakukannya sebagai 'buka_tautan' (KUERI_BUKA)
    'klik_mengerjakan' klik sah tombol "Mengerjakan" di portal; tambahan field link_soal_id, jenjang, mapel, url_host
                       (nama host tujuan saja). Hanya klik yang benar-benar dialihkan ke tautan soal yang dicatat.
Tanpa aturan hapus: log klik disimpan selamanya (tanpa TTL).
"""
import re
from typing import Any, Dict, Optional
from urllib.parse import urlsplit

from ujian_info import KOLEKSI_AKSES_LOG, baca_waktu

KOLEKSI_LINK_SOAL = 'ujian_link_soal'

AKSI_AKSES = ('buka_tautan', 'klik_mengerjakan')
AKSI_BUKA = 'buka_tautan'
AKSI_KLIK = 'klik_mengerjakan'

# Saringan log: klik sah "Mengerjakan" vs pembukaan tautan (termasuk entri lama sebelum field `aksi` ada).
KUERI_KLIK = {'aksi': AKSI_KLIK}
KUERI_BUKA = {'aksi': {'$ne': AKSI_KLIK}}

URL_SOAL_MAKS = 2000  # sama dengan URL_SOAL_MAKS di frontend/src/lib/ujianLinkSoal.js

INDEX_LINK_SOAL = [
    (KOLEKSI_LINK_SOAL, [('id', 1)], {'unique': True}),
    # Satu tautan soal per ujian + jenjang + mapel: simpan ulang menimpa.
    (KOLEKSI_LINK_SOAL, [('ujian_id', 1), ('jenjang', 1), ('mapel', 1)], {'unique': True, 'name': 'link_soal_unik_mapel'}),
    # Intensitas & rincian klik per link soal (agregasi dari log, bukan dari cache) dan bangun ulang penghitung.
    (KOLEKSI_AKSES_LOG, [('link_soal_id', 1), ('aksi', 1), ('waktu', -1)], {'name': 'akses_link_aksi_waktu'}),
    (KOLEKSI_AKSES_LOG, [('ujian_id', 1), ('aksi', 1), ('waktu', -1)], {'name': 'akses_ujian_aksi_waktu'}),
]

# Pola literal lebih dulu: urlsplit memaafkan bentuk rusak seperti "http:///x" atau "https:\\host".
_URL_SOAL = re.compile(r'^https?://[^/\\?#@\s]+', re.IGNORECASE)


def url_soal_aman(url: Any) -> Optional[str]:
    """Tautan soal yang boleh dipasang -> URL bersih, atau None. Hanya http:// atau https:// dengan nama host, tanpa spasi,
    tanpa kredensial (user:sandi@), ≤ URL_SOAL_MAKS. javascript:, data:, file:, dan skema lain ditolak. Sama dengan
    urlSoalAman di frontend."""
    t = str(url or '').strip()
    if not t or len(t) > URL_SOAL_MAKS or re.search(r'\s', t) or not _URL_SOAL.match(t):
        return None
    try:
        u = urlsplit(t)
    except ValueError:
        return None
    if u.scheme.lower() not in ('http', 'https') or not u.hostname or u.username or u.password:
        return None
    return t


def host_url(url: Any) -> str:
    """Nama host tautan untuk ditampilkan ringkas / dicatat di log ('' bila tidak terbaca)."""
    try:
        h = urlsplit(str(url or '').strip()).hostname or ''
    except ValueError:
        return ''
    return h[4:] if h.startswith('www.') else h


def link_soal_rusak(doc: Dict[str, Any]) -> Optional[str]:
    """Alasan sebuah dokumen link soal tidak dapat dipakai apa adanya (dilaporkan migrasi, tidak diubah), atau None:
    'url_tidak_sah' (terisi tetapi bukan http/https), 'jendela_tidak_terbaca', 'jendela_terbalik' (selesai ≤ mulai)."""
    if doc.get('url') and not url_soal_aman(doc.get('url')):
        return 'url_tidak_sah'
    mulai, selesai = doc.get('mulai_at'), doc.get('selesai_at')
    m, s = baca_waktu(mulai), baca_waktu(selesai)
    if (mulai and not m) or (selesai and not s):
        return 'jendela_tidak_terbaca'
    if m and s and s <= m:
        return 'jendela_terbalik'
    return None
