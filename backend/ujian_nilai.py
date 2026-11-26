"""Ujian Madrasah — Nilai UAS: nilai per siswa per mapel per ujian, log impor (monitoring), dan masa ujian/remidi.

Dokumen `nilai_ujian` (satu per ujian-mapel-siswa):
    id (WAJIB ada: index unik `id` menolak lebih dari satu dokumen tanpa id — selalu simpan lewat simpan_dokumen_nilai), ujian_id, mapel_id, kelas_id, kelas, jenjang, sheet, siswa_id, nilai (0–100 | None), sumber
    ('impor' | 'input_panitia' | 'input_guru'), impor_log_id, diedit_oleh, diedit_oleh_nama, waktu
    Unik: (ujian_id, mapel_id, siswa_id). Disinkronkan ke grade_entries.nilai_uas (kolom UAS rapor & akun guru mapel).

Dokumen `nilai_impor_log` (monitoring impor):
    id, ujian_id, mapel_id, mapel_nama, jenjang, berkas, ukuran (byte), status ('proses'|'selesai'|'gagal'), pesan, diproses, total_baris,
    berhasil, gagal, diisi_nol, per_sheet [{ sheet, kelas, total, diproses, berhasil, gagal, diisi_nol, dilewati, rata }], sheet_aktif,
    tahap (TAHAP_IMPOR), diperbarui (detak aktivitas terakhir job; dasar deteksi macet), galat_teknis (jenis & pesan exception
    tersaring, bila job gagal karena kesalahan server), gagal_di { tahap, sheet, baris, nama } (posisi saat job berhenti),
    kelas_tanpa_sheet, galat [{ sheet, baris, nama, siswa_id, nilai, jenis, pesan }] (maks GALAT_MAKS_DISIMPAN), galat_total,
    ulang_dari (log asal bila unggah ulang baris gagal), dilewati, siswa_berhasil [id siswa] (internal, tidak dikirim ke klien),
    diunggah_oleh, diunggah_oleh_nama, diunggah_sebagai ('Ketua Panitia' | 'Sekretaris Panitia' | 'Admin'), waktu, selesai_pada

Dokumen `nilai_masa` (satu per ujian): ujian_id (unik), ujian { aktif, mulai, selesai }, remidi { aktif, mulai, selesai },
    diubah { oleh, oleh_nama, pada }

Dokumen `nilai_ujian_riwayat` (jejak setiap perubahan nilai satu siswa; tidak pernah diubah/dihapus):
    id, ujian_id, mapel_id, siswa_id, kelas_id, nilai_lama, nilai_baru, sumber, impor_log_id, oleh, oleh_nama, waktu

Sinkron ke rapor — `grade_entries` (milik modul E-Rapor, kunci: student_id + subject_id + academic_year_id + semester)
mendapat kolom tambahan yang HANYA ditulis modul ujian:
    nilai_uas, nilai_uas_ujian_id, nilai_uas_sumber, nilai_uas_diperbarui
Kolom nilai pengetahuan/keterampilan/akhir/predikat milik guru tidak disentuh. `semester` grade_entries = kode semester
ujian ('ganjil' | 'genap'), lihat kode_semester_rapor().
"""
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator

from ujian import POLA_TANGGAL, sekarang_wib

KOLEKSI_NILAI = 'nilai_ujian'
KOLEKSI_IMPOR_LOG = 'nilai_impor_log'
KOLEKSI_MASA = 'nilai_masa'
KOLEKSI_RIWAYAT = 'nilai_ujian_riwayat'
KOLEKSI_RAPOR = 'grade_entries'
FIELD_RAPOR_UAS = ('nilai_uas', 'nilai_uas_ujian_id', 'nilai_uas_sumber', 'nilai_uas_diperbarui')
STATUS_IMPOR = ('proses', 'selesai', 'gagal')
SUMBER_NILAI = ('impor', 'input_panitia', 'input_guru')
LABEL_SUMBER = {'impor': 'Impor panitia', 'input_panitia': 'Input panitia', 'input_guru': 'Input guru mapel'}
GALAT_MAKS_DISIMPAN = 2000
# Tahap job impor (urut): diterima -> membaca berkas -> memeriksa template & mencocokkan sheet -> menyimpan nilai -> selesai.
TAHAP_IMPOR = ('diterima', 'membaca', 'memeriksa', 'menyimpan', 'selesai')
LABEL_TAHAP = {'diterima': 'Berkas diterima', 'membaca': 'Membaca berkas Excel', 'memeriksa': 'Memeriksa template & sheet kelas',
               'menyimpan': 'Menyimpan nilai', 'selesai': 'Selesai'}

