"""Koleksi MongoDB, index, dan skema validasi modul PKG (Penilaian Kinerja Guru).

Koleksi (semua dokumen memakai `id` string UUID sebagai kunci, `_id` Mongo tidak dipakai di API):
    pkg_periode    {id, nama_periode, semester_id, tahun_pelajaran, semester, tanggal_buka, tanggal_tutup,
                    status ('draf' | 'berjalan' | 'ditutup'), dibuat_oleh, created_at, updated_at}
    pkg_sk         {id, nomor_sk, nomor_sk_kunci (huruf kecil, unik), tanggal_sk, tentang, periode_id,
                    ditetapkan_oleh, penilai_ids, dinilai_ids, snapshot_anggota {<user_id>: {nama, nip, mapel}},
                    is_active, created_at, updated_at}
    pkg_penugasan  {id, periode_id, sk_id, penilai_id, guru_dinilai_ids, jumlah_jatah,
                    supervisi_selesai, tanggal_supervisi, catatan_supervisi, disupervisi_oleh,
                    snapshot_guru {<guru_id>: {nama, nip, mapel}}, updated_at}
    pkg_instrumen  {id, versi_template, revisi, checksum (berkas sumber), cocok_resmi, sumber ('template' | 'unggah'),
                    nama_berkas, revisi_dari (id instrumen asal), alasan_perubahan, diimpor_oleh, diimpor_pada,
                    is_active, kompetensi [{kode, nama, sub [{kode, nama, bobot, indikator [{level, teks}]}]}],
                    created_at, updated_at}
                   Satu instrumen aktif; versi lama tetap tersimpan karena lembar penilaian merujuk instrumen_id-nya.
    pkg_penilaian  {id, sk_id, periode_id, penilai_id, guru_dinilai_id, instrumen_id (versi saat lembar dibuat),
                    isian {<kode_sub>: {centang [level], catatan_bukti, tanggapan}}, catatan_umum,
                    skor_per_indikator {<kode_sub>: skor 0–5}, progres (0–100), nilai_akhir, nilai_maks,
                    capaian_persen, level_capaian, predikat, status ('draf' | 'terkunci'),
                    snapshot_guru {nama, nip, mapel}, dikirim_pada, terkunci_pada, terkunci_oleh, created_at, updated_at}
                   Satu lembar per guru per SK; lembar terkunci tidak dapat diubah.
    Tugas penilaian = pkg_penugasan.guru_dinilai_ids milik penilai pada periode berjalan (lihat pkg_beranda).
    pkg_audit_log  lihat pkg_audit.py
    pkg_unduhan    {id, jenis, format, periode_id, nama_berkas, aktor_id, aktor_nama, timestamp}
    pkg_template   {jenis, nama_berkas, versi, checksum, ukuran, diperiksa_pada}  (hasil pemeriksaan startup)
    pkg_impor_pratinjau {token, pembuat_id, pratinjau, expire_at}  (pratinjau impor instrumen, kedaluwarsa 30 menit)
    pkg_rekap      {id (= penilaian_id), periode_id, sk_id, guru_id, penilai_id, nama, nip, mapel, penilai_nama,
                    instrumen_id, versi_template, revisi, nilai_akhir, nilai_maks, capaian_persen, level_capaian,
                    predikat, per_kompetensi {kode: subtotal}, catatan_umum, terkunci_pada, dihitung_pada}
                   Hasil akhir per lembar terkunci (materialisasi untuk rekap, statistik, & cetak); dibangun ulang
                   dari pkg_penilaian bila perlu (migrasi/pkg_rekap.bangun_ulang_rekap).

Integritas dijaga index: hanya satu periode 'berjalan', satu SK aktif per periode, nomor SK unik,
satu penugasan per penilai per periode, satu lembar penilaian per guru per SK.
"""
import logging
import re
from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

logger = logging.getLogger('matsandatama')

