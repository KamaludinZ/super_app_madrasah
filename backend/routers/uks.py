"""API endpoints for UKS (Unit Kesehatan Sekolah / School Health Unit) Management."""
import logging
import re
import calendar
import io
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import uuid

import openpyxl
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from xml.sax.saxutils import escape as xml_escape

from ckg_impor import baca_berkas_ckg, dokumen_ckg, validasi_baris_ckg
from ckg_kolom import KOLOM_CKG, KOLOM_IDENTITAS_CKG, baris_kolom_baku, kolom_template_ckg, lengkapi_identitas_ckg, pemeriksaan_lain
from core import db, get_active_academic_year, get_current_user, get_settings, require_role, serialize_doc, log_audit

from routers._shared import sembunyikan_siswa_nonaktif

router = APIRouter()

UKS_ROLES = ('admin', 'unit_kesehatan')
# Peran yang boleh MELIHAT riwayat stok BMHP (berisi data pasien). Mutasi
# (tambah/ubah/hapus master, BMHP masuk, pemakaian via penanganan) tetap
# hanya untuk UKS_ROLES.
UKS_VIEW_ROLES = UKS_ROLES + ('kepala_sekolah',)
# Hanya admin dan petugas UKS yang boleh menambah/mengubah/menghapus/menonaktifkan
# master Penegakan Diagnosa. Daftar diagnosa tetap bisa dibaca pengguna login
# (dipakai sebagai label di laporan/riwayat).
DIAGNOSA_MANAGE_ROLES = UKS_ROLES


# ============================================================
# REQUEST MODELS
# ============================================================

class JenisPenangananRequest(BaseModel):
    """Request model for a handling/treatment type (e.g., first aid category)."""
    nama: str
    deskripsi: Optional[str] = None
    urutan: Optional[int] = 0


class DiagnosaRequest(BaseModel):
    """Request model for a Penegakan Diagnosa master entry (collection uks_diagnosa),
    following the Jenis Penanganan pattern. Inactive diagnoses stay stored (old
    visits keep referring to them) but are hidden from the Penanganan form."""
    kode: Optional[str] = None  # mis. kode ICD-10, opsional
    nama: str
    kategori: str
    deskripsi: Optional[str] = None
    urutan: Optional[int] = 0
    aktif: bool = True


class ObatRequest(BaseModel):
    """Request model for a medicine catalog entry. Stock, expiry, and minimum
    threshold live on Obat Masuk batches / this record's stok_minimum policy —
    this model only covers the medicine's identity and reference info."""
    nama_obat: str
    jenis: Optional[str] = None  # e.g., "Tablet", "Sirup", "Salep"
    satuan: Optional[str] = 'pcs'
    untuk_penanganan: Optional[str] = None  # free-text: what this medicine is used for
    dosis: Optional[str] = None  # e.g., "1 tablet setiap 6 jam setelah makan"
    stok_minimum: Optional[int] = 0
    keterangan: Optional[str] = None


class BMHPRequest(BaseModel):
    """Request model for a BMHP (Bahan Medis Habis Pakai) catalog entry, mirroring
    ObatRequest. Stock and nearest expiry are derived from BMHP Masuk batches,
    never stored on the uks_bmhp record itself."""
    nama_bmhp: str
    jenis: Optional[str] = None  # e.g., "Pembalut Luka", "APD", "Antiseptik"
    satuan: Optional[str] = 'pcs'
    stok_minimum: Optional[int] = 0
    keterangan: Optional[str] = None


class BMHPMasukRequest(BaseModel):
    """Request model for a BMHP restocking batch (collection uks_bmhp_masuk).
    Like ObatMasukRequest, each batch stores its own stok_sisa (initialised to
    jumlah) and optional expiry, and is consumed FEFO when BMHP is used in a
    Penanganan Kunjungan."""
    bmhp_id: str
    tanggal: str
    jumlah: int
    tanggal_kadaluarsa: Optional[str] = None
    sumber: Optional[str] = None  # e.g., "Pembelian", "Donasi", "Puskesmas"
    keterangan: Optional[str] = None


class BMHPDipakaiItem(BaseModel):
    """One BMHP used as part of a treatment (Penanganan Kunjungan)."""
    bmhp_id: str
    jumlah: int = 1


# Dokumen uks_bmhp_keluar TIDAK diinput manual; dibuat otomatis oleh alur
# Penanganan Kunjungan. Field yang disimpan:
#   id, bmhp_id, bmhp_nama, tanggal, jumlah, kunjungan_id,
#   pasien_id, pasien_nama, pasien_identitas, pasien_roles, keluhan,
#   batch_alokasi [{masuk_id, jumlah}]  -> batch BMHP Masuk yang dipotong (FEFO),
#                                          dipakai untuk mengembalikan stok tepat ke batch asal
#   petugas_id, petugas_nama, created_at
BMHP_KELUAR_FIELDS = (
    'id', 'bmhp_id', 'bmhp_nama', 'tanggal', 'jumlah', 'kunjungan_id',
    'pasien_id', 'pasien_nama', 'pasien_identitas', 'pasien_roles', 'keluhan',
    'batch_alokasi', 'petugas_id', 'petugas_nama', 'created_at',
)


class ObatMasukRequest(BaseModel):
    """Request model for a restocking batch. Each batch carries its own
    expiry date and remaining quantity, consumed FEFO (earliest expiry first)
    when medicine is dispensed."""
    obat_id: str
    tanggal: str
    jumlah: int
    tanggal_kadaluarsa: Optional[str] = None
    sumber: Optional[str] = None  # e.g., "Pembelian", "Donasi", "Puskesmas"
    keterangan: Optional[str] = None


class ObatKeluarRequest(BaseModel):
    """Request model for dispensed (outgoing) medicine, optionally linked to a kunjungan."""
    obat_id: str
    tanggal: str
    jumlah: int
    kunjungan_id: Optional[str] = None
    penerima_id: Optional[str] = None  # user id (siswa/GTK) receiving the medicine
    keterangan: Optional[str] = None


class KunjunganUKSRequest(BaseModel):
    """Request model for the initial UKS visit intake (patient + complaint,
    plus optional vitals taken on arrival). Treatment details are recorded
    separately via PenangananKunjunganRequest once the patient has been seen,
    so a visit can be logged immediately on arrival."""
    pasien_id: str  # user id (siswa/guru/tendik)
    tanggal: str
    waktu: Optional[str] = None
    keluhan: str
    tinggi_badan: Optional[float] = None  # cm
    berat_badan: Optional[float] = None  # kg
    tekanan_darah: Optional[str] = None  # e.g., "120/80"
    nadi: Optional[int] = None  # bpm
    suhu: Optional[float] = None  # celsius
    spo2: Optional[int] = None  # %


class ObatDipakaiItem(BaseModel):
    """One medicine dispensed as part of a treatment."""
    obat_id: str
    jumlah: int = 1


class PenangananKunjunganRequest(BaseModel):
    """Request model for recording treatment against an existing UKS visit.
    Vitals here overwrite the intake vitals if provided (e.g. re-measured
    before discharge); left blank, the intake values are kept unchanged."""
    diagnosa_utama_id: Optional[str] = None  # wajib diisi; divalidasi di submit_penanganan agar pesan error jelas
    diagnosa_tambahan_ids: List[str] = []
    jenis_penanganan_ids: List[str] = []
    obat_list: List[ObatDipakaiItem] = []
    bmhp_list: List[BMHPDipakaiItem] = []
    penanganan: Optional[str] = None
    kondisi_pulang: Optional[str] = None  # e.g., "Membaik", "Dirujuk", "Dijemput", "Istirahat di Mahad"
    dirujuk_ke: Optional[str] = None
    keterangan: Optional[str] = None
    tinggi_badan: Optional[float] = None  # cm
    berat_badan: Optional[float] = None  # kg
    tekanan_darah: Optional[str] = None  # e.g., "120/80"
    nadi: Optional[int] = None  # bpm
    suhu: Optional[float] = None  # celsius
    spo2: Optional[int] = None  # %


class CekKesehatanRequest(BaseModel):
    """Request model for a Cek Kesehatan Gratis (CKG) screening record."""
    pasien_id: str  # user id (siswa/guru/tendik)
    tanggal: str
    tinggi_badan: Optional[float] = None  # cm
    berat_badan: Optional[float] = None  # kg
    tekanan_darah: Optional[str] = None  # e.g., "120/80"
    nadi: Optional[int] = None  # bpm
    suhu: Optional[float] = None  # celsius
    spo2: Optional[int] = None  # %
    pemeriksaan_mata: Optional[str] = None
    pemeriksaan_gigi: Optional[str] = None
    # Kolom baku CKG
    jumlah_karies: Optional[int] = Field(None, ge=0, le=32)
    visus_mata: Optional[str] = None
    kesehatan_kulit: Optional[str] = None
    fungsi_pendengaran: Optional[str] = None
    hemoglobin: Optional[float] = Field(None, ge=0, le=30)  # g/dL
    gds: Optional[float] = Field(None, ge=0, le=1000)  # mg/dL
    kesimpulan: Optional[str] = None
    rekomendasi: Optional[str] = None
    keterangan: Optional[str] = None


class ImunisasiRequest(BaseModel):
    """Request model for an immunization record."""
    pasien_id: str  # user id (siswa/guru/tendik)
    tanggal: str
    jenis_vaksin: str
    dosis_ke: Optional[str] = None  # e.g., "1", "2", "Booster"
    petugas_pemberi: Optional[str] = None  # e.g., "Puskesmas Lowokwaru"
    efek_samping: Optional[str] = None
    keterangan: Optional[str] = None


UKS_ROOM_NAME = 'Ruang UKS'
UKS_KATEGORI_ALAT_BAHAN = ['Alat Medis', 'Furniture', 'P3K', 'Obat & BMHP', 'Lainnya']


class AsetUKSRequest(BaseModel):
    """Request model for a UKS equipment/asset item — sama seperti pola Lab
    IPA/Komputer: disimpan di collection Sarpras (aset_tetap/aset_lancar)
    yang sama, dipisahkan lewat lokasi_room_id, agar terintegrasi penuh
    dengan /admin/sarpras/. Aset lancar (mis. obat, BMHP) pakai stok, bukan
    baik/rusak seperti aset tetap."""
    aset_tipe: str  # 'tetap' or 'lancar'
    nama: str
    sumber_dana: str = 'Komite'  # 'Komite' or 'BMN'
    kategori: Optional[str] = None
    satuan: Optional[str] = None
    jumlah_baik: int = 0
    jumlah_rusak: int = 0
    stok: int = 0
    stok_minimum: int = 0
    lokasi_penyimpanan: Optional[str] = None
    ruangan_id: Optional[str] = None  # default: Ruang UKS; bisa diganti ruangan lain
    keterangan: Optional[str] = None


async def _create_indexes_safely(database, specs) -> List[str]:
    """Buat index satu per satu; kegagalan satu index (mis. data lama ganda pada index
    unik) dicatat dan TIDAK menghentikan pembuatan index lainnya. Mengembalikan daftar
    deskripsi index yang gagal."""
    gagal = []
    for coll, keys, kwargs in specs:
        try:
            await database[coll].create_index(keys, **kwargs)
        except Exception as e:  # noqa: BLE001 - dilaporkan ke pemanggil & log
            desc = f"{coll} {keys}"
            gagal.append(f"{desc}: {e}")
            logging.getLogger('matsandatama').error(f"[uks] Gagal membuat index {desc}: {e}")
    return gagal


async def ensure_uks_bmhp_indexes(database) -> List[str]:
    """Create the BMHP collections' indexes (idempotent). Called on startup and by
    migrations/migrate_uks_bmhp.py. nama_key is the lowercased, trimmed BMHP name
    so two catalog entries cannot differ only by letter case or spacing.
    Returns the list of indexes that could not be created (empty = all good)."""
    return await _create_indexes_safely(database, [
        ('uks_bmhp', 'id', {'unique': True}),
        ('uks_bmhp', 'nama_key', {'unique': True}),
        ('uks_bmhp_masuk', 'id', {'unique': True}),
        ('uks_bmhp_masuk', [('bmhp_id', 1), ('tanggal_kadaluarsa', 1)], {}),
        ('uks_bmhp_keluar', 'id', {'unique': True}),
        ('uks_bmhp_keluar', [('bmhp_id', 1), ('tanggal', -1)], {}),
        ('uks_bmhp_keluar', 'kunjungan_id', {}),
    ])


async def ensure_uks_diagnosa_indexes(database) -> List[str]:
    """Index master diagnosa, riwayat kunjungan/CKG, dan filter periode laporan
    (idempotent). Setiap index dibuat terpisah agar satu kegagalan (mis. nama diagnosa
    ganda di data lama) tidak membatalkan index lain. Mengembalikan index yang gagal."""
    specs = [
        ('uks_diagnosa', 'id', {'unique': True}),
        ('uks_diagnosa', 'nama_key', {'unique': True}),
        ('uks_diagnosa', 'kode', {'unique': True, 'name': 'kode_unik_bila_diisi',
                                  'partialFilterExpression': {'kode': {'$type': 'string', '$gt': ''}}}),
        ('uks_diagnosa', [('aktif', 1), ('urutan', 1)], {}),
        # Untuk cek "diagnosa terpakai" dan rekap diagnosa per kunjungan.
        ('uks_kunjungan', 'diagnosa_utama_id', {}),
        ('uks_kunjungan', 'diagnosa_tambahan_ids', {}),
        # Riwayat kunjungan per pasien (filter periode + urutan terbaru dari index).
        ('uks_kunjungan', [('pasien_id', 1), ('tanggal', -1)], {}),
        ('uks_kunjungan', [('pasien_id', 1), ('tanggal', -1), ('waktu', -1), ('created_at', -1)], {}),
        # Riwayat CKG per siswa.
        ('uks_ckg', [('pasien_id', 1), ('tanggal', -1), ('created_at', -1)], {}),
        # Laporan UKS Baru: filter periode (bulan/tahun) pada kunjungan & mutasi stok.
        ('uks_kunjungan', 'tanggal', {}),
    ] + [(coll, 'tanggal', {}) for coll in ('uks_obat_masuk', 'uks_obat_keluar', 'uks_bmhp_masuk', 'uks_bmhp_keluar')]
    return await _create_indexes_safely(database, specs)


DEFAULT_DIAGNOSA = [
    {'kode': 'R50.9', 'nama': 'Demam', 'kategori': 'Gejala Umum'},
    {'kode': 'R51', 'nama': 'Sakit Kepala (Cephalgia)', 'kategori': 'Gejala Umum'},
    {'kode': 'R55', 'nama': 'Pingsan (Sinkop)', 'kategori': 'Gejala Umum'},
    {'kode': 'J00', 'nama': 'Common Cold (Batuk Pilek)', 'kategori': 'Pernapasan'},
    {'kode': 'K30', 'nama': 'Dispepsia (Maag)', 'kategori': 'Pencernaan'},
    {'kode': 'A09', 'nama': 'Diare', 'kategori': 'Pencernaan'},
    {'kode': 'T14.0', 'nama': 'Luka Lecet / Superfisial', 'kategori': 'Cedera'},
    {'kode': 'S93.4', 'nama': 'Keseleo (Sprain)', 'kategori': 'Cedera'},
    {'kode': 'N94.6', 'nama': 'Dismenore (Nyeri Haid)', 'kategori': 'Reproduksi'},
]


def bmhp_nama_key(nama: str) -> str:
    return ' '.join((nama or '').split()).lower()


async def _get_user_or_404(user_id: str):
    doc = await db.users.find_one({'id': user_id}, {'_id': 0, 'password_hash': 0})
    if not doc:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    return doc


def _user_fields(prefix: str, u: Dict) -> Dict:
    return {
        f'{prefix}_nama': u.get('full_name'),
        f'{prefix}_identitas': u.get('nis') or u.get('nip_nuptk') or u.get('username'),
        f'{prefix}_roles': u.get('roles'),
    }


async def _get_active_pasien_list(jenis_pasien: str, tingkat: Optional[str] = None, jenis_gtk: Optional[str] = None,
                                  kelas: Optional[str] = None) -> List[Dict]:
    """Pasien aktif untuk template CKG/Imunisasi:
    - siswa: siswa di kelas tahun ajaran aktif (bukan mutasi keluar); `tingkat` 7/8/9 menyaring grade kelas,
             `kelas` (id atau nama kelas, mis. '7A') menyaring satu kelas.
    - gtk  : guru & tenaga kependidikan aktif (bukan mutasi keluar); `jenis_gtk` guru/tendik menyaring jenisnya
             (pengguna yang juga guru dihitung sebagai guru, sama dengan menu Data GTK).
    Urutan: kelas lalu nama (siswa), nama (GTK)."""
    from data_master_service import gtk_per_jenis, normalisasi_jenis_gtk, normalisasi_tingkat
    if jenis_pasien == 'gtk':
        data = await gtk_per_jenis(db, normalisasi_jenis_gtk(jenis_gtk))
        return [{'id': d['user']['id'], 'full_name': d['user'].get('full_name'), 'jenis_gtk': d['jenis'],
                 'identitas': d['user'].get('nip') or d['user'].get('nip_nuptk') or d['user'].get('username'), 'kelas': None}
                for d in data if d['user'].get('is_active', True) is not False]
    if jenis_pasien != 'siswa':
        raise HTTPException(400, "jenis_pasien harus 'siswa' atau 'gtk'")

    grade = normalisasi_tingkat(tingkat)
    active_ay = await get_active_academic_year()
    class_query: Dict[str, Any] = {'academic_year_id': active_ay['id']} if active_ay else {}
    if grade is not None:
        class_query['grade'] = grade
    classes = await db.classes.find(class_query, {'_id': 0, 'id': 1, 'name': 1}).to_list(500)
    if kelas and kelas.strip().lower() not in ('all', 'semua'):
        k = kelas.strip().lower()
        classes = [c for c in classes if c['id'] == kelas.strip() or str(c.get('name') or '').strip().lower() == k]
        if not classes:
            raise HTTPException(404, f"Kelas '{kelas}' tidak ditemukan pada tahun ajaran aktif" + (f" tingkat {grade}" if grade else ''))
    class_names = {c['id']: c['name'] for c in classes}
    if not class_names:
        return []

    students = await db.users.find(
        {'roles': 'siswa', 'student_class_id': {'$in': list(class_names.keys())}, 'mutation_type': {'$ne': 'keluar'}},
        {'_id': 0, 'id': 1, 'full_name': 1, 'nisn': 1, 'student_class_id': 1}
    ).to_list(5000)
    students.sort(key=lambda s: (class_names.get(s.get('student_class_id'), ''), s.get('full_name') or ''))
    return [{'id': s['id'], 'full_name': s.get('full_name'), 'identitas': s.get('nisn'), 'kelas': class_names.get(s.get('student_class_id'))} for s in students]


def nama_kelompok_template(jenis_pasien: str, tingkat: Optional[str], jenis_gtk: Optional[str], kelas: Optional[str] = None) -> str:
    """Bagian nama berkas template, mis. 'Siswa_Kelas_7', 'Siswa_Kelas_7A', 'Siswa_Semua_Kelas', 'GTK_Guru'."""
    if jenis_pasien == 'siswa' and kelas and kelas.strip().lower() not in ('all', 'semua'):
        return 'Siswa_Kelas_' + re.sub(r'[^A-Za-z0-9]+', '', kelas)
    if jenis_pasien == 'siswa':
        t = (tingkat or '').strip().lower()
        return 'Siswa_Semua_Kelas' if t in ('', 'all', 'semua') else f'Siswa_Kelas_{t}'
    j = (jenis_gtk or '').strip().lower()
    return 'GTK_' + {'guru': 'Guru', 'tendik': 'Tendik', 'tenaga_kependidikan': 'Tendik'}.get(j, 'Semua')


async def _get_obat_or_404(obat_id: str):
    doc = await db.uks_obat.find_one({'id': obat_id})
    if not doc:
        raise HTTPException(404, "Data obat tidak ditemukan")
    return doc


async def _get_obat_stock_summary(obat_id: str) -> Dict:
    """Aggregate remaining stock and nearest expiry across all Obat Masuk
    batches for one medicine. Stock and expiry are derived here, never stored
    on the uks_obat catalog record."""
    batches = await db.uks_obat_masuk.find(
        {'obat_id': obat_id, 'stok_sisa': {'$gt': 0}}, {'_id': 0}
    ).sort('tanggal_kadaluarsa', 1).to_list(1000)

    stok_tersisa = sum(b.get('stok_sisa', 0) for b in batches)
    stok_masuk_total = await db.uks_obat_masuk.aggregate([
        {'$match': {'obat_id': obat_id}},
        {'$group': {'_id': None, 'total': {'$sum': '$jumlah'}}},
    ]).to_list(1)
    stok_masuk = stok_masuk_total[0]['total'] if stok_masuk_total else 0
    stok_terpakai = stok_masuk - stok_tersisa

    with_expiry = [b for b in batches if b.get('tanggal_kadaluarsa')]
    tanggal_kadaluarsa_terdekat = with_expiry[0]['tanggal_kadaluarsa'] if with_expiry else None

    return {
        'stok_masuk': stok_masuk,
        'stok_terpakai': stok_terpakai,
        'stok_tersisa': stok_tersisa,
        'tanggal_kadaluarsa_terdekat': tanggal_kadaluarsa_terdekat,
        'jumlah_batch_aktif': len(batches),
    }


async def _get_bmhp_or_404(bmhp_id: str):
    doc = await db.uks_bmhp.find_one({'id': bmhp_id})
    if not doc:
        raise HTTPException(404, "Data BMHP tidak ditemukan")
    return doc


