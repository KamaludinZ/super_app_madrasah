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
import uuid
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlsplit

from pydantic import BaseModel, Field, field_validator, model_validator

from ujian import WIB_TZ, sekarang_wib
from ujian_info import JENJANG_UJIAN, KOLEKSI_AKSES_LOG, baca_waktu

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
    'jenjang_tidak_sah', 'url_tidak_sah' (terisi tetapi bukan http/https), 'jendela_tidak_terbaca', 'jendela_terbalik'
    (selesai ≤ mulai)."""
    if 'jenjang' in doc and doc.get('jenjang') not in JENJANG_UJIAN:
        return 'jenjang_tidak_sah'
    if doc.get('url') and not url_soal_aman(doc.get('url')):
        return 'url_tidak_sah'
    mulai, selesai = doc.get('mulai_at'), doc.get('selesai_at')
    m, s = baca_waktu(mulai), baca_waktu(selesai)
    if (mulai and not m) or (selesai and not s):
        return 'jendela_tidak_terbaca'
    if m and s and s <= m:
        return 'jendela_terbalik'
    return None


# ---- Jendela awal dari jadwal ujian ----
# Nama mapel di jadwal_ujian adalah teks bebas (menu Pengaturan Formulir); dicocokkan ke kode baku lewat nama ternormal
# (huruf & angka saja, huruf kecil) dan beberapa sebutan lain yang lazim di madrasah.
_ALIAS_MAPEL = {
    'alquranhadits': 'quran_hadits', 'alquranhadis': 'quran_hadits', 'quranhadis': 'quran_hadits', 'qurdis': 'quran_hadits',
    'ppkn': 'pkn', 'pendidikanpancasila': 'pkn', 'pancasila': 'pkn', 'pendidikanpancasiladankewarganegaraan': 'pkn',
    'aqidahakhlak': 'akidah_akhlak', 'akidahakhlaq': 'akidah_akhlak', 'aqidahakhlaq': 'akidah_akhlak',
    'fikih': 'fiqh', 'fiqih': 'fiqh', 'sejarahkebudayaanislam': 'ski',
    'pendidikanjasmaniolahragadankesehatan': 'pjok', 'penjas': 'pjok', 'penjaskes': 'pjok', 'penjasorkes': 'pjok',
    'senibudayadanprakarya': 'seni_budaya', 'sbdp': 'seni_budaya', 'sbk': 'seni_budaya', 'tik': 'informatika',
    'bindo': 'bahasa_indonesia', 'bing': 'bahasa_inggris', 'barab': 'bahasa_arab', 'bjawa': 'bahasa_jawa',
}


def kunci_nama_mapel(nama: Any) -> str:
    """Nama mapel ternormal untuk dicocokkan: huruf kecil, hanya huruf & angka ("Al-Qur'an Hadits" -> "alquranhadits")."""
    return re.sub(r'[^a-z0-9]', '', str(nama or '').lower())


def kode_mapel_dari_nama(nama: Any, mapel: Iterable[Dict[str, Any]]) -> Optional[str]:
    """Kode baku dari nama mapel teks bebas: cocok dengan nama atau kode mapel baku (`mapel` = [{kode, nama}] jenjang itu),
    atau dengan alias lazim. None bila tidak dikenali."""
    k = kunci_nama_mapel(nama)
    if not k:
        return None
    daftar = list(mapel)
    for m in daftar:
        if k in (kunci_nama_mapel(m.get('nama')), kunci_nama_mapel(m.get('kode'))):
            return m['kode']
    alias = _ALIAS_MAPEL.get(k)
    return alias if alias and any(m['kode'] == alias for m in daftar) else None


def iso_wib(tanggal: str, jam: str) -> str:
    """'YYYY-MM-DD' + 'HH:MM' (WIB) -> ISO datetime ber-zona WIB."""
    return f'{tanggal}T{jam}:00+07:00'


def jendela_jadwal(jadwal: Iterable[Dict[str, Any]], jenjang: int, mapel: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Sesi jadwal ujian tiap mapel baku satu jenjang -> { kode: { tanggal, sesi_ke, mulai_at, selesai_at } } (nilai awal
    jendela tombol "Mengerjakan"). Bila satu mapel muncul di beberapa sesi, sesi paling awal yang dipakai. Sesi yang nama
    mapelnya tidak dikenali dilewati (mapel itu tampil "belum ada di jadwal")."""
    daftar = list(mapel)
    hasil: Dict[str, Dict[str, Any]] = {}
    for s in sorted(jadwal or [], key=lambda x: (x.get('tanggal') or '', x.get('jam_mulai') or '', x.get('sesi_ke') or 0)):
        kode = kode_mapel_dari_nama((s.get('mapel') or {}).get(str(jenjang)), daftar)
        if not kode or kode in hasil or not (s.get('tanggal') and s.get('jam_mulai') and s.get('jam_selesai')):
            continue
        hasil[kode] = {'tanggal': s['tanggal'], 'sesi_ke': s.get('sesi_ke'),
                       'mulai_at': iso_wib(s['tanggal'], s['jam_mulai']), 'selesai_at': iso_wib(s['tanggal'], s['jam_selesai'])}
    return hasil


# ---- Isian & dokumen link soal ----
def _waktu_wib(v: Any, nama: str) -> str:
    d = baca_waktu(v)
    if not d:
        raise ValueError(f'Waktu {nama} tidak terbaca')
    return d.astimezone(WIB_TZ).replace(microsecond=0).isoformat()


