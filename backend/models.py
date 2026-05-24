"""
Pydantic models for Super Apps MATSANDATAMA.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any, Literal
import uuid

from pydantic import BaseModel, Field, ConfigDict


ROLES = [
    'admin',
    'siswa',
    'guru',
    'tenaga_kependidikan',
    'guru_ekstrakurikuler',
    'guru_piket',
    'guru_bk',
    'wali_kelas',
    'guru_tata_tertib',
    'alumni',
    'kepala_sekolah',
    'kepala_tata_usaha',
    'waka_kesiswaan',
    'waka_kurikulum',
    'waka_sarpras',
    'waka_humas',
    'bendahara',
    'kepegawaian',
    'perpustakaan',
    'unit_pelayanan',
    'unit_kesehatan',
    'penjamin_mutu',
    'unit_pengaduan',
    'unit_ubudiyah',
    'unit_olimpiade',
    'unit_tahfidz',
    'unit_kopsis',
    'mundhir_mahad',
    'musrif_mahad',
    'musrifah_mahad',
    'murabbi_mahad',
    'bendahara_mahad',
]

ROLE_LABELS = {
    'admin': 'Administrator',
    'siswa': 'Siswa',
    'guru': 'Guru Mata Pelajaran',
    'tenaga_kependidikan': 'Tenaga Kependidikan',
    'guru_ekstrakurikuler': 'Guru Ekstrakurikuler',
    'guru_piket': 'Guru Piket',
    'guru_bk': 'Guru BK',
    'wali_kelas': 'Wali Kelas',
    'guru_tata_tertib': 'Guru Tata Tertib',
    'alumni': 'Alumni',
    'kepala_sekolah': 'Kepala Sekolah',
    'kepala_tata_usaha': 'Kepala Tata Usaha',
    'waka_kesiswaan': 'Waka Kesiswaan',
    'waka_kurikulum': 'Waka Kurikulum',
    'waka_sarpras': 'Waka Sarana Prasarana',
    'waka_humas': 'Waka Humas',
    'bendahara': 'Bendahara',
    'kepegawaian': 'Kepegawaian',
    'perpustakaan': 'Perpustakaan',
    'unit_pelayanan': 'Unit Pelayanan',
    'unit_kesehatan': 'Unit Kesehatan',
    'penjamin_mutu': 'Penjamin Mutu',
    'unit_pengaduan': 'Unit Pengaduan',
    'unit_ubudiyah': 'Unit Ubudiyah',
    'unit_olimpiade': 'Unit Olimpiade',
    'unit_tahfidz': 'Unit Tahfidz',
    'unit_kopsis': 'Unit Kopsis',
    'mundhir_mahad': 'Mundhir Mahad',
    'musrif_mahad': 'Musrif Mahad',
    'musrifah_mahad': 'Musrifah Mahad',
    'murabbi_mahad': 'Murabbi Mahad',
    'bendahara_mahad': 'Bendahara Mahad',
}

# Default teaching slots template (jam ke- format)
DEFAULT_TEACHING_SLOTS = [
    {'name': 'Jam ke-1', 'start_time': '07:00', 'end_time': '07:45'},
    {'name': 'Jam ke-2', 'start_time': '07:45', 'end_time': '08:30'},
    {'name': 'Jam ke-3', 'start_time': '08:30', 'end_time': '09:15'},
    {'name': 'Istirahat',  'start_time': '09:15', 'end_time': '09:30', 'is_break': True},
    {'name': 'Jam ke-4', 'start_time': '09:30', 'end_time': '10:15'},
    {'name': 'Jam ke-5', 'start_time': '10:15', 'end_time': '11:00'},
    {'name': 'Jam ke-6', 'start_time': '11:00', 'end_time': '11:45'},
    {'name': 'Istirahat & Shalat', 'start_time': '11:45', 'end_time': '12:30', 'is_break': True},
    {'name': 'Jam ke-7', 'start_time': '12:30', 'end_time': '13:15'},
    {'name': 'Jam ke-8', 'start_time': '13:15', 'end_time': '14:00'},
    {'name': 'Jam ke-9', 'start_time': '14:00', 'end_time': '14:45'},
]
DEFAULT_ACTIVE_DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat']


class UserModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str
    full_name: str
    nip_nuptk: Optional[str] = None
    nisn: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    roles: List[str] = Field(default_factory=list)
    homeroom_class_id: Optional[str] = None
    student_class_id: Optional[str] = None
    parent_of: List[str] = Field(default_factory=list)
    # Additional siswa fields
    gender: Optional[str] = None  # 'L' / 'P' / 'Laki-laki' / 'Perempuan'
    birth_place: Optional[str] = None
    birth_date: Optional[str] = None
    address: Optional[str] = None
    photo_url: Optional[str] = None
    is_active: bool = True
    nis: Optional[str] = None  # Nomor Induk Siswa (lokal sekolah, beda dgn NISN)
    nism: Optional[str] = None  # NIS Madrasah (NISM) - untuk buku induk
    nomor_peserta_ujian: Optional[str] = None  # Nomor Peserta Ujian Madrasah (kelas 9) - untuk buku induk
    # Mutation tracking (for stats: mutasi masuk/keluar di TP aktif)
    mutation_type: Optional[str] = None  # 'masuk' | 'keluar' | None
    mutation_ay_id: Optional[str] = None  # TP saat mutasi
    mutation_date: Optional[str] = None  # tanggal mutasi (YYYY-MM-DD)
    mutation_note: Optional[str] = None  # alasan/keterangan
    # Additional mutation details for keluar
    mutation_keluar_type: Optional[str] = None  # For staff: 'pindah' | 'keluar' | 'pensiun' | 'berhenti'
    mutation_destination: Optional[str] = None  # Sekolah/instansi tujuan (untuk pindah)
    mutation_document_url: Optional[str] = None  # Upload dokumen pendukung
    # Password policy (suggest change at first login + every 6 months)
    password_changed_at: Optional[str] = None  # ISO datetime when user last changed password
    password_change_dismissed_until: Optional[str] = None  # snooze reminder until this ISO datetime
    # Per-user view context (override aktif TP/semester untuk view data lampau, per user)
    # Tidak mempengaruhi user lain dan tidak mengubah TP aktif global.
    view_academic_year_id: Optional[str] = None  # None = ikut TP aktif global
    view_semester: Optional[str] = None  # None = ikut semester aktif global
    # Alumni & graduation tracking
    graduation_status: Optional[str] = None  # 'aktif' | 'lulus' | 'mutasi_keluar' | 'dropout'
    graduation_date: Optional[str] = None  # YYYY-MM-DD tanggal lulus
    graduation_ay_id: Optional[str] = None  # TP saat lulus
    graduation_class_id: Optional[str] = None  # Kelas terakhir saat lulus
    graduation_certificate_number: Optional[str] = None  # Nomor ijazah
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = None
    jabatan_ids: List[str] = Field(default_factory=list)  # Array of jabatan IDs for guru/staff

    # ==================== DATA SISWA (EMIS) ====================
    # Kewarganegaraan
    warga_negara: Optional[str] = None  # 'WNI' | 'WNA'
    nik: Optional[str] = None  # 16 digit (WNI)
    asal_negara: Optional[str] = None  # WNA
    nomor_izin_tinggal: Optional[str] = None  # KITAS (WNA)

    # Data Keluarga
    jumlah_saudara: Optional[int] = None
    anak_ke: Optional[int] = None
    agama: Optional[str] = None
    cita_cita: Optional[str] = None
    hobi: Optional[str] = None
    yang_membiayai_sekolah: Optional[str] = None

    # Pra Sekolah & Imunisasi
    pra_sekolah: List[str] = Field(default_factory=list)  # ['TK/RA', 'PAUD']
    imunisasi: List[str] = Field(default_factory=list)  # ['Hepatitis B', 'BCG', 'DPT', 'Polio', 'Campak', 'Covid']

    # Kontak Siswa
    no_hp_siswa: Optional[str] = None
    tidak_punya_hp: bool = False
    email_siswa: Optional[str] = None

    # KIP & KK
    nomor_kip: Optional[str] = None
    nomor_kk: Optional[str] = None
    nama_kepala_keluarga: Optional[str] = None

    # ==================== DATA ORANG TUA ====================
    # AYAH KANDUNG
    ayah_nama: Optional[str] = None
    ayah_status: Optional[str] = None  # 'Masih Hidup' | 'Sudah Meninggal' | 'Tidak Diketahui'
    ayah_kewarganegaraan: Optional[str] = None  # 'WNI' | 'WNA'
    ayah_nik: Optional[str] = None
    ayah_asal_negara: Optional[str] = None
    ayah_nomor_izin_tinggal: Optional[str] = None
    ayah_tempat_lahir: Optional[str] = None
    ayah_tanggal_lahir: Optional[str] = None
    ayah_pendidikan_terakhir: Optional[str] = None
    ayah_pekerjaan: Optional[str] = None
    ayah_penghasilan: Optional[str] = None
    ayah_no_hp: Optional[str] = None
    ayah_tidak_punya_hp: bool = False

    # IBU KANDUNG
    ibu_nama: Optional[str] = None
    ibu_status: Optional[str] = None  # 'Masih Hidup' | 'Sudah Meninggal' | 'Tidak Diketahui'
    ibu_kewarganegaraan: Optional[str] = None  # 'WNI' | 'WNA'
    ibu_nik: Optional[str] = None
    ibu_asal_negara: Optional[str] = None
    ibu_nomor_izin_tinggal: Optional[str] = None
    ibu_tempat_lahir: Optional[str] = None
    ibu_tanggal_lahir: Optional[str] = None
    ibu_pendidikan_terakhir: Optional[str] = None
    ibu_pekerjaan: Optional[str] = None
    ibu_penghasilan: Optional[str] = None
    ibu_no_hp: Optional[str] = None
    ibu_tidak_punya_hp: bool = False

    # ==================== DATA WALI ====================
    hubungan_wali: Optional[str] = None  # 'Sama dengan ayah kandung' | 'Sama dengan ibu kandung' | 'Lainnya'
    wali_nama: Optional[str] = None
    wali_status: Optional[str] = None
    wali_kewarganegaraan: Optional[str] = None
    wali_nik: Optional[str] = None
    wali_asal_negara: Optional[str] = None
    wali_nomor_izin_tinggal: Optional[str] = None
    wali_tempat_lahir: Optional[str] = None
    wali_tanggal_lahir: Optional[str] = None
    wali_pendidikan_terakhir: Optional[str] = None
    wali_pekerjaan: Optional[str] = None
    wali_penghasilan: Optional[str] = None
    wali_no_hp: Optional[str] = None
    wali_tidak_punya_hp: bool = False
    nomor_kks: Optional[str] = None
    nomor_pkh: Optional[str] = None

    # ==================== DATA ALAMAT ====================
    # ALAMAT AYAH KANDUNG
    ayah_tinggal_luar_negeri: bool = False
    ayah_status_kepemilikan_rumah: Optional[str] = None
    ayah_alamat_luar_negeri: Optional[str] = None
    ayah_provinsi: Optional[str] = None
    ayah_kabupaten_kota: Optional[str] = None
    ayah_kecamatan: Optional[str] = None
    ayah_kelurahan_desa: Optional[str] = None
    ayah_rt: Optional[str] = None
    ayah_rw: Optional[str] = None
    ayah_alamat: Optional[str] = None
    ayah_kode_pos: Optional[str] = None

    # ALAMAT IBU KANDUNG
    ibu_sama_dengan_ayah: bool = False
    ibu_tinggal_luar_negeri: bool = False
    ibu_status_kepemilikan_rumah: Optional[str] = None
    ibu_alamat_luar_negeri: Optional[str] = None
    ibu_provinsi: Optional[str] = None
    ibu_kabupaten_kota: Optional[str] = None
    ibu_kecamatan: Optional[str] = None
    ibu_kelurahan_desa: Optional[str] = None
    ibu_rt: Optional[str] = None
    ibu_rw: Optional[str] = None
    ibu_alamat: Optional[str] = None
    ibu_kode_pos: Optional[str] = None

    # ALAMAT WALI
    wali_status_wali: Optional[str] = None  # 'Sama dengan ayah kandung' | 'Sama dengan ibu kandung' | 'Lainnya'
    wali_sama_dengan_ayah: bool = False
    wali_tinggal_luar_negeri: bool = False
    wali_status_kepemilikan_rumah: Optional[str] = None
    wali_alamat_luar_negeri: Optional[str] = None
    wali_provinsi: Optional[str] = None
    wali_kabupaten_kota: Optional[str] = None
    wali_kecamatan: Optional[str] = None
    wali_kelurahan_desa: Optional[str] = None
    wali_rt: Optional[str] = None
    wali_rw: Optional[str] = None
    wali_alamat: Optional[str] = None
    wali_kode_pos: Optional[str] = None

    # ALAMAT TEMPAT TINGGAL SISWA
    status_tempat_tinggal: Optional[str] = None  # 'Tinggal dengan Ayah Kandung' | 'Tinggal dengan Ibu Kandung' | dll
    siswa_status_kepemilikan_rumah: Optional[str] = None
    siswa_provinsi: Optional[str] = None
    siswa_kabupaten_kota: Optional[str] = None
    siswa_kecamatan: Optional[str] = None
    siswa_kelurahan_desa: Optional[str] = None
    siswa_rt: Optional[str] = None
    siswa_rw: Optional[str] = None
    siswa_alamat: Optional[str] = None
    siswa_kode_pos: Optional[str] = None
    jarak_tempuh: Optional[str] = None
    transportasi: Optional[str] = None
    waktu_tempuh: Optional[str] = None

    # ==================== ARSIP DOKUMEN ====================
    dokumen_pas_foto: Optional[str] = None  # URL file
    dokumen_akte_kelahiran: Optional[str] = None
    dokumen_ijazah_sd: Optional[str] = None
    dokumen_kartu_keluarga: Optional[str] = None
    dokumen_kip: Optional[str] = None  # Aktif jika nomor_kip terisi
    dokumen_pkh: Optional[str] = None  # Aktif jika nomor_pkh terisi
    dokumen_kks: Optional[str] = None  # Aktif jika nomor_kks terisi
    dokumen_ijazah_mts: Optional[str] = None

    # ==================== REKAM DIDIK (RIWAYAT KELAS) ====================
    # Riwayat kelas siswa per semester dari kelas 7-9
    # Format: {'7_ganjil': 'class_id', '7_genap': 'class_id', '8_ganjil': 'class_id', ...}
    # Untuk siswa mutasi: semester sebelum masuk akan kosong, semester setelah keluar akan kosong
    rekam_didik: Dict[str, Any] = Field(default_factory=dict)
    # Contoh:
    # {
    #   '7_ganjil': {'class_id': 'xxx', 'class_name': '7A', 'tahun_pelajaran_id': 'yyy', 'tahun_pelajaran': '2023/2024'},
    #   '7_genap': {'class_id': 'xxx', 'class_name': '7A', 'tahun_pelajaran_id': 'yyy', 'tahun_pelajaran': '2023/2024'},
    #   '8_ganjil': {'class_id': 'zzz', 'class_name': '8A', 'tahun_pelajaran_id': 'aaa', 'tahun_pelajaran': '2024/2025'},
    #   '8_genap': None,  # Mutasi keluar di semester 8 ganjil
    #   '9_ganjil': None,
    #   '9_genap': None
    # }


class JabatanModel(BaseModel):
    """Model for managing staff positions/jabatan (e.g., Kepala Sekolah, Wakil Kepala, etc.)"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Kepala Sekolah", "Wakil Kepala Kurikulum", "Koordinator Mata Pelajaran"
    description: Optional[str] = None  # Detailed description of the position
    category: Optional[str] = None  # e.g., "struktural", "fungsional", "koordinator"
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