async def _get_bmhp_stock_summary(bmhp_id: str) -> Dict:
    """Aggregate remaining stock and nearest expiry across all BMHP Masuk
    batches for one BMHP — same derivation as _get_obat_stock_summary."""
    batches = await db.uks_bmhp_masuk.find(
        {'bmhp_id': bmhp_id, 'stok_sisa': {'$gt': 0}}, {'_id': 0}
    ).sort('tanggal_kadaluarsa', 1).to_list(1000)

    stok_tersisa = sum(b.get('stok_sisa', 0) for b in batches)
    stok_masuk_total = await db.uks_bmhp_masuk.aggregate([
        {'$match': {'bmhp_id': bmhp_id}},
        {'$group': {'_id': None, 'total': {'$sum': '$jumlah'}}},
    ]).to_list(1)
    stok_masuk = stok_masuk_total[0]['total'] if stok_masuk_total else 0

    with_expiry = [b for b in batches if b.get('tanggal_kadaluarsa')]
    return {
        'stok_masuk': stok_masuk,
        'stok_terpakai': stok_masuk - stok_tersisa,
        'stok_tersisa': stok_tersisa,
        'tanggal_kadaluarsa_terdekat': with_expiry[0]['tanggal_kadaluarsa'] if with_expiry else None,
        'jumlah_batch_aktif': len(batches),
    }


def _clean_bmhp_request(req: BMHPRequest) -> Dict:
    data = req.model_dump()
    data['nama_bmhp'] = ' '.join((data.get('nama_bmhp') or '').split())
    if not data['nama_bmhp']:
        raise HTTPException(400, "Nama BMHP wajib diisi")
    data['satuan'] = (data.get('satuan') or '').strip() or 'pcs'
    if (data.get('stok_minimum') or 0) < 0:
        raise HTTPException(400, "Stok minimum tidak boleh negatif")
    data['stok_minimum'] = data.get('stok_minimum') or 0
    data['nama_key'] = bmhp_nama_key(data['nama_bmhp'])
    return data


async def _ensure_bmhp_name_free(nama_key: str, exclude_id: Optional[str] = None):
    query = {'nama_key': nama_key}
    if exclude_id:
        query['id'] = {'$ne': exclude_id}
    if await db.uks_bmhp.find_one(query, {'_id': 1}):
        raise HTTPException(400, "Nama BMHP sudah terdaftar")


def _merge_bmhp_items(items) -> Dict[str, int]:
    """Gabungkan baris BMHP yang sama dalam satu penanganan menjadi satu jumlah."""
    merged: Dict[str, int] = {}
    for item in items:
        if item.jumlah <= 0:
            raise HTTPException(400, "Jumlah BMHP harus lebih dari 0")
        merged[item.bmhp_id] = merged.get(item.bmhp_id, 0) + item.jumlah
    return merged


async def _use_bmhp(bmhp: Dict, jumlah: int, kunjungan: Dict, pasien: Optional[Dict], user: Dict) -> Dict:
    """Potong stok BMHP secara FEFO dari batch BMHP Masuk dan catat otomatis
    di uks_bmhp_keluar. Batch yang dipotong disimpan di batch_alokasi agar stok
    bisa dikembalikan tepat ke batch asal bila penanganan diubah/dihapus."""
    batches = await db.uks_bmhp_masuk.find(
        {'bmhp_id': bmhp['id'], 'stok_sisa': {'$gt': 0}}, {'_id': 0}
    ).sort('tanggal_kadaluarsa', 1).to_list(1000)
    # Batch tanpa tanggal kadaluarsa dipakai paling akhir.
    batches.sort(key=lambda b: (b.get('tanggal_kadaluarsa') is None, b.get('tanggal_kadaluarsa') or ''))

    remaining = jumlah
    alokasi = []
    for batch in batches:
        if remaining <= 0:
            break
        take = min(batch['stok_sisa'], remaining)
        await db.uks_bmhp_masuk.update_one({'id': batch['id']}, {'$inc': {'stok_sisa': -take}})
        alokasi.append({'masuk_id': batch['id'], 'jumlah': take})
        remaining -= take

    doc = {
        'id': str(uuid.uuid4()),
        'bmhp_id': bmhp['id'],
        'bmhp_nama': bmhp.get('nama_bmhp'),
        'tanggal': kunjungan['tanggal'],
        'jumlah': jumlah,
        'kunjungan_id': kunjungan['id'],
        'pasien_id': kunjungan.get('pasien_id'),
        'keluhan': kunjungan.get('keluhan'),
        'batch_alokasi': alokasi,
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
    }
    if pasien:
        doc.update(_user_fields('pasien', pasien))
    else:
        doc['pasien_nama'] = kunjungan.get('pasien_nama')
    await db.uks_bmhp_keluar.insert_one(doc)
    return doc


async def _revert_bmhp_keluar_for_kunjungan(kunjungan_id: str) -> None:
    """Kembalikan stok semua BMHP keluar milik satu kunjungan lalu hapus catatannya."""
    entries = await db.uks_bmhp_keluar.find({'kunjungan_id': kunjungan_id}, {'_id': 0}).to_list(500)
    for entry in entries:
        alokasi = entry.get('batch_alokasi') or []
        if alokasi:
            for a in alokasi:
                await db.uks_bmhp_masuk.update_one({'id': a['masuk_id']}, {'$inc': {'stok_sisa': a['jumlah']}})
        else:
            # Catatan lama tanpa alokasi: kembalikan ke batch terdekat yang masih punya ruang.
            batches = await db.uks_bmhp_masuk.find({'bmhp_id': entry['bmhp_id']}, {'_id': 0}).sort('tanggal_kadaluarsa', 1).to_list(1000)
            if batches:
                target = next((b for b in batches if b.get('stok_sisa', 0) < b.get('jumlah', 0)), batches[-1])
                await db.uks_bmhp_masuk.update_one({'id': target['id']}, {'$inc': {'stok_sisa': entry.get('jumlah', 0)}})
    await db.uks_bmhp_keluar.delete_many({'kunjungan_id': kunjungan_id})


async def _dispense_obat(obat_id: str, jumlah: int, tanggal: str, user: Dict,
                          kunjungan_id: Optional[str] = None, penerima: Optional[Dict] = None,
                          keterangan: Optional[str] = None) -> Dict:
    """Record an obat-keluar entry and deduct stock FEFO (earliest expiry
    batch first) across Obat Masuk batches. Shared by the manual Obat Keluar
    form and the Penanganan Kunjungan flow."""
    obat = await _get_obat_or_404(obat_id)
    if jumlah <= 0:
        raise HTTPException(400, "Jumlah harus lebih dari 0")

    summary = await _get_obat_stock_summary(obat_id)
    if summary['stok_tersisa'] < jumlah:
        raise HTTPException(400, f"Stok '{obat.get('nama_obat')}' tidak mencukupi (tersedia: {summary['stok_tersisa']})")

    batches = await db.uks_obat_masuk.find(
        {'obat_id': obat_id, 'stok_sisa': {'$gt': 0}}, {'_id': 0}
    ).sort('tanggal_kadaluarsa', 1).to_list(1000)

    remaining = jumlah
    alokasi = []
    for batch in batches:
        if remaining <= 0:
            break
        take = min(batch['stok_sisa'], remaining)
        await db.uks_obat_masuk.update_one({'id': batch['id']}, {'$inc': {'stok_sisa': -take}})
        alokasi.append({'masuk_id': batch['id'], 'jumlah': take})
        remaining -= take

    doc = {
        'id': str(uuid.uuid4()),
        'obat_id': obat_id,
        'batch_alokasi': alokasi,
        'obat_nama': obat.get('nama_obat'),
        'tanggal': tanggal,
        'jumlah': jumlah,
        'kunjungan_id': kunjungan_id,
        'keterangan': keterangan,
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
    }
    if penerima:
        doc.update(_user_fields('penerima', penerima))

    await db.uks_obat_keluar.insert_one(doc)
    return doc


async def _restore_obat_keluar(entry: Dict):
    """Kembalikan stok satu catatan obat keluar: tepat ke batch asal bila
    batch_alokasi tersedia, atau ke batch terdekat untuk catatan lama."""
    alokasi = entry.get('batch_alokasi') or []
    if alokasi:
        for a in alokasi:
            await db.uks_obat_masuk.update_one({'id': a['masuk_id']}, {'$inc': {'stok_sisa': a['jumlah']}})
    else:
        await _restore_obat_stock(entry['obat_id'], entry.get('jumlah', 0))


async def _revert_obat_keluar_for_kunjungan(kunjungan_id: str) -> None:
    """Kembalikan stok semua obat keluar milik satu kunjungan lalu hapus catatannya,
    agar simpan ulang penanganan tidak memotong stok dua kali."""
    entries = await db.uks_obat_keluar.find({'kunjungan_id': kunjungan_id}, {'_id': 0}).to_list(500)
    for entry in entries:
        await _restore_obat_keluar(entry)
    await db.uks_obat_keluar.delete_many({'kunjungan_id': kunjungan_id})


async def _restore_obat_stock(obat_id: str, jumlah: int):
    """Reverse a dispense (e.g. when an obat-keluar entry is deleted) by
    returning quantity to the batch with the nearest expiry that still has
    room, or the most recent batch if all are exhausted."""
    batches = await db.uks_obat_masuk.find({'obat_id': obat_id}, {'_id': 0}).sort('tanggal_kadaluarsa', 1).to_list(1000)
    if not batches:
        return
    target = next((b for b in batches if b.get('stok_sisa', 0) < b.get('jumlah', 0)), batches[-1])
    await db.uks_obat_masuk.update_one({'id': target['id']}, {'$inc': {'stok_sisa': jumlah}})


# ============================================================
# WARGA MADRASAH LOOKUP (for pasien / penerima picker)
# ============================================================

@router.get("/uks/warga-madrasah")
async def list_warga_madrasah(search: Optional[str] = None, role: Optional[str] = None, user: Dict = Depends(require_role(*UKS_ROLES))):
    """Minimal lookup of active users for the patient picker, optionally filtered by role
    (e.g. role=guru or role=tenaga_kependidikan for the GTK patient-type selector)."""
    query = {'is_active': {'$ne': False}, 'mutation_type': {'$ne': 'keluar'}}
    if role:
        query['roles'] = role
    if search:
        query['full_name'] = {'$regex': re.escape(search), '$options': 'i'}

    items = await db.users.find(
        query,
        {'_id': 0, 'id': 1, 'full_name': 1, 'nis': 1, 'nip_nuptk': 1, 'username': 1, 'roles': 1}
    ).sort('full_name', 1).to_list(3000)
    return [serialize_doc(i) for i in items]


def _calc_umur(birth_date: Optional[str]) -> Optional[str]:
    if not birth_date:
        return None
    try:
        birth = datetime.fromisoformat(birth_date[:10])
    except (ValueError, TypeError):
        return None
    today = datetime.utcnow()
    years = today.year - birth.year
    months = today.month - birth.month
    if today.day < birth.day:
        months -= 1
    if months < 0:
        years -= 1
        months += 12
    return f"{years} tahun {months} bulan"


@router.get("/uks/pasien/{pasien_id}/profile")
async def get_pasien_profile(pasien_id: str, user: Dict = Depends(require_role(*UKS_ROLES, 'kepala_sekolah'))):
    """Rich profile for the Detail Kunjungan dialog: identity, wali kelas
    (from the student's currently assigned class), address, parent/wali
    contacts, and mahad status — siswa only fields are None for GTK patients."""
    pasien = await _get_user_or_404(pasien_id)
    is_siswa = 'siswa' in (pasien.get('roles') or [])

    profile = {
        'jenis_pasien': 'siswa' if is_siswa else 'gtk',
        'full_name': pasien.get('full_name'),
        'nik': None,
        'tempat_lahir': pasien.get('birth_place'),
        'tanggal_lahir': pasien.get('birth_date'),
        'umur': _calc_umur(pasien.get('birth_date')),
        'class_name': None,
        'wali_kelas_nama': None,
        'alamat_siswa': None,
        'ayah_nama': None,
        'ayah_no_hp': None,
        'ibu_nama': None,
        'ibu_no_hp': None,
        'wali_nama': None,
        'wali_no_hp': None,
        'santri_mahad': False,
        'kamar_mahad': None,
    }

    if not is_siswa:
        return profile

    if pasien.get('student_class_id'):
        cls = await db.classes.find_one({'id': pasien['student_class_id']}, {'_id': 0, 'name': 1, 'homeroom_teacher_id': 1})
        if cls:
            profile['class_name'] = cls.get('name')
            if cls.get('homeroom_teacher_id'):
                wali_kelas = await db.users.find_one({'id': cls['homeroom_teacher_id']}, {'_id': 0, 'full_name': 1})
                profile['wali_kelas_nama'] = wali_kelas.get('full_name') if wali_kelas else None

    detail = await db.student_details.find_one({'student_id': pasien_id}, {'_id': 0})
    if detail:
        ayah = detail.get('ayah') or {}
        ibu = detail.get('ibu') or {}
        wali = detail.get('wali') or {}
        alamat_siswa = detail.get('alamat_siswa') or {}
        profile.update({
            'nik': detail.get('nik'),
            'alamat_siswa': alamat_siswa.get('alamat'),
            'ayah_nama': ayah.get('nama'),
            'ayah_no_hp': ayah.get('no_hp'),
            'ibu_nama': ibu.get('nama'),
            'ibu_no_hp': ibu.get('no_hp'),
            'wali_nama': wali.get('nama'),
            'wali_no_hp': wali.get('no_hp'),
            'santri_mahad': bool(detail.get('santri_mahad')),
            'kamar_mahad': detail.get('kamar_mahad'),
        })

    return profile


# ============================================================
# JENIS PENANGANAN ENDPOINTS
# ============================================================

@router.get("/uks/jenis-penanganan")
async def list_jenis_penanganan(user: Dict = Depends(get_current_user)):
    items = await db.uks_jenis_penanganan.find({}, {'_id': 0}).sort('urutan', 1).to_list(1000)
    return [serialize_doc(i) for i in items]


