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
    # Mutation tracking (for stats: mutasi masuk/keluar di TP aktif)
    mutation_type: Optional[str] = None  # 'masuk' | 'keluar' | None
    mutation_ay_id: Optional[str] = None  # TP saat mutasi
    mutation_date: Optional[str] = None  # tanggal mutasi (YYYY-MM-DD)
    mutation_note: Optional[str] = None  # alasan/keterangan
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
    is_accelerated: bool = False  # kelas percepatan flag
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
    created_at: datetime = Field(default_factory=datetime.utcnow)


class JournalModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    schedule_id: str
    teacher_id: str
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
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None


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
