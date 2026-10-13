// Utilitas waktu: semua jam ditampilkan dalam WIB (Asia/Jakarta), format 24 jam.
//
// Format waktu di database campuran:
//  - ber-zona, mis. '2026-10-12T07:35:00+07:00' atau '...+00:00' / '...Z'
//  - UTC tanpa zona dari datetime.utcnow().isoformat() di backend — selalu memuat detik,
//    mis. '2026-10-12T00:35:12.345678'
//  - WIB tanpa zona dari isian <input type="datetime-local">, tanpa detik, mis. '2026-10-12T07:35'
//  - tanggal saja, mis. '2026-10-12'
// new Date() bawaan membaca string tanpa zona sebagai waktu lokal perangkat, sehingga jam UTC
// tampil 7 jam lebih awal. parseServerDate() menafsirkan tiap format dengan benar.

export const WIB_TIMEZONE = 'Asia/Jakarta';

const HAS_ZONE = /([zZ]|[+-]\d{2}:?\d{2})$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const WITH_SECONDS = /T\d{2}:\d{2}:\d{2}/;

export function parseServerDate(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  const s = String(value).trim();
  let d;
  if (DATE_ONLY.test(s)) d = new Date(`${s}T00:00:00+07:00`);
  else if (HAS_ZONE.test(s)) d = new Date(s);
  else if (WITH_SECONDS.test(s)) d = new Date(`${s.replace(/(\.\d{3})\d+$/, '$1')}Z`); // UTC tanpa zona
  else d = new Date(`${s}+07:00`); // isian datetime-local (WIB)
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Format waktu server dalam WIB 24 jam.
 * kind: '' (tanggal + jam), 'Date' (tanggal saja), 'Time' (jam saja) — sama seperti toLocale{Date,Time}String.
 */
export function formatWIB(value, kind = '', options = {}, fallback = '-') {
  const d = parseServerDate(value);
  if (!d) return fallback;
  const opts = { timeZone: WIB_TIMEZONE, ...options };
  if (kind !== 'Date' && !('hour12' in opts)) opts.hourCycle = 'h23';
  if (kind === 'Date') return d.toLocaleDateString('id-ID', opts);
  if (kind === 'Time') return d.toLocaleTimeString('id-ID', opts);
  return d.toLocaleString('id-ID', opts);
}

/** 'YYYY-MM-DD' tanggal kalender WIB dari nilai waktu server (untuk filter tanggal). */
export function wibDateKey(value) {
  const d = parseServerDate(value);
  if (!d) return '';
  return d.toLocaleDateString('en-CA', { timeZone: WIB_TIMEZONE });
}

/** "12 Oktober 2026, 07:35" (atau tanpa jam) dalam WIB — pengganti format(new Date(x), 'dd MMMM yyyy, HH:mm'). */
export function formatWIBPanjang(value, withTime = true, fallback = '-') {
  const d = parseServerDate(value);
  if (!d) return fallback;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('id-ID', {
      timeZone: WIB_TIMEZONE, day: '2-digit', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  const tanggal = `${parts.day} ${parts.month} ${parts.year}`;
  return withTime ? `${tanggal}, ${parts.hour}:${parts.minute}` : tanggal;
}