INDEX_NILAI = [
    (KOLEKSI_NILAI, [('id', 1)], {'unique': True}),
    (KOLEKSI_NILAI, [('ujian_id', 1), ('mapel_id', 1), ('siswa_id', 1)], {'unique': True, 'name': 'nilai_unik_siswa'}),
    (KOLEKSI_NILAI, [('ujian_id', 1), ('mapel_id', 1), ('kelas_id', 1)], {}),
    (KOLEKSI_IMPOR_LOG, [('id', 1)], {'unique': True}),
    (KOLEKSI_IMPOR_LOG, [('ujian_id', 1), ('waktu', -1)], {}),
    (KOLEKSI_IMPOR_LOG, [('status', 1)], {}),
    (KOLEKSI_MASA, [('ujian_id', 1)], {'unique': True}),
    (KOLEKSI_NILAI, [('siswa_id', 1)], {}),
    (KOLEKSI_RIWAYAT, [('id', 1)], {'unique': True}),
    (KOLEKSI_RIWAYAT, [('ujian_id', 1), ('mapel_id', 1), ('siswa_id', 1), ('waktu', -1)], {}),
    # Pencarian baris rapor satu siswa-mapel-semester saat sinkron nilai UAS (tidak unik: data lama bisa ganda per kelas).
    (KOLEKSI_RAPOR, [('student_id', 1), ('subject_id', 1), ('academic_year_id', 1), ('semester', 1)], {'name': 'rapor_siswa_mapel_semester'}),
]


async def pastikan_index_nilai(db) -> None:
    for koleksi, keys, opsi in INDEX_NILAI:
        await db[koleksi].create_index(keys, **opsi)


def peran_pengunggah(akses: Dict[str, Any]) -> str:
    """Label kapasitas pengunggah pada ujian itu (dari routers.ujian.akses_ujian): jabatan panitia didahulukan."""
    from ujian import LABEL_JABATAN
    if akses.get('jabatan'):
        return LABEL_JABATAN.get(akses['jabatan'], akses['jabatan'])
    return 'Admin' if akses.get('pengelola') else 'Pimpinan'


def dokumen_log_impor(ujian_id: str, mapel: Dict[str, Any], jenjang: int, berkas: str, oleh: Dict[str, Any],
                      waktu: datetime = None, sebagai: Optional[str] = None, ukuran: int = 0,
                      ulang_dari: Optional[str] = None) -> Dict[str, Any]:
    return {
        'id': str(uuid.uuid4()), 'ujian_id': ujian_id, 'mapel_id': mapel['id'], 'mapel_nama': mapel.get('name') or mapel.get('nama'),
        'jenjang': jenjang, 'berkas': berkas, 'ukuran': ukuran, 'status': 'proses', 'pesan': '', 'diproses': 0, 'total_baris': 0,
        'berhasil': 0, 'gagal': 0, 'per_sheet': [], 'galat': [], 'galat_total': 0, 'sheet_aktif': None, 'kelas_tanpa_sheet': [],
        'diunggah_oleh': oleh.get('id'), 'diunggah_oleh_nama': oleh.get('full_name') or oleh.get('username'),
        'diunggah_sebagai': sebagai, 'waktu': (waktu or sekarang_wib()).isoformat(), 'selesai_pada': None,
        'ulang_dari': ulang_dari, 'dilewati': 0, 'berubah': 0, 'diisi_nol': 0, 'siswa_berhasil': [],
        'tahap': 'diterima', 'diperbarui': (waktu or sekarang_wib()).isoformat(), 'galat_teknis': None, 'gagal_di': None,
    }


