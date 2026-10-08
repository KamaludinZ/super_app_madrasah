/**
 * Pilihan Agenda Saya (sama dengan web MyAgendaPage): kategori guru/tendik, prioritas, status, dan status
 * otomatis berdasarkan waktu (terjadwal → berlangsung → selesai; dibatalkan tetap).
 */
import type { StaffEvent } from '@/api/types';
import type { BadgeTone } from '@/components/ui/Badge';
import { parseISO } from '@/utils/time';

export const GURU_CATEGORIES = [
  { value: 'rapat', label: 'Rapat' }, { value: 'pelatihan', label: 'Pelatihan' }, { value: 'supervisi', label: 'Supervisi' },
  { value: 'ekskul', label: 'Ekstrakurikuler' }, { value: 'lainnya', label: 'Lainnya' },
];
export const TENDIK_CATEGORIES = [
  { value: 'administrasi', label: 'Administrasi' }, { value: 'inventaris', label: 'Inventaris' }, { value: 'keamanan', label: 'Keamanan' },
  { value: 'kebersihan', label: 'Kebersihan' }, { value: 'pelatihan', label: 'Pelatihan' }, { value: 'lainnya', label: 'Lainnya' },
];
export const PRIORITIES: { value: string; label: string; tone: BadgeTone }[] = [
  { value: 'low', label: 'Rendah', tone: 'neutral' }, { value: 'normal', label: 'Normal', tone: 'brand' },
  { value: 'high', label: 'Tinggi', tone: 'warning' }, { value: 'urgent', label: 'Mendesak', tone: 'error' },
];
export const STATUSES: { value: string; label: string; tone: BadgeTone }[] = [
  { value: 'pending', label: 'Terjadwal', tone: 'brand' }, { value: 'in_progress', label: 'Berlangsung', tone: 'warning' },
  { value: 'completed', label: 'Selesai', tone: 'success' }, { value: 'cancelled', label: 'Dibatalkan', tone: 'error' },
];

export const categoryOptions = (roles: string[] | undefined) => (roles?.includes('guru') ? GURU_CATEGORIES : TENDIK_CATEGORIES);
export const categoryLabel = (v?: string | null) => [...GURU_CATEGORIES, ...TENDIK_CATEGORIES].find((c) => c.value === v)?.label ?? v ?? '-';

/** Status menurut waktu sekarang (WIB): rentang = tanggal mulai jam mulai s.d. tanggal selesai jam selesai. */
export function autoStatus(a: StaffEvent, now = Date.now()) {
  if (a.status === 'cancelled') return STATUSES[3];
  const start = parseISO(`${a.date}T${a.start_time || '00:00'}:00`).getTime();
  const end = parseISO(`${a.end_date || a.date}T${a.end_time || '23:59'}:00`).getTime();
  if (Number.isNaN(start)) return STATUSES.find((s) => s.value === a.status) ?? STATUSES[0];
  return now < start ? STATUSES[0] : now <= end ? STATUSES[1] : STATUSES[2];
}