KOLEKSI_PERIODE = 'pkg_periode'
KOLEKSI_SK = 'pkg_sk'
KOLEKSI_PENUGASAN = 'pkg_penugasan'
KOLEKSI_INSTRUMEN = 'pkg_instrumen'
KOLEKSI_PENILAIAN = 'pkg_penilaian'
KOLEKSI_AUDIT = 'pkg_audit_log'
KOLEKSI_UNDUHAN = 'pkg_unduhan'
KOLEKSI_TEMPLATE = 'pkg_template'
KOLEKSI_PRATINJAU_IMPOR = 'pkg_impor_pratinjau'
KOLEKSI_REKAP = 'pkg_rekap'

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
    (KOLEKSI_INSTRUMEN, [('versi_template', 1), ('revisi', -1)], {'name': 'versi_revisi'}),
    (KOLEKSI_PENILAIAN, [('id', 1)], {'unique': True, 'name': 'id_unik'}),
    (KOLEKSI_PENILAIAN, [('sk_id', 1), ('guru_dinilai_id', 1)], {'unique': True, 'name': 'lembar_per_guru'}),
    (KOLEKSI_PENILAIAN, [('sk_id', 1), ('penilai_id', 1)], {'name': 'lembar_per_penilai'}),
    (KOLEKSI_PENILAIAN, [('periode_id', 1), ('status', 1)], {'name': 'periode_status'}),
    (KOLEKSI_PENILAIAN, [('instrumen_id', 1)], {'name': 'instrumen'}),
    (KOLEKSI_UNDUHAN, [('timestamp', -1)], {'name': 'waktu'}),
    (KOLEKSI_UNDUHAN, [('aktor_id', 1), ('timestamp', -1)], {'name': 'aktor_waktu'}),
    (KOLEKSI_TEMPLATE, [('jenis', 1)], {'unique': True, 'name': 'jenis_unik'}),
    (KOLEKSI_REKAP, [('id', 1)], {'unique': True, 'name': 'id_unik'}),
    (KOLEKSI_REKAP, [('periode_id', 1), ('capaian_persen', -1)], {'name': 'periode_capaian'}),
    (KOLEKSI_REKAP, [('guru_id', 1), ('periode_id', 1)], {'name': 'guru_periode'}),
    (KOLEKSI_REKAP, [('periode_id', 1), ('penilai_id', 1)], {'name': 'periode_penilai'}),
    (KOLEKSI_PRATINJAU_IMPOR, [('token', 1)], {'unique': True, 'name': 'token_unik'}),
    (KOLEKSI_PRATINJAU_IMPOR, [('expire_at', 1)], {'expireAfterSeconds': 0, 'name': 'ttl_expire_at'}),
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
    """Daftar id unik (urutan dipertahankan), tanpa string kosong; id berformat salah ditolak."""
    hasil = list(dict.fromkeys(i.strip() for i in (nilai or []) if isinstance(i, str) and i.strip()))
    salah = [i for i in hasil if not _RE_ID.match(i)]
    if salah:
        raise ValueError(f'id tidak valid: {salah[0][:40]}')
    return hasil


POLA_ID = r'^[A-Za-z0-9_-]{1,64}$'
_RE_ID = re.compile(POLA_ID)


class IsianPkg(BaseModel):
    """Dasar isian endpoint PKG: field tak dikenal ditolak (422) agar salah ketik tidak diam-diam diabaikan."""
    model_config = ConfigDict(extra='forbid')


class PeriodeRequest(IsianPkg):
    nama_periode: str = Field(..., max_length=120)
    semester_id: Optional[str] = Field(None, pattern=POLA_ID)
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


class StatusPeriodeRequest(IsianPkg):
    status: str

    @field_validator('status')
    @classmethod
    def _status(cls, v):
        if v not in ('berjalan', 'ditutup'):
            raise ValueError("status harus 'berjalan' atau 'ditutup'")
        return v


class SkRequest(IsianPkg):
    nomor_sk: str = Field(..., max_length=120)
    tanggal_sk: str
    tentang: str = Field('', max_length=300)
    periode_id: str = Field(..., pattern=POLA_ID)

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


class PenilaiSkRequest(IsianPkg):
    penilai_ids: List[str] = Field(default_factory=list, max_length=500)
    alasan_perubahan: str = Field('', max_length=300)  # wajib bila penilaian SK sudah berjalan

    @field_validator('penilai_ids')
    @classmethod
    def _unik(cls, v):
        return _ids(v)

    @field_validator('alasan_perubahan')
    @classmethod
    def _alasan(cls, v):
        return _teks(v)