FIELD_LOG = ('id', 'mapel_id', 'mapel_nama', 'jenjang', 'berkas', 'ukuran', 'status', 'pesan', 'diproses', 'total_baris', 'berhasil',
             'gagal', 'per_sheet', 'sheet_aktif', 'kelas_tanpa_sheet', 'galat_total', 'diunggah_oleh', 'diunggah_oleh_nama',
             'diunggah_sebagai', 'waktu', 'selesai_pada', 'ulang_dari', 'dilewati', 'berubah', 'diisi_nol', 'tahap', 'diperbarui',
             'galat_teknis', 'gagal_di')


def durasi_detik(doc: Dict[str, Any]) -> Optional[int]:
    if not (doc.get('waktu') and doc.get('selesai_pada')):
        return None
    try:
        return max(0, round((datetime.fromisoformat(doc['selesai_pada']) - datetime.fromisoformat(doc['waktu'])).total_seconds()))
    except (TypeError, ValueError):
        return None


def ringkas_log(doc: Dict[str, Any], dengan_galat: bool = False) -> Dict[str, Any]:
    hasil = {k: doc.get(k) for k in FIELD_LOG}
    hasil['durasi_detik'] = durasi_detik(doc)
    if dengan_galat:
        hasil['galat'] = doc.get('galat') or []
    return hasil


# ---- Masa ujian & remidi ----
class MasaIn(BaseModel):
    aktif: bool = False
    mulai: Optional[str] = Field(None, pattern=POLA_TANGGAL)
    selesai: Optional[str] = Field(None, pattern=POLA_TANGGAL)

    @model_validator(mode='after')
    def _aturan(self):
        if self.aktif and not (self.mulai and self.selesai):
            raise ValueError('Tanggal mulai & selesai wajib diisi saat masa dibuka')
        if self.mulai and self.selesai and self.selesai < self.mulai:
            raise ValueError('Tanggal selesai tidak boleh sebelum tanggal mulai')
        return self


class MasaNilaiIn(BaseModel):
    ujian: MasaIn
    remidi: MasaIn


def masa_terbuka(doc: Optional[Dict[str, Any]], hari_ini: str) -> Optional[str]:
    """'ujian' | 'remidi' | None — masa yang sedang terbuka menurut tanggal WIB."""
    for jenis in ('ujian', 'remidi'):
        m = (doc or {}).get(jenis) or {}
        if m.get('aktif') and m.get('mulai') and m.get('selesai') and m['mulai'] <= hari_ini <= m['selesai']:
            return jenis
    return None


def galat_nilai(nilai: Any) -> Optional[str]:
    """None bila sah (angka 0–100 atau kosong)."""
    if nilai is None or (isinstance(nilai, str) and not nilai.strip()):
        return None
    try:
        n = float(str(nilai).replace(',', '.'))
    except (TypeError, ValueError):
        return f'Nilai bukan angka ("{nilai}")'
    if not 0 <= n <= 100:
        return f'Nilai di luar rentang 0–100 ({nilai})'
    return None


def ke_angka(nilai: Any) -> Optional[float]:
    if nilai is None or (isinstance(nilai, str) and not nilai.strip()):
        return None
    n = float(str(nilai).replace(',', '.'))
    return int(n) if n.is_integer() else round(n, 2)


def dokumen_nilai(ujian_id: str, mapel_id: str, siswa: Dict[str, Any], nilai: Optional[float], sumber: str, oleh: Dict[str, Any],
                  sheet: Optional[str] = None, impor_log_id: Optional[str] = None) -> Dict[str, Any]:
    return {
        'ujian_id': ujian_id, 'mapel_id': mapel_id, 'siswa_id': siswa['id'], 'kelas_id': siswa.get('kelas_id'),
        'kelas': siswa.get('kelas'), 'jenjang': siswa.get('jenjang'), 'sheet': sheet, 'nilai': nilai, 'sumber': sumber,
        'impor_log_id': impor_log_id,
        'diedit_oleh': oleh.get('id'), 'diedit_oleh_nama': oleh.get('full_name') or oleh.get('username'),
        'waktu': sekarang_wib().isoformat(),
    }


