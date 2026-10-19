"""Koleksi MongoDB, index, dan skema validasi modul PKG (Penilaian Kinerja Guru).

Koleksi (semua dokumen memakai `id` string UUID sebagai kunci, `_id` Mongo tidak dipakai di API):
    pkg_periode    {id, nama_periode, semester_id, tahun_pelajaran, semester, tanggal_buka, tanggal_tutup,
                    status ('draf' | 'berjalan' | 'ditutup'), dibuat_oleh, created_at, updated_at}
    pkg_sk         {id, nomor_sk, nomor_sk_kunci (huruf kecil, unik), tanggal_sk, tentang, periode_id,
                    ditetapkan_oleh, penilai_ids, dinilai_ids, snapshot_anggota {<user_id>: {nama, nip, mapel}},
                    jatah {<penilai_id>: n}, is_active, created_at, updated_at}
    pkg_penugasan  {id, periode_id, sk_id, penilai_id, guru_dinilai_ids, jumlah_jatah,
                    supervisi_selesai, tanggal_supervisi, catatan_supervisi, disupervisi_oleh,
                    snapshot_guru {<guru_id>: {nama, nip, mapel}}, updated_at}
    pkg_instrumen  {id, versi_template, checksum, kompetensi [...], is_active, created_at, updated_at}
    pkg_penilaian  {id, sk_id, periode_id, penilai_id, guru_dinilai_id, instrumen_id, skor_per_indikator,
                    progres (0–100), nilai_akhir, predikat, status ('draf' | 'terkunci'), created_at, updated_at}
    pkg_audit_log  lihat pkg_audit.py
    pkg_unduhan    {id, jenis, format, periode_id, nama_berkas, aktor_id, aktor_nama, timestamp}
    pkg_template   {jenis, nama_berkas, versi, checksum, ukuran, diperiksa_pada}  (hasil pemeriksaan startup)

Integritas dijaga index: hanya satu periode 'berjalan', satu SK aktif per periode, nomor SK unik,
satu penugasan per penilai per periode, satu lembar penilaian per guru per SK.
"""
import logging
import re
from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

logger = logging.getLogger('matsandatama')

KOLEKSI_PERIODE = 'pkg_periode'
KOLEKSI_SK = 'pkg_sk'
KOLEKSI_PENUGASAN = 'pkg_penugasan'
KOLEKSI_INSTRUMEN = 'pkg_instrumen'
KOLEKSI_PENILAIAN = 'pkg_penilaian'
KOLEKSI_AUDIT = 'pkg_audit_log'
KOLEKSI_UNDUHAN = 'pkg_unduhan'
KOLEKSI_TEMPLATE = 'pkg_template'

STATUS_PERIODE = ('draf', 'berjalan', 'ditutup')
STATUS_PENILAIAN = ('draf', 'terkunci')
# Transisi status periode yang diizinkan: draf -> berjalan -> ditutup.
TRANSISI_PERIODE = {'draf': 'berjalan', 'berjalan': 'ditutup'}

INDEX_PKG = [
    (KOLEKSI_PERIODE, [('id', 1)], {'unique': True, 'name': 'id_unik'}),
    (KOLEKSI_PERIODE, [('status', 1)], {'unique': True, 'name': 'satu_periode_berjalan',
                                        'partialFilterExpression': {'status': 'berjalan'}}),
    (KOLEKSI_SK, [('id', 1)], {'unique': True, 'name': 'id_unik'}),
    (KOLEKSI_SK, [('nomor_sk_kunci', 1)], {'unique': True, 'name': 'nomor_sk_unik'}),
    (KOLEKSI_SK, [('periode_id', 1)], {'unique': True, 'name': 'satu_sk_aktif_per_periode',
                                       'partialFilterExpression': {'is_active': True}}),
    (KOLEKSI_PENUGASAN, [('id', 1)], {'unique': True, 'name': 'id_unik'}),
    (KOLEKSI_PENUGASAN, [('periode_id', 1), ('penilai_id', 1)], {'unique': True, 'name': 'penilai_per_periode'}),
    (KOLEKSI_INSTRUMEN, [('id', 1)], {'unique': True, 'name': 'id_unik'}),
    (KOLEKSI_INSTRUMEN, [('is_active', 1)], {'unique': True, 'name': 'satu_instrumen_aktif',
                                             'partialFilterExpression': {'is_active': True}}),
    (KOLEKSI_PENILAIAN, [('id', 1)], {'unique': True, 'name': 'id_unik'}),
    (KOLEKSI_PENILAIAN, [('sk_id', 1), ('guru_dinilai_id', 1)], {'unique': True, 'name': 'lembar_per_guru'}),
    (KOLEKSI_PENILAIAN, [('sk_id', 1), ('penilai_id', 1)], {'name': 'lembar_per_penilai'}),
    (KOLEKSI_UNDUHAN, [('timestamp', -1)], {'name': 'waktu'}),
    (KOLEKSI_UNDUHAN, [('aktor_id', 1), ('timestamp', -1)], {'name': 'aktor_waktu'}),
    (KOLEKSI_TEMPLATE, [('jenis', 1)], {'unique': True, 'name': 'jenis_unik'}),
]


