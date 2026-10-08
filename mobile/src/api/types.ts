/** Tipe data respons API (hanya field yang dipakai aplikasi). */
export type User = {
  id: string;
  username: string;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  roles: string[];
  active_role?: string;
  homeroom_class_id?: string | null;
  student_class_id?: string | null;
  nip_nuptk?: string | null;
  is_impersonating?: boolean;
  password_status?: { should_prompt: boolean; reason?: string | null; message?: string };
  [k: string]: unknown;
};

export type Captcha = { challenge_id: string; image: string; length: number; expires_in: number };

export type LoginResponse = {
  access_token: string;
  user: User;
  active_role: string;
  expires_in_minutes: number;
  idle_timeout_minutes: number;
};

export type PublicSettings = {
  app_name?: string;
  school_name?: string;
  logo_url?: string | null;
  idle_timeout_minutes?: number;
  session_max_hours?: number;
  maintenance_mode?: boolean;
  maintenance_message?: string | null;
};

export type SubstituteInfo = {
  assignment_id: string;
  substitute_teacher_id: string;
  substitute_teacher_name?: string | null;
  journal_filled: boolean;
};

export type ScheduleItem = {
  id: string;
  day: string;
  start_time: string;
  end_time: string;
  class_id: string;
  class_name?: string | null;
  subject_id?: string;
  subject_name?: string | null;
  subject_code?: string | null;
  room_id?: string | null;
  room_name?: string | null;
  teacher_id?: string;
  teacher_name?: string | null;
  slot_indexes?: number[];
  jam_ke?: string;
  journal_filled?: boolean;
  journal_id?: string | null;
  /** Slot di mana user menjadi guru pengganti. */
  is_substitute?: boolean;
  assignment_id?: string | null;
  original_teacher_id?: string;
  original_teacher_name?: string | null;
  date?: string;
  reason?: string | null;
  /** Slot user yang sedang digantikan guru lain. */
  substitute?: SubstituteInfo | null;
  [k: string]: unknown;
};

/** Ejaan baku backend: 'alpa' (scan QR, ekspor). */
export type AttendanceStatus = 'hadir' | 'sakit' | 'izin' | 'alpa';

export type AttendanceDetail = { student_id: string; student_name?: string | null; status: string; note?: string | null };

export type Journal = {
  id: string;
  schedule_id?: string;
  class_name?: string | null;
  subject_name?: string | null;
  room_name?: string | null;
  teacher_name?: string | null;
  materi: string;
  catatan?: string | null;
  kd_indikator?: string | null;
  materi_nama?: string | null;
  siswa_hadir: number;
  siswa_tidak_hadir: number;
  siswa_izin: number;
  siswa_sakit: number;
  started_at: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  jam_ke?: string;
  fill_mode?: string;
  filled_by_name?: string | null;
  diisi_oleh?: string;
  filled_by_me?: boolean;
  is_substitute?: boolean;
  pair_key?: string;
  pair_position?: 'first' | 'second';
  qr_mode?: string;
  attendance_details?: AttendanceDetail[];
  offline_submission?: { needs_verification?: boolean; was_offline?: boolean } | null;
  [k: string]: unknown;
};

export type QRValidation = {
  overall_valid: boolean;
  qr: { valid: boolean; reason: string; mode?: string };
  schedule: { valid: boolean; reason: string; schedule?: ScheduleItem | null; start_time?: string; end_time?: string };
  gps: { valid: boolean; reason: string; distance?: number };
  context: { room?: { id: string; name?: string } | null; schedule?: ScheduleItem | null; start_time?: string; end_time?: string };
};

export type Student = { id: string; full_name: string; nisn?: string | null; class_name?: string | null };

export type Announcement = {
  id: string;
  title: string;
  body: string;
  severity?: 'info' | 'warning' | 'success' | 'danger' | string;
  is_pinned?: boolean;
  is_read?: boolean;
  created_at?: string;
  created_by_name?: string | null;
  target_roles?: string[];
};

export type NotificationItem = {
  id: string;
  /** announcement · system · user (notifikasi pribadi per peristiwa). */
  source: 'announcement' | 'system' | 'user' | string;
  /** Jenis notifikasi pribadi, mis. class_task_new, teacher_task_new, verval_approved. */
  type?: string | null;
  /** Path web tujuan (dibuka native bila ada layarnya, selain itu modul web). */
  link?: string | null;
  data?: Record<string, unknown>;
  source_id: string;
  title: string;
  body: string;
  severity?: string;
  is_pinned?: boolean;
  is_read: boolean;
  created_at?: string;
  icon?: string;
};

export type GPConfig = { allowed_roles: string[]; can_manage: boolean };