class LinkSoalIn(BaseModel):
    """Isian admin satu link soal (PUT /ujian/{id}/link-soal/{jenjang}/{mapel}). `url` boleh kosong (mapel "belum siap").
    `versi` = diperbarui_pada yang dimuat (None bila belum pernah disimpan) — beda dengan yang tersimpan -> ditolak (409)."""
    url: str = Field('', max_length=URL_SOAL_MAKS + 50)
    mulai_at: str = Field(..., max_length=40)
    selesai_at: str = Field(..., max_length=40)
    aktif: bool = True
    versi: Optional[str] = Field(None, max_length=64)

    @field_validator('url', mode='before')
    @classmethod
    def _url(cls, v):
        t = str(v or '').strip()
        if not t:
            return ''
        if len(t) > URL_SOAL_MAKS:
            raise ValueError(f'Tautan soal maksimal {URL_SOAL_MAKS} karakter')
        aman = url_soal_aman(t)
        if not aman:
            raise ValueError('Tautan soal harus diawali http:// atau https://, tanpa spasi dan tanpa nama pengguna/sandi')
        return aman

    @field_validator('mulai_at')
    @classmethod
    def _mulai(cls, v):
        return _waktu_wib(v, 'mulai')

    @field_validator('selesai_at')
    @classmethod
    def _selesai(cls, v):
        return _waktu_wib(v, 'tutup')

    @model_validator(mode='after')
    def _urutan(self):
        if baca_waktu(self.selesai_at) <= baca_waktu(self.mulai_at):
            raise ValueError('Waktu tutup harus setelah waktu mulai')
        return self


def link_siap(doc: Optional[Dict[str, Any]]) -> bool:
    """Tombol "Mengerjakan" dapat dipakai: tautan soal sah terisi DAN tombol diaktifkan admin."""
    return bool(doc) and bool(url_soal_aman(doc.get('url'))) and doc.get('aktif', True) is not False


def dokumen_link_soal(ujian_id: str, jenjang: int, mapel: str, isi: LinkSoalIn, user: Dict[str, Any],
                      lama: Optional[Dict[str, Any]] = None, waktu: datetime = None) -> Dict[str, Any]:
    """Dokumen link soal hasil simpan admin (MENIMPA yang lama). id, dibuat_pada, dan penghitung klik (cache dari log)
    dipertahankan — mengganti tautan/jendela tidak menghapus riwayat klik."""
    if int(jenjang) not in JENJANG_UJIAN:
        raise ValueError(f'Jenjang tidak dikenal: {jenjang}')
    t = (waktu or sekarang_wib()).isoformat()
    lama = lama or {}
    return {
        'id': lama.get('id') or str(uuid.uuid4()), 'ujian_id': ujian_id, 'jenjang': int(jenjang), 'mapel': mapel,
        'url': isi.url, 'mulai_at': isi.mulai_at, 'selesai_at': isi.selesai_at, 'aktif': bool(isi.aktif),
        'jumlah_klik': int(lama.get('jumlah_klik') or 0), 'klik_terakhir_at': lama.get('klik_terakhir_at'),
        'dibuat_pada': lama.get('dibuat_pada') or t, 'diperbarui_pada': t,
        'diperbarui_oleh': user.get('id'), 'diperbarui_oleh_nama': user.get('full_name') or user.get('username'),
    }


def ringkas_link_admin(doc: Optional[Dict[str, Any]], jenjang: int, mapel: str, jadwal: Optional[Dict[str, Any]] = None,
                       tampil_url: bool = False) -> Dict[str, Any]:
    """Satu entri LinkSoal untuk menu Link Soal (kontrak frontend/src/lib/ujianLinkSoal.js). Mapel yang belum pernah
    disimpan: id None, url '', jendela dari jadwal. Alamat soal lengkap hanya untuk admin (`tampil_url`); pemantau
    mendapat nama host saja."""
    d = doc or {}
    url = d.get('url') or ''
    return {
        'id': d.get('id'), 'jenjang': int(jenjang), 'mapel': mapel,
        'url': url if tampil_url else '', 'url_host': host_url(url) if url else '',
        'mulai_at': d.get('mulai_at') or (jadwal or {}).get('mulai_at'),
        'selesai_at': d.get('selesai_at') or (jadwal or {}).get('selesai_at'),
        'aktif': d.get('aktif', True) is not False, 'siap': link_siap(doc), 'jadwal': jadwal,
        'jumlah_klik': int(d.get('jumlah_klik') or 0), 'klik_terakhir_at': d.get('klik_terakhir_at'),
        'diperbarui_pada': d.get('diperbarui_pada'), 'diperbarui_oleh_nama': d.get('diperbarui_oleh_nama'),
        'versi': d.get('diperbarui_pada'),
    }


def susun_link_admin(docs: Iterable[Dict[str, Any]], mapel_per_jenjang: Dict[str, List[Dict[str, Any]]],
                     jadwal: Iterable[Dict[str, Any]], tampil_url: bool = False) -> List[Dict[str, Any]]:
    """Satu entri per jenjang × mapel baku aktif (urutan baku), menggabungkan dokumen tersimpan dan jendela jadwal."""
    peta = {(int(d.get('jenjang') or 0), d.get('mapel')): d for d in docs or []}
    jadwal = list(jadwal or [])
    hasil = []
    for j in JENJANG_UJIAN:
        daftar = mapel_per_jenjang.get(str(j)) or []
        dari_jadwal = jendela_jadwal(jadwal, j, daftar)
        hasil.extend(ringkas_link_admin(peta.get((j, m['kode'])), j, m['kode'], dari_jadwal.get(m['kode']), tampil_url) for m in daftar)
    return hasil
