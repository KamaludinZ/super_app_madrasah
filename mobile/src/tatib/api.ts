/**
 * Poin Tata Tertib (kebaikan +, pelanggaran −) — endpoint & tipe untuk layar native (hanya lihat):
 * Poin Saya (siswa), Pantauan Walikelas, dan Rekap pimpinan. Pencatatan poin tetap di web
 * (admin, guru tata tertib, waka kesiswaan). Cakupan data dibatasi server menurut peran aktif.
 */
import { request } from '@/api/client';

export type TindakLanjut = { id?: string; tanggal?: string; uraian?: string; petugas_nama?: string | null };
export type CatatanPoin = {
  id: string; siswa_id?: string; siswa_nama?: string | null; siswa_kelas?: string | null; tanggal?: string;
  tatib_kode?: string | null; tatib_nama?: string | null; kategori_nama?: string | null; jenis_nama?: string | null;
  poin: number; tatib_poin?: number | null; jenis_poin: 'kebaikan' | 'pelanggaran' | string; kondisi?: string | null; catatan?: string | null;
  petugas_nama?: string | null; tindak_lanjut: TindakLanjut[];
};
export type RangkumanPoin = {
  total_plus: number; total_minus: number; saldo: number; jumlah_kebaikan: number; jumlah_pelanggaran: number; perlu_perhatian: boolean;
};
/** GET /tatib/poin-saya, /tatib/walikelas/siswa/{id}, /tatib/poin/siswa/{id} */
export type PaketPoin = RangkumanPoin & {
  siswa: { id: string; nama?: string | null; nis?: string | null; nisn?: string | null; kelas?: string | null };
  batas_minus_perhatian: number; records: CatatanPoin[];
};
/** GET /tatib/walikelas/siswa */
export type PoinKelasWali = {
  kelas: { id: string; name: string } | null; batas_minus_perhatian?: number;
  siswa: (RangkumanPoin & { id: string; full_name: string; nis?: string | null; nisn?: string | null })[];
};
/** GET /tatib/rekap */
export type RekapTatib = {
  ringkasan: { total_plus: number; total_minus: number; jumlah_kebaikan: number; jumlah_pelanggaran: number; siswa_perlu_perhatian: number };
  per_kelas: { kelas: string; jumlah_siswa: number; jumlah_kebaikan: number; jumlah_pelanggaran: number; total_plus: number; total_minus: number; saldo: number; siswa_perlu_perhatian: number }[];
  teratas_pelanggaran: { kode?: string | null; nama: string; kategori_nama?: string | null; jumlah: number }[];
  teratas_kebaikan: { kode?: string | null; nama: string; kategori_nama?: string | null; jumlah: number }[];
};

export const tatib = {
  poinSaya: () => request<PaketPoin>('/tatib/poin-saya'),
  kelasWali: () => request<PoinKelasWali>('/tatib/walikelas/siswa'),
  siswaWali: (id: string) => request<PaketPoin>(`/tatib/walikelas/siswa/${id}`),
  siswa: (id: string) => request<PaketPoin>(`/tatib/poin/siswa/${id}`),
  /** Catatan mentah (GET /tatib/penanganan) — catatan lama bisa tanpa `poin`, pakai nilaiPoin(). */
  catatan: (q: { start_date?: string; end_date?: string; siswa_id?: string }) => request<CatatanPoin[]>('/tatib/penanganan', { query: q }),
  rekap: (q: { kelas?: string; start_date?: string; end_date?: string }) => request<RekapTatib>('/tatib/rekap', { query: q }),
};

/** Nilai bertanda satu catatan (catatan lama memakai tatib_poin), sama dengan nilai_poin backend. */
export const nilaiPoin = (c: Pick<CatatanPoin, 'poin' | 'tatib_poin'>) => Number(c.poin ?? c.tatib_poin ?? 0);
