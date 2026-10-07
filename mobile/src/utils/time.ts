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