async def simpan_dokumen_nilai(db, dok: Dict[str, Any]) -> None:
    """Upsert satu nilai_ujian (kunci ujian-mapel-siswa). `id` diberi saat dokumen pertama kali dibuat: tanpa itu index
    unik `id` menganggap setiap dokumen baru ber-id null sehingga siswa baru KEDUA ditolak (E11000 duplicate key)."""
    await db[KOLEKSI_NILAI].update_one(
        {'ujian_id': dok['ujian_id'], 'mapel_id': dok['mapel_id'], 'siswa_id': dok['siswa_id']},
        {'$set': dok, '$setOnInsert': {'id': str(uuid.uuid4())}}, upsert=True)


_POLA_RAHASIA = re.compile(r'\b[a-z][a-z0-9+.-]*://\S+', re.IGNORECASE)  # URL koneksi (mongodb+srv://user:pass@host...)


def galat_teknis(e: BaseException, maks: int = 300) -> str:
    """Ringkasan exception yang aman ditampilkan ke panitia: nama jenis + pesan, tanpa URL/kredensial koneksi."""
    pesan = _POLA_RAHASIA.sub('[disembunyikan]', ' '.join(str(e).split()))
    return f'{type(e).__name__}: {pesan}'[:maks] if pesan else type(e).__name__


def penjelasan_galat(e: BaseException) -> str:
    """Penjelasan bahasa awam untuk kesalahan server yang umum saat impor/simpan nilai."""
    from pymongo.errors import AutoReconnect, DuplicateKeyError, NetworkTimeout, ServerSelectionTimeoutError
    if isinstance(e, DuplicateKeyError):
        return 'Database menolak data ganda (index unik)'
    if isinstance(e, (ServerSelectionTimeoutError, NetworkTimeout, AutoReconnect)):
        return 'Koneksi ke database terputus atau terlalu lambat'
    if isinstance(e, MemoryError):
        return 'Memori server tidak cukup untuk memproses berkas'
    return 'Kesalahan tak terduga di server'


def rekap_kelas(nilai: List[Dict[str, Any]], total: int) -> Dict[str, Any]:
    terisi = [n['nilai'] for n in nilai if n.get('nilai') is not None]
    return {'total': total, 'terisi': len(terisi), 'rata': round(sum(terisi) / len(terisi), 1) if terisi else None}


async def rantai_ulang(db, log: Dict[str, Any], maks: int = 50) -> List[Dict[str, Any]]:
    """Log asal + seluruh unggah ulang sebelumnya (mengikuti `ulang_dari`) -> [log terbaru, ..., log pertama]."""
    rantai, dilihat = [log], {log['id']}
    while rantai[-1].get('ulang_dari') and len(rantai) < maks:
        induk = await db[KOLEKSI_IMPOR_LOG].find_one({'id': rantai[-1]['ulang_dari']}, {'_id': 0})
        if not induk or induk['id'] in dilihat:
            break
        rantai.append(induk)
        dilihat.add(induk['id'])
    return rantai


def dokumen_riwayat(nilai_baru: Dict[str, Any], nilai_lama: Optional[float]) -> Dict[str, Any]:
    """Jejak satu perubahan nilai dari dokumen nilai_ujian yang baru disimpan."""
    return {
        'id': str(uuid.uuid4()), **{k: nilai_baru.get(k) for k in ('ujian_id', 'mapel_id', 'siswa_id', 'kelas_id', 'sumber', 'impor_log_id')},
        'nilai_lama': nilai_lama, 'nilai_baru': nilai_baru.get('nilai'), 'oleh': nilai_baru.get('diedit_oleh'),
        'oleh_nama': nilai_baru.get('diedit_oleh_nama'), 'waktu': nilai_baru.get('waktu'),
    }


def kode_semester_rapor(semester: Optional[Dict[str, Any]]) -> Optional[str]:
    """Nilai kolom `semester` grade_entries ('ganjil' | 'genap') dari dokumen semester ujian."""
    for teks in ((semester or {}).get('code'), (semester or {}).get('name')):
        t = str(teks or '').strip().lower()
        if 'ganjil' in t or t in ('1', '3', '5'):
            return 'ganjil'
        if 'genap' in t or t in ('2', '4', '6'):
            return 'genap'
    return None