class TahunTakwimModel(BaseModel):
    """
    Tahun Takwim (Calendar Year) - Mengatur kalender umum aplikasi (Januari - Desember).
    Digunakan untuk laporan keuangan, anggaran tahunan, dan timestamp riwayat data.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    year: int  # e.g., 2026
    name: str  # e.g., "Tahun 2026"
    start_date: str  # YYYY-MM-DD, default: "2026-01-01"
    end_date: str  # YYYY-MM-DD, default: "2026-12-31"
    is_active: bool = False  # hanya 1 tahun takwim yang aktif
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


class AcademicYearModel(BaseModel):
    """
    Tahun Pelajaran - Mengatur siklus kenaikan kelas.
    Bisa melintasi 2 Tahun Takwim (contoh: 2025/2026 melintasi tahun 2025 dan 2026).
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "2025/2026"
    tahun_takwim_ids: List[str] = Field(default_factory=list)  # List of Tahun Takwim IDs yang dilintasi
    start_date: str  # YYYY-MM-DD, e.g., "2025-07-01" (awal TP)
    end_date: str  # YYYY-MM-DD, e.g., "2026-06-30" (akhir TP)
    is_active: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None


class SemesterModel(BaseModel):
    """Semester - Terpisah dari Academic Year untuk fleksibilitas."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Ganjil", "Genap", "Semester 1", "Semester 2"
    code: str  # e.g., "ganjil", "genap", "1", "2", "3", "4", "5", "6" - primary code for display
    codes: List[str] = Field(default_factory=list)  # Multiple codes for accelerated (e.g., ["1", "3", "5"])
    academic_year_id: str  # TP yang dimiliki semester ini
    tahun_takwim_id: Optional[str] = None  # Tahun Takwim yang dimiliki semester ini
    semester_type: Literal['regular', 'accelerated'] = 'regular'  # regular: ganjil/genap, accelerated: 1-6
    curriculum_id: Optional[str] = None  # kurikulum yang dipakai di semester ini
    start_date: Optional[str] = None  # YYYY-MM-DD
    end_date: Optional[str] = None  # YYYY-MM-DD
    is_active: bool = False  # hanya 1 semester yang aktif di sistem
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CurriculumModel(BaseModel):
    """Kurikulum (mis. K-13, Kurikulum Merdeka, Kurikulum Madrasah)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "Kurikulum Merdeka", "K-13", "Kurikulum Madrasah 2020"
    code: str  # e.g., "KM", "K13", "KMA183"
    description: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ClassModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    grade: int
    parallel: str
    academic_year_id: str  # TP reference (kept for reference)
    semester_id: Optional[str] = None  # Semester aktif untuk kelas ini
    homeroom_teacher_id: Optional[str] = None
    room_id: Optional[str] = None
    capacity: int = 40  # Kapasitas maksimal siswa per kelas
    is_accelerated: bool = False  # kelas percepatan flag
    # Phase E2 additions
    curriculum_id: Optional[str] = None  # kurikulum yang dipakai di kelas ini (deprecated - use from semester)
    semester: Optional[str] = None  # DEPRECATED: use semester_id instead
    token: Optional[str] = None  # token kelas unik (format: <name>-<year>-<rand4>)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WeeklyHolidayModel(BaseModel):
    """Hari libur mingguan (Sab/Min/dll yang rutin libur per minggu)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    day: str  # 'senin' | 'selasa' | ... | 'minggu'
    description: str = ''  # Keterangan (mis. "libur", "libur khusus tahfidz")
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AcademicHolidayModel(BaseModel):
    """Hari libur akademik tahunan (libur nasional/keagamaan/semester/kegiatan)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    date: str  # YYYY-MM-DD
    end_date: Optional[str] = None  # untuk libur multi-hari (mis. libur semester)
    name: str  # mis. "Idul Fitri 1447H", "Hari Pancasila"
    category: str = 'libur_nasional'  # 'libur_nasional' | 'libur_keagamaan' | 'libur_semester' | 'kegiatan_akademik'
    description: Optional[str] = None
    academic_year_id: Optional[str] = None  # opsional, untuk filter per TP
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RoomModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    gps_radius_meters: float = 20.0
    gps_enabled: bool = True
    qr_mode: Literal['static', 'dynamic'] = 'static'
    qr_secret: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SubjectModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    name: str
    curriculum_ids: List[str] = Field(default_factory=list)  # kurikulum yang memakai mapel ini
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ScheduleModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    semester_id: str  # NEW: references semesters.id (contains academic_year_id + curriculum)
    class_id: str
    subject_id: str
    teacher_id: str
    room_id: str
    day: str
    start_time: str
    end_time: str
    slot_index: Optional[int] = None  # references teaching_slots index
    is_published: bool = True
    # === DEPRECATED fields (keep for backward compatibility) ===
    academic_year_id: Optional[str] = None  # DEPRECATED: use semester_id instead
    semester: Optional[str] = None  # DEPRECATED: use semester_id instead
    # === Workflow status ===
    # Flow: draft → submitted → approved → locked
    status: str = 'draft'  # 'draft' | 'submitted' | 'approved' | 'locked'
    created_by: Optional[str] = None  # user_id pembuat (admin atau guru/wali)
    submitted_at: Optional[datetime] = None
    submitted_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    locked_at: Optional[datetime] = None
    locked_by: Optional[str] = None
    locked_by_role: Optional[str] = None  # 'admin' | 'wali_kelas' — siapa role yang lock
    created_at: datetime = Field(default_factory=datetime.utcnow)


class JournalModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    schedule_id: str
    teacher_id: str  # Guru pengajar terjadwal (subject teacher)
    class_id: str
    subject_id: str
    room_id: str
    semester_id: str  # NEW: references semesters.id (contains academic_year_id + curriculum)
    materi: str
    catatan: Optional[str] = None
    siswa_hadir: int = 0
    siswa_tidak_hadir: int = 0
    siswa_izin: int = 0
    siswa_sakit: int = 0
    started_at: datetime = Field(default_factory=datetime.utcnow)
    scheduled_start: Optional[str] = None
    scheduled_end: Optional[str] = None
    validations: Dict[str, Any] = Field(default_factory=dict)
    qr_mode: str = 'static'
    is_locked: bool = False
    # === DEPRECATED fields (keep for backward compatibility) ===
    academic_year_id: Optional[str] = None  # DEPRECATED: use semester_id instead
    semester: Optional[str] = None  # DEPRECATED: use semester_id instead
    # === Audit pengisian jurnal ===
    fill_mode: str = 'self'  # 'self' (guru pengajar isi sendiri) | 'piket' (guru piket titipan) | 'admin' (admin override)
    filled_by_user_id: Optional[str] = None  # Jika beda dari teacher_id (mis. piket)
    filled_by_role: Optional[str] = None  # 'guru' | 'guru_piket' | 'admin'
    task_id: Optional[str] = None  # Link ke TeacherTaskModel jika berbasis titipan
    piket_note: Optional[str] = None  # Catatan piket (alasan titipan, dll)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TeacherTaskModel(BaseModel):
    """Tugas titipan dari guru pengajar untuk guru piket.
    Guru pengajar bisa create task ini sebelum hari H jika berhalangan."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    schedule_id: str  # Jadwal yang akan dititipkan
    teacher_id: str  # Guru pengajar (yang menitipkan)
    date: str  # YYYY-MM-DD tanggal pelaksanaan
    task_content: str  # Detail tugas/materi titipan
    notes: Optional[str] = None  # Catatan tambahan untuk piket
    leave_type: Optional[str] = None  # Jenis izin: 'sakit', 'cuti', 'dinas_luar', 'lainnya'
    status: str = 'pending'  # 'pending' | 'accepted' | 'completed' | 'cancelled'
    accepted_by_user_id: Optional[str] = None  # Guru piket yang menerima tugas
    accepted_at: Optional[datetime] = None  # Waktu diterima oleh guru piket
    completed_journal_id: Optional[str] = None  # Link ke journal jika sudah diisi
    completed_by_user_id: Optional[str] = None  # Guru piket yang mengisi
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class StudentDetailModel(BaseModel):
    """Detail lengkap data siswa (sub-collection of users) — Iterasi 1: kerangka minimal."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str  # FK ke users.id (siswa)
    # === DATA SISWA ===
    citizenship: Optional[str] = None  # 'WNI' | 'WNA'
    nik: Optional[str] = None  # 16 digit for WNI
    asal_negara: Optional[str] = None  # for WNA
    nomor_izin_tinggal: Optional[str] = None  # KITAS for WNA
    jumlah_saudara: Optional[int] = None
    anak_ke: Optional[int] = None
    agama: Optional[str] = None  # Islam, Kristen Protestan, Katolik, Hindu, Buddha, Kong hu cu
    cita_cita: Optional[str] = None
    no_hp_unavailable: bool = False
    hobi: Optional[str] = None
    pembiaya_sekolah: Optional[str] = None  # Orang Tua, Wali, Tanggungan Sendiri, Lainnya
    pra_sekolah: List[str] = Field(default_factory=list)  # ['TK_RA', 'PAUD']
    imunisasi: List[str] = Field(default_factory=list)  # ['Hepatitis B','BCG','DPT','Polio','Campak','Covid']
    nomor_kip: Optional[str] = None
    nomor_kk: Optional[str] = None
    nama_kepala_keluarga: Optional[str] = None
    # === DATA ORANG TUA — embed sebagai dict untuk fleksibilitas ===
    ayah: Optional[Dict[str, Any]] = None  # {nama, status, citizenship, nik/asal_negara/kitas, tempat_lahir, tgl_lahir, pendidikan, pekerjaan, penghasilan, no_hp_unavailable, no_hp}
    ibu: Optional[Dict[str, Any]] = None
    wali: Optional[Dict[str, Any]] = None  # plus {hubungan_wali, nomor_kks, nomor_pkh}
    # === DATA ALAMAT ===
    alamat_ayah: Optional[Dict[str, Any]] = None  # {tinggal_luar_negeri, status_kepemilikan, alamat, provinsi, kabupaten, kecamatan, kelurahan, rt, rw, kode_pos}
    alamat_ibu: Optional[Dict[str, Any]] = None
    alamat_wali: Optional[Dict[str, Any]] = None
    alamat_siswa: Optional[Dict[str, Any]] = None  # plus {status_tempat_tinggal, jarak_tempuh, transportasi, waktu_tempuh}
    # === Update tracking ===
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class AttendanceRecord(BaseModel):
    """Per-student attendance record"""
    student_id: str
    status: Literal['hadir', 'sakit', 'izin', 'alpa'] = 'hadir'
    note: Optional[str] = None


