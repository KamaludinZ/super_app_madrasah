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
    'orang_tua',
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
    'orang_tua': 'Orang Tua/Wali Siswa',
}


class UserModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str
    full_name: str
    nip_nuptk: Optional[str] = None  # for teachers/staff
    nisn: Optional[str] = None  # for students
    email: Optional[str] = None  # optional, for reset
    phone: Optional[str] = None
    roles: List[str] = Field(default_factory=list)
    # Role-specific data
    homeroom_class_id: Optional[str] = None  # if wali_kelas
    student_class_id: Optional[str] = None  # if siswa
    parent_of: List[str] = Field(default_factory=list)  # student_ids if orang_tua
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login_at: Optional[datetime] = None


class AcademicYearModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "2025/2026"
    is_active: bool = False
    semesters: List[Dict[str, Any]] = Field(default_factory=list)  # [{name, is_active, start_date, end_date}]
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ClassModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "7A", "8B"
    grade: int  # 7, 8, 9
    parallel: str  # "A", "B", "C"
    academic_year_id: str
    homeroom_teacher_id: Optional[str] = None  # wali kelas
    room_id: Optional[str] = None  # default room
    created_at: datetime = Field(default_factory=datetime.utcnow)


class RoomModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # e.g., "R-101", "Lab IPA"
    description: Optional[str] = None
    gps_lat: Optional[float] = None
    gps_lon: Optional[float] = None
    gps_radius_meters: float = 20.0
    gps_enabled: bool = True  # toggle per room
    qr_mode: Literal['static', 'dynamic'] = 'static'
    qr_secret: Optional[str] = None  # for dynamic QR (TOTP)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SubjectModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str  # "MTK", "IPA"
    name: str  # "Matematika"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ScheduleModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    academic_year_id: str
    semester: str  # 'ganjil' / 'genap'
    class_id: str
    subject_id: str
    teacher_id: str
    room_id: str
    day: str  # 'senin', 'selasa', etc. (Indonesian)
    start_time: str  # "HH:MM"
    end_time: str  # "HH:MM"
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


class AuditLogModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: Optional[str] = None
    username: Optional[str] = None
    action: str  # "create", "update", "delete", "login", "logout", "role_switch"
    entity: str  # "user", "class", "journal", etc.
    entity_id: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SecurityLogModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: str  # "login_success", "login_failed", "locked", "captcha_failed"
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
    logo_url: Optional[str] = None  # base64 data url
    favicon_url: Optional[str] = None
    report_logo_url: Optional[str] = None
    primary_color: str = "#006837"
    gps_default_enabled: bool = True
    gps_default_radius: float = 20.0
    qr_default_mode: Literal['static', 'dynamic'] = 'static'
    grace_minutes: int = 15
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: Optional[str] = None


class QRTemplateModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    image_b64: str  # base64-encoded image
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