export type GPPeriod = {
  semester_id?: string | null;
  name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  today: string;
  holidays: { date: string; end_date?: string | null; name: string }[];
};

/** GET /guru-pengganti/teachers — guru yang punya jadwal di semester aktif. */
export type GPTeacher = {
  id: string;
  name: string;
  nip_nuptk?: string | null;
  subject: string;
  subjects: string[];
  schedule_count: number;
  days: string[];
};

/** GET /guru-pengganti/teachers/{id}/slots */
export type GPSlot = {
  id: string;
  teacher_id: string;
  day: string;
  start_time: string;
  end_time: string;
  jam_ke: string;
  class_id?: string | null;
  class_name: string;
  subject_id?: string | null;
  subject_name: string;
  room_id?: string | null;
  room_name: string;
  semester_id?: string | null;
};

export type GPDate = {
  date: string;
  selectable: boolean;
  reason: string | null;
  assignment: { id: string; substitute_teacher_id: string; substitute_teacher_name?: string | null } | null;
};

/** GET /guru-pengganti/slots/{schedule_id}/dates?month=YYYY-MM */
export type GPSlotDates = {
  schedule_id: string;
  day: string;
  month: string;
  period: { name?: string | null; start_date?: string | null; end_date?: string | null };
  dates: GPDate[];
};

/** GET /guru-pengganti/substitute-candidates */
export type GPCandidate = {
  id: string;
  name: string;
  nip_nuptk?: string | null;
  subject: string;
  available: boolean;
  unavailable: string | null;
};

export type GPJournalStatus = 'filled' | 'pending' | 'missing';

/** GET /guru-pengganti/assignments */
export type GPAssignment = {
  id: string;
  schedule_id: string;
  date: string;
  day: string;
  start_time?: string | null;
  end_time?: string | null;
  jam_ke?: string;
  class_name: string;
  subject_name: string;
  room_name?: string | null;
  original_teacher_id: string;
  original_teacher_name: string;
  substitute_teacher_id: string;
  substitute_teacher_name: string;
  reason?: string | null;
  status: 'active' | 'cancelled' | string;
  journal_status?: GPJournalStatus;
  assigned_by_name?: string | null;
  assigned_by_role?: string | null;
  assigned_at?: string | null;
  cancelled_at?: string | null;
};

/** POST /guru-pengganti/assignments */
export type GPAssignResult = {
  created: { id: string; date: string }[];
  count: number;
  skipped: { date: string; reason: string }[];
};

export type GPJournalView = {
  id: string;
  materi: string;
  catatan?: string | null;
  started_at: string;
  fill_mode?: string;
  filled_by_name?: string | null;
  qr_mode?: string;
  siswa_hadir: number;
  siswa_sakit: number;
  siswa_izin: number;
  siswa_tidak_hadir: number;
};

/** GET /guru-pengganti/assignments/{id}/journals */
export type GPSideBySide = {
  assignment: GPAssignment;
  original_journal: GPJournalView | null;
  substitute_journal: GPJournalView | null;
};

export type OfflinePermit = {
  schedule_id: string;
  date: string;
  start_time: string;
  end_time: string;
  class_id: string | null;
  class_name?: string | null;
  subject_name?: string | null;
  room_id?: string | null;
  room_name?: string | null;
  is_substitute: boolean;
  assignment_id?: string | null;
  original_teacher_name?: string | null;
  valid_until: string;
  permit: string;
};

export type OfflinePermitsResponse = {
  server_time: string;
  date: string;
  holiday: string | null;
  permits: OfflinePermit[];
};

/** Tugas titipan guru pengajar untuk guru piket (GET /teacher-tasks). */
export type TeacherTask = {
  id: string;
  schedule_id: string;
  teacher_id: string;
  teacher_name?: string | null;
  date: string;
  task_content: string;
  notes?: string | null;
  leave_type?: 'sakit' | 'cuti' | 'dinas_luar' | 'lainnya' | string | null;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled' | string;
  accepted_by_name?: string | null;
  class_name?: string | null;
  subject_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  [k: string]: unknown;
};

/** GET /piket/schedules/today — jadwal hari ini (semua guru) + status jurnal & titipan. */
export type PiketSchedule = ScheduleItem & {
  has_journal: boolean;
  journal_info?: { schedule_id: string; fill_mode?: string; filled_by_user_id?: string } | null;
  teacher_name?: string | null;
  task?: TeacherTask | null;
};

/** KD/Indikator mapel (GET /indikator?mapel_id&semester_id) — opsional di jurnal. */
export type Indikator = { id: string; kode?: string | null; nama?: string | null; mapel_id?: string; semester_id?: string };

