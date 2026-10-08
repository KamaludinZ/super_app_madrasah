/** Pilihan Laporan guru (sama dengan web ReportPage): jenis, prioritas, status penanganan. */
import type { BadgeTone } from '@/components/ui/Badge';

type Opt = { value: string; label: string; tone: BadgeTone };
export const JENIS: Opt[] = [
  { value: 'sarana_prasarana', label: 'Sarana & Prasarana', tone: 'warning' },
  { value: 'siswa', label: 'Siswa Bermasalah', tone: 'error' },
  { value: 'catatan', label: 'Catatan Umum', tone: 'brand' },
];
export const PRIORITAS: Opt[] = [
  { value: 'rendah', label: 'Rendah', tone: 'neutral' }, { value: 'sedang', label: 'Sedang', tone: 'brand' },
  { value: 'tinggi', label: 'Tinggi', tone: 'warning' }, { value: 'mendesak', label: 'Mendesak', tone: 'error' },
];
export const STATUS: Opt[] = [
  { value: 'baru', label: 'Baru', tone: 'brand' }, { value: 'ditinjau', label: 'Ditinjau', tone: 'warning' },
  { value: 'dalam_proses', label: 'Dalam Proses', tone: 'warning' }, { value: 'selesai', label: 'Selesai', tone: 'success' },
  { value: 'ditolak', label: 'Ditolak', tone: 'error' },
];
export const opt = (list: Opt[], v?: string | null): Opt => list.find((o) => o.value === v) ?? { value: v ?? '', label: v ?? '-', tone: 'neutral' };