@router.post("/uks/jenis-penanganan")
async def create_jenis_penanganan(req: JenisPenangananRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'created_by': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.uks_jenis_penanganan.insert_one(doc)
    await log_audit(user, 'uks_jenis_penanganan_create', f"Created jenis penanganan: {req.nama}")
    return serialize_doc(doc)


@router.put("/uks/jenis-penanganan/{item_id}")
async def update_jenis_penanganan(item_id: str, req: JenisPenangananRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_jenis_penanganan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Jenis penanganan tidak ditemukan")

    update_data = req.model_dump()
    update_data['updated_at'] = datetime.utcnow().isoformat()
    await db.uks_jenis_penanganan.update_one({'id': item_id}, {'$set': update_data})
    await log_audit(user, 'uks_jenis_penanganan_update', f"Updated jenis penanganan: {item_id}")

    updated = await db.uks_jenis_penanganan.find_one({'id': item_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/uks/jenis-penanganan/{item_id}")
async def delete_jenis_penanganan(item_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_jenis_penanganan.find_one({'id': item_id})
    if not existing:
        raise HTTPException(404, "Jenis penanganan tidak ditemukan")

    used = await db.uks_kunjungan.count_documents({'jenis_penanganan_ids': item_id})
    if used > 0:
        raise HTTPException(400, f"Jenis penanganan masih digunakan oleh {used} data kunjungan")

    await db.uks_jenis_penanganan.delete_one({'id': item_id})
    await log_audit(user, 'uks_jenis_penanganan_delete', f"Deleted jenis penanganan: {item_id}")
    return {'message': 'Jenis penanganan berhasil dihapus'}


# ============================================================
# DATA OBAT (DAFTAR OBAT) ENDPOINTS
# ============================================================

@router.get("/uks/obat")
async def list_obat(search: Optional[str] = None, user: Dict = Depends(get_current_user)):
    """List the medicine catalog, each enriched with stock aggregated live
    from its Obat Masuk batches (stok_masuk, stok_terpakai, stok_tersisa,
    nearest expiry, and low-stock flag)."""
    query = {}
    if search:
        query['nama_obat'] = {'$regex': re.escape(search), '$options': 'i'}
    items = await db.uks_obat.find(query, {'_id': 0}).sort('nama_obat', 1).to_list(2000)

    enriched = []
    for i in items:
        summary = await _get_obat_stock_summary(i['id'])
        doc = {**i, **summary}
        doc['stok_menipis'] = summary['stok_tersisa'] <= (i.get('stok_minimum') or 0)
        enriched.append(serialize_doc(doc))
    return enriched


@router.post("/uks/obat")
async def create_obat(req: ObatRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'created_by': user['id'],
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.uks_obat.insert_one(doc)
    await log_audit(user, 'uks_obat_create', f"Created obat: {req.nama_obat}")
    return serialize_doc(doc)


@router.put("/uks/obat/{obat_id}")
async def update_obat(obat_id: str, req: ObatRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    await _get_obat_or_404(obat_id)

    update_data = req.model_dump()
    update_data['updated_at'] = datetime.utcnow().isoformat()
    await db.uks_obat.update_one({'id': obat_id}, {'$set': update_data})
    await log_audit(user, 'uks_obat_update', f"Updated obat: {obat_id}")

    updated = await db.uks_obat.find_one({'id': obat_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/uks/obat/{obat_id}")
async def delete_obat(obat_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    await _get_obat_or_404(obat_id)

    has_batches = await db.uks_obat_masuk.count_documents({'obat_id': obat_id})
    if has_batches > 0:
        raise HTTPException(400, f"Obat ini masih memiliki {has_batches} riwayat obat masuk dan tidak dapat dihapus")

    await db.uks_obat.delete_one({'id': obat_id})
    await log_audit(user, 'uks_obat_delete', f"Deleted obat: {obat_id}")
    return {'message': 'Data obat berhasil dihapus'}


# ============================================================
# OBAT MASUK ENDPOINTS
# ============================================================

@router.get("/uks/obat-masuk")
async def list_obat_masuk(
    obat_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    query = {}
    if obat_id:
        query['obat_id'] = obat_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal'] = date_query

    items = await db.uks_obat_masuk.find(query, {'_id': 0}).sort('tanggal', -1).to_list(3000)
    return [serialize_doc(i) for i in items]


@router.post("/uks/obat-masuk")
async def create_obat_masuk(req: ObatMasukRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    """Record a new stock batch. stok_sisa starts equal to jumlah and is
    depleted FEFO as the medicine is dispensed via Obat Keluar / Penanganan."""
    obat = await _get_obat_or_404(req.obat_id)
    if req.jumlah <= 0:
        raise HTTPException(400, "Jumlah harus lebih dari 0")

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'stok_sisa': req.jumlah,
        'obat_nama': obat.get('nama_obat'),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
    }
    await db.uks_obat_masuk.insert_one(doc)
    await log_audit(user, 'uks_obat_masuk_create', f"Obat masuk: {obat.get('nama_obat')} +{req.jumlah}")
    return serialize_doc(doc)


@router.delete("/uks/obat-masuk/{entry_id}")
async def delete_obat_masuk(entry_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_obat_masuk.find_one({'id': entry_id})
    if not existing:
        raise HTTPException(404, "Data obat masuk tidak ditemukan")

    if existing.get('stok_sisa', 0) < existing.get('jumlah', 0):
        raise HTTPException(400, "Batch ini sudah terpakai sebagian dan tidak dapat dihapus. Hapus data obat keluar terkait terlebih dahulu.")

    await db.uks_obat_masuk.delete_one({'id': entry_id})
    await log_audit(user, 'uks_obat_masuk_delete', f"Deleted obat masuk: {entry_id}")
    return {'message': 'Data obat masuk berhasil dihapus'}


# ============================================================
# OBAT KELUAR ENDPOINTS
# ============================================================

@router.get("/uks/obat-keluar")
async def list_obat_keluar(
    obat_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(get_current_user)
):
    query = {}
    if obat_id:
        query['obat_id'] = obat_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal'] = date_query

    items = await db.uks_obat_keluar.find(query, {'_id': 0}).sort('tanggal', -1).to_list(3000)
    return [serialize_doc(i) for i in items]


@router.post("/uks/obat-keluar")
async def create_obat_keluar(req: ObatKeluarRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    penerima = await _get_user_or_404(req.penerima_id) if req.penerima_id else None
    doc = await _dispense_obat(
        req.obat_id, req.jumlah, req.tanggal, user,
        kunjungan_id=req.kunjungan_id, penerima=penerima, keterangan=req.keterangan,
    )
    await log_audit(user, 'uks_obat_keluar_create', f"Obat keluar: {doc['obat_nama']} -{req.jumlah}")
    return serialize_doc(doc)


@router.delete("/uks/obat-keluar/{entry_id}")
async def delete_obat_keluar(entry_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_obat_keluar.find_one({'id': entry_id})
    if not existing:
        raise HTTPException(404, "Data obat keluar tidak ditemukan")

    await _restore_obat_keluar(existing)
    await db.uks_obat_keluar.delete_one({'id': entry_id})
    await log_audit(user, 'uks_obat_keluar_delete', f"Deleted obat keluar: {entry_id}")
    return {'message': 'Data obat keluar berhasil dihapus'}


# ============================================================
# PENEGAKAN DIAGNOSA (MASTER) ENDPOINTS
# ============================================================

async def _get_diagnosa_or_404(diagnosa_id: str):
    doc = await db.uks_diagnosa.find_one({'id': diagnosa_id})
    if not doc:
        raise HTTPException(404, "Data penegakan diagnosa tidak ditemukan")
    return doc


async def _clean_diagnosa_request(req: DiagnosaRequest, exclude_id: Optional[str] = None) -> Dict:
    data = req.model_dump()
    data['nama'] = ' '.join((data.get('nama') or '').split())
    if not data['nama']:
        raise HTTPException(400, "Nama diagnosa wajib diisi")
    data['kategori'] = ' '.join((data.get('kategori') or '').split())
    if not data['kategori']:
        raise HTTPException(400, "Kategori diagnosa wajib diisi")
    kode = (data.get('kode') or '').strip().upper()
    if kode and not re.fullmatch(r'[A-Z0-9.\-]{1,10}', kode):
        raise HTTPException(400, "Kode hanya boleh huruf, angka, titik, atau strip (maks. 10 karakter)")
    data['kode'] = kode or None
    if (data.get('urutan') or 0) < 0:
        raise HTTPException(400, "Urutan tidak boleh negatif")
    data['urutan'] = data.get('urutan') or 0
    data['deskripsi'] = (data.get('deskripsi') or '').strip() or None
    data['nama_key'] = bmhp_nama_key(data['nama'])

    others = {'id': {'$ne': exclude_id}} if exclude_id else {}
    if await db.uks_diagnosa.find_one({**others, 'nama_key': data['nama_key']}, {'_id': 1}):
        raise HTTPException(400, "Nama diagnosa sudah terdaftar")
    if kode and await db.uks_diagnosa.find_one({**others, 'kode': kode}, {'_id': 1}):
        raise HTTPException(400, "Kode diagnosa sudah dipakai diagnosa lain")
    return data


async def _resolve_penanganan_diagnosa(req, kunjungan: Dict) -> Dict:
    """Validasi diagnosa pada penanganan (diagnosa utama WAJIB, tambahan opsional)
    dan kembalikan field yang disimpan di
    uks_kunjungan: id + snapshot nama/kode (agar riwayat & laporan tetap terbaca
    walau master diganti namanya). Diagnosa nonaktif ditolak, kecuali memang sudah
    tersimpan di kunjungan ini sebelumnya."""
    utama_id = (req.diagnosa_utama_id or '').strip() or None
    if not utama_id:
        if not await db.uks_diagnosa.find_one({'aktif': {'$ne': False}}, {'_id': 1}):
            raise HTTPException(400, "Diagnosa utama wajib dipilih, tetapi master Penegakan Diagnosa masih kosong. Isi dulu di menu UKS > Penegakan Diagnosa.")
        raise HTTPException(400, "Diagnosa utama wajib dipilih")
    tambahan_ids = []
    for did in req.diagnosa_tambahan_ids:
        if did and did != utama_id and did not in tambahan_ids:
            tambahan_ids.append(did)

    previous = {kunjungan.get('diagnosa_utama_id'), *(kunjungan.get('diagnosa_tambahan_ids') or [])}
    wanted = ([utama_id] if utama_id else []) + tambahan_ids
    docs = {d['id']: d for d in await db.uks_diagnosa.find({'id': {'$in': wanted}}, {'_id': 0}).to_list(len(wanted) or 1)}
    for did in wanted:
        d = docs.get(did)
        if not d:
            raise HTTPException(404, f"Penegakan diagnosa tidak ditemukan: {did}")
        if d.get('aktif') is False and did not in previous:
            raise HTTPException(400, f"Diagnosa '{d.get('nama')}' sudah nonaktif dan tidak dapat dipilih")

    utama = docs.get(utama_id) if utama_id else None
    return {
        'diagnosa_utama_id': utama_id,
        'diagnosa_utama_nama': utama.get('nama') if utama else None,
        'diagnosa_utama_kode': utama.get('kode') if utama else None,
        'diagnosa_tambahan_ids': tambahan_ids,
        'diagnosa_tambahan_nama': [docs[d].get('nama') for d in tambahan_ids],
    }


async def _count_kunjungan_with_diagnosa(diagnosa_id: str) -> int:
    return await db.uks_kunjungan.count_documents(
        {'$or': [{'diagnosa_utama_id': diagnosa_id}, {'diagnosa_tambahan_ids': diagnosa_id}]}
    )


@router.get("/uks/diagnosa")
async def list_diagnosa(
    aktif: Optional[bool] = None,
    kategori: Optional[str] = None,
    search: Optional[str] = None,
    user: Dict = Depends(get_current_user),
):
    """Daftar master Penegakan Diagnosa, urut berdasarkan urutan lalu nama.
    Form penanganan memakai ?aktif=true agar diagnosa nonaktif tidak bisa dipilih."""
    query: Dict = {}
    if aktif is not None:
        query['aktif'] = aktif
    if kategori:
        query['kategori'] = kategori
    if search:
        pattern = {'$regex': re.escape(search), '$options': 'i'}
        query['$or'] = [{'nama': pattern}, {'kode': pattern}]
    items = await db.uks_diagnosa.find(query, {'_id': 0, 'nama_key': 0}).sort([('urutan', 1), ('nama', 1)]).to_list(2000)
    return [serialize_doc(i) for i in items]


@router.get("/uks/diagnosa/{diagnosa_id}")
async def get_diagnosa(diagnosa_id: str, user: Dict = Depends(require_role(*UKS_VIEW_ROLES))):
    """Detail diagnosa beserta jumlah kunjungan yang memakainya (untuk petugas & kepala sekolah)."""
    doc = await _get_diagnosa_or_404(diagnosa_id)
    doc.pop('nama_key', None)
    doc['jumlah_kunjungan'] = await _count_kunjungan_with_diagnosa(diagnosa_id)
    return serialize_doc(doc)


@router.post("/uks/diagnosa")
async def create_diagnosa(req: DiagnosaRequest, user: Dict = Depends(require_role(*DIAGNOSA_MANAGE_ROLES))):
    data = await _clean_diagnosa_request(req)
    now = datetime.utcnow().isoformat()
    doc = {'id': str(uuid.uuid4()), **data, 'created_by': user['id'], 'created_at': now, 'updated_at': now}
    await db.uks_diagnosa.insert_one(doc)
    await log_audit(user, 'uks_diagnosa_create', f"Created diagnosa: {data['nama']}")
    doc.pop('nama_key', None)
    return serialize_doc(doc)


@router.put("/uks/diagnosa/{diagnosa_id}")
async def update_diagnosa(diagnosa_id: str, req: DiagnosaRequest, user: Dict = Depends(require_role(*DIAGNOSA_MANAGE_ROLES))):
    await _get_diagnosa_or_404(diagnosa_id)
    data = await _clean_diagnosa_request(req, exclude_id=diagnosa_id)
    data['updated_at'] = datetime.utcnow().isoformat()
    await db.uks_diagnosa.update_one({'id': diagnosa_id}, {'$set': data})
    await log_audit(user, 'uks_diagnosa_update', f"Updated diagnosa: {diagnosa_id}")
    updated = await db.uks_diagnosa.find_one({'id': diagnosa_id}, {'_id': 0, 'nama_key': 0})
    return serialize_doc(updated)


@router.delete("/uks/diagnosa/{diagnosa_id}")
async def delete_diagnosa(diagnosa_id: str, user: Dict = Depends(require_role(*DIAGNOSA_MANAGE_ROLES))):
    await _get_diagnosa_or_404(diagnosa_id)
    used = await _count_kunjungan_with_diagnosa(diagnosa_id)
    if used:
        raise HTTPException(400, f"Diagnosa sudah dipakai di {used} kunjungan dan tidak dapat dihapus. Nonaktifkan saja.")
    await db.uks_diagnosa.delete_one({'id': diagnosa_id})
    await log_audit(user, 'uks_diagnosa_delete', f"Deleted diagnosa: {diagnosa_id}")
    return {'message': 'Penegakan diagnosa berhasil dihapus'}


# ============================================================
# DATA BMHP (BAHAN MEDIS HABIS PAKAI) ENDPOINTS
# ============================================================

@router.get("/uks/bmhp")
async def list_bmhp(search: Optional[str] = None, user: Dict = Depends(get_current_user)):
    """List the BMHP catalog, each enriched with stock aggregated live from its
    BMHP Masuk batches and a low-stock flag (mirrors GET /uks/obat)."""
    query = {}
    if search:
        query['nama_bmhp'] = {'$regex': re.escape(search), '$options': 'i'}
    items = await db.uks_bmhp.find(query, {'_id': 0, 'nama_key': 0}).sort('nama_bmhp', 1).to_list(2000)

    enriched = []
    for i in items:
        summary = await _get_bmhp_stock_summary(i['id'])
        doc = {**i, **summary}
        doc['stok_menipis'] = summary['stok_tersisa'] <= (i.get('stok_minimum') or 0)
        enriched.append(serialize_doc(doc))
    return enriched


@router.get("/uks/bmhp/{bmhp_id}")
async def get_bmhp(bmhp_id: str, user: Dict = Depends(get_current_user)):
    doc = await _get_bmhp_or_404(bmhp_id)
    doc.pop('nama_key', None)
    summary = await _get_bmhp_stock_summary(bmhp_id)
    out = {**doc, **summary, 'stok_menipis': summary['stok_tersisa'] <= (doc.get('stok_minimum') or 0)}
    return serialize_doc(out)


@router.post("/uks/bmhp")
async def create_bmhp(req: BMHPRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    data = _clean_bmhp_request(req)
    await _ensure_bmhp_name_free(data['nama_key'])
    now = datetime.utcnow().isoformat()
    doc = {
        'id': str(uuid.uuid4()),
        **data,
        'created_by': user['id'],
        'created_at': now,
        'updated_at': now,
    }
    await db.uks_bmhp.insert_one(doc)
    await log_audit(user, 'uks_bmhp_create', f"Created BMHP: {data['nama_bmhp']}")
    doc.pop('nama_key', None)
    return serialize_doc(doc)


@router.put("/uks/bmhp/{bmhp_id}")
async def update_bmhp(bmhp_id: str, req: BMHPRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    await _get_bmhp_or_404(bmhp_id)
    data = _clean_bmhp_request(req)
    await _ensure_bmhp_name_free(data['nama_key'], exclude_id=bmhp_id)
    data['updated_at'] = datetime.utcnow().isoformat()
    await db.uks_bmhp.update_one({'id': bmhp_id}, {'$set': data})
    await log_audit(user, 'uks_bmhp_update', f"Updated BMHP: {bmhp_id}")

    updated = await db.uks_bmhp.find_one({'id': bmhp_id}, {'_id': 0, 'nama_key': 0})
    return serialize_doc(updated)


@router.delete("/uks/bmhp/{bmhp_id}")
async def delete_bmhp(bmhp_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    await _get_bmhp_or_404(bmhp_id)

    has_masuk = await db.uks_bmhp_masuk.count_documents({'bmhp_id': bmhp_id})
    has_keluar = await db.uks_bmhp_keluar.count_documents({'bmhp_id': bmhp_id})
    if has_masuk or has_keluar:
        raise HTTPException(400, "BMHP ini sudah memiliki riwayat masuk/keluar dan tidak dapat dihapus")

    await db.uks_bmhp.delete_one({'id': bmhp_id})
    await log_audit(user, 'uks_bmhp_delete', f"Deleted BMHP: {bmhp_id}")
    return {'message': 'Data BMHP berhasil dihapus'}


# ============================================================
# BMHP MASUK ENDPOINTS
# ============================================================

def _bmhp_tanggal_filter(bulan: Optional[str], start_date: Optional[str], end_date: Optional[str]) -> Optional[Dict]:
    """Filter tanggal untuk riwayat BMHP: bulan=YYYY-MM, atau rentang start/end (YYYY-MM-DD)."""
    if bulan:
        if not re.fullmatch(r'\d{4}-\d{2}', bulan):
            raise HTTPException(400, "Format bulan harus YYYY-MM")
        year, month = int(bulan[:4]), int(bulan[5:])
        if not 1 <= month <= 12:
            raise HTTPException(400, "Bulan tidak valid")
        last_day = calendar.monthrange(year, month)[1]
        return {'$gte': f"{bulan}-01", '$lte': f"{bulan}-{last_day:02d}"}
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        return date_query
    return None


@router.get("/uks/bmhp-masuk")
async def list_bmhp_masuk(
    bmhp_id: Optional[str] = None,
    bulan: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES))
):
    """Riwayat BMHP masuk (terbaru dulu), bisa difilter per BMHP dan per bulan/rentang tanggal."""
    query = {}
    if bmhp_id:
        query['bmhp_id'] = bmhp_id
    tanggal = _bmhp_tanggal_filter(bulan, start_date, end_date)
    if tanggal:
        query['tanggal'] = tanggal

    items = await db.uks_bmhp_masuk.find(query, {'_id': 0}).sort([('tanggal', -1), ('created_at', -1)]).to_list(3000)
    satuan = {b['id']: b.get('satuan') for b in await db.uks_bmhp.find({}, {'_id': 0, 'id': 1, 'satuan': 1}).to_list(2000)}
    return [serialize_doc({**i, 'satuan': satuan.get(i.get('bmhp_id'))}) for i in items]


@router.post("/uks/bmhp-masuk")
async def create_bmhp_masuk(req: BMHPMasukRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    """Record a new BMHP stock batch. Stock is updated automatically because
    GET /uks/bmhp sums stok_sisa across batches; stok_sisa starts equal to
    jumlah and is depleted FEFO when BMHP is used in a Penanganan Kunjungan."""
    bmhp = await _get_bmhp_or_404(req.bmhp_id)
    if req.jumlah <= 0:
        raise HTTPException(400, "Jumlah harus lebih dari 0")
    today_wib = (datetime.utcnow() + timedelta(hours=7)).strftime('%Y-%m-%d')
    if req.tanggal > today_wib:
        raise HTTPException(400, "Tanggal masuk tidak boleh melebihi hari ini")
    if req.tanggal_kadaluarsa and req.tanggal_kadaluarsa <= req.tanggal:
        raise HTTPException(400, "Tanggal kadaluarsa harus setelah tanggal masuk")

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'tanggal_kadaluarsa': req.tanggal_kadaluarsa or None,
        'stok_sisa': req.jumlah,
        'bmhp_nama': bmhp.get('nama_bmhp'),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
    }
    await db.uks_bmhp_masuk.insert_one(doc)
    await log_audit(user, 'uks_bmhp_masuk_create', f"BMHP masuk: {bmhp.get('nama_bmhp')} +{req.jumlah}")
    doc.pop('_id', None)
    return {**serialize_doc(doc), 'stok': await _get_bmhp_stock_summary(req.bmhp_id)}


@router.delete("/uks/bmhp-masuk/{entry_id}")
async def delete_bmhp_masuk(entry_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_bmhp_masuk.find_one({'id': entry_id})
    if not existing:
        raise HTTPException(404, "Data BMHP masuk tidak ditemukan")

    if existing.get('stok_sisa', 0) < existing.get('jumlah', 0):
        raise HTTPException(400, "Batch ini sudah terpakai sebagian dan tidak dapat dihapus.")

    await db.uks_bmhp_masuk.delete_one({'id': entry_id})
    await log_audit(user, 'uks_bmhp_masuk_delete', f"Deleted BMHP masuk: {entry_id}")
    return {'message': 'Data BMHP masuk berhasil dihapus', 'stok': await _get_bmhp_stock_summary(existing['bmhp_id'])}


# ============================================================
# BMHP KELUAR ENDPOINTS (hanya baca — dibuat otomatis oleh penanganan kunjungan)
# ============================================================

@router.get("/uks/bmhp-keluar")
async def list_bmhp_keluar(
    bmhp_id: Optional[str] = None,
    kunjungan_id: Optional[str] = None,
    pasien_tipe: Optional[str] = None,  # 'siswa' atau 'gtk'
    bulan: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES))
):
    """Riwayat BMHP keluar (terbaru dulu). Setiap baris berasal dari penanganan
    kunjungan, diperkaya dengan satuan BMHP, tipe pasien (siswa/gtk), dan kelas siswa."""
    query = {}
    if bmhp_id:
        query['bmhp_id'] = bmhp_id
    if kunjungan_id:
        query['kunjungan_id'] = kunjungan_id
    if pasien_tipe == 'siswa':
        query['pasien_roles'] = 'siswa'
    elif pasien_tipe == 'gtk':
        query['pasien_roles'] = {'$ne': 'siswa'}
    elif pasien_tipe:
        raise HTTPException(400, "pasien_tipe harus 'siswa' atau 'gtk'")
    tanggal = _bmhp_tanggal_filter(bulan, start_date, end_date)
    if tanggal:
        query['tanggal'] = tanggal

    items = await db.uks_bmhp_keluar.find(query, {'_id': 0, 'batch_alokasi': 0}).sort([('tanggal', -1), ('created_at', -1)]).to_list(3000)

    satuan = {b['id']: b.get('satuan') for b in await db.uks_bmhp.find({}, {'_id': 0, 'id': 1, 'satuan': 1}).to_list(2000)}
    pasien_ids = list({i.get('pasien_id') for i in items if i.get('pasien_id')})
    pasien = {u['id']: u for u in await db.users.find(
        {'id': {'$in': pasien_ids}}, {'_id': 0, 'id': 1, 'student_class_id': 1}
    ).to_list(len(pasien_ids) or 1)}
    class_ids = list({u.get('student_class_id') for u in pasien.values() if u.get('student_class_id')})
    kelas = {c['id']: c.get('name') for c in await db.classes.find(
        {'id': {'$in': class_ids}}, {'_id': 0, 'id': 1, 'name': 1}
    ).to_list(len(class_ids) or 1)}

    out = []
    for i in items:
        roles = i.get('pasien_roles') or []
        is_siswa = 'siswa' in roles
        class_id = pasien.get(i.get('pasien_id'), {}).get('student_class_id')
        out.append(serialize_doc({
            **i,
            'satuan': satuan.get(i.get('bmhp_id')),
            'pasien_tipe': 'siswa' if is_siswa else 'gtk',
            'pasien_kelas': kelas.get(class_id) if is_siswa else None,
        }))
    return out


# ============================================================
# DATA KUNJUNGAN UKS ENDPOINTS (input + riwayat)
# ============================================================

@router.get("/uks/kunjungan")
async def list_kunjungan(
    pasien_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    jenis_penanganan_id: Optional[str] = None,
    diagnosa_id: Optional[str] = None,
    pasien_tipe: Optional[str] = None,  # 'siswa' atau 'gtk'
    status: Optional[str] = None,
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES))
):
    """Riwayat kunjungan UKS (terbaru dulu). Setiap baris selalu memuat field
    diagnosa (diagnosa_utama_id/nama/kode, diagnosa_tambahan_ids/nama) dan
    bmhp_dipakai; kunjungan lama yang belum punya diagnosa berisi None/list kosong.
    diagnosa_id menyaring kunjungan yang memakai diagnosa itu (utama atau tambahan);
    pasien_tipe memisahkan kunjungan siswa dan GTK."""
    query = {}
    if pasien_id:
        query['pasien_id'] = pasien_id
    if jenis_penanganan_id:
        query['jenis_penanganan_ids'] = jenis_penanganan_id
    and_clauses = []
    if diagnosa_id:
        and_clauses.append({'$or': [{'diagnosa_utama_id': diagnosa_id}, {'diagnosa_tambahan_ids': diagnosa_id}]})
    if pasien_tipe:
        if pasien_tipe not in ('siswa', 'gtk'):
            raise HTTPException(400, "pasien_tipe harus 'siswa' atau 'gtk'")
        # Data lama tanpa snapshot pasien_tipe dikenali dari peran pasien.
        role_match = {'pasien_roles': 'siswa'} if pasien_tipe == 'siswa' else {'pasien_roles': {'$ne': 'siswa'}}
        and_clauses.append({'$or': [{'pasien_tipe': pasien_tipe}, {'pasien_tipe': {'$in': [None]}, **role_match}]})
    if and_clauses:
        query['$and'] = and_clauses
    if status:
        query['status'] = status
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal'] = date_query

    await sembunyikan_siswa_nonaktif(query, 'pasien_id', db)  # data siswa nonaktif disembunyikan, tidak dihapus
    items = await db.uks_kunjungan.find(query, {'_id': 0}).sort(KUNJUNGAN_SORT_TERBARU).to_list(5000)
    return [serialize_doc(_with_kunjungan_defaults(i)) for i in items]


async def _pasien_snapshot(pasien: Dict) -> Dict:
    """Salinan identitas pasien yang disimpan di kunjungan: tipe (siswa/gtk) dan
    nama kelas saat kunjungan, agar riwayat tetap benar walau siswa naik kelas."""
    is_siswa = 'siswa' in (pasien.get('roles') or [])
    kelas = None
    if is_siswa and pasien.get('student_class_id'):
        cls = await db.classes.find_one({'id': pasien['student_class_id']}, {'_id': 0, 'name': 1})
        kelas = cls.get('name') if cls else None
    return {'pasien_tipe': 'siswa' if is_siswa else 'gtk', 'pasien_kelas': kelas}


def _clean_keluhan(keluhan: Optional[str]) -> str:
    text = (keluhan or '').strip()
    if not text:
        raise HTTPException(400, "Keluhan wajib diisi")
    return text


# Catatan petugas yang dicetak di bawah bagian penatalaksanaan pada surat
# keterangan UKS (rujukan / perizinan pulang), beserta jejak siapa & kapan mengubahnya.
CATATAN_SURAT_MAX = 1000
KUNJUNGAN_CATATAN_SURAT_DEFAULTS = {
    'catatan_surat': None,
    'catatan_surat_oleh': None,
    'catatan_surat_pada': None,
}


def _with_kunjungan_defaults(doc: Dict) -> Dict:
    """Lengkapi dokumen kunjungan lama dengan field diagnosa/BMHP agar bentuk respons konsisten."""
    return {
        'diagnosa_utama_id': None,
        'diagnosa_utama_nama': None,
        'diagnosa_utama_kode': None,
        'diagnosa_tambahan_ids': [],
        'diagnosa_tambahan_nama': [],
        'bmhp_dipakai': [],
        'pasien_tipe': None,
        'pasien_kelas': None,
        **KUNJUNGAN_CATATAN_SURAT_DEFAULTS,
        **doc,
    }


def _today_wib() -> datetime:
    return datetime.utcnow() + timedelta(hours=7)


# Urutan riwayat kunjungan, dijalankan di MongoDB: terbaru ke terlama berdasarkan
# tanggal, lalu jam (kosong/null = paling awal di hari itu), lalu waktu input.
KUNJUNGAN_SORT_TERBARU = [('tanggal', -1), ('waktu', -1), ('created_at', -1)]


@router.get("/uks/pasien/{pasien_id}/riwayat-kunjungan")
async def get_riwayat_kunjungan_pasien(
    pasien_id: str,
    hari: int = Query(365, ge=1, le=3650, description="Panjang periode ke belakang dari hari ini (WIB)"),
    jenis_pasien: Optional[str] = None,  # 'siswa' atau 'gtk'; bila diisi harus cocok dengan pasien
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES)),
):
    """Riwayat kunjungan UKS seorang pasien (siswa/GTK) dalam N hari terakhir
    (default 1 tahun), untuk ditampilkan di bawah form kunjungan. Berisi identitas
    pasien, periode, ringkasan, dan daftar kunjungan urut terbaru ke terlama
    lengkap dengan keluhan, diagnosa, penanganan, serta obat/BMHP."""
    if jenis_pasien not in (None, 'siswa', 'gtk'):
        raise HTTPException(400, "jenis_pasien harus 'siswa' atau 'gtk'")
    pasien = await _get_user_or_404(pasien_id)
    snapshot = await _pasien_snapshot(pasien)
    if jenis_pasien and snapshot['pasien_tipe'] != jenis_pasien:
        label = {'siswa': 'siswa', 'gtk': 'GTK'}
        raise HTTPException(400, f"Pasien ini terdaftar sebagai {label[snapshot['pasien_tipe']]}, bukan {label[jenis_pasien]}")

    today = _today_wib()
    mulai = (today - timedelta(days=hari)).strftime('%Y-%m-%d')
    selesai = today.strftime('%Y-%m-%d')

    raw = await db.uks_kunjungan.find(
        {'pasien_id': pasien_id, 'tanggal': {'$gte': mulai, '$lte': selesai}}, {'_id': 0}
    ).sort(KUNJUNGAN_SORT_TERBARU).to_list(2000)
    items = [_with_kunjungan_defaults(k) for k in raw]

    diag_counts: Dict[str, int] = {}
    for k in items:
        if k.get('diagnosa_utama_nama'):
            diag_counts[k['diagnosa_utama_nama']] = diag_counts.get(k['diagnosa_utama_nama'], 0) + 1
    top = max(diag_counts.items(), key=lambda kv: kv[1]) if diag_counts else None
    batas_30 = (today - timedelta(days=30)).strftime('%Y-%m-%d')

    return {
        'pasien': {
            'id': pasien_id,
            'nama': pasien.get('full_name'),
            'identitas': pasien.get('nis') or pasien.get('nip_nuptk') or pasien.get('username'),
            **snapshot,
        },
        'periode': {'hari': hari, 'mulai': mulai, 'selesai': selesai},
        'ringkasan': {
            'total': len(items),
            'sudah_ditangani': sum(1 for k in items if k.get('status') == 'Sudah Ditangani'),
            'kunjungan_30_hari': sum(1 for k in items if (k.get('tanggal') or '') >= batas_30),
            'diagnosa_terbanyak': {'nama': top[0], 'jumlah': top[1]} if top else None,
            'kunjungan_terakhir': items[0].get('tanggal') if items else None,
        },
        'items': [serialize_doc(k) for k in items],
    }


async def _get_siswa_for_riwayat(student_id: str, user: Dict) -> Dict:
    """Ambil siswa dan pastikan pengguna boleh melihat riwayat kesehatannya.
    Data kesehatan bersifat sensitif, jadi aksesnya lebih sempit dari data siswa biasa:
    admin, petugas UKS, kepala sekolah, dan wali kelas HANYA untuk siswa di kelasnya."""
    siswa = await _get_user_or_404(student_id)
    if 'siswa' not in (siswa.get('roles') or []):
        raise HTTPException(400, "Pengguna ini bukan siswa")

    active = user.get('active_role')
    if 'admin' in (user.get('roles') or []) or active in UKS_VIEW_ROLES:
        return siswa
    if active == 'wali_kelas' or 'wali_kelas' in (user.get('roles') or []):
        cls = await db.classes.find_one({'id': siswa.get('student_class_id')}, {'_id': 0, 'homeroom_teacher_id': 1}) if siswa.get('student_class_id') else None
        if cls and cls.get('homeroom_teacher_id') == user['id']:
            return siswa
        raise HTTPException(403, "Wali kelas hanya dapat melihat riwayat UKS siswa di kelasnya")
    raise HTTPException(403, "Anda tidak memiliki akses ke riwayat UKS siswa")


async def _siswa_identitas(siswa: Dict) -> Dict:
    kelas_nama, wali_nama = None, None
    if siswa.get('student_class_id'):
        cls = await db.classes.find_one({'id': siswa['student_class_id']}, {'_id': 0, 'name': 1, 'homeroom_teacher_id': 1})
        if cls:
            kelas_nama = cls.get('name')
            if cls.get('homeroom_teacher_id'):
                wali = await db.users.find_one({'id': cls['homeroom_teacher_id']}, {'_id': 0, 'full_name': 1})
                wali_nama = wali.get('full_name') if wali else None
    return {
        'id': siswa['id'],
        'nama': siswa.get('full_name'),
        'nis': siswa.get('nis'),
        'nisn': siswa.get('nisn'),
        'kelas': kelas_nama,
        'wali_kelas_nama': wali_nama,
        'umur': _calc_umur(siswa.get('birth_date')),
        'gender': siswa.get('gender'),
    }


def _tahun_filter(tahun: Optional[str]) -> Optional[Dict]:
    if not tahun:
        return None
    if not re.fullmatch(r'\d{4}', tahun):
        raise HTTPException(400, "Format tahun harus YYYY")
    return {'$gte': f"{tahun}-01-01", '$lte': f"{tahun}-12-31"}


@router.get("/uks/siswa/{student_id}/riwayat-kunjungan")
async def get_riwayat_kunjungan_siswa(
    student_id: str,
    tahun: Optional[str] = None,
    status: Optional[str] = None,
    user: Dict = Depends(get_current_user),
):
    """Seluruh riwayat kunjungan UKS seorang siswa (untuk menu Riwayat UKS di data
    siswa), urut terbaru ke terlama, opsional difilter tahun (YYYY) dan status.
    Respons memuat identitas siswa, ringkasan, daftar tahun yang punya kunjungan,
    dan daftar kunjungan lengkap dengan keluhan, diagnosa, penanganan, obat/BMHP."""
    siswa = await _get_siswa_for_riwayat(student_id, user)

    query: Dict = {'pasien_id': student_id}
    tanggal = _tahun_filter(tahun)
    if tanggal:
        query['tanggal'] = tanggal
    if status:
        if status not in ('Belum Ditangani', 'Sudah Ditangani'):
            raise HTTPException(400, "Status tidak valid")
        query['status'] = status

    raw = await db.uks_kunjungan.find(query, {'_id': 0}).sort(KUNJUNGAN_SORT_TERBARU).to_list(5000)
    items = [_with_kunjungan_defaults(k) for k in raw]

    all_dates = await db.uks_kunjungan.distinct('tanggal', {'pasien_id': student_id})
    tahun_tersedia = sorted({d[:4] for d in all_dates if d}, reverse=True)

    diag_counts: Dict[str, int] = {}
    for k in items:
        if k.get('diagnosa_utama_nama'):
            diag_counts[k['diagnosa_utama_nama']] = diag_counts.get(k['diagnosa_utama_nama'], 0) + 1
    top = max(diag_counts.items(), key=lambda kv: kv[1]) if diag_counts else None

    return {
        'siswa': await _siswa_identitas(siswa),
        'filter': {'tahun': tahun, 'status': status},
        'tahun_tersedia': tahun_tersedia,
        'ringkasan': {
            'total': len(items),
            'sudah_ditangani': sum(1 for k in items if k.get('status') == 'Sudah Ditangani'),
            'diagnosa_terbanyak': {'nama': top[0], 'jumlah': top[1]} if top else None,
            'kunjungan_terakhir': items[0].get('tanggal') if items else None,
        },
        'items': [serialize_doc(k) for k in items],
    }


def _hitung_imt(tinggi_badan, berat_badan) -> Optional[float]:
    """IMT = BB (kg) / TB (m)^2, dibulatkan 1 desimal; None bila data tidak lengkap."""
    try:
        tb, bb = float(tinggi_badan), float(berat_badan)
    except (TypeError, ValueError):
        return None
    if tb <= 0 or bb <= 0:
        return None
    return round(bb / ((tb / 100) ** 2), 1)


def _selisih(now, prev) -> Optional[float]:
    try:
        return round(float(now) - float(prev), 1)
    except (TypeError, ValueError):
        return None


@router.get("/uks/siswa/{student_id}/riwayat-ckg")
async def get_riwayat_ckg_siswa(student_id: str, tahun: Optional[str] = None, user: Dict = Depends(get_current_user)):
    """Riwayat pemeriksaan CKG seorang siswa (tab Riwayat CKG), urut terbaru ke
    terlama, opsional difilter tahun. Setiap baris diberi IMT hasil hitung; ringkasan
    membandingkan pemeriksaan terakhir dengan sebelumnya (perubahan TB/BB).
    Akses sama dengan riwayat kunjungan siswa (termasuk wali kelas untuk kelasnya)."""
    siswa = await _get_siswa_for_riwayat(student_id, user)

    query: Dict = {'pasien_id': student_id}
    tanggal = _tahun_filter(tahun)
    if tanggal:
        query['tanggal'] = tanggal
    raw = await db.uks_ckg.find(query, {'_id': 0}).sort([('tanggal', -1), ('created_at', -1)]).to_list(2000)
    items = [{**c, 'imt': _hitung_imt(c.get('tinggi_badan'), c.get('berat_badan'))} for c in raw]

    all_dates = await db.uks_ckg.distinct('tanggal', {'pasien_id': student_id})
    last = items[0] if items else None
    prev = items[1] if len(items) > 1 else None
    return {
        'siswa': await _siswa_identitas(siswa),
        'filter': {'tahun': tahun},
        'tahun_tersedia': sorted({d[:4] for d in all_dates if d}, reverse=True),
        'ringkasan': {
            'total': len(items),
            'pemeriksaan_terakhir': last.get('tanggal') if last else None,
            'tinggi_badan': last.get('tinggi_badan') if last else None,
            'berat_badan': last.get('berat_badan') if last else None,
            'imt': last.get('imt') if last else None,
            'perubahan_tinggi_badan': _selisih(last.get('tinggi_badan'), prev.get('tinggi_badan')) if last and prev else None,
            'perubahan_berat_badan': _selisih(last.get('berat_badan'), prev.get('berat_badan')) if last and prev else None,
        },
        'items': [serialize_doc(c) for c in items],
    }


# ============================================================
# LAPORAN UKS BARU: REKAP PENEGAKAN DIAGNOSA PER KUNJUNGAN
# ============================================================

def _match_pasien_tipe(pasien_tipe: Optional[str]) -> Dict:
    """Filter siswa/GTK yang juga mengenali kunjungan lama tanpa snapshot pasien_tipe."""
    if not pasien_tipe:
        return {}
    if pasien_tipe not in ('siswa', 'gtk'):
        raise HTTPException(400, "pasien_tipe harus 'siswa' atau 'gtk'")
    role_match = {'pasien_roles': 'siswa'} if pasien_tipe == 'siswa' else {'pasien_roles': {'$ne': 'siswa'}}
    return {'$or': [{'pasien_tipe': pasien_tipe}, {'pasien_tipe': {'$in': [None]}, **role_match}]}


async def _rekap_diagnosa(start: str, end: str, pasien_tipe: Optional[str]) -> Dict:
    """Rekap penegakan diagnosa kunjungan UKS dalam rentang tanggal [start, end],
    dihitung lewat aggregation MongoDB. Per diagnosa: jumlah kunjungan sebagai
    diagnosa utama, jumlah pasien berbeda (diagnosa utama), jumlah kemunculan sebagai
    diagnosa tambahan, total, dan persentase terhadap kunjungan yang terdiagnosa."""
    match = {'tanggal': {'$gte': start, '$lte': end}, **_match_pasien_tipe(pasien_tipe)}

    totals = await db.uks_kunjungan.aggregate([
        {'$match': match},
        {'$group': {
            '_id': None,
            'total_kunjungan': {'$sum': 1},
            'dengan_diagnosa': {'$sum': {'$cond': [{'$ifNull': ['$diagnosa_utama_id', False]}, 1, 0]}},
            'pasien': {'$addToSet': '$pasien_id'},
            'pasien_dx': {'$addToSet': {'$cond': [{'$ifNull': ['$diagnosa_utama_id', False]}, '$pasien_id', '$$REMOVE']}},
        }},
        {'$project': {'_id': 0, 'total_kunjungan': 1, 'dengan_diagnosa': 1,
                      'pasien_unik': {'$size': '$pasien'}, 'pasien_unik_terdiagnosa': {'$size': '$pasien_dx'}}},
    ]).to_list(1)
    t = totals[0] if totals else {'total_kunjungan': 0, 'dengan_diagnosa': 0, 'pasien_unik': 0, 'pasien_unik_terdiagnosa': 0}

    utama = await db.uks_kunjungan.aggregate([
        {'$match': {**match, 'diagnosa_utama_id': {'$nin': [None, '']}}},
        {'$group': {
            '_id': '$diagnosa_utama_id',
            'nama': {'$last': '$diagnosa_utama_nama'},
            'kode': {'$last': '$diagnosa_utama_kode'},
            'utama': {'$sum': 1},
            'pasien': {'$addToSet': '$pasien_id'},
        }},
        {'$project': {'nama': 1, 'kode': 1, 'utama': 1, 'jumlah_pasien': {'$size': '$pasien'}}},
    ]).to_list(1000)

    tambahan = await db.uks_kunjungan.aggregate([
        {'$match': {**match, 'diagnosa_tambahan_ids.0': {'$exists': True}}},
        {'$project': {'pair': {'$zip': {'inputs': ['$diagnosa_tambahan_ids', {'$ifNull': ['$diagnosa_tambahan_nama', []]}], 'useLongestLength': True}}}},
        {'$unwind': '$pair'},
        {'$group': {'_id': {'$arrayElemAt': ['$pair', 0]}, 'nama': {'$last': {'$arrayElemAt': ['$pair', 1]}}, 'tambahan': {'$sum': 1}}},
    ]).to_list(1000)

    rows: Dict[str, Dict] = {}
    for u in utama:
        rows[u['_id']] = {'diagnosa_id': u['_id'], 'nama': u.get('nama'), 'kode': u.get('kode'),
                          'utama': u['utama'], 'jumlah_pasien': u['jumlah_pasien'], 'tambahan': 0}
    for tb in tambahan:
        if not tb['_id']:
            continue
        row = rows.setdefault(tb['_id'], {'diagnosa_id': tb['_id'], 'nama': tb.get('nama'), 'kode': None,
                                          'utama': 0, 'jumlah_pasien': 0, 'tambahan': 0})
        row['tambahan'] = tb['tambahan']
        row['nama'] = row['nama'] or tb.get('nama')

    # Lengkapi kode/nama dari master bila salinan di kunjungan kosong.
    missing = [r['diagnosa_id'] for r in rows.values() if not r['kode'] or not r['nama']]
    if missing:
        for d in await db.uks_diagnosa.find({'id': {'$in': missing}}, {'_id': 0, 'id': 1, 'nama': 1, 'kode': 1}).to_list(len(missing)):
            r = rows[d['id']]
            r['nama'] = r['nama'] or d.get('nama')
            r['kode'] = r['kode'] or d.get('kode')

    dengan = t['dengan_diagnosa']
    items = []
    for r in rows.values():
        r['total'] = r['utama'] + r['tambahan']
        r['persen'] = round(r['utama'] / dengan * 100, 1) if dengan else 0
        items.append(r)
    items.sort(key=lambda r: (-r['utama'], -r['total'], (r['nama'] or '').lower()))

    return {
        'ringkasan': {
            'total_kunjungan': t['total_kunjungan'],
            'dengan_diagnosa': dengan,
            'tanpa_diagnosa': t['total_kunjungan'] - dengan,
            'pasien_unik': t['pasien_unik'],
            'pasien_unik_terdiagnosa': t['pasien_unik_terdiagnosa'],
            'jenis_diagnosa': len(items),
        },
        'items': items,
    }


def _periode_laporan(periode: Optional[str], tahun: Optional[str], bulan: Optional[str]) -> Dict:
    """Ubah parameter periode laporan (bulanan/tahunan) menjadi rentang tanggal."""
    periode = periode or 'bulanan'
    if periode not in ('bulanan', 'tahunan'):
        raise HTTPException(400, "periode harus 'bulanan' atau 'tahunan'")
    if not tahun or not re.fullmatch(r'\d{4}', tahun):
        raise HTTPException(400, "Tahun wajib diisi dengan format YYYY")
    today = _today_wib()
    if not 2000 <= int(tahun) <= today.year + 1:
        raise HTTPException(400, f"Tahun harus antara 2000 dan {today.year + 1}")
    if periode == 'bulanan' and bulan and re.fullmatch(r'0[1-9]|1[0-2]', bulan):
        if f"{tahun}-{bulan}" > today.strftime('%Y-%m'):
            raise HTTPException(400, "Periode laporan belum berjalan (bulan di masa depan)")
    elif periode == 'tahunan' and int(tahun) > today.year:
        raise HTTPException(400, "Periode laporan belum berjalan (tahun di masa depan)")
    if periode == 'tahunan':
        return {'periode': 'tahunan', 'tahun': tahun, 'bulan': None,
                'start': f"{tahun}-01-01", 'end': f"{tahun}-12-31", 'label': f"Tahun {tahun}"}
    if not bulan or not re.fullmatch(r'0[1-9]|1[0-2]', bulan):
        raise HTTPException(400, "Bulan wajib diisi dengan format 01-12 untuk periode bulanan")
    last = calendar.monthrange(int(tahun), int(bulan))[1]
    nama_bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus',
                  'September', 'Oktober', 'November', 'Desember'][int(bulan) - 1]
    return {'periode': 'bulanan', 'tahun': tahun, 'bulan': bulan,
            'start': f"{tahun}-{bulan}-01", 'end': f"{tahun}-{bulan}-{last:02d}", 'label': f"{nama_bulan} {tahun}"}


@router.get("/uks/laporan-baru/diagnosa")
async def laporan_rekap_diagnosa(
    periode: Optional[str] = 'bulanan',
    tahun: Optional[str] = None,
    bulan: Optional[str] = None,
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES)),
):
    """Laporan UKS Baru — rekap penegakan diagnosa per kunjungan untuk satu periode,
    dipisah menjadi data siswa dan GTK (masing-masing ringkasan + daftar diagnosa)."""
    per = _periode_laporan(periode, tahun, bulan)
    return {
        'periode': per,
        'siswa': await _rekap_diagnosa(per['start'], per['end'], 'siswa'),
        'gtk': await _rekap_diagnosa(per['start'], per['end'], 'gtk'),
    }


@router.get("/uks/laporan-baru/diagnosa/{diagnosa_id}/kunjungan")
async def laporan_rincian_diagnosa(
    diagnosa_id: str,
    pasien_tipe: str,
    periode: Optional[str] = 'bulanan',
    tahun: Optional[str] = None,
    bulan: Optional[str] = None,
    peran: Optional[str] = None,  # 'utama' | 'tambahan' | None (semua)
    q: Optional[str] = None,  # cari nama pasien, keluhan, atau kelas
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES)),
):
    """Rincian kunjungan untuk satu baris rekap diagnosa (modal di Laporan UKS Baru):
    semua kunjungan siswa/GTK dalam periode yang memakai diagnosa ini, ditandai
    perannya ('utama' atau 'tambahan'), urut terbaru ke terlama."""
    if pasien_tipe not in ('siswa', 'gtk'):
        raise HTTPException(400, "pasien_tipe harus 'siswa' atau 'gtk'")
    if peran not in (None, '', 'utama', 'tambahan'):
        raise HTTPException(400, "peran harus 'utama' atau 'tambahan'")
    per = _periode_laporan(periode, tahun, bulan)
    if peran == 'utama':
        dx_match = {'diagnosa_utama_id': diagnosa_id}
    elif peran == 'tambahan':
        dx_match = {'diagnosa_tambahan_ids': diagnosa_id, 'diagnosa_utama_id': {'$ne': diagnosa_id}}
    else:
        dx_match = {'$or': [{'diagnosa_utama_id': diagnosa_id}, {'diagnosa_tambahan_ids': diagnosa_id}]}
    clauses = [
        {'tanggal': {'$gte': per['start'], '$lte': per['end']}},
        _match_pasien_tipe(pasien_tipe),
        dx_match,
    ]
    if q and q.strip():
        pattern = {'$regex': re.escape(q.strip()), '$options': 'i'}
        clauses.append({'$or': [{'pasien_nama': pattern}, {'keluhan': pattern}, {'pasien_kelas': pattern}]})
    query = {'$and': clauses}
    raw = await db.uks_kunjungan.find(query, {'_id': 0}).sort(KUNJUNGAN_SORT_TERBARU).to_list(5000)
    items = []
    for k in raw:
        k = _with_kunjungan_defaults(k)
        k['peran'] = 'utama' if k.get('diagnosa_utama_id') == diagnosa_id else 'tambahan'
        items.append(serialize_doc(k))

    master = await db.uks_diagnosa.find_one({'id': diagnosa_id}, {'_id': 0, 'nama': 1, 'kode': 1})
    nama = (master or {}).get('nama') or next((k['diagnosa_utama_nama'] for k in items if k['peran'] == 'utama' and k.get('diagnosa_utama_nama')), None)
    return {
        'periode': per,
        'pasien_tipe': pasien_tipe,
        'diagnosa': {'id': diagnosa_id, 'nama': nama, 'kode': (master or {}).get('kode')},
        'jumlah_utama': sum(1 for k in items if k['peran'] == 'utama'),
        'jumlah_tambahan': sum(1 for k in items if k['peran'] == 'tambahan'),
        'items': items,
    }


# ============================================================
# LAPORAN UKS BARU: REKAP OPNAME OBAT & BMHP
# ============================================================

async def _sum_mutasi_per_item(coll, id_field: str, start: str, end: str) -> Dict[str, Dict[str, int]]:
    """Jumlah mutasi (masuk/keluar) per item: sebelum periode dan di dalam periode."""
    rows = await coll.aggregate([
        {'$match': {'tanggal': {'$lte': end}}},
        {'$group': {
            '_id': f'${id_field}',
            'sebelum': {'$sum': {'$cond': [{'$lt': ['$tanggal', start]}, {'$ifNull': ['$jumlah', 0]}, 0]}},
            'periode': {'$sum': {'$cond': [{'$gte': ['$tanggal', start]}, {'$ifNull': ['$jumlah', 0]}, 0]}},
        }},
    ]).to_list(5000)
    return {r['_id']: {'sebelum': r['sebelum'], 'periode': r['periode']} for r in rows}


async def _rekap_opname(item_coll, masuk_coll, keluar_coll, id_field: str, nama_field: str, start: str, end: str) -> Dict:
    """Rekap opname persediaan untuk rentang [start, end] (dipakai obat & BMHP):
    stok_awal = masuk - keluar sebelum start; masuk/keluar = mutasi dalam periode;
    stok_akhir = stok_awal + masuk - keluar. Disertakan pula stok sistem saat ini
    (jumlah stok_sisa batch) dan kadaluarsa terdekat batch yang masih ada stoknya."""
    items = await item_coll.find({}, {'_id': 0, 'id': 1, nama_field: 1, 'satuan': 1, 'stok_minimum': 1, 'jenis': 1}).sort(nama_field, 1).to_list(5000)
    masuk = await _sum_mutasi_per_item(masuk_coll, id_field, start, end)
    keluar = await _sum_mutasi_per_item(keluar_coll, id_field, start, end)

    stok_now = {r['_id']: r for r in await masuk_coll.aggregate([
        {'$match': {'stok_sisa': {'$gt': 0}}},
        {'$group': {
            '_id': f'${id_field}',
            'stok': {'$sum': '$stok_sisa'},
            'kadaluarsa': {'$min': {'$cond': [{'$gt': [{'$ifNull': ['$tanggal_kadaluarsa', '']}, '']}, '$tanggal_kadaluarsa', None]}},
        }},
    ]).to_list(5000)}

    rows = []
    for it in items:
        m = masuk.get(it['id'], {'sebelum': 0, 'periode': 0})
        k = keluar.get(it['id'], {'sebelum': 0, 'periode': 0})
        awal = m['sebelum'] - k['sebelum']
        akhir = awal + m['periode'] - k['periode']
        minimum = it.get('stok_minimum') or 0
        status = 'Habis' if akhir <= 0 else ('Menipis' if akhir <= minimum else 'Aman')
        now = stok_now.get(it['id'], {})
        rows.append({
            'id': it['id'],
            'nama': it.get(nama_field),
            'jenis': it.get('jenis'),
            'satuan': it.get('satuan'),
            'stok_minimum': minimum,
            'stok_awal': awal,
            'masuk': m['periode'],
            'keluar': k['periode'],
            'stok_akhir': akhir,
            'status': status,
            'stok_saat_ini': now.get('stok', 0),
            'tanggal_kadaluarsa_terdekat': now.get('kadaluarsa'),
        })

    return {
        'ringkasan': {
            'jumlah_item': len(rows),
            'total_masuk': sum(r['masuk'] for r in rows),
            'total_keluar': sum(r['keluar'] for r in rows),
            'item_menipis': sum(1 for r in rows if r['status'] == 'Menipis'),
            'item_habis': sum(1 for r in rows if r['status'] == 'Habis'),
        },
        'items': rows,
    }


async def _rekap_opname_obat(start: str, end: str) -> Dict:
    return await _rekap_opname(db.uks_obat, db.uks_obat_masuk, db.uks_obat_keluar, 'obat_id', 'nama_obat', start, end)


async def _rekap_opname_bmhp(start: str, end: str) -> Dict:
    """Opname BMHP: masuk dari uks_bmhp_masuk, keluar dari uks_bmhp_keluar (tercatat
    otomatis saat penanganan kunjungan)."""
    return await _rekap_opname(db.uks_bmhp, db.uks_bmhp_masuk, db.uks_bmhp_keluar, 'bmhp_id', 'nama_bmhp', start, end)


@router.get("/uks/laporan-baru/opname")
async def laporan_rekap_opname(
    periode: Optional[str] = 'bulanan',
    tahun: Optional[str] = None,
    bulan: Optional[str] = None,
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES)),
):
    """Laporan UKS Baru — rekap opname persediaan obat dan BMHP untuk satu periode
    (stok awal, masuk, keluar, stok akhir, status, stok sistem, kadaluarsa terdekat)."""
    per = _periode_laporan(periode, tahun, bulan)
    return {
        'periode': per,
        'obat': await _rekap_opname_obat(per['start'], per['end']),
        'bmhp': await _rekap_opname_bmhp(per['start'], per['end']),
    }


# ============================================================
# LAPORAN UKS BARU: EKSPOR EXCEL / PDF
# ============================================================

async def _laporan_baru_sections(jenis: str, per: Dict) -> List[Dict]:
    """Susun bagian-bagian laporan (judul, header, baris, baris total) untuk ekspor.
    jenis='diagnosa' -> bagian Siswa & GTK; jenis='opname' -> bagian Obat & BMHP."""
    if jenis == 'diagnosa':
        sections = []
        for tipe, label in (('siswa', 'Siswa'), ('gtk', 'GTK')):
            r = await _rekap_diagnosa(per['start'], per['end'], tipe)
            rk = r['ringkasan']
            rows = [[i + 1, x['kode'] or '-', x['nama'] or '(diagnosa terhapus)', x['utama'], x['jumlah_pasien'],
                     x['tambahan'], x['total'], f"{x['persen']}%"] for i, x in enumerate(r['items'])]
            total = ['', '', 'Total kunjungan terdiagnosa', rk['dengan_diagnosa'], rk['pasien_unik_terdiagnosa'],
                     sum(x['tambahan'] for x in r['items']), sum(x['total'] for x in r['items']), '100%' if r['items'] else '-']
            sections.append({
                'sheet': label,
                'title': f"Rekap Penegakan Diagnosa per Kunjungan - {label}",
                'info': f"Total kunjungan: {rk['total_kunjungan']} | Terdiagnosa: {rk['dengan_diagnosa']} | "
                        f"Belum didiagnosa: {rk['tanpa_diagnosa']} | Pasien berbeda: {rk['pasien_unik']}",
                'headers': ['No', 'Kode', 'Penegakan Diagnosa', 'Jumlah Kunjungan', 'Jumlah Pasien', 'Sebagai Tambahan', 'Total', '%'],
                'rows': rows,
                'total': total if rows else None,
                'widths': [1.2, 2.2, 8.5, 3.2, 3.0, 3.2, 2.2, 2.0],
            })
        return sections
    if jenis == 'opname':
        sections = []
        for key, label, fn in (('obat', 'Obat', _rekap_opname_obat), ('bmhp', 'BMHP', _rekap_opname_bmhp)):
            r = await fn(per['start'], per['end'])
            rows = [[i + 1, x['nama'], x['satuan'] or '-', x['stok_awal'], x['masuk'], x['keluar'], x['stok_akhir'],
                     x['stok_minimum'], x['stok_saat_ini'], x['status'], x['tanggal_kadaluarsa_terdekat'] or '-']
                    for i, x in enumerate(r['items'])]
            rk = r['ringkasan']
            sections.append({
                'sheet': label,
                'title': f"Rekap Opname {label}",
                'info': f"Jumlah item: {rk['jumlah_item']} | Masuk: {rk['total_masuk']} | Keluar: {rk['total_keluar']} | "
                        f"Menipis: {rk['item_menipis']} | Habis: {rk['item_habis']}",
                'headers': ['No', f'Nama {label}', 'Satuan', 'Stok Awal', 'Masuk', 'Keluar', 'Stok Akhir',
                            'Stok Min', 'Stok Sistem', 'Status', 'Kadaluarsa Terdekat'],
                'rows': rows,
                'total': None,
                'widths': [1.0, 6.0, 2.0, 2.0, 1.8, 1.8, 2.0, 1.8, 2.2, 2.0, 3.2],
            })
        return sections
    raise HTTPException(404, "Jenis laporan tidak dikenal")


def _laporan_filename(jenis: str, per: Dict, ext: str) -> str:
    nama = 'Rekap_Diagnosa' if jenis == 'diagnosa' else 'Opname_Obat_BMHP'
    kode = per['tahun'] if per['periode'] == 'tahunan' else f"{per['tahun']}-{per['bulan']}"
    return f"Laporan_UKS_{nama}_{kode}.{ext}"


@router.get("/uks/laporan-baru/{jenis}/export-excel")
async def export_laporan_baru_excel(
    jenis: str,
    periode: Optional[str] = 'bulanan',
    tahun: Optional[str] = None,
    bulan: Optional[str] = None,
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES)),
):
    """Unduh Laporan UKS Baru (rekap diagnosa atau opname) sebagai Excel: satu sheet
    per bagian (Siswa/GTK atau Obat/BMHP), lengkap dengan kop madrasah dan periode."""
    per = _periode_laporan(periode, tahun, bulan)
    sections = await _laporan_baru_sections(jenis, per)
    settings = await get_settings()
    school = settings.get('school_name') or 'MTsN 2 Kota Malang'

    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    header_fill = PatternFill(start_color="006837", end_color="006837", fill_type="solid")
    total_fill = PatternFill(start_color="E8F5E9", end_color="E8F5E9", fill_type="solid")
    border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

    for sec in sections:
        ws = wb.create_sheet(sec['sheet'])
        ncol = len(sec['headers'])
        last = get_column_letter(ncol)
        for r, (text, font) in enumerate([
            (school, Font(bold=True, size=13)),
            (sec['title'], Font(bold=True, size=12)),
            (f"Periode: {per['label']} ({per['start']} s.d. {per['end']})", Font(size=10)),
            (sec['info'], Font(size=10, italic=True)),
        ], start=1):
            ws.merge_cells(f"A{r}:{last}{r}")
            ws[f"A{r}"] = text
            ws[f"A{r}"].font = font
        hr = 6
        for c, h in enumerate(sec['headers'], 1):
            cell = ws.cell(row=hr, column=c, value=h)
            cell.fill = header_fill
            cell.font = Font(color="FFFFFF", bold=True)
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = border
        row = hr + 1
        if not sec['rows']:
            ws.merge_cells(f"A{row}:{last}{row}")
            ws[f"A{row}"] = "Tidak ada data pada periode ini"
            ws[f"A{row}"].alignment = Alignment(horizontal="center")
            row += 1
        for data in sec['rows']:
            for c, v in enumerate(data, 1):
                ws.cell(row=row, column=c, value=v).border = border
            row += 1
        if sec['total']:
            for c, v in enumerate(sec['total'], 1):
                cell = ws.cell(row=row, column=c, value=v)
                cell.font = Font(bold=True)
                cell.fill = total_fill
                cell.border = border
        for c, w in enumerate(sec['widths'], 1):
            ws.column_dimensions[get_column_letter(c)].width = max(8, w * 4)
        ws.freeze_panes = ws.cell(row=hr + 1, column=1)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={_laporan_filename(jenis, per, 'xlsx')}"},
    )