/** Materi/Pokok Bahasan mapel (GET /materi?mapel_id&semester_id) — opsional di jurnal. */
export type MateriPokok = { id: string; nama: string; deskripsi?: string | null; indikator_id?: string | null };

/** Tugas Kelas Digital (GET /kelas/tugas, /kelas/tugas/{id}). */
export type KelasTugas = {
  id: string;
  judul: string;
  deskripsi?: string | null;
  /** Isi tugas (HTML dari editor guru). */
  konten?: string | null;
  file_url?: string | null;
  /** ISO lokal WIB tanpa zona, mis. 2026-10-10T23:59. */
  deadline?: string | null;
  subject_id?: string | null;
  subject_name?: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  target_role?: string[] | string;
  submission_status?: 'submitted' | 'not_submitted';
  my_submission?: { id: string; jawaban: string; file_url?: string | null; submitted_at?: string; updated_at?: string | null } | null;
  created_at?: string;
};

/** Materi Kelas Digital (GET /kelas/materi, /kelas/materi/{id}). */
export type KelasMateri = {
  id: string;
  judul: string;
  deskripsi?: string | null;
  konten?: string | null;
  file_url?: string | null;
  subject_id?: string | null;
  subject_name?: string | null;
  teacher_id?: string | null;
  teacher_name?: string | null;
  created_at?: string;
};

export type KehadiranRecord = { id?: string; date: string; status: string; subject_name?: string | null; subject_code?: string | null; teacher_name?: string | null };
export type KehadiranRekap = { total: number; hadir: number; sakit?: number; izin?: number; alpa?: number; percentage: number };
/** GET /students/my-attendance/stats */
export type KehadiranStats = { month: number; year: number; monthly: KehadiranRekap; weekly: KehadiranRekap; daily: KehadiranRekap };

/** GET /grades/rapor/{student_id}?semester — nilai E-Rapor semester (TP aktif). */
export type RaporGrade = {
  id: string; subject_id: string; subject_name?: string | null; subject_code?: string | null; teacher_name?: string | null;
  semester: string; nilai_pengetahuan?: number | null; nilai_keterampilan?: number | null; nilai_akhir?: number | null;
  predicate?: string | null; description?: string | null;
};
export type Rapor = {
  student: { id: string; full_name?: string; nisn?: string | null; nis?: string | null };
  class?: { id: string; name?: string } | null;
  academic_year?: { id: string; name?: string } | null;
  grades: RaporGrade[];
  average: number;
};
/** GET /ekstrakurikuler/student/{student_id}?semester */
export type RaporEkskul = {
  id: string; name?: string | null; activity_description?: string | null; schedule_day?: string | null;
  schedule_start?: string | null; schedule_end?: string | null; location?: string | null;
  predicate?: string | null; description?: string | null;
};

/** GET /verval-requests — ajuan perubahan data / prestasi. */
export type VervalRequest = {
  id: string; user_id: string; user_type?: string; request_type?: string; status: 'pending' | 'approved' | 'rejected' | string;
  old_data?: Record<string, unknown> | null; new_data?: Record<string, unknown> | null;
  admin_notes?: string | null; submitted_at?: string; created_at?: string; reviewed_at?: string | null; reviewed_by_name?: string | null;
};

/** Prestasi (GET /achievements) — juga dipakai untuk pengajuan prestasi yang masih di verval (_verval*). */
export type Achievement = {
  id: string; holder_type?: 'siswa' | 'guru' | 'tendik' | 'madrasah' | string; holder_id?: string | null; student_id?: string | null;
  holder_name?: string | null; holder_full_name?: string | null; student_name?: string | null; class_name?: string | null;
  name: string; bidang_lomba?: string | null; category?: string | null; level?: string | null; rank?: string | null;
  organizer?: string | null; date?: string | null; year?: number | null; academic_year_label?: string | null;
  jenis_lomba?: string | null; jenis_penyelenggara?: string | null; mode_pelaksanaan?: string | null; tempat_pelaksanaan?: string | null;
  cara_mengikuti?: string | null; jenis_hadiah?: string[] | null; nama_pembina?: string | null; description?: string | null;
  certificate_url?: string | null; photo_url?: string | null; is_verified?: boolean; verifier_name?: string | null;
  _vervalRequestId?: string; _vervalStatus?: string; _adminNotes?: string | null;
};
export type AcademicYear = { id: string; name: string; is_active?: boolean };
export type Extracurricular = {
  id: string; name: string; description?: string | null; coach_id?: string | null; coach_name?: string | null;
  schedule_day?: string | null; schedule_start?: string | null; schedule_end?: string | null; location?: string | null; member_count?: number;
};
