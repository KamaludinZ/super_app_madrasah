"""Penilaian guru mapel (Input Nilai): Ulangan, Sumatif, dan UTS per kelas–mapel–semester.

Setiap jenis berdiri sendiri (tidak digabung menjadi satu nilai akhir rapor):
- Ulangan & Sumatif: guru menambah kolom sendiri (Ulangan ke-n / TP–Lingkup Materi ke-n) beserta ringkasan materi dan
  Nilai Batas Ketercapaian (KKTP). Siswa melihat RERATA nilai akhir kolom-kolom jenis itu.
- UTS: satu kolom per kelas–mapel–semester. Siswa melihat nilai akhirnya.
- UAS: dikelola modul Ujian Madrasah (nilai_ujian -> grade_entries.nilai_uas), bukan modul ini.

Mode kolom (per kelas–mapel–tahun ajaran–semester): 'nilai' = satu kolom nilai, atau 'pk' = kolom Pengetahuan &
Keterampilan dengan nilai akhir = rerata keduanya. Mode hanya dapat diganti selama belum ada nilai yang diisi.

Ketercapaian (predikat) tiap nilai dihitung dari KKTP kolom: rentang KKTP–100 dibagi tiga sama besar.
  < KKTP Belum Tercapai · KKTP… Cukup · … Baik · … Sangat Baik (mis. KKTP 65: <65, 65–76, 77–88, 89–100).

Koleksi:
  penilaian_kolom  { id, jenis: 'ulangan'|'sumatif'|'uts', class_id, subject_id, academic_year_id, semester, ke,
                     ringkasan, kktp, nilai: { student_id: {nilai} | {p, k} }, dibuat_oleh, dibuat_oleh_nama, dibuat_pada,
                     diubah_oleh, diubah_oleh_nama, diubah_pada }
  penilaian_mode   { class_id, subject_id, academic_year_id, semester, mode, diubah_oleh, diubah_oleh_nama, diubah_pada }
Sinkron ke grade_entries (kunci student_id + class_id + subject_id + academic_year_id + semester):
  nilai_harian (rerata ulangan), nilai_sumatif (rerata sumatif), nilai_uts, penilaian_diperbarui.
"""
import math
from typing import Any, Dict, Iterable, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

KOLEKSI_KOLOM = 'penilaian_kolom'
KOLEKSI_MODE = 'penilaian_mode'
KOLEKSI_RAPOR = 'grade_entries'
JENIS_KOLOM = ('ulangan', 'sumatif', 'uts')
LABEL_JENIS = {'ulangan': 'Ulangan', 'sumatif': 'Sumatif', 'uts': 'UTS'}
FIELD_RAPOR = {'ulangan': 'nilai_harian', 'sumatif': 'nilai_sumatif', 'uts': 'nilai_uts'}
MODE_KOLOM = ('nilai', 'pk')
MODE_BAWAAN = 'nilai'
KKTP_BAWAAN = 75
KETERCAPAIAN = {'belum': 'Belum Tercapai', 'cukup': 'Cukup', 'baik': 'Baik', 'sangat_baik': 'Sangat Baik'}


# ---- Ketercapaian ----
def batas_interval(kktp: float):
    """(batas Baik, batas Sangat Baik) — rentang KKTP–100 dibagi tiga, dibulatkan ke atas."""
    k = float(kktp)
    lebar = (100 - k) / 3
    return math.ceil(round(k + lebar, 6)), math.ceil(round(k + 2 * lebar, 6))


def interval_ketercapaian(kktp: Optional[float]) -> Optional[Dict[str, Optional[List[float]]]]:
    """{belum, cukup, baik, sangat_baik: [min, maks] | None} untuk ditampilkan (rentang kosong = None)."""
    if kktp is None:
        return None
    k = float(kktp)
    b2, b3 = batas_interval(k)
    kk = math.ceil(k)

    def rentang(a, b):
        return [a, b] if a <= b else None
    return {'belum': rentang(0, kk - 1), 'cukup': rentang(kk, b2 - 1), 'baik': rentang(b2, b3 - 1), 'sangat_baik': rentang(b3, 100)}


def ketercapaian(nilai: Optional[float], kktp: Optional[float]) -> Optional[str]:
    """'belum' | 'cukup' | 'baik' | 'sangat_baik' | None (nilai atau KKTP kosong)."""
    if nilai is None or kktp is None:
        return None
    k = float(kktp)
    if nilai < k:
        return 'belum'
    b2, b3 = batas_interval(k)
    if nilai < b2:
        return 'cukup'
    if nilai < b3:
        return 'baik'
    return 'sangat_baik'