@router.get("/uks/laporan-baru/{jenis}/export-pdf")
async def export_laporan_baru_pdf(
    jenis: str,
    periode: Optional[str] = 'bulanan',
    tahun: Optional[str] = None,
    bulan: Optional[str] = None,
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES)),
):
    """Unduh Laporan UKS Baru (rekap diagnosa atau opname) sebagai PDF A4 landscape."""
    per = _periode_laporan(periode, tahun, bulan)
    sections = await _laporan_baru_sections(jenis, per)
    settings = await get_settings()

    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=landscape(A4), topMargin=1.2 * cm, bottomMargin=1.2 * cm,
                            leftMargin=1.2 * cm, rightMargin=1.2 * cm)
    styles = getSampleStyleSheet()
    cell_style = styles['BodyText'].clone('cell', fontSize=8, leading=10)
    elements = [
        Paragraph(settings.get('school_name') or 'MTsN 2 Kota Malang', styles['Title']),
        Paragraph(f"Laporan UKS — Periode {per['label']} ({per['start']} s.d. {per['end']})", styles['Heading3']),
    ]
    for idx, sec in enumerate(sections):
        elements.append(Spacer(1, 0.4 * cm))
        elements.append(Paragraph(sec['title'], styles['Heading2']))
        elements.append(Paragraph(sec['info'], styles['Italic']))
        elements.append(Spacer(1, 0.2 * cm))
        header = [Paragraph(f"<font color='white'><b>{h}</b></font>", cell_style) for h in sec['headers']]
        body = [[Paragraph(str(v), cell_style) for v in r] for r in sec['rows']]
        if not body:
            body = [[Paragraph('Tidak ada data pada periode ini', cell_style)] + [''] * (len(header) - 1)]
        data = [header] + body
        if sec['total']:
            data.append([Paragraph(f"<b>{v}</b>", cell_style) for v in sec['total']])
        table = Table(data, colWidths=[w * cm for w in sec['widths']], repeatRows=1)
        style = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#006837')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]
        if sec['total']:
            style.append(('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#E8F5E9')))
        if not sec['rows']:
            style.append(('SPAN', (0, 1), (-1, 1)))
        table.setStyle(TableStyle(style))
        elements.append(table)

    doc.build(elements)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={_laporan_filename(jenis, per, 'pdf')}"},
    )


