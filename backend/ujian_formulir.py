"""Ujian Madrasah — Pengaturan Formulir: aktivasi & jendela waktu formulir (berlaku untuk SEMUA ruang satu ujian),
jadwal sesi, template cetak, pola tanda tangan, dan token tautan publik.

Dokumen `formulir_ujian` (satu per ujian):
    ujian_id (unik), aktif, jam_buka, jam_tutup ('HH:MM' WIB), token (unik; tautan publik daftar hadir & berita acara),
    template { nama_madrasah, kop_madrasah, alamat, kota_ttd, singkatan_ujian, nama_kegiatan, catatan_kaki },
    pola_ttd { tampil_di_cetak, tinggi_mm }, diubah { aktivasi|template|pola_ttd|jadwal: { oleh, oleh_nama, pada } },
    diubah_pada, diubah_oleh_nama

Dokumen `jadwal_ujian` (sesi ujian; mengisi "Hari, tanggal", "Pukul", dan "Mata Pelajaran" pada lembar cetak):
    id, ujian_id, tanggal 'YYYY-MM-DD', sesi_ke (1..), jam_mulai, jam_selesai, mapel { '7': nama, '8': nama, '9': nama }
    Unik: (ujian_id, tanggal, sesi_ke).
"""
import secrets
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from ujian import KOLEKSI_FORMULIR, POLA_TANGGAL, cek_waktu_formulir, ringkas_formulir, sekarang_wib  # noqa: F401 (diekspor ulang)

KOLEKSI_JADWAL = 'jadwal_ujian'
POLA_JAM = r'^([01]\d|2[0-3]):[0-5]\d$'
TINGGI_TTD_MIN, TINGGI_TTD_MAKS, TINGGI_TTD_BAWAAN = 8, 20, 12
SESI_MAKS_PER_HARI = 6
BAGIAN_DIUBAH = ('aktivasi', 'template', 'pola_ttd', 'jadwal')

# Isian bawaan sesuai docs/2a. Daftar Hadir Peserta.docx & docs/3. Berita Acara.docx (sama dengan TEMPLATE_BAWAAN
# di frontend/src/lib/ujianFormulir.js). Nama & alamat madrasah diambil dari Pengaturan bila diisi.
KEGIATAN_JENIS = {
    'UTS': {'singkatan_ujian': 'ASTS', 'nama_kegiatan': 'Asesmen Sumatif Tengah Semester'},
    'UAS': {'singkatan_ujian': 'ASAS', 'nama_kegiatan': 'Asesmen Sumatif Akhir Semester'},
}
TEMPLATE_BAWAAN = {
    'nama_madrasah': 'MTsN 2 Kota Malang',
    'kop_madrasah': 'MTs NEGERI 2 KOTA MALANG',
    'alamat': 'Jalan Raya Cemorokandang No. 77, Kota Malang',
    'kota_ttd': 'Malang',
    **KEGIATAN_JENIS['UAS'],
    'catatan_kaki': 'Diisi dengan Mata Pelajaran pada waktu itu',
}
BATAS_TEMPLATE = {'nama_madrasah': 80, 'kop_madrasah': 80, 'alamat': 160, 'kota_ttd': 40, 'singkatan_ujian': 20,
                  'nama_kegiatan': 100, 'catatan_kaki': 120}

INDEX_FORMULIR = [
    (KOLEKSI_FORMULIR, [('ujian_id', 1)], {'unique': True}),
    (KOLEKSI_FORMULIR, [('token', 1)], {'unique': True, 'name': 'formulir_unik_token',
                                        'partialFilterExpression': {'token': {'$type': 'string'}}}),
    (KOLEKSI_JADWAL, [('id', 1)], {'unique': True}),
    (KOLEKSI_JADWAL, [('ujian_id', 1), ('tanggal', 1), ('sesi_ke', 1)], {'unique': True, 'name': 'jadwal_unik_sesi'}),
]


async def pastikan_index_formulir(db) -> None:
    for koleksi, keys, opsi in INDEX_FORMULIR:
        await db[koleksi].create_index(keys, **opsi)


def token_baru() -> str:
    """Token tautan publik: acak & tidak dapat ditebak (bukan id ujian)."""
    return secrets.token_urlsafe(16)


def template_bawaan(jenis: Optional[str], pengaturan: Optional[Dict[str, Any]] = None) -> Dict[str, str]:
    """Template bawaan menurut jenis ujian; nama & alamat madrasah dari Pengaturan bila ada."""
    t = {**TEMPLATE_BAWAAN, **KEGIATAN_JENIS.get(jenis or 'UAS', {})}
    s = pengaturan or {}
    if s.get('school_name'):
        t['nama_madrasah'] = s['school_name']
    if s.get('address'):
        t['alamat'] = s['address']
    if s.get('city'):
        t['kota_ttd'] = str(s['city']).replace('Kota ', '').replace('Kabupaten ', '').strip() or t['kota_ttd']
    return t