class ClassAttendanceModel(BaseModel):
    """Daily attendance for a class (recorded by wali kelas or admin)"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    class_id: str
    semester_id: str  # NEW: references semesters.id (contains academic_year_id)
    date: str  # YYYY-MM-DD
    records: List[Dict[str, Any]] = Field(default_factory=list)
    recorded_by: str  # user_id
    recorded_at: datetime = Field(default_factory=datetime.utcnow)
    summary: Dict[str, int] = Field(default_factory=dict)  # {'hadir': 28, 'sakit': 1, ...}
    # === DEPRECATED fields (keep for backward compatibility) ===
    academic_year_id: Optional[str] = None  # DEPRECATED: use semester_id instead
    semester: Optional[str] = None  # DEPRECATED: use semester_id instead


class ClassCleanlinessModel(BaseModel):
    """Daily class cleanliness record"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    class_id: str
    academic_year_id: str  # Link to academic year
    semester: str  # 'Ganjil', 'Genap', or '1'-'6'
    date: str  # YYYY-MM-DD
    rating: int = 3  # 1-5 stars
    condition: Literal['bersih', 'cukup', 'kotor'] = 'bersih'
    notes: Optional[str] = None
    piket_students: List[str] = Field(default_factory=list)  # student_ids
    photo_url: Optional[str] = None  # base64
    recorded_by: str
    recorded_at: datetime = Field(default_factory=datetime.utcnow)


class AuditLogModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    username: Optional[str] = None
    action: str
    entity: str
    entity_id: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SecurityLogModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str
    username: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class LeadershipPosition(BaseModel):
    """Model untuk data pimpinan madrasah"""
    name: str
    nip: Optional[str] = None
    position: str  # 'kepala_madrasah', 'kepala_tu', 'wakil_kesiswaan', etc.


class SettingsModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "global_config"
    app_name: str = "Super Apps MATSANDATAMA"
    school_name: str = "MTsN 2 Kota Malang"
    npsn: Optional[str] = None
    accreditation: Optional[str] = None
    headmaster_name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    report_logo_url: Optional[str] = None
    # NEW: Kop surat dan daftar pimpinan
    letterhead_url: Optional[str] = None  # URL untuk kop surat
    leadership: List[Dict[str, str]] = Field(default_factory=list)  # Daftar pimpinan
    primary_color: str = "#006837"
    gps_default_enabled: bool = True
    gps_default_radius: float = 20.0
    qr_default_mode: Literal['static', 'dynamic'] = 'static'
    grace_minutes: int = 15
    # NEW: Work-day & schedule template config
    active_days: List[str] = Field(default_factory=lambda: list(DEFAULT_ACTIVE_DAYS))
    teaching_slots: List[Dict[str, Any]] = Field(default_factory=lambda: list(DEFAULT_TEACHING_SLOTS))
    # NEW: Session management
    session_max_hours: int = 12  # max session length (work-day)
    idle_timeout_minutes: int = 30  # auto-logout after inactivity
    # SMTP configuration (Phase 4)
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    smtp_from_email: Optional[str] = None
    smtp_from_name: Optional[str] = None
    # App URL for reset password email link
    app_public_url: Optional[str] = None
    # Maintenance mode (admin can toggle to lock app for non-admin users)
    maintenance_mode: bool = False
    maintenance_message: Optional[str] = None  # custom message shown to users
    maintenance_ends_at: Optional[str] = None  # estimated end time (ISO)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None


