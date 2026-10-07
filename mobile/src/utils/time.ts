/** Utilitas waktu — semua tampilan memakai zona WIB (Asia/Jakarta). */
export const WIB = 'Asia/Jakarta';
export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const DAY_KEYS = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'] as const;
export const DAY_LABELS: Record<string, string> = {
  senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu', kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu', minggu: 'Minggu',
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTHS_LONG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Komponen tanggal/jam sebuah instan pada zona WIB (tanpa bergantung pada Intl). */
export function wibParts(d: Date | number | string = Date.now()) {
  const t = typeof d === 'string' ? parseISO(d).getTime() : typeof d === 'number' ? d : d.getTime();
  const shifted = new Date(t + WIB_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(), // 0-11
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(), // 0 = Minggu
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/** Parse ISO 8601; string tanpa zona dianggap WIB (sesuai backend yang menyimpan now_wib()). */
export function parseISO(s: string): Date {
  if (!s) return new Date(NaN);
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s);
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (dateOnly) return new Date(`${s}T00:00:00+07:00`);
  return new Date(hasZone ? s : `${s}+07:00`);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD pada WIB. */
export function toISODate(d: Date | number | string = Date.now()): string {
  const p = wibParts(d);
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
}

export const todayISO = () => toISODate(Date.now());

/** Kunci hari (senin..minggu) untuk sebuah tanggal ISO. */
export function dayKeyOf(isoDate: string): string {
  return DAY_KEYS[wibParts(isoDate).weekday];
}

export function addDays(isoDate: string, n: number): string {
  const t = parseISO(isoDate).getTime() + n * 86_400_000;
  return toISODate(t);
}

/** "Senin, 7 Oktober 2026" */
export function formatDateLong(d: Date | number | string = Date.now()): string {
  const p = wibParts(d);
  return `${DAY_LABELS[DAY_KEYS[p.weekday]]}, ${p.day} ${MONTHS_LONG[p.month]} ${p.year}`;
}

/** "7 Okt 2026" */
export function formatDateShort(d: Date | number | string): string {
  const p = wibParts(d);
  if (Number.isNaN(p.year)) return '-';
  return `${p.day} ${MONTHS[p.month]} ${p.year}`;
}

/** "08:30" */
export function formatTime(d: Date | number | string): string {
  const p = wibParts(d);
  if (Number.isNaN(p.hour)) return '-';
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** "7 Okt 2026, 08:30 WIB" */
export function formatDateTime(d: Date | number | string): string {
  const p = wibParts(d);
  if (Number.isNaN(p.year)) return '-';
  return `${p.day} ${MONTHS[p.month]} ${p.year}, ${pad(p.hour)}:${pad(p.minute)} WIB`;
}

/** Waktu relatif singkat: "baru saja", "5 mnt lalu", "2 jam lalu", "kemarin", tanggal. */
export function formatRelative(d: Date | number | string): string {
  const t = typeof d === 'string' ? parseISO(d).getTime() : typeof d === 'number' ? d : d.getTime();
  if (Number.isNaN(t)) return '-';
  const diff = Date.now() - t;
  const m = Math.round(diff / 60_000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const dd = Math.round(h / 24);
  if (dd === 1) return 'kemarin';
  if (dd < 7) return `${dd} hari lalu`;
  return formatDateShort(t);
}

/** Menit sejak tengah malam dari "HH:MM". */
export function minutesOf(hhmm: string): number {
  const [h, m] = (hhmm || '0:0').split(':').map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

/** Instan (ms epoch) untuk tanggal ISO + "HH:MM" pada WIB. */
export function wibInstant(isoDate: string, hhmm: string): number {
  return parseISO(`${isoDate}T${hhmm.length === 5 ? hhmm : '0' + hhmm}:00`).getTime();
}

export type SlotStatus = 'upcoming' | 'ongoing' | 'done';

export function slotStatus(start: string, end: string, now = Date.now()): SlotStatus {
  const p = wibParts(now);
  const cur = p.hour * 60 + p.minute;
  if (cur < minutesOf(start)) return 'upcoming';
  if (cur > minutesOf(end)) return 'done';
  return 'ongoing';
}

/** Salam sesuai jam WIB. */
export function greeting(now = Date.now()): string {
  const h = wibParts(now).hour;
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 18) return 'Selamat sore';
  return 'Selamat malam';
}

export const nowISO = () => new Date().toISOString();

/** "Sen, 7 Okt" — label tanggal ringkas untuk daftar & chip. */
export function formatDayShort(isoDate: string): string {
  const p = wibParts(isoDate);
  if (Number.isNaN(p.year)) return '-';
  return `${DAY_LABELS[DAY_KEYS[p.weekday]].slice(0, 3)}, ${p.day} ${MONTHS[p.month]}`;
}

/** "2026-10" dari tanggal ISO. */
export const monthOf = (isoDate: string) => isoDate.slice(0, 7);

/** "Oktober 2026" dari "2026-10". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map((x) => parseInt(x, 10));
  return `${MONTHS_LONG[(m || 1) - 1]} ${y}`;
}

/** Geser bulan "YYYY-MM" sebanyak n. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map((x) => parseInt(x, 10));
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
}

/** Tanggal pertama & terakhir sebuah bulan "YYYY-MM". */
export function monthRange(month: string): { start: string; end: string; days: number } {
  const [y, m] = month.split('-').map((x) => parseInt(x, 10));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${pad(days)}`, days };
}

/** Status tenggat untuk daftar tugas: lewat, hari ini, besok, atau n hari lagi (WIB). */
export function dueInfo(deadline?: string | null, now = Date.now()): { label: string; tone: 'error' | 'warning' | 'neutral' | 'brand'; overdue: boolean } | null {
  if (!deadline) return null;
  const t = parseISO(deadline).getTime();
  if (Number.isNaN(t)) return null;
  const jam = formatTime(t);
  if (t < now) return { label: `Tenggat lewat · ${formatDateShort(t)}`, tone: 'error', overdue: true };
  const days = Math.round((parseISO(toISODate(t)).getTime() - parseISO(toISODate(now)).getTime()) / 86_400_000);
  if (days === 0) return { label: `Hari ini ${jam}`, tone: 'warning', overdue: false };
  if (days === 1) return { label: `Besok ${jam}`, tone: 'warning', overdue: false };
  return { label: `${days} hari lagi · ${formatDateShort(t)}`, tone: days <= 3 ? 'brand' : 'neutral', overdue: false };
}
