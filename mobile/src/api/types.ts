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
  source: 'announcement' | 'system' | string;
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

export type GPTeacher = { id: string; full_name: string; username?: string; roles?: string[]; slot_count?: number };

export type GPSlot = ScheduleItem & { jam_ke?: string };

export type GPDate = { date: string; selectable: boolean; reason?: string | null; day?: string; assigned?: boolean };

export type GPCandidate = { id: string; full_name: string; available: boolean; reason?: string | null; roles?: string[] };

export type GPAssignment = {
  id: string;
  schedule_id: string;
  date: string;
  status: 'active' | 'cancelled' | string;
  original_teacher_id: string;
  original_teacher_name?: string | null;
  substitute_teacher_id: string;
  substitute_teacher_name?: string | null;
  class_name?: string | null;
  subject_name?: string | null;
  room_name?: string | null;
  start_time?: string;
  end_time?: string;
  reason?: string | null;
  assigned_by_name?: string | null;
  journal_filled?: boolean;
  original_journal_filled?: boolean;
  created_at?: string;
  [k: string]: unknown;
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

export type PiketSchedule = ScheduleItem & {
  has_journal: boolean;
  teacher_name?: string | null;
  task?: { id: string; jenis_izin?: string; note?: string } | null;
};