class AnnouncementModel(BaseModel):
    """Pengumuman / Announcement (Admin push messages to selected roles)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    body: str  # supports plain text or basic markdown
    target_roles: List[str] = Field(default_factory=lambda: ['all'])  # 'all' or specific roles
    severity: Literal['info', 'success', 'warning', 'critical'] = 'info'
    is_active: bool = True
    is_pinned: bool = False
    starts_at: Optional[str] = None  # ISO datetime
    ends_at: Optional[str] = None  # ISO datetime (auto-hide after)
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[str] = None


class QRTemplateModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    image_b64: str
    is_default: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================
# REQUEST/RESPONSE MODELS
# ============================================================
class LoginRequest(BaseModel):
    username: str
    password: str
    captcha_id: str
    captcha_answer: int


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]
    active_role: str
    expires_in_minutes: int = 720  # 12 hours
    idle_timeout_minutes: int = 30


class CaptchaResponse(BaseModel):
    challenge_id: str
    question: str
    expires_in: int


class RoleSwitchRequest(BaseModel):
    new_role: str


class UserCreateRequest(BaseModel):
    username: str
    password: str
    full_name: str
    nip_nuptk: Optional[str] = None
    nisn: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    roles: List[str]
    homeroom_class_id: Optional[str] = None
    student_class_id: Optional[str] = None
    parent_of: List[str] = Field(default_factory=list)
    gender: Optional[str] = None
    birth_place: Optional[str] = None
    birth_date: Optional[str] = None
    address: Optional[str] = None


class UserUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    nip_nuptk: Optional[str] = None
    nisn: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    roles: Optional[List[str]] = None
    homeroom_class_id: Optional[str] = None
    student_class_id: Optional[str] = None
    parent_of: Optional[List[str]] = None
    is_active: Optional[bool] = None
    new_password: Optional[str] = None
    gender: Optional[str] = None
    birth_place: Optional[str] = None
    birth_date: Optional[str] = None
    address: Optional[str] = None


class JournalCreateRequest(BaseModel):
    qr_token: str
    user_lat: Optional[float] = None
    user_lon: Optional[float] = None
    materi: str
    catatan: Optional[str] = None
    siswa_hadir: int = 0
    siswa_tidak_hadir: int = 0
    siswa_izin: int = 0
    siswa_sakit: int = 0


class QRValidateRequest(BaseModel):
    qr_token: str
    user_lat: Optional[float] = None
    user_lon: Optional[float] = None


class ClassAttendanceSubmit(BaseModel):
    class_id: str
    date: str
    records: List[Dict[str, Any]]


class ClassCleanlinessSubmit(BaseModel):
    class_id: str
    date: str
    rating: int = 3
    condition: str = 'bersih'
    notes: Optional[str] = None
    piket_students: List[str] = Field(default_factory=list)
    photo_url: Optional[str] = None


# ============================================================
# REPORTS (Laporan)
# ============================================================
class ReportModel(BaseModel):
    """Report for infrastructure damage or student issues"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal['sarana_prasarana', 'siswa', 'catatan'] = 'catatan'  # Type of report
    title: str  # Report title/summary
    description: str  # Detailed description
    class_id: Optional[str] = None  # Related class (optional)
    student_id: Optional[str] = None  # Related student (for siswa type)
    location: Optional[str] = None  # Location for infrastructure issues
    priority: Literal['rendah', 'sedang', 'tinggi', 'mendesak'] = 'sedang'
    status: Literal['baru', 'ditinjau', 'dalam_proses', 'selesai', 'ditolak'] = 'baru'
    reported_by: str  # user_id of reporter
    reported_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_by: Optional[str] = None  # admin who reviewed
    reviewed_at: Optional[datetime] = None
    response: Optional[str] = None  # Admin response/notes
    resolved_at: Optional[datetime] = None
    photo_url: Optional[str] = None  # base64 encoded photo


class ReportSubmit(BaseModel):
    type: str = 'catatan'
    title: str
    description: str
    class_id: Optional[str] = None
    student_id: Optional[str] = None
    location: Optional[str] = None
    priority: str = 'sedang'
    photo_url: Optional[str] = None


class ReportUpdate(BaseModel):
    status: Optional[str] = None
    response: Optional[str] = None


class MutationMasukSubmit(BaseModel):
    """Form untuk mutasi masuk (siswa atau staff)."""
    model_config = ConfigDict(extra="ignore")
    # Common fields
    full_name: str
    mutation_date: str  # YYYY-MM-DD
    mutation_note: Optional[str] = None
    mutation_document_url: Optional[str] = None

    # Siswa-specific fields
    nisn: Optional[str] = None
    nis: Optional[str] = None
    gender: Optional[str] = None  # 'L' / 'P'
    birth_place: Optional[str] = None
    birth_date: Optional[str] = None  # YYYY-MM-DD
    address: Optional[str] = None
    class_id: Optional[str] = None

    # Staff-specific fields
    nip_nuptk: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    roles: Optional[List[str]] = None


class MutationKeluarSubmit(BaseModel):
    """Form untuk mutasi keluar."""
    model_config = ConfigDict(extra="ignore")
    user_id: str
    mutation_date: str  # YYYY-MM-DD
    mutation_note: str  # Alasan mutasi (wajib)

    # For staff only
    mutation_keluar_type: Optional[str] = None  # 'pindah' | 'keluar' | 'pensiun' | 'berhenti'
    mutation_destination: Optional[str] = None  # Instansi tujuan (wajib jika pindah)
    mutation_document_url: Optional[str] = None


