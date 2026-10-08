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

export type Hitungan = Record<string, number>;
/** GET /bk/laporan/summary */
export type BkRingkasan = {
  total_kunjungan: number; kunjungan_by_jenis: Hitungan; total_clkb: number; clkb_belum_ditanggapi: number;
  total_pcl: number; pcl_belum_ditanggapi: number; total_home_visit: number;
};
/** GET /uks/laporan/summary */
export type UksRingkasan = {
  total_kunjungan: number; kunjungan_by_jenis_penanganan: Hitungan; kunjungan_by_kondisi_pulang: Hitungan;
  total_obat_keluar_transaksi: number; most_used_obat: { nama_obat: string; jumlah: number }[]; total_jenis_obat: number;
  obat_stok_menipis: { id: string; nama_obat: string; satuan?: string | null; stok_tersisa?: number; stok_minimum?: number }[];
};
/** GET /perpus/laporan/summary */
export type PerpusRingkasan = {
  total_judul_koleksi: number; total_eksemplar: number; total_eksemplar_tersedia: number; koleksi_by_jenis: Hitungan;
  total_peminjaman: number; peminjaman_aktif: number; peminjaman_terlambat: number; most_borrowed: { judul: string; jumlah: number }[];
  total_kunjungan: number; kunjungan_by_tujuan: Hitungan;
};
/** GET /sarpras/kerusakan */
export type Kerusakan = {
  id: string; aset_tipe: string; aset_nama?: string | null; tanggal_lapor: string; deskripsi_kerusakan: string; tingkat_kerusakan?: string | null;
  status?: string | null; tanggal_perbaikan?: string | null; biaya_perbaikan?: number | null; hasil_perbaikan?: string | null;
};
/** GET /alumni/stats */
export type AlumniStat = { academic_year_id?: string | null; academic_year_name?: string | null; class_id?: string | null; class_name?: string | null; grade?: string | number | null; count: number };
export type Alumni = { id: string; full_name: string; nisn?: string | null; nis?: string | null; graduation_date?: string | null; graduation_class_name?: string | null; gender?: string | null };
/** GET /rkam/budget-items */
export type RkamItem = {
  id: string; code?: string | null; name: string; category?: string | null; bidang?: string | null; description?: string | null;
  allocated_bos?: number; allocated_komite?: number; realized_bos?: number; realized_komite?: number; fiscal_year: string; quarter?: string | null;
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
  bk: (start_date: string, end_date: string) => request<BkRingkasan>('/bk/laporan/summary', { query: { start_date, end_date } }),
  uks: (start_date: string, end_date: string) => request<UksRingkasan>('/uks/laporan/summary', { query: { start_date, end_date } }),
  perpus: (start_date: string, end_date: string) => request<PerpusRingkasan>('/perpus/laporan/summary', { query: { start_date, end_date } }),
  kerusakan: () => request<Kerusakan[]>('/sarpras/kerusakan'),
  alumniStats: () => request<AlumniStat[]>('/alumni/stats'),
  alumni: (search?: string) => request<Alumni[]>('/alumni', { query: { search: search || undefined } }),
  rkam: (fiscal_year: string) => request<RkamItem[]>('/rkam/budget-items', { query: { fiscal_year } }),
  users: (role: string) => request<User[]>('/users', { query: { role, is_active: true } }),
};