@router.post("/uks/kunjungan")
async def create_kunjungan(req: KunjunganUKSRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    pasien = await _get_user_or_404(req.pasien_id)

    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        'keluhan': _clean_keluhan(req.keluhan),
        **_user_fields('pasien', pasien),
        **await _pasien_snapshot(pasien),
        'status': 'Belum Ditangani',
        'diagnosa_utama_id': None,
        'diagnosa_utama_nama': None,
        'diagnosa_utama_kode': None,
        'diagnosa_tambahan_ids': [],
        'diagnosa_tambahan_nama': [],
        'jenis_penanganan_ids': [],
        'jenis_penanganan_nama': [],
        'obat_dipakai': [],
        'bmhp_dipakai': [],
        'penanganan': None,
        'kondisi_pulang': None,
        'dirujuk_ke': None,
        'keterangan': None,
        **KUNJUNGAN_CATATAN_SURAT_DEFAULTS,
        'ditangani_oleh': None,
        'ditangani_pada': None,
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }

    await db.uks_kunjungan.insert_one(doc)
    await log_audit(user, 'uks_kunjungan_create', f"Recorded kunjungan UKS: {pasien.get('full_name')}")
    doc.pop('_id', None)
    return serialize_doc(doc)


@router.put("/uks/kunjungan/{kunjungan_id}")
async def update_kunjungan(kunjungan_id: str, req: KunjunganUKSRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    """Update the intake portion of a visit (patient, date/time, complaint).
    Treatment fields are managed separately via /uks/kunjungan/{id}/penanganan."""
    existing = await db.uks_kunjungan.find_one({'id': kunjungan_id})
    if not existing:
        raise HTTPException(404, "Data kunjungan tidak ditemukan")

    update_data = req.model_dump()
    update_data['keluhan'] = _clean_keluhan(req.keluhan)

    if req.pasien_id != existing.get('pasien_id'):
        pasien = await _get_user_or_404(req.pasien_id)
        update_data.update(_user_fields('pasien', pasien))
        update_data.update(await _pasien_snapshot(pasien))

    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.uks_kunjungan.update_one({'id': kunjungan_id}, {'$set': update_data})
    await log_audit(user, 'uks_kunjungan_update', f"Updated kunjungan UKS: {kunjungan_id}")

    updated = await db.uks_kunjungan.find_one({'id': kunjungan_id}, {'_id': 0})
    return serialize_doc(_with_kunjungan_defaults(updated))


@router.put("/uks/kunjungan/{kunjungan_id}/penanganan")
async def submit_penanganan(kunjungan_id: str, req: PenangananKunjunganRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    """Record treatment for a visit: one or more jenis penanganan, any obat
    dispensed (each automatically logged to Obat Keluar with stock deducted), and
    any BMHP used (automatically logged to BMHP Keluar, stock deducted FEFO;
    re-saving replaces the visit's previous BMHP usage instead of adding to it)."""
    existing = await db.uks_kunjungan.find_one({'id': kunjungan_id})
    if not existing:
        raise HTTPException(404, "Data kunjungan tidak ditemukan")

    diagnosa_fields = await _resolve_penanganan_diagnosa(req, existing)
    penanganan_text = (req.penanganan or '').strip() or None
    if not req.jenis_penanganan_ids and not penanganan_text:
        raise HTTPException(400, "Penanganan wajib diisi: pilih jenis penanganan atau tuliskan uraian penanganan")

    jenis_names = []
    for jid in req.jenis_penanganan_ids:
        jenis = await db.uks_jenis_penanganan.find_one({'id': jid})
        if not jenis:
            raise HTTPException(404, f"Jenis penanganan tidak ditemukan: {jid}")
        jenis_names.append(jenis.get('nama'))

    # Validate stock for every requested medicine before dispensing any of them,
    # so a mid-list failure never leaves a partially-applied treatment. Obat yang
    # sudah tercatat untuk kunjungan ini akan dikembalikan dulu (simpan ulang
    # mengganti, bukan menambah), jadi jumlah lamanya ikut dihitung tersedia.
    previous_obat: Dict[str, int] = {}
    for prev in await db.uks_obat_keluar.find({'kunjungan_id': kunjungan_id}, {'_id': 0, 'obat_id': 1, 'jumlah': 1}).to_list(500):
        previous_obat[prev['obat_id']] = previous_obat.get(prev['obat_id'], 0) + prev.get('jumlah', 0)
    requested_obat: Dict[str, int] = {}
    for item in req.obat_list:
        if item.jumlah <= 0:
            raise HTTPException(400, "Jumlah obat harus lebih dari 0")
        requested_obat[item.obat_id] = requested_obat.get(item.obat_id, 0) + item.jumlah
    for obat_id, jumlah in requested_obat.items():
        obat = await _get_obat_or_404(obat_id)
        available = (await _get_obat_stock_summary(obat_id))['stok_tersisa'] + previous_obat.get(obat_id, 0)
        if available < jumlah:
            raise HTTPException(400, f"Stok '{obat.get('nama_obat')}' tidak mencukupi (tersedia: {available})")

    # Validasi stok BMHP. BMHP yang sudah tercatat untuk kunjungan ini akan
    # dikembalikan dulu, jadi jumlah lama ikut dihitung sebagai stok tersedia.
    bmhp_request = _merge_bmhp_items(req.bmhp_list)
    previous_bmhp: Dict[str, int] = {}
    for prev in await db.uks_bmhp_keluar.find({'kunjungan_id': kunjungan_id}, {'_id': 0, 'bmhp_id': 1, 'jumlah': 1}).to_list(500):
        previous_bmhp[prev['bmhp_id']] = previous_bmhp.get(prev['bmhp_id'], 0) + prev.get('jumlah', 0)
    bmhp_docs = {}
    for bmhp_id, jumlah in bmhp_request.items():
        bmhp = await _get_bmhp_or_404(bmhp_id)
        bmhp_docs[bmhp_id] = bmhp
        available = (await _get_bmhp_stock_summary(bmhp_id))['stok_tersisa'] + previous_bmhp.get(bmhp_id, 0)
        if available < jumlah:
            raise HTTPException(400, f"Stok BMHP '{bmhp.get('nama_bmhp')}' tidak mencukupi (tersedia: {available})")

    pasien = await db.users.find_one({'id': existing['pasien_id']}, {'_id': 0, 'password_hash': 0})

    await _revert_bmhp_keluar_for_kunjungan(kunjungan_id)
    bmhp_dipakai = []
    for bmhp_id, jumlah in bmhp_request.items():
        await _use_bmhp(bmhp_docs[bmhp_id], jumlah, existing, pasien, user)
        bmhp_dipakai.append({'bmhp_id': bmhp_id, 'bmhp_nama': bmhp_docs[bmhp_id].get('nama_bmhp'), 'jumlah': jumlah})

    await _revert_obat_keluar_for_kunjungan(kunjungan_id)
    obat_dipakai = []
    for item in req.obat_list:
        dispensed = await _dispense_obat(
            item.obat_id, item.jumlah, existing['tanggal'], user,
            kunjungan_id=kunjungan_id, penerima=pasien,
            keterangan=f"Penanganan kunjungan UKS {existing.get('pasien_nama')}",
        )
        obat_dipakai.append({'obat_id': item.obat_id, 'obat_nama': dispensed['obat_nama'], 'jumlah': item.jumlah})

    update_data = {
        **diagnosa_fields,
        'jenis_penanganan_ids': req.jenis_penanganan_ids,
        'jenis_penanganan_nama': jenis_names,
        'obat_dipakai': obat_dipakai,
        'bmhp_dipakai': bmhp_dipakai,
        'penanganan': penanganan_text,
        'kondisi_pulang': req.kondisi_pulang,
        'dirujuk_ke': req.dirujuk_ke,
        'keterangan': req.keterangan,
        'status': 'Sudah Ditangani',
        'ditangani_oleh': user.get('full_name', user.get('username')),
        'ditangani_pada': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    # Vitals re-measured during treatment overwrite the intake values; if left
    # blank on this request, the intake values recorded on arrival are kept.
    for field in ('tinggi_badan', 'berat_badan', 'tekanan_darah', 'nadi', 'suhu', 'spo2'):
        value = getattr(req, field)
        if value is not None:
            update_data[field] = value
    await db.uks_kunjungan.update_one({'id': kunjungan_id}, {'$set': update_data})
    await log_audit(user, 'uks_kunjungan_penanganan', f"Penanganan kunjungan UKS: {kunjungan_id}")

    updated = await db.uks_kunjungan.find_one({'id': kunjungan_id}, {'_id': 0})
    return serialize_doc(_with_kunjungan_defaults(updated))


# ============================================================
# SURAT KETERANGAN UKS (rujukan / perizinan pulang)
# ============================================================

SURAT_UKS_JENIS = {
    'rujukan': {'judul': 'Surat Rujukan Kesehatan', 'kode': 'RJK', 'kondisi_pulang': 'Dirujuk'},
    'perizinan': {'judul': 'Surat Perizinan Pulang', 'kode': 'IZN', 'kondisi_pulang': 'Dijemput Orang Tua'},
}


def _penatalaksanaan_surat(k: Dict) -> Dict:
    """Rincian penanganan/penatalaksanaan kunjungan dalam bentuk siap tampil di surat."""
    pemberian = [{'jenis': 'obat', 'id': o.get('obat_id'), 'nama': o.get('obat_nama'), 'jumlah': o.get('jumlah')}
                 for o in (k.get('obat_dipakai') or [])]
    pemberian += [{'jenis': 'bmhp', 'id': b.get('bmhp_id'), 'nama': b.get('bmhp_nama'), 'jumlah': b.get('jumlah')}
                  for b in (k.get('bmhp_dipakai') or [])]
    return {
        'sudah_ditangani': k.get('status') == 'Sudah Ditangani' or bool(k.get('ditangani_pada')),
        'diagnosa_utama': ({'id': k.get('diagnosa_utama_id'), 'nama': k.get('diagnosa_utama_nama'),
                            'kode': k.get('diagnosa_utama_kode')} if k.get('diagnosa_utama_nama') else None),
        'diagnosa_tambahan': [n for n in (k.get('diagnosa_tambahan_nama') or []) if n],
        'jenis_penanganan': [n for n in (k.get('jenis_penanganan_nama') or []) if n],
        'tindakan': k.get('penanganan'),
        'pemberian': pemberian,
        'kondisi_pulang': k.get('kondisi_pulang'),
        'dirujuk_ke': k.get('dirujuk_ke'),
        'keterangan': k.get('keterangan'),
        'ditangani_oleh': k.get('ditangani_oleh'),
        'ditangani_pada': k.get('ditangani_pada'),
    }


@router.get("/uks/kunjungan/{kunjungan_id}/surat")
async def get_surat_kunjungan(
    kunjungan_id: str,
    jenis: str = 'rujukan',
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES)),
):
    """Data lengkap surat keterangan UKS untuk satu kunjungan: identitas pasien,
    penatalaksanaan (diagnosa, penanganan, obat/BMHP, kondisi pulang), catatan petugas,
    kop madrasah, dan nomor surat. Jenis surat harus sesuai kondisi pulang kunjungan."""
    cfg = SURAT_UKS_JENIS.get(jenis)
    if not cfg:
        raise HTTPException(400, "Jenis surat harus 'rujukan' atau 'perizinan'")
    k = await db.uks_kunjungan.find_one({'id': kunjungan_id}, {'_id': 0})
    if not k:
        raise HTTPException(404, "Kunjungan tidak ditemukan")
    if k.get('kondisi_pulang') != cfg['kondisi_pulang']:
        raise HTTPException(400, f"{cfg['judul']} hanya untuk kunjungan dengan kondisi pulang '{cfg['kondisi_pulang']}'")
    k = _with_kunjungan_defaults(k)

    pasien = await get_pasien_profile(k['pasien_id'], user) if k.get('pasien_id') else None
    if pasien and pasien.get('jenis_pasien') == 'gtk' and not pasien.get('nik'):
        u = await db.users.find_one({'id': k['pasien_id']}, {'_id': 0, 'nik': 1})
        pasien['nik'] = (u or {}).get('nik')

    settings = await get_settings()
    return {
        'jenis': jenis,
        'judul': cfg['judul'],
        'nomor': f"UKS/{cfg['kode']}/{(k.get('tanggal') or '').replace('-', '')}/{(k.get('id') or '')[:6]}",
        'kunjungan': serialize_doc(k),
        'pasien': pasien,
        'penatalaksanaan': _penatalaksanaan_surat(k),
        'catatan': {
            'teks': k.get('catatan_surat'),
            'oleh': k.get('catatan_surat_oleh'),
            'pada': k.get('catatan_surat_pada'),
            'maks': CATATAN_SURAT_MAX,
        },
        'sekolah': {
            'school_name': settings.get('school_name'),
            'address': settings.get('address'),
            'npsn': settings.get('npsn'),
            'city': settings.get('city'),
        },
    }


def _tanggal_surat(tanggal: Optional[str]) -> str:
    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})', tanggal or '')
    if not m:
        return tanggal or '-'
    return f"{int(m.group(3))} {BULAN_NAMA_ID[int(m.group(2)) - 1]} {m.group(1)}"


