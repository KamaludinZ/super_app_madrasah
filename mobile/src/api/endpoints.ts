import { File as FsFile } from 'expo-file-system';
import { request } from './client';
import type {
  AcademicYear, Achievement, Announcement, ClassHistoryItem, CLKBForm, CLKBSubmission, Extracurricular, GTKAbsensiMy, IbadahSchedule, PiketGuru, GTKIzin, Kelengkapan, StaffEvent, StaffEventInput, StaffEventStats, StudentDetailResponse, PCLForm, PCLSubmission, Captcha, GPAssignment, GPAssignResult, GPCandidate, GPConfig, GPPeriod, GPSideBySide, GPSlot,
  GPSlotDates, GPTeacher, Indikator, Journal, KehadiranRecord, KehadiranStats, KelasMateri, KelasTugas, LoginResponse, NotificationItem, OfflinePermitsResponse, PiketSchedule,
  MateriPokok, PublicSettings, QRValidation, Rapor, RaporEkskul, ScheduleItem, VervalRequest, Student, TeacherTask, User,
} from './types';

export const api = {
  health: () => request<{ status: string; time_wib: string }>('/health', { token: null, timeoutMs: 8000 }),
  settings: () => request<PublicSettings>('/settings', { token: null }),

  auth: {
    captcha: () => request<Captcha>('/auth/captcha', { token: null }),
    login: (body: { username: string; password: string; captcha_id: string; captcha_answer: string; remember: boolean }) =>
      request<LoginResponse>('/auth/login', { method: 'POST', body, token: null, silent401: true }),
    me: (token?: string) => request<User>('/auth/me', { token, silent401: true }),
    switchRole: (new_role: string) =>
      request<{ access_token: string; active_role: string; user: User }>('/auth/switch-role', { method: 'POST', body: { new_role } }),
    logout: () => request<{ message: string }>('/auth/logout', { method: 'POST', silent401: true }),
    forgotPassword: (identifier: string) =>
      request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { identifier }, token: null }),
    resetValidate: (token: string) =>
      request<{ valid: boolean; username?: string | null }>(`/auth/reset-password/validate/${encodeURIComponent(token)}`, { token: null }),
    resetPassword: (token: string, new_password: string) =>
      request<{ message: string }>('/auth/reset-password', { method: 'POST', body: { token, new_password }, token: null }),
    changePassword: (current_password: string, new_password: string) =>
      request<{ message: string; access_token?: string }>('/auth/change-password', { method: 'POST', body: { current_password, new_password } }),
  },

  schedules: {
    myToday: () => request<ScheduleItem[]>('/schedules/my-today', { query: { include_substitute: true } }),
    list: (q: { teacher_id?: string; class_id?: string; day?: string }) => request<ScheduleItem[]>('/schedules', { query: q }),
    grouped: (q: { teacher_id?: string; class_id?: string }) => request<ScheduleItem[]>('/schedules/grouped', { query: q }),
    mySubstitute: (from: string, to: string) => request<ScheduleItem[]>('/guru-pengganti/my-schedule', { query: { from, to } }),
  },

  students: {
    byClass: (class_id: string) => request<Student[]>('/students', { query: { class_id } }),
    myAttendance: (month: number, year: number) =>
      request<{ month: number; year: number; records: KehadiranRecord[] }>('/students/my-attendance', { query: { month, year } }),
    myAttendanceStats: (month: number, year: number) =>
      request<KehadiranStats>('/students/my-attendance/stats', { query: { month, year } }),
    detail: (id: string) => request<StudentDetailResponse>(`/students/${id}/detail`),
    kelengkapan: (id: string) => request<{ kelengkapan: Kelengkapan }>(`/students/${id}/kelengkapan`),
    classHistory: (id: string) => request<ClassHistoryItem[]>(`/students/${id}/class-history`),
  },

  jurnal: {
    validate: (qr_token: string, user_lat?: number | null, user_lon?: number | null) =>
      request<QRValidation>('/jurnal/validate', { method: 'POST', body: { qr_token, user_lat, user_lon } }),
    create: (body: Record<string, unknown>) => request<Journal>('/jurnal', { method: 'POST', body }),
    validateByClassToken: (class_token: string, user_lat?: number | null, user_lon?: number | null) =>
      request<QRValidation>('/jurnal/validate-by-class-token', { method: 'POST', body: { class_token, user_lat, user_lon } }),
    createByClassToken: (body: Record<string, unknown>) => request<Journal>('/jurnal/by-class-token', { method: 'POST', body }),
    my: () => request<Journal[]>('/jurnal/my'),
    detail: (id: string) => request<Journal>(`/jurnal/${id}`),
    byClass: (class_id: string) => request<Journal[]>(`/jurnal/by-class/${class_id}`),
    admin: (q: { start_date?: string; end_date?: string; class_id?: string; limit?: number }) => request<{ items: Journal[] }>('/admin/jurnal', { query: q }),
    piketFilled: () => request<Journal[]>('/jurnal/piket-filled'),
  },

  kelas: {
    tugas: () => request<KelasTugas[]>('/kelas/tugas'),
    tugasDetail: (id: string) => request<KelasTugas>(`/kelas/tugas/${id}`),
    submitTugas: (id: string, body: { jawaban: string; file_url?: string | null }) =>
      request<{ message: string; id: string }>(`/kelas/tugas/${id}/submit`, { method: 'POST', body }),
    materi: () => request<KelasMateri[]>('/kelas/materi'),
    materiDetail: (id: string) => request<KelasMateri>(`/kelas/materi/${id}`),
  },

  rapor: {
    get: (studentId: string, semester: string) => request<Rapor>(`/grades/rapor/${studentId}`, { query: { semester } }),
    ekskul: (studentId: string, semester: string) => request<RaporEkskul[]>(`/ekstrakurikuler/student/${studentId}`, { query: { semester } }),
  },

  verval: {
    mine: () => request<VervalRequest[]>('/verval-requests'),
    prestasi: (reviewer = false) =>
      request<VervalRequest[]>('/verval-requests', { query: { request_type: 'prestasi_create', reviewer_view: reviewer || undefined } }),
    create: (body: { user_id: string; user_type: string; request_type: 'prestasi_create' | 'profile_update'; target_collection?: string; target_id?: string | null; old_data: Record<string, unknown>; new_data: Record<string, unknown> }) =>
      request<VervalRequest>('/verval-requests', { method: 'POST', body }),
    cancel: (id: string) => request<{ message: string }>(`/verval-requests/${id}`, { method: 'DELETE' }),
  },

  achievements: {
    list: () => request<Achievement[]>('/achievements'),
    /** Unggah sertifikat/foto (maks 2 MB) → {url} untuk payload prestasi. */
    upload: (jenis: 'certificate' | 'photo', uri: string) => {
      // fetch Expo (expo/fetch) tidak menerima bagian FormData {uri}; File expo-file-system dibaca sebagai bytes.
      const form = new FormData();
      form.append('file', new FsFile(uri) as unknown as Blob);
      return request<{ url: string }>(`/achievements/upload/${jenis}`, { method: 'POST', form, timeoutMs: 60_000 });
    },
  },

  ekskul: {
    list: () => request<Extracurricular[]>('/extracurriculars'),
  },

  bk: {
    clkbForm: () => request<CLKBForm>('/bk/clkb/form'),
    clkbHistory: () => request<CLKBSubmission[]>('/bk/clkb/my-history'),
    clkbSubmit: (body: Omit<CLKBSubmission, 'id' | 'submitted_at' | 'scoring'>) => request<CLKBSubmission>('/bk/clkb/submit', { method: 'POST', body }),
    pclForm: () => request<PCLForm>('/bk/pcl/form'),
    pclHistory: () => request<PCLSubmission[]>('/bk/pcl/my-history'),
    pclSubmit: (body: Pick<PCLSubmission, 'selected' | 'masalah_lain' | 'masalah_saat_ini' | 'tempat_curhat'>) =>
      request<PCLSubmission>('/bk/pcl/submit', { method: 'POST', body }),
  },

  gtk: {
    absensiMy: (date_from: string, date_to: string) => request<GTKAbsensiMy>('/gtk/absensi/my', { query: { date_from, date_to } }),
    izinMy: () => request<GTKIzin[]>('/gtk/izin/my'),
    izinCreate: (body: Omit<GTKIzin, 'id'>) => request<GTKIzin>('/gtk/izin', { method: 'POST', body }),
    izinUpdate: (id: string, body: Omit<GTKIzin, 'id'>) => request<GTKIzin>(`/gtk/izin/${id}`, { method: 'PUT', body }),
    izinDelete: (id: string) => request<{ message: string }>(`/gtk/izin/${id}`, { method: 'DELETE' }),
  },

  jadwalPiket: {
    piket: () => request<PiketGuru[]>('/piket-schedules'),
    ibadah: () => request<IbadahSchedule[]>('/ibadah-schedules'),
  },

  agenda: {
    list: () => request<StaffEvent[]>('/staff-events'),
    stats: () => request<StaffEventStats>('/staff-events/stats/duration'),
    create: (body: StaffEventInput) => request<StaffEvent>('/staff-events', { method: 'POST', body }),
    update: (id: string, body: StaffEventInput) => request<StaffEvent>(`/staff-events/${id}`, { method: 'PUT', body }),
    remove: (id: string) => request<{ message: string }>(`/staff-events/${id}`, { method: 'DELETE' }),
  },

  academicYears: () => request<AcademicYear[]>('/academic-years'),

  akademik: {
    indikator: (q: { mapel_id: string; semester_id?: string | null }) =>
      request<Indikator[]>('/indikator', { query: { mapel_id: q.mapel_id, semester_id: q.semester_id || undefined } }),
    materi: (q: { mapel_id: string; semester_id?: string | null }) =>
      request<MateriPokok[]>('/materi', { query: { mapel_id: q.mapel_id, semester_id: q.semester_id || undefined } }),
  },

  piket: {
    today: () => request<PiketSchedule[]>('/piket/schedules/today'),
    fill: (body: {
      schedule_id: string; task_id?: string | null; materi: string; catatan?: string | null; piket_note?: string | null;
      jenis_izin?: string | null; siswa_hadir: number; siswa_sakit: number; siswa_izin: number; siswa_tidak_hadir: number;
      attendance_records: { student_id: string; student_name?: string; status: string }[];
    }) => request<Journal>('/piket/fill-journal', { method: 'POST', body }),
    tasks: (q: { date?: string; status?: string } = {}) => request<TeacherTask[]>('/teacher-tasks', { query: q }),
    acceptTask: (id: string) => request<TeacherTask>(`/teacher-tasks/${id}/accept`, { method: 'PUT' }),
  },

  announcements: {
    list: () => request<Announcement[]>('/announcements'),
  },

  notifications: {
    list: () => request<NotificationItem[]>('/notifications'),
    unreadCount: () => request<{ unread: number }>('/notifications/unread-count'),
    markRead: (source: string, source_id: string) => request<unknown>(`/notifications/${source}/${source_id}/read`, { method: 'POST' }),
    markAllRead: () => request<{ marked_read: number }>('/notifications/mark-all-read', { method: 'POST' }),
  },

  gp: {
    config: () => request<GPConfig>('/guru-pengganti/config'),
    period: () => request<GPPeriod>('/guru-pengganti/period'),
    teachers: (q?: string) => request<GPTeacher[]>('/guru-pengganti/teachers', { query: { q } }),
    teacherSlots: (teacher_id: string) => request<GPSlot[]>(`/guru-pengganti/teachers/${teacher_id}/slots`),
    slotDates: (schedule_id: string, month: string) => request<GPSlotDates>(`/guru-pengganti/slots/${schedule_id}/dates`, { query: { month } }),
    candidates: (schedule_id: string, dates: string[], q?: string) =>
      request<GPCandidate[]>('/guru-pengganti/substitute-candidates', { query: { schedule_id, dates: dates.join(',') || undefined, q } }),
    assignments: (q: { from?: string; to?: string; status?: 'active' | 'cancelled' | 'all'; q?: string; teacher_id?: string; limit?: number }) =>
      request<GPAssignment[]>('/guru-pengganti/assignments', { query: q }),
    assign: (body: { schedule_id: string; dates: string[]; substitute_teacher_id: string; reason?: string | null; skip_invalid?: boolean }) =>
      request<GPAssignResult>('/guru-pengganti/assignments', { method: 'POST', body }),
    cancel: (id: string) => request<{ ok: boolean }>(`/guru-pengganti/assignments/${id}`, { method: 'DELETE' }),
    assignmentJournals: (id: string) => request<GPSideBySide>(`/guru-pengganti/assignments/${id}/journals`),
    fillJournal: (body: { assignment_id: string; materi: string; catatan?: string; attendance_records: { student_id: string; student_name?: string; status: string }[] }) =>
      request<Journal>('/guru-pengganti/journals', { method: 'POST', body }),
    fillOriginal: (body: { assignment_id: string; materi: string; catatan?: string }) =>
      request<Journal>('/guru-pengganti/journals/original', { method: 'POST', body }),
  },

  mobile: {
    registerDevice: (body: { device_id: string; expo_push_token?: string | null; platform: 'android' | 'ios'; app_version?: string; local_reminders: boolean }) =>
      request<{ ok: boolean; device_id: string }>('/mobile/devices', { method: 'POST', body }),
    unregisterDevice: (device_id: string) => request<{ ok: boolean; removed: number }>(`/mobile/devices/${device_id}`, { method: 'DELETE' }),
    offlinePermits: (date: string) => request<OfflinePermitsResponse>('/mobile/offline-permits', { query: { date } }),
    submitOffline: (body: Record<string, unknown>) => request<Journal>('/mobile/journals/offline', { method: 'POST', body }),
  },
};