def dokumen_formulir_baru(ujian: Dict[str, Any], pengaturan: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        'ujian_id': ujian['id'], 'aktif': False, 'jam_buka': None, 'jam_tutup': None, 'token': token_baru(),
        'template': template_bawaan(ujian.get('jenis'), pengaturan),
        'pola_ttd': {'tampil_di_cetak': True, 'tinggi_mm': TINGGI_TTD_BAWAAN},
        'diubah': {b: None for b in BAGIAN_DIUBAH}, 'diubah_pada': None, 'diubah_oleh_nama': None,
    }


def stempel(oleh: Dict[str, Any], waktu: datetime = None) -> Dict[str, Any]:
    return {'oleh': oleh.get('id'), 'oleh_nama': oleh.get('full_name') or oleh.get('username'),
            'pada': (waktu or sekarang_wib()).isoformat()}


def set_ubah(bagian: str, isi: Dict[str, Any], oleh: Dict[str, Any]) -> Dict[str, Any]:
    """$set untuk mengubah satu bagian formulir beserta stempel bagian & stempel umum."""
    s = stempel(oleh)
    return {**isi, f'diubah.{bagian}': s, 'diubah_pada': s['pada'], 'diubah_oleh_nama': s['oleh_nama']}


def ringkas_pengaturan(ujian: Dict[str, Any], f: Dict[str, Any], hari_ini: str, jam: str, basis_url: str = '') -> Dict[str, Any]:
    """Formulir untuk antarmuka (kontrak `Formulir` di frontend/src/lib/ujianFormulir.js)."""
    token = f.get('token')
    return {
        **ringkas_formulir(ujian, f, hari_ini, jam),
        'token': token,
        'tautan': {'daftar_hadir': f'{basis_url}/publik/ujian/{token}/daftar-hadir',
                   'berita_acara': f'{basis_url}/publik/ujian/{token}/berita-acara'} if token else None,
        'template': {**template_bawaan(ujian.get('jenis')), **(f.get('template') or {})},
        'pola_ttd': {'tampil_di_cetak': True, 'tinggi_mm': TINGGI_TTD_BAWAAN, **(f.get('pola_ttd') or {})},
        'diubah': {b: ({'oleh_nama': d.get('oleh_nama'), 'pada': d.get('pada')} if (d := (f.get('diubah') or {}).get(b)) else None)
                   for b in BAGIAN_DIUBAH},
        'diubah_pada': f.get('diubah_pada'),
        'diubah_oleh_nama': f.get('diubah_oleh_nama'),
    }


# ---- Isian ----
class AktivasiIn(BaseModel):
    aktif: bool
    jam_buka: Optional[str] = Field(None, pattern=POLA_JAM)
    jam_tutup: Optional[str] = Field(None, pattern=POLA_JAM)

    @field_validator('jam_buka', 'jam_tutup', mode='before')
    @classmethod
    def _kosong(cls, v):
        return v or None

    @model_validator(mode='after')
    def _aturan(self):
        if self.aktif and not (self.jam_buka and self.jam_tutup):
            raise ValueError('Jam buka dan jam tutup wajib diisi saat formulir aktif')
        if self.jam_buka and self.jam_tutup and self.jam_tutup <= self.jam_buka:
            raise ValueError('Jam tutup harus setelah jam buka')
        return self


class TemplateIn(BaseModel):
    nama_madrasah: str = Field(..., max_length=BATAS_TEMPLATE['nama_madrasah'])
    kop_madrasah: str = Field(..., max_length=BATAS_TEMPLATE['kop_madrasah'])
    alamat: str = Field(..., max_length=BATAS_TEMPLATE['alamat'])
    kota_ttd: str = Field(..., max_length=BATAS_TEMPLATE['kota_ttd'])
    singkatan_ujian: str = Field(..., max_length=BATAS_TEMPLATE['singkatan_ujian'])
    nama_kegiatan: str = Field(..., max_length=BATAS_TEMPLATE['nama_kegiatan'])
    catatan_kaki: str = Field(..., max_length=BATAS_TEMPLATE['catatan_kaki'])

    @field_validator('*')
    @classmethod
    def _wajib(cls, v):
        v = ' '.join((v or '').split())
        if not v:
            raise ValueError('Wajib diisi')
        return v