def _jam_wib(iso: Optional[str]) -> Optional[str]:
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
    except ValueError:
        return None
    if dt.tzinfo is not None:
        dt = dt.replace(tzinfo=None) - (dt.utcoffset() or timedelta(0))
    return (dt + timedelta(hours=7)).strftime('%H:%M') + ' WIB'


def _p(text, style) -> Paragraph:
    """Paragraph dengan teks pengguna di-escape (aman dari karakter <, &) dan baris baru dipertahankan."""
    return Paragraph(xml_escape('' if text is None else str(text)).replace('\n', '<br/>'), style)


def _surat_pdf_bytes(data: Dict) -> bytes:
    """Bangun PDF surat keterangan UKS (A4 portrait) dari hasil get_surat_kunjungan:
    kop, identitas, isi, vital, penatalaksanaan, catatan (atau baris kosong), tanda tangan."""
    k, pasien, pt = data['kunjungan'], data.get('pasien') or {}, data['penatalaksanaan']
    sekolah = data.get('sekolah') or {}
    nama_sekolah = sekolah.get('school_name') or 'MTsN 2 Kota Malang'
    kota = sekolah.get('city') or 'Malang'
    is_siswa = pasien.get('jenis_pasien') == 'siswa' or k.get('pasien_tipe') == 'siswa'

    styles = getSampleStyleSheet()
    body = styles['BodyText'].clone('surat_body', fontSize=10.5, leading=14)
    small = body.clone('surat_small', fontSize=9, leading=12)
    bold = body.clone('surat_bold', fontName='Helvetica-Bold')
    center = body.clone('surat_center', alignment=1)
    kop = styles['Title'].clone('surat_kop', fontSize=14, leading=17, spaceAfter=0)
    judul = center.clone('surat_judul', fontName='Helvetica-Bold', fontSize=12)

    def grid(rows):
        t = Table([[_p(a, body), _p(':', body), b if isinstance(b, Paragraph) else _p(b if b not in (None, '') else '-', body)]
                   for a, b in rows], colWidths=[4.6 * cm, 0.4 * cm, 11.2 * cm])
        t.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 2),
                               ('TOPPADDING', (0, 0), (-1, -1), 1), ('BOTTOMPADDING', (0, 0), (-1, -1), 1)]))
        return t

    el = [_p(nama_sekolah.upper(), kop)]
    for line in (sekolah.get('address'), f"NPSN: {sekolah['npsn']}" if sekolah.get('npsn') else None):
        if line:
            el.append(_p(line, small.clone('kop_line', alignment=1)))
    garis = Table([['']], colWidths=[17 * cm], rowHeights=[4])
    garis.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 1.5, colors.black)]))
    el += [garis, Spacer(1, 0.3 * cm),
           Paragraph(f"<u>{xml_escape(data['judul'].upper())}</u>", judul),
           _p(f"Nomor: {data['nomor']}", small.clone('nomor', alignment=1)), Spacer(1, 0.4 * cm),
           _p(f"Yang bertanda tangan di bawah ini, Petugas Unit Kesehatan Sekolah (UKS) {nama_sekolah}, menerangkan bahwa:", body),
           Spacer(1, 0.15 * cm)]
    ident = [('Nama', k.get('pasien_nama')), ('NIK', pasien.get('nik')), ('Jenis Pasien', 'Siswa' if is_siswa else 'GTK')]
    if is_siswa:
        ident += [('Kelas', pasien.get('class_name') or k.get('pasien_kelas')), ('Wali Kelas', pasien.get('wali_kelas_nama'))]
    ident += [('Tanggal / Waktu', f"{_tanggal_surat(k.get('tanggal'))} {k.get('waktu') or ''}".strip()), ('Keluhan', k.get('keluhan'))]
    el += [grid(ident), Spacer(1, 0.3 * cm)]

    if data['jenis'] == 'rujukan':
        isi = (f"Berdasarkan pemeriksaan yang telah dilakukan, yang bersangkutan memerlukan penanganan lebih lanjut dan dirujuk ke "
               f"<b>{xml_escape(k.get('dirujuk_ke') or '_______________')}</b> untuk mendapatkan pemeriksaan/penanganan medis lebih lanjut.")
    else:
        isi = ("Berdasarkan pemeriksaan yang telah dilakukan, yang bersangkutan diizinkan untuk pulang lebih awal dengan kondisi "
               "<b>Dijemput Orang Tua/Wali</b> guna mendapatkan istirahat dan perawatan lebih lanjut di rumah.")
    el += [Paragraph(isi, body), Spacer(1, 0.3 * cm)]

    vital = [(lbl, f"{k[f]}{sat}") for f, lbl, sat in (
        ('tinggi_badan', 'TB', ' cm'), ('berat_badan', 'BB', ' kg'), ('tekanan_darah', 'Tensi', ''),
        ('nadi', 'Nadi', ' bpm'), ('suhu', 'Suhu', ' °C'), ('spo2', 'SpO2', '%')) if k.get(f) not in (None, '')]
    if vital:
        el += [_p('Hasil pemeriksaan vital:', bold), _p('   '.join(f"{a}: {b}" for a, b in vital), body), Spacer(1, 0.3 * cm)]

    blok = [_p('Penanganan / penatalaksanaan di UKS:', bold)]
    if not pt['sudah_ditangani']:
        blok.append(_p('Belum ada data penanganan untuk kunjungan ini.', body))
    else:
        du = pt['diagnosa_utama']
        rows = [('Diagnosa utama', f"{du['nama']}{' (' + du['kode'] + ')' if du.get('kode') else ''}" if du else None)]
        if pt['diagnosa_tambahan']:
            rows.append(('Diagnosa tambahan', ', '.join(pt['diagnosa_tambahan'])))
        rows.append(('Jenis penanganan', ', '.join(pt['jenis_penanganan']) or None))
        if (pt.get('tindakan') or '').strip():
            rows.append(('Uraian tindakan', pt['tindakan'].strip()))
        jam = _jam_wib(pt.get('ditangani_pada'))
        if jam:
            rows.append(('Waktu penanganan', jam))
        blok.append(grid(rows))
        if pt['pemberian']:
            hdr = [Paragraph(f'<b>{h}</b>', small) for h in ('No', 'Jenis', 'Obat / BMHP yang diberikan', 'Jumlah')]
            tbl = Table([hdr] + [[_p(i + 1, small), _p('Obat' if x['jenis'] == 'obat' else 'BMHP', small), _p(x['nama'] or '-', small),
                                  _p(x['jumlah'], small)] for i, x in enumerate(pt['pemberian'])],
                        colWidths=[1.0 * cm, 2.0 * cm, 10.8 * cm, 2.2 * cm], repeatRows=1)
            tbl.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                                     ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#F1F5F9')),
                                     ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
            blok += [Spacer(1, 0.1 * cm), tbl, Spacer(1, 0.1 * cm)]
        else:
            blok.append(grid([('Obat / BMHP', 'Tidak ada pemberian obat/BMHP')]))
        kondisi = pt.get('kondisi_pulang') or '-'
        if pt.get('dirujuk_ke'):
            kondisi += f" — ke {pt['dirujuk_ke']}"
        rows = [('Kondisi saat keluar UKS', kondisi)]
        if (pt.get('keterangan') or '').strip():
            rows.append(('Keterangan', pt['keterangan'].strip()))
        blok.append(grid(rows))
    el += [KeepTogether(blok), Spacer(1, 0.3 * cm)]

    catatan = (data['catatan'].get('teks') or '').strip()
    cat = [_p('Catatan:', bold)]
    if catatan:
        cat.append(_p(catatan, body))
    else:
        lines = Table([['']] * 3, colWidths=[16.2 * cm], rowHeights=[0.75 * cm] * 3)
        lines.setStyle(TableStyle([('LINEBELOW', (0, 0), (-1, -1), 0.6, colors.grey, None, (1, 2))]))
        cat.append(lines)
    el += [KeepTogether(cat), Spacer(1, 0.3 * cm),
           _p('Demikian surat ini dibuat untuk dapat dipergunakan sebagaimana mestinya.', body), Spacer(1, 0.5 * cm)]

    tgl = f"{kota}, {_tanggal_surat(k.get('tanggal'))}"
    petugas = pt.get('ditangani_oleh') or k.get('petugas_nama') or '(_________________)'
    if is_siswa:
        kiri = [[''], [_p('Mengetahui, Wali Kelas', center)], [''], [Paragraph(f"<b><u>{xml_escape(pasien.get('wali_kelas_nama') or '(_________________)')}</u></b>", center)]]
    else:
        kiri = [[''], [''], [''], ['']]
    kanan = [[_p(tgl, center)], [_p('Petugas UKS,', center)], [''], [Paragraph(f"<b><u>{xml_escape(petugas)}</u></b>", center)]]
    ttd = Table([[a[0], b[0]] for a, b in zip(kiri, kanan)], colWidths=[8.1 * cm, 8.1 * cm],
                rowHeights=[None, None, 1.8 * cm, None])
    el.append(KeepTogether([ttd]))

    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm,
                            leftMargin=2 * cm, rightMargin=2 * cm, title=data['judul'])
    doc.build(el)
    return output.getvalue()


@router.get("/uks/kunjungan/{kunjungan_id}/surat/pdf")
async def download_surat_kunjungan_pdf(
    kunjungan_id: str,
    jenis: str = 'rujukan',
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES)),
):
    """Unduh surat keterangan UKS sebagai PDF A4, lengkap dengan penatalaksanaan & catatan."""
    data = await get_surat_kunjungan(kunjungan_id, jenis, user)
    pdf = _surat_pdf_bytes(data)
    nama = re.sub(r'[^A-Za-z0-9]+', '_', data['kunjungan'].get('pasien_nama') or 'Pasien').strip('_') or 'Pasien'
    label = 'Rujukan' if jenis == 'rujukan' else 'Perizinan_Pulang'
    filename = f"Surat_{label}_UKS_{data['kunjungan'].get('tanggal') or ''}_{nama}.pdf"
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


class CatatanSuratRequest(BaseModel):
    catatan_surat: Optional[str] = None


@router.put("/uks/kunjungan/{kunjungan_id}/catatan-surat")
async def update_catatan_surat(
    kunjungan_id: str,
    req: CatatanSuratRequest,
    user: Dict = Depends(require_role(*UKS_ROLES)),
):
    """Simpan catatan petugas yang dicetak di bawah penatalaksanaan pada surat
    keterangan UKS. Teks kosong menghapus catatan (surat mencetak baris kosong)."""
    k = await db.uks_kunjungan.find_one({'id': kunjungan_id}, {'_id': 0, 'id': 1, 'kondisi_pulang': 1})
    if not k:
        raise HTTPException(404, "Kunjungan tidak ditemukan")
    kondisi_surat = {cfg['kondisi_pulang'] for cfg in SURAT_UKS_JENIS.values()}
    if k.get('kondisi_pulang') not in kondisi_surat:
        raise HTTPException(400, "Catatan surat hanya untuk kunjungan yang dirujuk atau dijemput orang tua")
    teks = (req.catatan_surat or '').strip() or None
    if teks and len(teks) > CATATAN_SURAT_MAX:
        raise HTTPException(400, f"Catatan surat maksimal {CATATAN_SURAT_MAX} karakter")
    now = datetime.utcnow().isoformat()
    await db.uks_kunjungan.update_one({'id': kunjungan_id}, {'$set': {
        'catatan_surat': teks,
        'catatan_surat_oleh': user.get('full_name', user.get('username')) if teks else None,
        'catatan_surat_pada': now if teks else None,
        'updated_at': now,
    }})
    await log_audit(user, 'uks_kunjungan_catatan_surat', f"Catatan surat kunjungan UKS: {kunjungan_id}")
    updated = await db.uks_kunjungan.find_one({'id': kunjungan_id}, {'_id': 0})
    return serialize_doc(_with_kunjungan_defaults(updated))


@router.delete("/uks/kunjungan/{kunjungan_id}")
async def delete_kunjungan(kunjungan_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_kunjungan.find_one({'id': kunjungan_id})
    if not existing:
        raise HTTPException(404, "Data kunjungan tidak ditemukan")

    await _revert_bmhp_keluar_for_kunjungan(kunjungan_id)
    await _revert_obat_keluar_for_kunjungan(kunjungan_id)
    await db.uks_kunjungan.delete_one({'id': kunjungan_id})
    await log_audit(user, 'uks_kunjungan_delete', f"Deleted kunjungan UKS: {kunjungan_id}")
    return {'message': 'Data kunjungan berhasil dihapus'}


# ============================================================
# DATA CKG (CEK KESEHATAN GRATIS) ENDPOINTS
# ============================================================

@router.get("/uks/ckg")
async def list_ckg(
    pasien_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    q: Optional[str] = None,
    kelas: Optional[str] = None,
    jenis_kelamin: Optional[str] = None,
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES))
):
    """Daftar CKG (identitas pasien dipetakan ke kolom baku). Opsional: q (nama/NIK), kelas
    ('7A', 'tingkat:7', 'gtk'), jenis_kelamin (L/P) — aturan sama dengan /uks/ckg/daftar."""
    if jenis_kelamin and jenis_kelamin not in ('L', 'P'):
        raise HTTPException(400, "Jenis kelamin harus 'L' atau 'P'")
    query = {}
    if pasien_id:
        query['pasien_id'] = pasien_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal'] = date_query

    await sembunyikan_siswa_nonaktif(query, 'pasien_id', db)  # data siswa nonaktif disembunyikan, tidak dihapus
    items = await db.uks_ckg.find(query, {'_id': 0}).sort('tanggal', -1).to_list(5000)
    settings = await get_settings()
    # Petakan ke kolom baku CKG: identitas pasien terkini (NIK, tgl lahir, JK, alamat, kelas) & nama sekolah.
    items = await lengkapi_identitas_ckg(db, items, settings.get('school_name'))
    if q or kelas or jenis_kelamin:
        items = [i for i in items if _cocok_cari_ckg(i, q) and _cocok_filter_ckg(i, kelas, jenis_kelamin)]
    return [serialize_doc(i) for i in items]


def _cocok_cari_ckg(item: Dict, q: str) -> bool:
    """Pencarian nama (semua kata) atau NIK (angka, spasi/titik diabaikan) — sama dengan frontend."""
    q = (q or '').strip().lower()
    if not q:
        return True
    teks = ' '.join(str(item.get(k) or '') for k in ('pasien_nama', 'pasien_nik', 'pasien_alamat', 'pasien_identitas', 'pasien_kelas')).lower()
    digit = re.sub(r'[\s.-]', '', q)
    if digit.isdigit() and len(digit) >= 3:
        return digit in re.sub(r'\D', '', str(item.get('pasien_nik') or '')) or q in teks
    return all(kata in teks for kata in q.split())


def _cocok_filter_ckg(item: Dict, kelas: Optional[str], jenis_kelamin: Optional[str]) -> bool:
    if jenis_kelamin and item.get('pasien_jenis_kelamin') != jenis_kelamin:
        return False
    if not kelas or kelas == 'all':
        return True
    siswa = item.get('pasien_tipe') == 'siswa'
    if kelas == 'gtk':
        return not siswa
    if not siswa:
        return False
    nama = str(item.get('pasien_kelas') or '')
    if kelas.startswith('tingkat:'):
        return nama.startswith(kelas[8:])
    return nama == kelas


