/**
 * Endpoint & tipe pemantauan Kepala Madrasah (Fase 4 aplikasi native) — hanya baca.
 * Dipisah dari api/endpoints.ts agar modul inti tetap ringkas.
 */
import { request } from '@/api/client';
import type { ClassItem, User } from '@/api/types';

export type Rekap = { total: number; hadir: number; sakit: number; izin: number; alpa: number; percentage: number };
export type RekapKelas = Rekap & { class_id: string; class_name: string };
export type RekapTingkat = Rekap & { tingkat: string | number; class_count: number; classes: RekapKelas[] };
/** GET /admin/attendance/overall */
export type KehadiranOverall = { month: number; year: number; monthly: Rekap; weekly: Rekap; daily: Rekap; by_grade: RekapTingkat[] };
export type KehadiranSiswaRekap = Rekap & {
  student_id: string; student_name: string; nisn?: string | null;
  records: { id?: string; status: string; date?: string | null; subject_name?: string | null; teacher_name?: string | null }[];
};
/** GET /admin/attendance/by-class */
export type KehadiranKelas = { class: ClassItem; month: number; year: number; class_statistics: Rekap; students: KehadiranSiswaRekap[] };

/** GET /admin/jurnal/stats-by-teacher */
export type JurnalStatGuru = {
  teacher_id: string; teacher_name: string; total_jurnal: number; total_jtm: number;
  total_hadir: number; total_sakit: number; total_izin: number; total_alpa: number; weekly_slots: number; fill_rate_pct?: number | null;
};

export type GtkRekapRingkas = {
  hadir: number; sakit: number; cuti: number; dinas_luar: number; lainnya: number; alpha: number; libur: number;
  total_hari_wajib: number; total_izin: number; persentase_hadir?: number | null;
};
/** GET /gtk/absensi/rekap (semua GTK) */
export type GtkRekap = GtkRekapRingkas & { gtk_id: string; gtk_name: string };
/** GET /gtk/absensi/rekap?gtk_id */
export type GtkRekapDetail = { gtk_id: string; gtk_name: string; days: { date: string; status: string }[]; summary: GtkRekapRingkas };

/** GET /cleanliness/admin/recap */
export type KebersihanRekap = {
  class: ClassItem;
  latest?: { date: string; rating?: number; condition?: string; notes?: string | null; rater_name?: string | null } | null;
  avg_rating_7days: number; condition_count_7days: { bersih: number; cukup: number; kotor: number }; total_records: number;
};

/** /staff-events & /madrasah-events */
export type AgendaItem = {
  id: string; name?: string; event_name?: string; description?: string | null; date: string; end_date?: string | null;
  start_time?: string | null; end_time?: string | null; location?: string | null; user_id?: string; user_name?: string | null;
  created_by_name?: string | null; is_active?: boolean; category?: string | null; status?: string; participants_count?: number;
};

export const pantau = {
  kehadiranOverall: (month: number, year: number) => request<KehadiranOverall>('/admin/attendance/overall', { query: { month, year } }),
  kehadiranKelas: (class_id: string, month: number, year: number) =>
    request<KehadiranKelas>('/admin/attendance/by-class', { query: { class_id, month, year } }),
  jurnalStatGuru: () => request<JurnalStatGuru[]>('/admin/jurnal/stats-by-teacher'),
  gtkRekap: (date_from: string, date_to: string) => request<GtkRekap[]>('/gtk/absensi/rekap', { query: { date_from, date_to } }),
  gtkRekapDetail: (gtk_id: string, date_from: string, date_to: string) =>
    request<GtkRekapDetail>('/gtk/absensi/rekap', { query: { gtk_id, date_from, date_to } }),
  kebersihanRekap: () => request<KebersihanRekap[]>('/cleanliness/admin/recap'),
  staffEvents: (year: number, month: number) => request<AgendaItem[]>('/staff-events', { query: { year, month } }),
  madrasahEvents: (year: number, month: number) => request<AgendaItem[]>('/madrasah-events', { query: { year, month } }),
  users: (role: string) => request<User[]>('/users', { query: { role, is_active: true } }),
};
