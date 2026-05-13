"""
Pydantic models for Phase 4 - Achievement, Extracurricular, E-Rapor.
"""
from datetime import datetime
from typing import List, Optional, Dict, Any, Literal
import uuid
from pydantic import BaseModel, Field, ConfigDict


class StudentAchievementModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    name: str  # nama lomba/prestasi
    category: Optional[str] = None  # akademik / non-akademik / lainnya
    level: Optional[str] = None  # kota / kabupaten / provinsi / nasional / internasional
    rank: Optional[str] = None  # juara 1 / 2 / 3 / harapan / dll
    organizer: Optional[str] = None  # penyelenggara
    date: Optional[str] = None  # tanggal prestasi (YYYY-MM-DD)
    description: Optional[str] = None
    certificate_url: Optional[str] = None  # base64 image of certificate
    is_verified: bool = False
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    submitted_by: Optional[str] = None  # user_id
    submitted_at: datetime = Field(default_factory=datetime.utcnow)


class ExtracurricularModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str  # 'Pramuka', 'PMR', 'Tahfidz', etc.
    description: Optional[str] = None
    coach_id: Optional[str] = None  # guru_ekstrakurikuler user_id
    schedule_day: Optional[str] = None  # day name
    schedule_start: Optional[str] = None
    schedule_end: Optional[str] = None
    location: Optional[str] = None
    academic_year_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ExtracurricularMemberModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    extracurricular_id: str
    student_id: str
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True


class ExtracurricularAttendanceModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    extracurricular_id: str
    date: str  # YYYY-MM-DD
    records: List[Dict[str, Any]] = Field(default_factory=list)
    recorded_by: str
    recorded_at: datetime = Field(default_factory=datetime.utcnow)


class ExtracurricularGradeModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    extracurricular_id: str
    student_id: str
    academic_year_id: str
    semester: str
    predicate: Optional[str] = None  # A / B / C / Sangat Baik / Baik / Cukup
    description: Optional[str] = None
    submitted_by: Optional[str] = None
    submitted_at: datetime = Field(default_factory=datetime.utcnow)


class GradeEntryModel(BaseModel):
    """E-Rapor: nilai per siswa per mapel per semester per TP."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    class_id: str
    subject_id: str
    teacher_id: Optional[str] = None
    academic_year_id: str
    semester: str
    nilai_pengetahuan: Optional[float] = None  # 0-100
    nilai_keterampilan: Optional[float] = None
    nilai_akhir: Optional[float] = None
    predicate: Optional[str] = None  # A / B / C / D
    description: Optional[str] = None
    submitted_by: Optional[str] = None
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