@router.get("/uks/ckg/daftar")
async def daftar_ckg_kolom_baku(
    q: Optional[str] = None,
    kelas: Optional[str] = None,
    jenis_kelamin: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    format_baris: bool = False,
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES)),
):
    """Daftar Data CKG dalam susunan kolom baku (NO, Nama Lengkap, NIK, Nama Sekolah, Tgl Lahir,
    Jenis Kelamin, Alamat Lengkap, BB, TB, TD, Jumlah Karies, Visus Mata, Kesehatan Kulit,
    Fungsi Pendengaran, Hemoglobin, GDS), dengan pencarian nama/NIK dan filter kelas
    ('7A', 'tingkat:7', 'gtk', 'all') & jenis kelamin (L/P). format_baris=true menambahkan
    nilai per kolom berurutan (siap ekspor/template)."""
    if jenis_kelamin and jenis_kelamin not in ('L', 'P'):
        raise HTTPException(400, "Jenis kelamin harus 'L' atau 'P'")
    query: Dict[str, Any] = {}
    if start_date or end_date:
        query['tanggal'] = {k: v for k, v in (('$gte', start_date), ('$lte', end_date)) if v}
    items = await db.uks_ckg.find(query, {'_id': 0}).sort([('tanggal', -1), ('created_at', -1)]).to_list(5000)
    settings = await get_settings()
    items = await lengkapi_identitas_ckg(db, items, settings.get('school_name'))
    total_semua = len(items)
    items = [i for i in items if _cocok_cari_ckg(i, q) and _cocok_filter_ckg(i, kelas, jenis_kelamin)]
    hasil = {
        'kolom': [{k: v for k, v in kol.items()} for kol in KOLOM_CKG],
        'total': len(items),
        'total_semua': total_semua,
        'items': [serialize_doc({**i, 'pemeriksaan_lain': pemeriksaan_lain(i)}) for i in items],
    }
    if format_baris:
        hasil['baris'] = [baris_kolom_baku(i, n) for n, i in enumerate(items)]
    return hasil