async def ensure_pkg_indexes(database) -> List[str]:
    """Buat index koleksi PKG (idempoten). Mengembalikan daftar galat; kegagalan tidak menghentikan server."""
    gagal = []
    for koleksi, keys, kwargs in INDEX_PKG:
        try:
            await database[koleksi].create_index(keys, **kwargs)
        except Exception as e:  # noqa: BLE001
            gagal.append(f"{koleksi} {kwargs.get('name')}: {e}")
            logger.error(f"[pkg] Gagal membuat index {koleksi}.{kwargs.get('name')}: {e}")
    return gagal


# ---------------------------------------------------------------- validasi isian endpoint

POLA_TANGGAL = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def _tanggal(nilai: Optional[str], wajib: bool = True) -> Optional[str]:
    if nilai in (None, ''):
        if wajib:
            raise ValueError('wajib diisi')
        return None
    nilai = str(nilai).strip()
    if not POLA_TANGGAL.match(nilai):
        raise ValueError('format tanggal harus YYYY-MM-DD')
    try:
        date.fromisoformat(nilai)
    except ValueError as e:
        raise ValueError('tanggal tidak valid') from e
    return nilai


def _teks(nilai: Optional[str]) -> str:
    return re.sub(r'\s+', ' ', (nilai or '')).strip()


def _ids(nilai: List[str]) -> List[str]:
    """Daftar id unik (urutan dipertahankan), tanpa string kosong."""
    return list(dict.fromkeys(i.strip() for i in (nilai or []) if isinstance(i, str) and i.strip()))


class PeriodeRequest(BaseModel):
    nama_periode: str = Field(..., max_length=120)
    semester_id: Optional[str] = Field(None, max_length=64)
    tahun_pelajaran: str = Field(..., max_length=20)
    semester: str = Field(..., max_length=40)
    tanggal_buka: str
    tanggal_tutup: str

    @field_validator('nama_periode', 'tahun_pelajaran', 'semester')
    @classmethod
    def _wajib_teks(cls, v):
        v = _teks(v)
        if not v:
            raise ValueError('wajib diisi')
        return v

    @field_validator('tanggal_buka', 'tanggal_tutup')
    @classmethod
    def _cek_tanggal(cls, v):
        return _tanggal(v)

    @model_validator(mode='after')
    def _urutan_tanggal(self):
        if self.tanggal_tutup < self.tanggal_buka:
            raise ValueError('tanggal tutup tidak boleh sebelum tanggal buka')
        return self


class StatusPeriodeRequest(BaseModel):
    status: str

    @field_validator('status')
    @classmethod
    def _status(cls, v):
        if v not in ('berjalan', 'ditutup'):
            raise ValueError("status harus 'berjalan' atau 'ditutup'")
        return v


class SkRequest(BaseModel):
    nomor_sk: str = Field(..., max_length=120)
    tanggal_sk: str
    tentang: str = Field('', max_length=300)
    periode_id: str = Field(..., min_length=1, max_length=64)

    @field_validator('nomor_sk')
    @classmethod
    def _nomor(cls, v):
        v = _teks(v)
        if not v:
            raise ValueError('wajib diisi')
        return v

    @field_validator('tentang')
    @classmethod
    def _tentang(cls, v):
        return _teks(v)

    @field_validator('tanggal_sk')
    @classmethod
    def _tgl(cls, v):
        return _tanggal(v)


class PenilaiSkRequest(BaseModel):
    penilai_ids: List[str] = Field(default_factory=list, max_length=500)

    @field_validator('penilai_ids')
    @classmethod
    def _unik(cls, v):
        return _ids(v)


class DinilaiSkRequest(BaseModel):
    dinilai_ids: List[str] = Field(default_factory=list, max_length=500)

    @field_validator('dinilai_ids')
    @classmethod
    def _unik(cls, v):
        return _ids(v)


class PenugasanRequest(BaseModel):
    penugasan: Dict[str, str] = Field(default_factory=dict)  # {guru_id: penilai_id}
    jatah: Dict[str, int] = Field(default_factory=dict)       # {penilai_id: n}

    @field_validator('penugasan')
    @classmethod
    def _penugasan(cls, v):
        if len(v) > 500:
            raise ValueError('terlalu banyak guru')
        return {g.strip(): p.strip() for g, p in v.items() if g and g.strip() and p and p.strip()}

    @field_validator('jatah')
    @classmethod
    def _jatah(cls, v):
        for n in v.values():
            if n < 0 or n > 99:
                raise ValueError('jatah harus 0–99')
        return v


class SupervisiRequest(BaseModel):
    tanggal_supervisi: str
    catatan: str = Field('', max_length=500)

    @field_validator('tanggal_supervisi')
    @classmethod
    def _tgl(cls, v):
        return _tanggal(v)

    @field_validator('catatan')
    @classmethod
    def _catatan(cls, v):
        return _teks(v)
