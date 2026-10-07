// Klien API modul Guru Pengganti (/api/guru-pengganti) + helper jadwal hari ini.
import { toLocalIso, DAY_KEYS } from '@/lib/guruPengganti';
import { api } from '@/lib/api';

/**
 * Hanya slot yang berlaku pada `dateIso`: tanggal penugasan sama, tidak dibatalkan,
 * dan hari slot cocok dengan hari tanggal tsb. (penugasan selalu mengikuti hari jadwal guru).
 */
export function filterSubstituteSlotsForDate(slots = [], dateIso = toLocalIso()) {
  const [y, m, d] = dateIso.split('-').map(Number);
  const dayKey = DAY_KEYS[new Date(y, m - 1, d).getDay()];
  return slots.filter((s) => s.date === dateIso
    && s.status !== 'cancelled'
    && (!s.day || s.day.toLowerCase() === dayKey));
}

/** Slot hasil penugasan hari ini untuk pengguna saat ini (penanda `is_substitute: true`). */
export async function getMySubstituteToday() {
  const { data } = await api.get('/guru-pengganti/my-schedule');
  return filterSubstituteSlotsForDate(data || [], toLocalIso());
}

/**
 * Gabungkan jadwal reguler & slot pengganti, urut jam mulai.
 * Slot reguler yang hari ini digantikan (`substitute` terisi) TETAP ada dan tetap bisa diisi jurnalnya
 * oleh guru asli — jurnalnya tersimpan berdampingan dengan jurnal guru pengganti.
 */
export function mergeTodaySchedule(regular = [], substitute = []) {
  return [...regular, ...substitute].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
}

/** Jurnal guru asli & guru pengganti untuk satu penugasan (slot + tanggal yang sama). */
export async function getSideBySideJournals(assignmentId) {
  const { data } = await api.get(`/guru-pengganti/assignments/${assignmentId}/journals`);
  return data;
}

// ---- Penugasan (admin, waka kurikulum, guru piket) ----

export async function listAssignments(params = {}) {
  const { data } = await api.get('/guru-pengganti/assignments', { params });
  return data || [];
}

export async function cancelAssignment(id) {
  await api.delete(`/guru-pengganti/assignments/${id}`);
}

export async function createAssignments({ scheduleId, dates, substituteTeacherId, reason }) {
  const { data } = await api.post('/guru-pengganti/assignments', {
    schedule_id: scheduleId,
    dates,
    substitute_teacher_id: substituteTeacherId,
    reason: reason || null,
  });
  return data;
}

/** Guru yang punya jadwal di semester aktif ({ id, name, subject, days, schedule_count }). */
export async function listReplaceableTeachers() {
  const { data } = await api.get('/guru-pengganti/teachers');
  return data || [];
}

export async function listTeacherSlots(teacherId) {
  const { data } = await api.get(`/guru-pengganti/teachers/${teacherId}/slots`);
  return data || [];
}

/** Tanggal satu bulan untuk slot: { day, period, dates: [{ date, selectable, reason, assignment }] }. */
export async function getSlotDates(scheduleId, month) {
  const { data } = await api.get(`/guru-pengganti/slots/${scheduleId}/dates`, { params: { month } });
  return data;
}

export async function listSubstituteCandidates(scheduleId, dates = []) {
  const { data } = await api.get('/guru-pengganti/substitute-candidates', {
    params: { schedule_id: scheduleId, dates: dates.join(',') || undefined },
  });
  return data || [];
}

/** Semester aktif + libur: { name, start_date, end_date, holidays }. */
export async function getActivePeriod() {
  const { data } = await api.get('/guru-pengganti/period');
  return data;
}

/** Pesan galat dari server (detail string) atau teks cadangan. */
export function apiErrorMessage(e, fallback) {
  const detail = e?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}