@router.post("/uks/ckg")
async def create_ckg(req: CekKesehatanRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    pasien = await _get_user_or_404(req.pasien_id)
    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        **_user_fields('pasien', pasien),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.uks_ckg.insert_one(doc)
    await log_audit(user, 'uks_ckg_create', f"Recorded CKG: {pasien.get('full_name')}")
    return serialize_doc(doc)


@router.put("/uks/ckg/{ckg_id}")
async def update_ckg(ckg_id: str, req: CekKesehatanRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_ckg.find_one({'id': ckg_id})
    if not existing:
        raise HTTPException(404, "Data CKG tidak ditemukan")

    # Hanya field yang dikirim yang diubah: field lama tanpa padanan kolom baku (nadi, suhu,
    # kesimpulan, dst.) atau field baku yang tidak disertakan klien tetap utuh.
    update_data = req.model_dump(exclude_unset=True)
    if req.pasien_id != existing.get('pasien_id'):
        pasien = await _get_user_or_404(req.pasien_id)
        update_data.update(_user_fields('pasien', pasien))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.uks_ckg.update_one({'id': ckg_id}, {'$set': update_data})
    await log_audit(user, 'uks_ckg_update', f"Updated CKG: {ckg_id}")

    updated = await db.uks_ckg.find_one({'id': ckg_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/uks/ckg/{ckg_id}")
async def delete_ckg(ckg_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_ckg.find_one({'id': ckg_id})
    if not existing:
        raise HTTPException(404, "Data CKG tidak ditemukan")

    await db.uks_ckg.delete_one({'id': ckg_id})
    await log_audit(user, 'uks_ckg_delete', f"Deleted CKG: {ckg_id}")
    return {'message': 'Data CKG berhasil dihapus'}


def _style_import_header(ws, headers: List[str]):
    header_fill = PatternFill(start_color="006837", end_color="006837", fill_type="solid")
    locked_fill = PatternFill(start_color="E8F5E9", end_color="E8F5E9", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_num, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
    ws.row_dimensions[1].height = 32
    return locked_fill


async def buat_template_ckg(pasien_list: List[Dict], jenis_pasien: str, tingkat: Optional[str],
                            jenis_gtk: Optional[str], kelas: Optional[str]) -> openpyxl.Workbook:
    """Template CKG dengan 16 judul kolom baku (+ Tanggal Periksa & ID Pasien di kanan).
    Kolom identitas (No, Nama, NIK, Sekolah, Tgl Lahir, JK, Alamat) & ID pasien terisi otomatis
    dari data siswa/GTK; kolom hasil pemeriksaan & tanggal dikosongkan untuk diisi petugas."""
    kolom = kolom_template_ckg()
    settings = await get_settings()
    items = await lengkapi_identitas_ckg(
        db, [{'pasien_id': p_['id'], 'pasien_nama': p_.get('full_name')} for p_ in pasien_list], settings.get('school_name'))
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Template CKG"
    isi_fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")
    head_fill = PatternFill(start_color="006837", end_color="006837", fill_type="solid")
    bantu_fill = PatternFill(start_color="B45309", end_color="B45309", fill_type="solid")
    for c, k in enumerate(kolom, 1):
        cell = ws.cell(row=1, column=c, value=k['label'])
        cell.fill = bantu_fill if k['grup'] == 'Kolom bantu impor' else head_fill
        cell.font = Font(color="FFFFFF", bold=True)
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        ws.column_dimensions[get_column_letter(c)].width = 28 if k['key'] in ('nama_lengkap', 'alamat', 'pasien_id') else max(11, len(k['label']) + 2)
    for r, item in enumerate(items, 2):
        nilai = baris_kolom_baku(item, r - 2) + ['', item['pasien_id']]
        for c, (k, v) in enumerate(zip(kolom, nilai), 1):
            prefill = k['key'] == 'no' or k['key'] in KOLOM_IDENTITAS_CKG or k['key'] == 'pasien_id'
            cell = ws.cell(row=r, column=c, value=v if prefill else None)
            cell.number_format = '@' if k['key'] in ('nik', 'td', 'visus_mata', 'tanggal', 'tgl_lahir') else cell.number_format
            if prefill:
                cell.fill = isi_fill
    ws.row_dimensions[1].height = 36
    ws.freeze_panes = 'C2'

    ws2 = wb.create_sheet("PETUNJUK")
    ws2['A1'] = f"Petunjuk Pengisian Template CKG — {nama_kelompok_template(jenis_pasien, tingkat, jenis_gtk, kelas).replace('_', ' ')}"
    ws2['A1'].font = Font(bold=True, size=13, color='006837')
    ws2.column_dimensions['A'].width = 110
    for line in [
        '', "Susunan kolom sama persis dengan tabel Data CKG: NO, Nama Lengkap, NIK, Nama Sekolah, Tgl Lahir, Jenis Kelamin, Alamat Lengkap,",
        "BB, TB, TD, Jumlah Karies, Visus Mata, Kesehatan Kulit, Fungsi Pendengaran, Hemoglobin, GDS — lalu kolom bantu Tanggal & ID Pasien.",
        "Kolom identitas (abu-abu) sudah terisi dari data siswa/GTK — JANGAN mengubah kolom ID Pasien, urutan, atau judul kolom.",
        "Isi Tanggal Periksa dan hasil pemeriksaan pada baris pasien yang diperiksa; baris tanpa hasil pemeriksaan dilewati saat impor.",
        "Format: Tanggal YYYY-MM-DD (mis. 2026-09-19) · TD sistolik/diastolik (mis. 110/70) · Visus mis. 6/6 · angka memakai titik desimal.",
        "Batas wajar: BB 1-300 kg, TB 30-250 cm, Jumlah Karies 0-32, Hemoglobin 0-30 g/dL, GDS 0-1000 mg/dL.",
        "Pasien baru di luar daftar: tambahkan baris dengan NIK (16 digit) bila ID Pasien tidak diketahui.",
    ]:
        ws2.append([line])
    wb.active = 0
    return wb


@router.get("/uks/ckg/template")
async def download_ckg_template(
    jenis_pasien: str = Query('siswa'),
    tingkat: Optional[str] = Query(None, description="Siswa: 7, 8, 9, atau kosong = semua kelas"),
    jenis_gtk: Optional[str] = Query(None, description="GTK: guru, tendik, atau kosong = semua"),
    kelas: Optional[str] = Query(None, description="Siswa: id atau nama satu kelas, mis. 7A"),
    user: Dict = Depends(require_role(*UKS_ROLES)),
):
    """Excel template pre-filled with active patients (siswa in the active
    academic year's classes, or active GTK), ready for petugas UKS to fill
    in the CKG examination columns and re-upload."""
    pasien_list = await _get_active_pasien_list(jenis_pasien, tingkat, jenis_gtk, kelas)
    wb = await buat_template_ckg(pasien_list, jenis_pasien, tingkat, jenis_gtk, kelas)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    # Nama kelas resmi (bukan ketikan pengguna) untuk nama berkas, mis. '7a' -> '7A'.
    kelas_nama = next((p_['kelas'] for p_ in pasien_list if p_.get('kelas')), None) if kelas else None
    if kelas and not kelas_nama:
        cls = await db.classes.find_one({'$or': [{'id': kelas}, {'name': {'$regex': f'^{re.escape(kelas.strip())}$', '$options': 'i'}}]}, {'_id': 0, 'name': 1})
        kelas_nama = (cls or {}).get('name') or kelas
    filename = f"Template_CKG_{nama_kelompok_template(jenis_pasien, tingkat, jenis_gtk, kelas_nama)}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        # Template memuat NIK & alamat pasien: jangan di-cache peramban/proxy.
        headers={"Content-Disposition": f'attachment; filename="{filename}"', 'X-Jumlah-Data': str(len(pasien_list)),
                 'Cache-Control': 'no-store'},
    )


async def _cari_pasien_impor_ckg(data: Dict[str, str]) -> (Optional[Dict], Optional[str], Optional[str]):
    """Pasien untuk satu baris impor: ID Pasien (kolom bantu) lalu NIK (siswa: student_details, GTK: users).
    Mengembalikan (pasien, pesan_galat, kolom_galat)."""
    pid = (data.get('pasien_id') or '').strip()
    if pid:
        u = await db.users.find_one({'id': pid}, {'_id': 0, 'password_hash': 0})
        return (u, None, None) if u else (None, f'ID Pasien {pid} tidak ditemukan', 'ID Pasien')
    nik = re.sub(r'\D', '', data.get('nik') or '')
    if not nik:
        return None, 'Identitas pasien kosong; isi ID Pasien (dari template) atau NIK', 'ID Pasien / NIK'
    calon = [d['student_id'] for d in await db.student_details.find({'nik': nik}, {'_id': 0, 'student_id': 1}).to_list(5)]
    calon += [u['id'] for u in await db.users.find({'nik': nik}, {'_id': 0, 'id': 1}).to_list(5)]
    calon = list(dict.fromkeys(calon))
    if not calon:
        return None, f'NIK {nik} tidak ditemukan pada data siswa/GTK', 'NIK'
    if len(calon) > 1:
        return None, f'NIK {nik} dimiliki {len(calon)} pengguna; isi kolom ID Pasien', 'NIK'
    return await db.users.find_one({'id': calon[0]}, {'_id': 0, 'password_hash': 0}), None, None


@router.post("/uks/ckg/import-excel")
async def import_ckg_excel(file: UploadFile = File(...), user: Dict = Depends(require_role(*UKS_ROLES))):
    """Impor Data CKG dari berkas template (format kolom baku; template lama tetap diterima).
    Baris tanpa hasil pemeriksaan dilewati. Respons: success, failed, total, hasil per baris
    (baris, nama, status, pesan, kolom) dan errors (teks, kompatibel dengan klien lama)."""
    if not (file.filename or '').lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(400, "Hanya file .xlsx yang didukung")
    contents = await file.read(5 * 1024 * 1024 + 1)
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(413, 'Ukuran berkas maksimal 5 MB')
    try:
        berkas = baca_berkas_ckg(contents)
    except ValueError as e:
        raise HTTPException(400, str(e))
    if berkas['masalah_header']:
        raise HTTPException(422, {'pesan': 'Susunan kolom berkas tidak sesuai template CKG', 'masalah': berkas['masalah_header']})

    hasil = []
    sekarang = datetime.utcnow().isoformat()
    sudah_di_berkas: Dict[tuple, int] = {}  # (pasien_id, tanggal) -> baris pertama di berkas ini
    for b in berkas['baris']:
        data = b['data']
        r = {'baris': b['baris'], 'nama': data.get('nama_lengkap') or '-', 'status': 'gagal', 'kolom': None}
        salah = validasi_baris_ckg(data)
        if salah:
            # Satu baris disimpan utuh atau tidak sama sekali; semua kesalahan dilaporkan sekaligus.
            r.update(pesan='; '.join(e['pesan'] for e in salah), kolom=', '.join(e['kolom'] for e in salah))
            hasil.append(r)
            continue
        pasien, pesan, kolom = await _cari_pasien_impor_ckg(data)
        if not pasien:
            r.update(pesan=pesan, kolom=kolom)
            hasil.append(r)
            continue
        r['nama'] = pasien.get('full_name') or r['nama']
        try:
            fields = dokumen_ckg(data)
        except ValueError:
            r.update(pesan='Ada nilai angka yang tidak valid', kolom='Hasil Pemeriksaan')
            hasil.append(r)
            continue
        if not fields.get('tanggal'):
            r.update(pesan='Tanggal pemeriksaan wajib diisi', kolom='Tanggal Periksa')
            hasil.append(r)
            continue
        kunci = (pasien['id'], fields['tanggal'])
        if kunci in sudah_di_berkas:
            r.update(pesan=f"Pemeriksaan pasien & tanggal yang sama sudah ada di baris {sudah_di_berkas[kunci]}", kolom='Tanggal Periksa')
            hasil.append(r)
            continue
        sudah_di_berkas[kunci] = b['baris']
        ada = await db.uks_ckg.find_one({'pasien_id': pasien['id'], 'tanggal': fields['tanggal']}, {'_id': 0, 'id': 1})
        if ada:
            # Impor ulang berkas yang sama tidak menggandakan data: perbarui pemeriksaan pada tanggal itu,
            # hanya untuk kolom yang terisi di berkas (kolom kosong tidak menghapus data tersimpan).
            isi = {k: v for k, v in fields.items() if v is not None}
            await db.uks_ckg.update_one({'id': ada['id']}, {'$set': {**isi, 'updated_at': sekarang, 'diperbarui_oleh': user['id'],
                                                                    'sumber_terakhir': f"impor:{berkas['format']}"}})
            r.update(status='berhasil', pesan='Diperbarui (pemeriksaan tanggal ini sudah ada)', aksi='perbarui', ckg_id=ada['id'])
        else:
            doc = {'id': str(uuid.uuid4()), 'pasien_id': pasien['id'], **fields, **_user_fields('pasien', pasien),
                   'pasien_tipe': 'siswa' if 'siswa' in (pasien.get('roles') or []) else 'gtk', 'sumber': f"impor:{berkas['format']}",
                   'petugas_id': user['id'], 'petugas_nama': user.get('full_name', user.get('username')), 'created_at': sekarang, 'updated_at': sekarang}
            await db.uks_ckg.insert_one(doc)
            r.update(status='berhasil', pesan='Tersimpan', aksi='baru', ckg_id=doc['id'])
        hasil.append(r)

    success = sum(1 for h in hasil if h['status'] == 'berhasil')
    diperbarui = sum(1 for h in hasil if h.get('aksi') == 'perbarui')
    await log_audit(user, 'uks_ckg_import', f"Import CKG dari Excel ({berkas['format']}): {success} berhasil, {len(hasil) - success} gagal")
    return {
        'format': berkas['format'],
        'success': success,
        'baru': success - diperbarui,
        'diperbarui': diperbarui,
        'failed': len(hasil) - success,
        'total': len(hasil),
        'dilewati': berkas['dilewati'],
        # Ringkasan siap tampil: jumlah per status & daftar baris gagal (lokasi + alasan).
        'ringkasan': {
            'diproses': len(hasil), 'berhasil': success, 'baru': success - diperbarui, 'diperbarui': diperbarui,
            'gagal': len(hasil) - success, 'dilewati_kosong': berkas['dilewati']['kosong'],
            'dilewati_belum_diperiksa': berkas['dilewati']['belum_diperiksa'],
        },
        'gagal': [{k: h.get(k) for k in ('baris', 'nama', 'kolom', 'pesan')} for h in hasil if h['status'] == 'gagal'],
        'hasil': hasil,
        'errors': [f"Baris {h['baris']}: {h['pesan']}" for h in hasil if h['status'] == 'gagal'],
        'total_rows': len(hasil),
    }


# ============================================================
# DATA IMUNISASI ENDPOINTS
# ============================================================

@router.get("/uks/imunisasi")
async def list_imunisasi(
    pasien_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(require_role(*UKS_VIEW_ROLES))
):
    query = {}
    if pasien_id:
        query['pasien_id'] = pasien_id
    if start_date or end_date:
        date_query = {}
        if start_date:
            date_query['$gte'] = start_date
        if end_date:
            date_query['$lte'] = end_date
        query['tanggal'] = date_query

    await sembunyikan_siswa_nonaktif(query, 'pasien_id', db)  # data siswa nonaktif disembunyikan, tidak dihapus
    items = await db.uks_imunisasi.find(query, {'_id': 0}).sort('tanggal', -1).to_list(5000)
    return [serialize_doc(i) for i in items]


@router.post("/uks/imunisasi")
async def create_imunisasi(req: ImunisasiRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    pasien = await _get_user_or_404(req.pasien_id)
    doc = {
        'id': str(uuid.uuid4()),
        **req.model_dump(),
        **_user_fields('pasien', pasien),
        'petugas_id': user['id'],
        'petugas_nama': user.get('full_name', user.get('username')),
        'created_at': datetime.utcnow().isoformat(),
        'updated_at': datetime.utcnow().isoformat(),
    }
    await db.uks_imunisasi.insert_one(doc)
    await log_audit(user, 'uks_imunisasi_create', f"Recorded imunisasi: {pasien.get('full_name')} - {req.jenis_vaksin}")
    return serialize_doc(doc)


@router.put("/uks/imunisasi/{imunisasi_id}")
async def update_imunisasi(imunisasi_id: str, req: ImunisasiRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_imunisasi.find_one({'id': imunisasi_id})
    if not existing:
        raise HTTPException(404, "Data imunisasi tidak ditemukan")

    update_data = req.model_dump()
    if req.pasien_id != existing.get('pasien_id'):
        pasien = await _get_user_or_404(req.pasien_id)
        update_data.update(_user_fields('pasien', pasien))
    update_data['updated_at'] = datetime.utcnow().isoformat()

    await db.uks_imunisasi.update_one({'id': imunisasi_id}, {'$set': update_data})
    await log_audit(user, 'uks_imunisasi_update', f"Updated imunisasi: {imunisasi_id}")

    updated = await db.uks_imunisasi.find_one({'id': imunisasi_id}, {'_id': 0})
    return serialize_doc(updated)


@router.delete("/uks/imunisasi/{imunisasi_id}")
async def delete_imunisasi(imunisasi_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    existing = await db.uks_imunisasi.find_one({'id': imunisasi_id})
    if not existing:
        raise HTTPException(404, "Data imunisasi tidak ditemukan")

    await db.uks_imunisasi.delete_one({'id': imunisasi_id})
    await log_audit(user, 'uks_imunisasi_delete', f"Deleted imunisasi: {imunisasi_id}")
    return {'message': 'Data imunisasi berhasil dihapus'}


@router.get("/uks/imunisasi/template")
async def download_imunisasi_template(jenis_pasien: str = Query('siswa'), user: Dict = Depends(require_role(*UKS_ROLES))):
    """Excel template pre-filled with active patients, ready for petugas UKS
    to fill in the immunization columns and re-upload."""
    pasien_list = await _get_active_pasien_list(jenis_pasien)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Template Imunisasi"

    headers = [
        'ID (jangan diubah)', 'NISN/NIP', 'Nama', 'Kelas', 'Tanggal (YYYY-MM-DD)',
        'Jenis Vaksin', 'Dosis/Tahap', 'Petugas/Lokasi Pemberi', 'Efek Samping', 'Keterangan',
    ]
    locked_fill = _style_import_header(ws, headers)

    for row_num, p in enumerate(pasien_list, 2):
        ws.cell(row=row_num, column=1, value=p['id']).fill = locked_fill
        ws.cell(row=row_num, column=2, value=p.get('identitas') or '').fill = locked_fill
        ws.cell(row=row_num, column=3, value=p.get('full_name') or '').fill = locked_fill
        ws.cell(row=row_num, column=4, value=p.get('kelas') or '').fill = locked_fill

    widths = [28, 14, 26, 10, 16, 20, 12, 22, 24, 20]
    for idx, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(idx)].width = w
    ws.column_dimensions['A'].hidden = True

    ws2 = wb.create_sheet("PETUNJUK")
    ws2['A1'] = "Petunjuk Pengisian Template Imunisasi"
    ws2['A1'].font = Font(bold=True, size=13, color='006837')
    ws2.column_dimensions['A'].width = 100
    for line in [
        '', "Kolom ID, NISN/NIP, Nama, dan Kelas sudah terisi otomatis — JANGAN diubah atau dihapus urutannya.",
        "Isi kolom Tanggal dan Jenis Vaksin pada baris siswa/GTK yang diimunisasi.",
        "Baris yang kolom Tanggal atau Jenis Vaksin-nya dikosongkan akan dilewati saat diimpor.",
        "Format Tanggal: YYYY-MM-DD (contoh: 2026-09-19).",
    ]:
        ws2.append([line])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    filename = f"Template_Imunisasi_{jenis_pasien}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/uks/imunisasi/import-excel")
async def import_imunisasi_excel(file: UploadFile = File(...), user: Dict = Depends(require_role(*UKS_ROLES))):
    if not file.filename.lower().endswith(('.xlsx', '.xlsm')):
        raise HTTPException(400, "Hanya file .xlsx yang didukung")
    contents = await file.read()
    wb = openpyxl.load_workbook(io.BytesIO(contents), read_only=True, data_only=True)
    ws = wb['Template Imunisasi'] if 'Template Imunisasi' in wb.sheetnames else wb.active

    success = 0
    errors = []
    for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or not row[0] or not row[4] or not row[5]:
            continue  # skip rows without ID, Tanggal, or Jenis Vaksin
        pasien_id = str(row[0]).strip()
        tanggal = str(row[4]).strip() if not hasattr(row[4], 'isoformat') else row[4].date().isoformat() if hasattr(row[4], 'date') else row[4].isoformat()
        try:
            pasien = await db.users.find_one({'id': pasien_id}, {'_id': 0, 'password_hash': 0})
            if not pasien:
                errors.append(f"Baris {idx}: pasien tidak ditemukan")
                continue

            doc = {
                'id': str(uuid.uuid4()),
                'pasien_id': pasien_id,
                'tanggal': tanggal,
                'jenis_vaksin': str(row[5]).strip(),
                'dosis_ke': str(row[6]).strip() if row[6] else None,
                'petugas_pemberi': str(row[7]).strip() if row[7] else None,
                'efek_samping': str(row[8]).strip() if row[8] else None,
                'keterangan': str(row[9]).strip() if len(row) > 9 and row[9] else None,
                **_user_fields('pasien', pasien),
                'petugas_id': user['id'],
                'petugas_nama': user.get('full_name', user.get('username')),
                'created_at': datetime.utcnow().isoformat(),
                'updated_at': datetime.utcnow().isoformat(),
            }
            await db.uks_imunisasi.insert_one(doc)
            success += 1
        except Exception as e:
            errors.append(f"Baris {idx}: {e}")

    await log_audit(user, 'uks_imunisasi_import', f"Import imunisasi dari Excel: {success} baris berhasil")
    return {'success': success, 'errors': errors, 'total_rows': success + len(errors)}


# ============================================================
# ASET UKS ENDPOINTS (terintegrasi dengan Sarpras: aset_tetap/aset_lancar
# yang sama, discope lewat ruangan "Ruang UKS" — sama seperti pola Lab IPA/
# Komputer di backend/routers/lab.py)
# ============================================================

async def _get_uks_room() -> Dict:
    """Ambil (atau buat otomatis jika belum ada) ruangan 'Ruang UKS' di
    collection rooms — UKS tidak punya akses membuat ruangan sendiri lewat
    menu Sarpras, jadi dibuat otomatis saat pertama kali dibutuhkan."""
    room = await db.rooms.find_one({'name': UKS_ROOM_NAME})
    if room:
        return room
    doc = {
        'id': str(uuid.uuid4()),
        'name': UKS_ROOM_NAME,
        'created_at': datetime.utcnow().isoformat(),
    }
    await db.rooms.insert_one(doc)
    return doc


async def _resolve_uks_target_room(ruangan_id: Optional[str]) -> Dict:
    if ruangan_id:
        room = await db.rooms.find_one({'id': ruangan_id})
        if not room:
            raise HTTPException(404, "Ruangan tidak ditemukan")
        return room
    return await _get_uks_room()


async def _resolve_uks_aset(aset_tipe: str, aset_id: str):
    if aset_tipe == 'tetap':
        doc = await db.sarpras_aset_tetap.find_one({'id': aset_id})
        if not doc:
            raise HTTPException(404, "Aset tidak ditemukan")
        return doc, db.sarpras_aset_tetap
    elif aset_tipe == 'lancar':
        doc = await db.sarpras_aset_lancar.find_one({'id': aset_id})
        if not doc:
            raise HTTPException(404, "Aset tidak ditemukan")
        return doc, db.sarpras_aset_lancar
    raise HTTPException(400, "aset_tipe harus 'tetap' atau 'lancar'")


async def _get_uks_asset_or_403(uks_room_id: str, aset_tipe: str, aset_id: str):
    doc, collection = await _resolve_uks_aset(aset_tipe, aset_id)
    if doc.get('lokasi_room_id') != uks_room_id:
        raise HTTPException(403, "Aset ini bukan bagian dari UKS")
    return doc, collection


def _uks_aset_doc_to_row(doc: Dict, aset_tipe: str) -> Dict:
    name_field = 'nama_aset' if aset_tipe == 'tetap' else 'nama_barang'
    row = {
        'id': doc.get('id'),
        'aset_tipe': aset_tipe,
        'nama': doc.get(name_field),
        'sumber_dana': doc.get('sumber_dana', 'Komite'),
        'kategori': doc.get('kategori'),
        'satuan': doc.get('satuan') or ('unit' if aset_tipe == 'tetap' else None),
        'lokasi_penyimpanan': doc.get('lokasi_penyimpanan'),
        'ruangan_id': doc.get('lokasi_room_id'),
        'ruangan_nama': doc.get('lokasi_room_nama'),
        'keterangan': doc.get('keterangan'),
    }
    if aset_tipe == 'tetap':
        row['jumlah_baik'] = doc.get('jumlah_baik', doc.get('jumlah', 0))
        row['jumlah_rusak'] = doc.get('jumlah_rusak', 0)
    else:
        row['stok'] = doc.get('stok', 0)
        row['stok_minimum'] = doc.get('stok_minimum', 0)
    return row


@router.get("/uks/aset/meta")
async def get_uks_aset_meta(user: Dict = Depends(get_current_user)):
    return {'kategori_alat_bahan': UKS_KATEGORI_ALAT_BAHAN}


@router.get("/uks/aset")
async def list_aset(user: Dict = Depends(get_current_user)):
    room = await _get_uks_room()
    tetap = await db.sarpras_aset_tetap.find({'lokasi_room_id': room['id']}, {'_id': 0}).sort('nama_aset', 1).to_list(2000)
    lancar = await db.sarpras_aset_lancar.find({'lokasi_room_id': room['id']}, {'_id': 0}).sort('nama_barang', 1).to_list(2000)
    rows = [_uks_aset_doc_to_row(a, 'tetap') for a in tetap] + [_uks_aset_doc_to_row(a, 'lancar') for a in lancar]
    rows.sort(key=lambda r: (r['nama'] or '').lower())
    return {
        'room': serialize_doc(room),
        'items': rows,
    }


@router.post("/uks/aset")
async def create_aset(req: AsetUKSRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    room = await _resolve_uks_target_room(req.ruangan_id)
    now = datetime.utcnow().isoformat()

    if req.aset_tipe == 'tetap':
        doc = {
            'id': str(uuid.uuid4()),
            'nama_aset': req.nama,
            'sumber_dana': req.sumber_dana,
            'kategori': req.kategori,
            'jumlah': req.jumlah_baik + req.jumlah_rusak,
            'jumlah_baik': req.jumlah_baik,
            'jumlah_rusak': req.jumlah_rusak,
            'kondisi': 'Baik' if req.jumlah_rusak == 0 else 'Rusak Ringan',
            'satuan': req.satuan,
            'lokasi_penyimpanan': req.lokasi_penyimpanan,
            'lokasi_room_id': room['id'],
            'lokasi_room_nama': room.get('name'),
            'keterangan': req.keterangan,
            'created_by': user['id'],
            'created_at': now,
            'updated_at': now,
        }
        await db.sarpras_aset_tetap.insert_one(doc)
    elif req.aset_tipe == 'lancar':
        doc = {
            'id': str(uuid.uuid4()),
            'nama_barang': req.nama,
            'sumber_dana': req.sumber_dana,
            'kategori': req.kategori,
            'satuan': req.satuan or 'pcs',
            'stok': req.stok,
            'stok_minimum': req.stok_minimum,
            'lokasi_penyimpanan': req.lokasi_penyimpanan,
            'lokasi_room_id': room['id'],
            'lokasi_room_nama': room.get('name'),
            'keterangan': req.keterangan,
            'created_by': user['id'],
            'created_at': now,
            'updated_at': now,
        }
        await db.sarpras_aset_lancar.insert_one(doc)
    else:
        raise HTTPException(400, "aset_tipe harus 'tetap' atau 'lancar'")

    await log_audit(user, 'uks_aset_create', f"Created aset UKS: {req.nama}")
    return _uks_aset_doc_to_row(doc, req.aset_tipe)


@router.put("/uks/aset/{aset_tipe}/{aset_id}")
async def update_aset(aset_tipe: str, aset_id: str, req: AsetUKSRequest, user: Dict = Depends(require_role(*UKS_ROLES))):
    uks_room = await _get_uks_room()
    _, collection = await _get_uks_asset_or_403(uks_room['id'], aset_tipe, aset_id)
    target_room = await _resolve_uks_target_room(req.ruangan_id)
    now = datetime.utcnow().isoformat()

    if aset_tipe == 'tetap':
        update_data = {
            'nama_aset': req.nama, 'sumber_dana': req.sumber_dana, 'kategori': req.kategori, 'satuan': req.satuan,
            'jumlah': req.jumlah_baik + req.jumlah_rusak,
            'jumlah_baik': req.jumlah_baik, 'jumlah_rusak': req.jumlah_rusak,
            'kondisi': 'Baik' if req.jumlah_rusak == 0 else 'Rusak Ringan',
            'lokasi_penyimpanan': req.lokasi_penyimpanan,
            'lokasi_room_id': target_room['id'], 'lokasi_room_nama': target_room.get('name'),
            'keterangan': req.keterangan, 'updated_at': now,
        }
    else:
        update_data = {
            'nama_barang': req.nama, 'sumber_dana': req.sumber_dana, 'kategori': req.kategori, 'satuan': req.satuan or 'pcs',
            'stok': req.stok, 'stok_minimum': req.stok_minimum,
            'lokasi_penyimpanan': req.lokasi_penyimpanan,
            'lokasi_room_id': target_room['id'], 'lokasi_room_nama': target_room.get('name'),
            'keterangan': req.keterangan, 'updated_at': now,
        }

    await collection.update_one({'id': aset_id}, {'$set': update_data})
    await log_audit(user, 'uks_aset_update', f"Updated aset UKS: {aset_id}")

    updated = await collection.find_one({'id': aset_id}, {'_id': 0})
    return _uks_aset_doc_to_row(updated, aset_tipe)


@router.delete("/uks/aset/{aset_tipe}/{aset_id}")
async def delete_aset(aset_tipe: str, aset_id: str, user: Dict = Depends(require_role(*UKS_ROLES))):
    uks_room = await _get_uks_room()
    _, collection = await _get_uks_asset_or_403(uks_room['id'], aset_tipe, aset_id)

    await collection.delete_one({'id': aset_id})
    await log_audit(user, 'uks_aset_delete', f"Deleted aset UKS: {aset_id}")
    return {'message': 'Aset berhasil dihapus'}


# ============================================================
# LAPORAN UKS (SUMMARY STATISTICS)
# ============================================================

@router.get("/uks/laporan/summary")
async def get_laporan_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user: Dict = Depends(require_role(*UKS_ROLES, 'kepala_sekolah'))
):
    date_query = {}
    if start_date:
        date_query['$gte'] = start_date
    if end_date:
        date_query['$lte'] = end_date

    kunjungan_query = {'tanggal': date_query} if date_query else {}
    kunjungan = await db.uks_kunjungan.find(kunjungan_query, {'_id': 0}).to_list(10000)

    obat_keluar_query = {'tanggal': date_query} if date_query else {}
    obat_keluar = await db.uks_obat_keluar.find(obat_keluar_query, {'_id': 0}).to_list(10000)

    obat_list = await db.uks_obat.find({}, {'_id': 0}).to_list(2000)
    for o in obat_list:
        o.update(await _get_obat_stock_summary(o['id']))

    def by_field(records, field):
        """Count occurrences of a field's value. If the value is a list (e.g.
        multiple jenis penanganan per visit), each entry counts separately."""
        counts = {}
        for r in records:
            val = r.get(field)
            keys = val if isinstance(val, list) else [val]
            if not keys:
                keys = ['Lainnya']
            for key in keys:
                key = key or 'Lainnya'
                counts[key] = counts.get(key, 0) + 1
        return counts

    obat_usage = {}
    for r in obat_keluar:
        key = r.get('obat_nama') or r.get('obat_id')
        obat_usage[key] = obat_usage.get(key, 0) + r.get('jumlah', 0)
    most_used_obat = sorted(obat_usage.items(), key=lambda x: x[1], reverse=True)[:10]

    low_stock = [o for o in obat_list if o.get('stok_tersisa', 0) <= (o.get('stok_minimum') or 0)]

    return {
        'total_kunjungan': len(kunjungan),
        'kunjungan_by_jenis_penanganan': by_field(kunjungan, 'jenis_penanganan_nama'),
        'kunjungan_by_kondisi_pulang': by_field(kunjungan, 'kondisi_pulang'),
        'total_obat_keluar_transaksi': len(obat_keluar),
        'most_used_obat': [{'nama_obat': k, 'jumlah': v} for k, v in most_used_obat],
        'total_jenis_obat': len(obat_list),
        'obat_stok_menipis': [serialize_doc(o) for o in low_stock],
    }


# ============================================================
# REKAP KUNJUNGAN (per hari/bulan/semester/tahun, siswa vs GTK)
# ============================================================

BULAN_NAMA_ID = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]


async def _resolve_rekap_period(period: str, bulan: Optional[str], semester_id: Optional[str], tahun: Optional[str]):
    """Resolve a rekap period into (start_date, end_date, label, group_by).
    group_by is 'hari' for a single month, 'bulan' for semester/tahun."""
    if period == 'bulan':
        if not bulan:
            raise HTTPException(400, "Parameter bulan wajib diisi (format YYYY-MM)")
        try:
            year, month = (int(x) for x in bulan.split('-'))
        except ValueError:
            raise HTTPException(400, "Format bulan tidak valid, gunakan YYYY-MM")
        last_day = calendar.monthrange(year, month)[1]
        start_date = f"{year:04d}-{month:02d}-01"
        end_date = f"{year:04d}-{month:02d}-{last_day:02d}"
        label = f"{BULAN_NAMA_ID[month - 1]} {year}"
        return start_date, end_date, label, 'hari'

    if period == 'semester':
        if not semester_id:
            raise HTTPException(400, "Parameter semester_id wajib diisi")
        sem = await db.semesters.find_one({'id': semester_id}, {'_id': 0})
        if not sem:
            raise HTTPException(404, "Semester tidak ditemukan")
        ay = await db.academic_years.find_one({'id': sem.get('academic_year_id')}, {'_id': 0, 'name': 1})
        label = f"Semester {sem.get('name')} {ay.get('name') if ay else ''}".strip()
        return sem.get('start_date'), sem.get('end_date'), label, 'bulan'

    if period == 'tahun':
        if not tahun:
            raise HTTPException(400, "Parameter tahun wajib diisi (format YYYY)")
        try:
            year = int(tahun)
        except ValueError:
            raise HTTPException(400, "Format tahun tidak valid")
        start_date = f"{year:04d}-01-01"
        end_date = f"{year:04d}-12-31"
        return start_date, end_date, f"Tahun {year}", 'bulan'

    raise HTTPException(400, "Parameter period tidak valid (bulan/semester/tahun)")


async def _build_rekap_kunjungan(period: str, bulan: Optional[str], semester_id: Optional[str], tahun: Optional[str]) -> Dict:
    start_date, end_date, label, group_by = await _resolve_rekap_period(period, bulan, semester_id, tahun)

    kunjungan = await db.uks_kunjungan.find(
        {'tanggal': {'$gte': start_date, '$lte': end_date}}, {'_id': 0}
    ).to_list(20000)

    def is_siswa(k):
        return 'siswa' in (k.get('pasien_roles') or [])

    if group_by == 'hari':
        year, month = (int(x) for x in bulan.split('-'))
        last_day = calendar.monthrange(year, month)[1]
        rows = []
        for day in range(1, last_day + 1):
            tanggal = f"{year:04d}-{month:02d}-{day:02d}"
            day_records = [k for k in kunjungan if k.get('tanggal') == tanggal]
            siswa_count = sum(1 for k in day_records if is_siswa(k))
            gtk_count = len(day_records) - siswa_count
            rows.append({'label': tanggal, 'siswa': siswa_count, 'gtk': gtk_count, 'total': len(day_records)})
    else:
        # group by bulan across the period's date range
        rows = []
        cur_year, cur_month = int(start_date[:4]), int(start_date[5:7])
        end_year, end_month = int(end_date[:4]), int(end_date[5:7])
        while (cur_year, cur_month) <= (end_year, end_month):
            month_start = f"{cur_year:04d}-{cur_month:02d}-01"
            month_last_day = calendar.monthrange(cur_year, cur_month)[1]
            month_end = f"{cur_year:04d}-{cur_month:02d}-{month_last_day:02d}"
            month_records = [k for k in kunjungan if month_start <= k.get('tanggal', '') <= month_end]
            siswa_count = sum(1 for k in month_records if is_siswa(k))
            gtk_count = len(month_records) - siswa_count
            rows.append({
                'label': f"{BULAN_NAMA_ID[cur_month - 1]} {cur_year}",
                'siswa': siswa_count, 'gtk': gtk_count, 'total': len(month_records),
            })
            if cur_month == 12:
                cur_year += 1
                cur_month = 1
            else:
                cur_month += 1

    total_siswa = sum(r['siswa'] for r in rows)
    total_gtk = sum(r['gtk'] for r in rows)

    return {
        'period': period,
        'label': label,
        'start_date': start_date,
        'end_date': end_date,
        'group_by': group_by,
        'rows': rows,
        'total_siswa': total_siswa,
        'total_gtk': total_gtk,
        'total': total_siswa + total_gtk,
    }


@router.get("/uks/laporan/rekap-kunjungan")
async def get_rekap_kunjungan(
    period: str = Query(..., description="bulan | semester | tahun"),
    bulan: Optional[str] = Query(None, description="YYYY-MM, wajib jika period=bulan"),
    semester_id: Optional[str] = Query(None, description="wajib jika period=semester"),
    tahun: Optional[str] = Query(None, description="YYYY, wajib jika period=tahun"),
    user: Dict = Depends(require_role(*UKS_ROLES, 'kepala_sekolah')),
):
    return await _build_rekap_kunjungan(period, bulan, semester_id, tahun)


def _rekap_row_label_header(group_by: str) -> str:
    return 'Tanggal' if group_by == 'hari' else 'Bulan'


@router.get("/uks/laporan/rekap-kunjungan/export-excel")
async def export_rekap_kunjungan_excel(
    period: str = Query(...),
    bulan: Optional[str] = Query(None),
    semester_id: Optional[str] = Query(None),
    tahun: Optional[str] = Query(None),
    user: Dict = Depends(require_role(*UKS_ROLES)),
):
    rekap = await _build_rekap_kunjungan(period, bulan, semester_id, tahun)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Rekap Kunjungan UKS"

    header_fill = PatternFill(start_color="006837", end_color="006837", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    header_alignment = Alignment(horizontal="center", vertical="center")
    border = Border(left=Side(style='thin'), right=Side(style='thin'), top=Side(style='thin'), bottom=Side(style='thin'))

    ws.merge_cells('A1:D1')
    ws['A1'] = f"Rekap Kunjungan UKS — {rekap['label']}"
    ws['A1'].font = Font(bold=True, size=13)

    headers = [_rekap_row_label_header(rekap['group_by']), 'Kunjungan Siswa', 'Kunjungan GTK', 'Total']
    for col_num, header in enumerate(headers, 1):
        cell = ws.cell(row=3, column=col_num, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = header_alignment
        cell.border = border

    row_num = 4
    for row in rekap['rows']:
        ws.cell(row=row_num, column=1, value=row['label']).border = border
        ws.cell(row=row_num, column=2, value=row['siswa']).border = border
        ws.cell(row=row_num, column=3, value=row['gtk']).border = border
        ws.cell(row=row_num, column=4, value=row['total']).border = border
        row_num += 1

    total_font = Font(bold=True)
    ws.cell(row=row_num, column=1, value='TOTAL').font = total_font
    ws.cell(row=row_num, column=1).border = border
    ws.cell(row=row_num, column=2, value=rekap['total_siswa']).font = total_font
    ws.cell(row=row_num, column=2).border = border
    ws.cell(row=row_num, column=3, value=rekap['total_gtk']).font = total_font
    ws.cell(row=row_num, column=3).border = border
    ws.cell(row=row_num, column=4, value=rekap['total']).font = total_font
    ws.cell(row=row_num, column=4).border = border

    for col_idx in range(1, len(headers) + 1):
        column = get_column_letter(col_idx)
        max_length = max(
            (len(str(ws.cell(row=r, column=col_idx).value or '')) for r in range(3, row_num + 1)),
            default=0,
        )
        ws.column_dimensions[column].width = min(max_length + 4, 40)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    filename = f"Rekap_Kunjungan_UKS_{rekap['label'].replace(' ', '_')}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/uks/laporan/rekap-kunjungan/export-pdf")
async def export_rekap_kunjungan_pdf(
    period: str = Query(...),
    bulan: Optional[str] = Query(None),
    semester_id: Optional[str] = Query(None),
    tahun: Optional[str] = Query(None),
    user: Dict = Depends(require_role(*UKS_ROLES)),
):
    rekap = await _build_rekap_kunjungan(period, bulan, semester_id, tahun)
    settings = await get_settings()

    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph(settings.get('school_name') or 'MTsN 2 Kota Malang', styles['Title']))
    elements.append(Paragraph(f"Rekap Kunjungan UKS — {rekap['label']}", styles['Heading2']))
    elements.append(Spacer(1, 0.5 * cm))

    header = [_rekap_row_label_header(rekap['group_by']), 'Kunjungan Siswa', 'Kunjungan GTK', 'Total']
    data = [header] + [[r['label'], str(r['siswa']), str(r['gtk']), str(r['total'])] for r in rekap['rows']]
    data.append(['TOTAL', str(rekap['total_siswa']), str(rekap['total_gtk']), str(rekap['total'])])

    table = Table(data, colWidths=[6 * cm, 4 * cm, 4 * cm, 4 * cm], repeatRows=1)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#006837')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#E8F5E9')),
    ]))
    elements.append(table)

    doc.build(elements)
    output.seek(0)

    filename = f"Rekap_Kunjungan_UKS_{rekap['label'].replace(' ', '_')}.pdf"
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
