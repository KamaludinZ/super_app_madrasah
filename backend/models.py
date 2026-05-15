"""
Pydantic models for Super Apps MATSANDATAMA.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any, Literal
import uuid

from pydantic import BaseModel, Field, ConfigDict


ROLES = [
    'admin',
    'guru',
    'wali_kelas',
    'siswa',
    'tenaga_kependidikan',
    'guru_piket',
    'guru_bk',
    'guru_tata_tertib',
    'guru_ekstrakurikuler',
]

ROLE_LABELS = {
    'admin': 'Administrator',
    'guru': 'Guru Mata Pelajaran',
    'wali_kelas': 'Wali Kelas',
    'siswa': 'Siswa',
    'tenaga_kependidikan': 'Tenaga Kependidikan',
    'guru_piket': 'Guru Piket',
    'guru_bk': 'Guru BK',
    'guru_tata_tertib': 'Guru Tata Tertib',
    'guru_ekstrakurikuler': 'Guru Ekstrakurikuler',
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
    gender: Optional[str] = None  # 'L' / 'P'
    birth_place: Optional[str] = None
    birth_date: Optional[str] = None
    address: Optional[str] = None
    photo_url: Optional[str] = None
    is_active: bool = True
    nis: Optional[str] = None  # Nomor Induk Siswa (lokal sekolah, beda dgn NISN)
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
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = None


class AcademicYearModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "2025/2026"
    is_active: bool = False
    # 'regular' = ganjil/genap; 'accelerated' = semester 1-6 untuk kelas percepatan
    semester_type: Literal['regular', 'accelerated'] = 'regular'
    semesters: List[Dict[str, Any]] = Field(default_factory=list)
    active_semester: Optional[str] = None  # name of active semester
    curriculum_id: Optional[str] = None  # kurikulum yang dipakai di TP ini
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
    academic_year_id: str
    homeroom_teacher_id: Optional[str] = None
    room_id: Optional[str] = None
    capacity: int = 40  # Kapasitas maksimal siswa per kelas
    is_accelerated: bool = False  # kelas percepatan flag
    # Phase E2 additions
    curriculum_id: Optional[str] = None  # kurikulum yang dipakai di kelas ini (boleh override TP)
    semester: Optional[str] = None  # semester aktif untuk kelas ini (boleh beda dari TP utama)
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
    academic_year_id: str
    semester: str  # 'ganjil', 'genap', or '1', '2', ..., '6'
    class_id: str
    subject_id: str
    teacher_id: str
    room_id: str
    day: str
    start_time: str
    end_time: str
    slot_index: Optional[int] = None  # references teaching_slots index
    is_published: bool = True
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
    academic_year_id: str
    semester: str
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
    status: str = 'pending'  # 'pending' | 'completed' | 'cancelled'
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
    date: str  # YYYY-MM-DD
    records: List[Dict[str, Any]] = Field(default_factory=list)
    recorded_by: str  # user_id
    recorded_at: datetime = Field(default_factory=datetime.utcnow)
    summary: Dict[str, int] = Field(default_factory=dict)  # {'hadir': 28, 'sakit': 1, ...}


class ClassCleanlinessModel(BaseModel):
    """Daily class cleanliness record"""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    class_id: str
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