# ---- Nilai ----
def bulat(v: Optional[float]) -> Optional[float]:
    return None if v is None else round(float(v) + 1e-9, 2)


def nilai_akhir(isian: Optional[Dict[str, Any]], mode: str) -> Optional[float]:
    """Nilai akhir satu isian: mode 'nilai' -> nilai; mode 'pk' -> rerata pengetahuan & keterampilan yang terisi."""
    isian = isian or {}
    if mode == 'pk':
        ada = [float(isian[x]) for x in ('p', 'k') if isian.get(x) is not None]
        return bulat(sum(ada) / len(ada)) if ada else None
    return bulat(isian.get('nilai')) if isian.get('nilai') is not None else None


def rerata(nilai: Iterable[Optional[float]]) -> Optional[float]:
    ada = [float(v) for v in nilai if v is not None]
    return bulat(sum(ada) / len(ada)) if ada else None


def isian_bersih(isian: Dict[str, Any], mode: str) -> Optional[Dict[str, float]]:
    """Ambil hanya bidang mode aktif; None bila kosong semua (siswa belum dinilai)."""
    bidang = ('p', 'k') if mode == 'pk' else ('nilai',)
    hasil = {b: float(isian[b]) for b in bidang if isian.get(b) is not None}
    return hasil or None


def kolom_berisi(kolom: Dict[str, Any]) -> bool:
    return any(isian for isian in (kolom.get('nilai') or {}).values())


def ringkas_kolom(kolom: Dict[str, Any], mode: str) -> Dict[str, Any]:
    """Kolom untuk klien: nilai per siswa dilengkapi nilai akhir & ketercapaian, serta interval KKTP."""
    kktp = kolom.get('kktp')
    nilai = {}
    for sid, isian in (kolom.get('nilai') or {}).items():
        if not isian:
            continue
        akhir = nilai_akhir(isian, mode)
        nilai[sid] = {**isian, 'akhir': akhir, 'ketercapaian': ketercapaian(akhir, kktp)}
    return {
        **{k: kolom.get(k) for k in ('id', 'jenis', 'ke', 'ringkasan', 'kktp', 'dibuat_oleh_nama', 'dibuat_pada', 'diubah_oleh_nama', 'diubah_pada')},
        'interval': interval_ketercapaian(kktp), 'nilai': nilai,
        'rerata_kelas': rerata(v['akhir'] for v in nilai.values()),
    }


def rekap_siswa(kolom: List[Dict[str, Any]], mode: str, siswa_ids: Iterable[str]) -> Dict[str, Dict[str, Optional[float]]]:
    """{student_id: {ulangan, sumatif, uts}} — ulangan & sumatif = rerata nilai akhir semua kolomnya, uts = nilai akhir."""
    hasil = {}
    for sid in siswa_ids:
        per_jenis = {j: [nilai_akhir((k.get('nilai') or {}).get(sid), mode) for k in kolom if k.get('jenis') == j] for j in JENIS_KOLOM}
        hasil[sid] = {j: rerata(v) for j, v in per_jenis.items()}
    return hasil


# ---- Masukan ----
class IsianNilai(BaseModel):
    nilai: Optional[float] = Field(None, ge=0, le=100)
    p: Optional[float] = Field(None, ge=0, le=100)
    k: Optional[float] = Field(None, ge=0, le=100)


class KolomIn(BaseModel):
    semester: str = Field(..., min_length=1, max_length=20)
    jenis: Literal['ulangan', 'sumatif', 'uts']
    ke: int = Field(1, ge=1, le=99)
    ringkasan: str = Field('', max_length=1000)
    kktp: float = Field(KKTP_BAWAAN, ge=0, le=100)
    nilai: Dict[str, IsianNilai] = Field(default_factory=dict)

    @field_validator('ringkasan')
    @classmethod
    def _rapikan(cls, v):
        return ' '.join((v or '').split())

    @field_validator('nilai')
    @classmethod
    def _batas(cls, v):
        if len(v) > 200:
            raise ValueError('Terlalu banyak siswa dalam satu kolom')
        return v


class KolomUbahIn(BaseModel):
    ke: Optional[int] = Field(None, ge=1, le=99)
    ringkasan: Optional[str] = Field(None, max_length=1000)
    kktp: Optional[float] = Field(None, ge=0, le=100)
    nilai: Optional[Dict[str, IsianNilai]] = None

    @field_validator('ringkasan')
    @classmethod
    def _rapikan(cls, v):
        return None if v is None else ' '.join(v.split())


class ModeIn(BaseModel):
    semester: str = Field(..., min_length=1, max_length=20)
    mode: Literal['nilai', 'pk']