class ClassHistoryModel(BaseModel):
    """Riwayat kelas siswa - track semua perubahan kelas siswa per TP & semester."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str  # ID siswa
    class_id: str  # ID kelas
    academic_year_id: str  # Tahun pelajaran
    semester: str  # 'Ganjil' | 'Genap' | '1' | '2' | '3' | '4' | '5' | '6'
    reason: Literal[
        'pembagian_kelas',  # Pembagian kelas awal TP
        'pindah_kelas',  # Pindah kelas dalam satu TP/semester
        'naik_kelas',  # Naik kelas ke TP berikutnya
        'pindah_semester',  # Pindah semester (khusus kelas accelerated)
        'mutasi_masuk',  # Siswa mutasi masuk dari sekolah lain
        'mutasi_keluar',  # Siswa mutasi keluar ke sekolah lain
        'lulus'  # Siswa lulus dari sekolah
    ]
    start_date: str  # YYYY-MM-DD - tanggal mulai di kelas ini
    end_date: Optional[str] = None  # YYYY-MM-DD - tanggal keluar dari kelas (None jika masih aktif)
    notes: Optional[str] = None  # Catatan tambahan
    created_by_user_id: str  # User yang membuat record ini
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PromotionBatchModel(BaseModel):
    """Batch process for class promotion (naik kelas/semester/lulus)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal['naik_kelas', 'pindah_semester', 'lulus']
    from_academic_year_id: str
    from_semester: str
    to_academic_year_id: Optional[str] = None  # None jika lulus
    to_semester: Optional[str] = None  # None jika lulus
    from_class_id: Optional[str] = None  # Filter kelas asal (None = semua)
    to_class_id: Optional[str] = None  # Target kelas (untuk naik_kelas/pindah_semester)
    student_ids: List[str] = Field(default_factory=list)  # Siswa yang diproses
    processed_count: int = 0
    failed_count: int = 0
    errors: List[str] = Field(default_factory=list)
    graduation_date: Optional[str] = None  # Untuk type=lulus
    certificate_number_prefix: Optional[str] = None  # Prefix nomor ijazah
    status: Literal['pending', 'processing', 'completed', 'failed'] = 'pending'
    created_by_user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None


class PromotionRequest(BaseModel):
    """Request model for promotion/graduation operations."""
    type: Literal['naik_kelas', 'pindah_semester', 'lulus']
    from_class_id: Optional[str] = None
    to_class_id: Optional[str] = None
    to_academic_year_id: Optional[str] = None
    to_semester: Optional[str] = None
    student_ids: List[str]
    graduation_date: Optional[str] = None
    certificate_number_prefix: Optional[str] = None
    notes: Optional[str] = None


# ============================================================
# GRADES & RAPOR (Nilai Siswa - Melekat Lintas TP)
# ============================================================
class GradeModel(BaseModel):
    """Nilai siswa per mata pelajaran per semester - melekat pada siswa lintas TP."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str  # ID siswa
    class_id: str  # Kelas saat nilai diinput
    subject_id: str  # Mata pelajaran
    semester_id: str  # NEW: references semesters.id (contains academic_year_id)
    # Komponen nilai K-13 / Kurikulum Merdeka
    nilai_pengetahuan: Optional[float] = None  # Nilai Pengetahuan (KI-3)
    nilai_keterampilan: Optional[float] = None  # Nilai Keterampilan (KI-4)
    nilai_sikap: Optional[str] = None  # Predikat Sikap Spiritual & Sosial
    nilai_akhir: Optional[float] = None  # Rata-rata atau nilai akhir
    predikat: Optional[str] = None  # A, B, C, D
    deskripsi: Optional[str] = None  # Deskripsi capaian kompetensi
    # Untuk kelas 9: nilai ujian
    nilai_ujian_tulis: Optional[float] = None
    nilai_ujian_praktek: Optional[float] = None
    # Tracking
    recorded_by: str  # Guru yang input
    recorded_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    # === DEPRECATED fields (keep for backward compatibility) ===
    academic_year_id: Optional[str] = None  # DEPRECATED: use semester_id instead
    semester: Optional[str] = None  # DEPRECATED: use semester_id instead


class RaporSummaryModel(BaseModel):
    """Rangkuman rapor siswa lintas TP (kelas 7-9)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    academic_year_id: str
    semester: str
    class_id: str
    total_subjects: int = 0
    average_score: float = 0.0
    rank_in_class: Optional[int] = None
    attendance_summary: Dict[str, int] = Field(default_factory=dict)  # {'hadir': 180, 'sakit': 2, ...}
    notes: Optional[str] = None  # Catatan wali kelas
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================
# ACHIEVEMENTS (Prestasi - Melekat Lintas TP)
# ============================================================
class AchievementModel(BaseModel):
    """Prestasi siswa - melekat pada siswa lintas TP & semester (Sesuai EMIS)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str  # ID siswa

    # Sesuai EMIS
    tahun: int  # Tahun Lomba
    nama_lomba: str  # Nama Lomba
    bidang_lomba: str  # 'Akademik' | 'Keagamaan' | 'Teknologi' | 'Olahraga' | dll
    nama_penyelenggara: str  # Nama Penyelenggara
    tingkat_lomba: str  # 'Kabupaten/Kota' | 'Provinsi' | 'Nasional' | 'Internasional' | 'Lainnya'
    peringkat: str  # 'Tidak Meraih Juara' | 'Juara 1/Medali Emas' | dll
    kategori_lomba: str  # 'Individu' | 'Kelompok'

    # Additional fields for existing system compatibility
    academic_year_id: Optional[str] = None  # TP saat prestasi diraih (optional)
    semester: Optional[str] = None  # Semester saat prestasi diraih (optional)
    certificate_url: Optional[str] = None  # Upload sertifikat
    photo_url: Optional[str] = None  # Foto dokumentasi

    # Tracking
    recorded_by: str  # User yang input
    recorded_at: datetime = Field(default_factory=datetime.utcnow)
    verified: bool = False  # Verifikasi oleh admin
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None


# ============================================================
# BEASISWA & BANTUAN (Sesuai EMIS)
# ============================================================
class BeasiswaModel(BaseModel):
    """Beasiswa dan bantuan yang diterima siswa."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str  # ID siswa
    tahun: int  # Tahun menerima beasiswa
    kategori: str  # 'Beasiswa Lainnya' | 'Beasiswa Berprestasi' | 'Beasiswa Kurang Mampu/Miskin' | 'Beasiswa Miskin dan Berprestasi'
    nama_beasiswa: str  # Nama Beasiswa/Bantuan
    jenis_instansi_pemberi: str  # 'Kementerian Agama' | 'Kementerian Lain' | 'Pemerintah Daerah' | dll
    nama_instansi_pemberi: str  # Nama Instansi Pemberi
    jangka_waktu_bulan: Optional[int] = None  # Jangka Waktu (Bulan)
    nominal: Optional[float] = None  # Nominal Beasiswa (Rupiah)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str  # User yang input