class PolaTtdIn(BaseModel):
    tampil_di_cetak: bool = True
    tinggi_mm: int = Field(TINGGI_TTD_BAWAAN, ge=TINGGI_TTD_MIN, le=TINGGI_TTD_MAKS)


class SesiIn(BaseModel):
    tanggal: str = Field(..., pattern=POLA_TANGGAL)
    sesi_ke: int = Field(1, ge=1, le=SESI_MAKS_PER_HARI)
    jam_mulai: str = Field(..., pattern=POLA_JAM)
    jam_selesai: str = Field(..., pattern=POLA_JAM)
    mapel: Dict[str, str] = Field(default_factory=dict)

    @field_validator('mapel', mode='before')
    @classmethod
    def _mapel(cls, v):
        hasil = {}
        for j, nama in (v or {}).items():
            if str(j) not in ('7', '8', '9'):
                raise ValueError('Jenjang mapel hanya 7, 8, atau 9')
            nama = ' '.join(str(nama or '').split())
            if len(nama) > 80:
                raise ValueError('Nama mata pelajaran maksimal 80 karakter')
            if nama:
                hasil[str(j)] = nama
        return hasil

    @model_validator(mode='after')
    def _jam(self):
        if self.jam_selesai <= self.jam_mulai:
            raise ValueError('Jam selesai sesi harus setelah jam mulai')
        return self


class JadwalIn(BaseModel):
    sesi: List[SesiIn] = Field(default_factory=list, max_length=60)


def galat_jadwal(sesi: List[SesiIn], mulai: str, selesai: str) -> List[str]:
    """Aturan lintas sesi: tanggal dalam masa ujian, (tanggal, sesi_ke) unik, jam sesi di hari yang sama tidak bertumpuk."""
    galat, kunci = [], {}
    for i, s in enumerate(sesi, start=1):
        if s.tanggal < mulai or s.tanggal > selesai:
            galat.append(f'Sesi {i}: tanggal {s.tanggal} di luar masa ujian ({mulai} s.d. {selesai})')
        k = (s.tanggal, s.sesi_ke)
        if k in kunci:
            galat.append(f'Sesi {i}: sesi ke-{s.sesi_ke} pada {s.tanggal} ganda dengan sesi {kunci[k]}')
        kunci.setdefault(k, i)
    per_hari: Dict[str, List[SesiIn]] = {}
    for s in sesi:
        per_hari.setdefault(s.tanggal, []).append(s)
    for tgl, daftar in per_hari.items():
        daftar = sorted(daftar, key=lambda x: x.jam_mulai)
        for a, b in zip(daftar, daftar[1:]):
            if b.jam_mulai < a.jam_selesai:
                galat.append(f'{tgl}: jam sesi ke-{a.sesi_ke} dan ke-{b.sesi_ke} bertumpuk')
    return galat


def dokumen_sesi(ujian_id: str, s: SesiIn) -> Dict[str, Any]:
    return {'id': str(uuid.uuid4()), 'ujian_id': ujian_id, **s.model_dump()}


def ringkas_sesi(d: Dict[str, Any]) -> Dict[str, Any]:
    return {k: d.get(k) for k in ('id', 'tanggal', 'sesi_ke', 'jam_mulai', 'jam_selesai', 'mapel')}


# ---- Layanan status & validasi waktu formulir (dipakai juga oleh tautan publik) ----
TOLERANSI_SESI_MENIT = 60  # daftar hadir sesi boleh diisi mulai 60 menit sebelum jam mulai sesi


def _menit(hhmm: str) -> int:
    j, m = (hhmm or '00:00').split(':')
    return int(j) * 60 + int(m)


def sesi_pada(jadwal: List[Dict[str, Any]], tanggal: str) -> List[Dict[str, Any]]:
    return sorted((s for s in jadwal if s.get('tanggal') == tanggal), key=lambda s: (s.get('sesi_ke') or 0, s.get('jam_mulai') or ''))


def sesi_aktif(jadwal: List[Dict[str, Any]], hari_ini: str, jam: str) -> Optional[Dict[str, Any]]:
    """Sesi yang sedang berjalan hari ini: jam sekarang di antara (jam mulai − toleransi) dan jam selesai. Bila tidak ada,
    sesi terakhir hari ini yang sudah dimulai; bila belum ada yang dimulai, sesi pertama hari ini."""
    hari = sesi_pada(jadwal, hari_ini)
    if not hari:
        return None
    m = _menit(jam)
    for s in hari:
        if _menit(s['jam_mulai']) - TOLERANSI_SESI_MENIT <= m <= _menit(s['jam_selesai']):
            return s
    mulai = [s for s in hari if _menit(s['jam_mulai']) <= m]
    return mulai[-1] if mulai else hari[0]