class DinilaiSkRequest(IsianPkg):
    dinilai_ids: List[str] = Field(default_factory=list, max_length=500)
    alasan_perubahan: str = Field('', max_length=300)  # wajib bila penilaian SK sudah berjalan

    @field_validator('dinilai_ids')
    @classmethod
    def _unik(cls, v):
        return _ids(v)

    @field_validator('alasan_perubahan')
    @classmethod
    def _alasan(cls, v):
        return _teks(v)


class PenugasanRequest(IsianPkg):
    penugasan: Dict[str, str] = Field(default_factory=dict)  # {guru_id: penilai_id}
    jatah: Dict[str, int] = Field(default_factory=dict)       # {penilai_id: n}
    alasan_perubahan: str = Field('', max_length=300)          # wajib bila penilaian SK sudah berjalan

    @field_validator('penugasan')
    @classmethod
    def _penugasan(cls, v):
        if len(v) > 500:
            raise ValueError('terlalu banyak guru')
        hasil = {g.strip(): p.strip() for g, p in v.items() if g and g.strip() and p and p.strip()}
        if any(not _RE_ID.match(i) for pasangan in hasil.items() for i in pasangan):
            raise ValueError('id guru/penilai tidak valid')
        return hasil

    @field_validator('jatah')
    @classmethod
    def _jatah(cls, v):
        if any(not _RE_ID.match(k) for k in v):
            raise ValueError('id penilai tidak valid')
        for n in v.values():
            if n < 0 or n > 99:
                raise ValueError('jatah harus 0–99')
        return v

    @field_validator('alasan_perubahan')
    @classmethod
    def _alasan(cls, v):
        return _teks(v)


class SupervisiRequest(IsianPkg):
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


# ---------------------------------------------------------------- struktur instrumen (kompetensi -> sub -> indikator)

LEVEL_INDIKATOR = (1, 2, 3, 4, 5)
POLA_KODE_KOMPETENSI = r'^\d{1,2}$'
POLA_KODE_SUB = r'^\d{1,2}\.\d{1,2}$'
BATAS_TEKS_INSTRUMEN = 500
BATAS_NAMA_INSTRUMEN = 200


def _bobot(v) -> float:
    try:
        n = round(float(v), 2)
    except (TypeError, ValueError) as e:
        raise ValueError('bobot harus angka') from e
    if abs(float(v) - n) > 1e-9:
        raise ValueError('bobot maksimal dua angka desimal')
    if n < 0.01 or n > 100:
        raise ValueError('bobot antara 0,01 dan 100')
    return n


class IndikatorInstrumen(IsianPkg):
    level: int = Field(..., ge=1, le=5)
    teks: str = Field(..., max_length=BATAS_TEKS_INSTRUMEN)

    @field_validator('teks')
    @classmethod
    def _teks_wajib(cls, v):
        v = _teks(v)
        if not v:
            raise ValueError('teks indikator wajib diisi')
        return v


def _cek_indikator(indikator: List['IndikatorInstrumen']) -> List['IndikatorInstrumen']:
    if sorted(i.level for i in indikator) != list(LEVEL_INDIKATOR):
        raise ValueError('indikator harus tepat Level 1 sampai 5, masing-masing satu')
    return sorted(indikator, key=lambda i: i.level)


class SubKompetensiInstrumen(IsianPkg):
    kode: str = Field(..., pattern=POLA_KODE_SUB)
    nama: str = Field(..., max_length=BATAS_NAMA_INSTRUMEN)
    bobot: float = 1.0
    indikator: List[IndikatorInstrumen]

    @field_validator('nama')
    @classmethod
    def _nama(cls, v):
        v = _teks(v)
        if not v:
            raise ValueError('nama sub-kompetensi wajib diisi')
        return v

    @field_validator('bobot', mode='before')
    @classmethod
    def _cek_bobot(cls, v):
        return _bobot(v)

    @field_validator('indikator')
    @classmethod
    def _indikator(cls, v):
        return _cek_indikator(v)


class KompetensiInstrumen(IsianPkg):
    kode: str = Field(..., pattern=POLA_KODE_KOMPETENSI)
    nama: str = Field(..., max_length=BATAS_NAMA_INSTRUMEN)
    sub: List[SubKompetensiInstrumen] = Field(..., min_length=1, max_length=20)

    @field_validator('nama')
    @classmethod
    def _nama(cls, v):
        v = _teks(v)
        if not v:
            raise ValueError('nama kompetensi wajib diisi')
        return v

    @model_validator(mode='after')
    def _sub_sesuai(self):
        kode = [s.kode for s in self.sub]
        if len(set(kode)) != len(kode):
            raise ValueError(f'kode sub-kompetensi ganda pada kompetensi {self.kode}')
        if any(not k.startswith(f'{self.kode}.') for k in kode):
            raise ValueError(f'kode sub-kompetensi harus diawali "{self.kode}."')
        return self