# ============================================================
# PENDIDIKAN LAIN (Sesuai EMIS)
# ============================================================
class PendidikanLainModel(BaseModel):
    """Pendidikan lain di luar sekolah formal (TPQ, Kursus, dll)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str  # ID siswa
    nama_lembaga: str  # Nama Lembaga
    jenis_lembaga: str  # Jenis Lembaga (TPQ, Kursus Bahasa, dll)
    mulai_belajar: str  # YYYY-MM-DD
    frekuensi_belajar: str  # 'Setiap Hari' | 'Seminggu 2-3' | 'Seminggu Sekali' | 'Tidak Rutin'
    lokasi_lembaga: str  # Alamat Lembaga
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: str  # User yang input


# ============================================================
# BUKU INDUK SISWA (Master Student Record)
# ============================================================
class StudentMasterRecordModel(BaseModel):
    """Buku Induk Siswa - data lengkap siswa untuk keperluan administrasi."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str  # FK ke users.id

    # Data Pribadi
    full_name: str
    nis: Optional[str] = None
    nisn: Optional[str] = None
    nik: Optional[str] = None  # NIK KTP
    gender: Optional[str] = None  # 'L' / 'P'
    birth_place: Optional[str] = None
    birth_date: Optional[str] = None  # YYYY-MM-DD
    religion: Optional[str] = None
    citizenship: Optional[str] = None  # 'WNI' / 'WNA'
    special_needs: Optional[str] = None  # Berkebutuhan khusus
    address: Optional[str] = None
    rt: Optional[str] = None
    rw: Optional[str] = None
    kelurahan: Optional[str] = None
    kecamatan: Optional[str] = None
    kabupaten: Optional[str] = None
    provinsi: Optional[str] = None
    postal_code: Optional[str] = None
    residence_type: Optional[str] = None  # Tinggal dengan orang tua/wali/kos
    transportation: Optional[str] = None  # Alat transportasi
    distance_km: Optional[float] = None  # Jarak rumah ke sekolah
    phone: Optional[str] = None
    mobile_phone: Optional[str] = None
    email: Optional[str] = None

    # Data Keluarga - Ayah
    father_name: Optional[str] = None
    father_nik: Optional[str] = None
    father_birth_year: Optional[int] = None
    father_education: Optional[str] = None
    father_occupation: Optional[str] = None
    father_income: Optional[str] = None  # Range pendapatan
    father_phone: Optional[str] = None

    # Data Keluarga - Ibu
    mother_name: Optional[str] = None
    mother_nik: Optional[str] = None
    mother_birth_year: Optional[int] = None
    mother_education: Optional[str] = None
    mother_occupation: Optional[str] = None
    mother_income: Optional[str] = None
    mother_phone: Optional[str] = None

    # Data Keluarga - Wali (jika ada)
    guardian_name: Optional[str] = None
    guardian_nik: Optional[str] = None
    guardian_birth_year: Optional[int] = None
    guardian_education: Optional[str] = None
    guardian_occupation: Optional[str] = None
    guardian_income: Optional[str] = None
    guardian_phone: Optional[str] = None
    guardian_relationship: Optional[str] = None  # Hubungan dengan siswa

    # Data Pendidikan Sebelumnya
    previous_school: Optional[str] = None
    previous_school_address: Optional[str] = None
    previous_school_certificate_number: Optional[str] = None
    previous_school_ijazah_number: Optional[str] = None

    # Data Penerimaan Siswa Baru
    admission_date: Optional[str] = None  # YYYY-MM-DD
    admission_class: Optional[str] = None  # Kelas diterima pertama kali
    admission_academic_year: Optional[str] = None  # TP diterima
    admission_number: Optional[str] = None  # Nomor peserta PSB

    # Data Kesehatan
    blood_type: Optional[str] = None
    height_cm: Optional[float] = None
    weight_kg: Optional[float] = None
    health_history: Optional[str] = None  # Riwayat penyakit

    # Data Bantuan/Beasiswa
    kps_pkh_number: Optional[str] = None  # Nomor KPS/PKH
    kip_number: Optional[str] = None  # Nomor KIP
    kks_number: Optional[str] = None  # Nomor KKS
    scholarship_info: Optional[str] = None  # Info beasiswa lain

    # Data Keluar/Lulus
    exit_date: Optional[str] = None  # Tanggal keluar
    exit_reason: Optional[str] = None  # Alasan keluar (lulus, mutasi, dll)
    exit_certificate_number: Optional[str] = None  # Nomor SKHUN/Ijazah

    # Tracking
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None


class VervalRequestModel(BaseModel):
    """
    Model untuk request verifikasi dan validasi data user.
    Digunakan saat siswa/guru/tendik mengajukan perubahan data yang perlu di-approve admin.
    """
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str  # ID user yang mengajukan
    user_type: str  # 'siswa' | 'guru' | 'tenaga_kependidikan'
    request_type: str = 'update'  # 'update' | 'create' (untuk future expansion)

    # Data lama (sebelum perubahan) - snapshot dari user doc saat ini
    old_data: Dict[str, Any] = Field(default_factory=dict)

    # Data baru yang diajukan (perubahan yang diminta)
    new_data: Dict[str, Any] = Field(default_factory=dict)

    # Status: 'pending' | 'approved' | 'rejected'
    status: str = 'pending'

    # Admin notes/catatan saat approve/reject
    admin_notes: Optional[str] = None

    # Tracking
    created_at: datetime = Field(default_factory=datetime.utcnow)
    submitted_by: str  # user_id yang submit (biasanya sama dengan user_id)
    submitted_by_name: Optional[str] = None  # nama lengkap untuk display

    # Approval tracking
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None  # admin user_id
    reviewed_by_name: Optional[str] = None  # admin nama lengkap