class StrukturInstrumen(IsianPkg):
    """Struktur lengkap instrumen hasil impor; divalidasi sebelum disimpan sebagai instrumen baru."""
    kompetensi: List[KompetensiInstrumen] = Field(..., min_length=1, max_length=20)

    @model_validator(mode='after')
    def _kompetensi_unik(self):
        kode = [k.kode for k in self.kompetensi]
        if len(set(kode)) != len(kode):
            raise ValueError('kode kompetensi ganda')
        return self


class UbahSubInstrumenRequest(IsianPkg):
    """Ubah satu sub-kompetensi instrumen aktif (kepala madrasah); alasan wajib untuk jejak audit."""
    nama: str = Field(..., max_length=BATAS_NAMA_INSTRUMEN)
    bobot: float
    indikator: List[IndikatorInstrumen]
    alasan: str = Field(..., max_length=300)

    @field_validator('nama')
    @classmethod
    def _nama(cls, v):
        v = _teks(v)
        if not v:
            raise ValueError('nama sub-kompetensi wajib diisi')
        return v

    @field_validator('bobot', mode='before')
    @classmethod
    def _cek_bobot(cls, v):
        return _bobot(v)

    @field_validator('indikator')
    @classmethod
    def _indikator(cls, v):
        return _cek_indikator(v)

    @field_validator('alasan')
    @classmethod
    def _alasan_wajib(cls, v):
        v = _teks(v)
        if not v:
            raise ValueError('alasan perubahan wajib diisi')
        return v


class TerapkanImporRequest(IsianPkg):
    token: str = Field(..., pattern=POLA_ID)


class AktifkanInstrumenRequest(IsianPkg):
    alasan: str = Field(..., max_length=300)

    @field_validator('alasan')
    @classmethod
    def _alasan_wajib(cls, v):
        v = _teks(v)
        if not v:
            raise ValueError('alasan wajib diisi')
        return v


# ---------------------------------------------------------------- lembar penilaian

BATAS_TEKS_PENILAIAN = 500
STATUS_LEMBAR = ('belum', 'draf', 'terkunci')


class IsianSubPenilaian(IsianPkg):
    """Isian satu sub-kompetensi: level indikator yang dicentang, catatan bukti fisik, tanggapan penilai."""
    centang: List[int] = Field(default_factory=list, max_length=5)
    catatan_bukti: str = Field('', max_length=BATAS_TEKS_PENILAIAN)
    tanggapan: str = Field('', max_length=BATAS_TEKS_PENILAIAN)

    @field_validator('centang')
    @classmethod
    def _centang(cls, v):
        if any(lv not in LEVEL_INDIKATOR for lv in v):
            raise ValueError('level indikator harus 1–5')
        return sorted(set(v))

    @field_validator('catatan_bukti', 'tanggapan')
    @classmethod
    def _rapi(cls, v):
        return (v or '').strip()


class DrafPenilaianRequest(IsianPkg):
    """Simpan draf lembar penilaian (otomatis/berkala). Kode sub harus ada di instrumen lembar."""
    guru_id: str = Field(..., pattern=POLA_ID)
    isian: Dict[str, IsianSubPenilaian] = Field(default_factory=dict)
    catatan_umum: str = Field('', max_length=BATAS_TEKS_PENILAIAN)

    @field_validator('isian')
    @classmethod
    def _kode_sub(cls, v):
        if len(v) > 60:
            raise ValueError('terlalu banyak sub-kompetensi')
        salah = [k for k in v if not re.match(POLA_KODE_SUB, k)]
        if salah:
            raise ValueError(f'kode sub-kompetensi tidak valid: {salah[0][:20]}')
        return v

    @field_validator('catatan_umum')
    @classmethod
    def _catatan(cls, v):
        return (v or '').strip()


class KirimPenilaianRequest(DrafPenilaianRequest):
    """Kirim & kunci lembar: isian terakhir ikut dikirim dan divalidasi kelengkapannya di server."""
