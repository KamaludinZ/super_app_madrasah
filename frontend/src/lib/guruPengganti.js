// Konstanta bersama modul Guru Pengganti.

export const GURU_PENGGANTI_PATH = '/guru-pengganti';

// Hanya peran ini yang boleh membuka & menugaskan guru pengganti.
// Guru mata pelajaran hanya melaksanakan (tanpa menu & tanpa akses halaman).
export const GURU_PENGGANTI_ROLES = ['admin', 'waka_kurikulum', 'guru_piket'];

export const canManageGuruPengganti = (role) => GURU_PENGGANTI_ROLES.includes(role);

// Tanggal lokal (WIB) dalam format YYYY-MM-DD; toISOString() memakai UTC.
export const toLocalIso = (d = new Date()) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Parse YYYY-MM-DD sebagai tanggal lokal (bukan UTC).
export const parseLocalIso = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Indeks sesuai Date#getDay() (0 = Minggu).
export const DAY_KEYS = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

/**
 * Alasan tanggal tidak bisa ditugasi guru pengganti, atau null bila boleh:
 * sudah lewat, atau di luar periode semester aktif.
 */
export const dateBlockReason = (date, period) => {
  const iso = toLocalIso(date);
  if (iso < toLocalIso()) return 'Tanggal sudah lewat';
  if (period?.start_date && iso < period.start_date) return 'Di luar periode semester aktif';
  if (period?.end_date && iso > period.end_date) return 'Di luar periode semester aktif';
  return null;
};

/**
 * Geser tanggal terpilih ke hari jadwal baru pada minggu yang sama (Senin–Minggu),
 * mis. Senin 6 → Rabu 8. Tanggal hasil yang lewat/di luar periode dibuang.
 * @returns {{ dates: string[], dropped: number }}
 */
export const shiftDatesToDay = (dates, dayKey, period) => {
  const target = DAY_KEYS.indexOf(dayKey);
  const shifted = new Set();
  dates.forEach((iso) => {
    const d = parseLocalIso(iso);
    const mondayOffset = (d.getDay() + 6) % 7; // Senin = 0
    const targetOffset = (target + 6) % 7;
    d.setDate(d.getDate() - mondayOffset + targetOffset);
    if (!dateBlockReason(d, period)) shifted.add(toLocalIso(d));
  });
  const result = [...shifted].sort();
  return { dates: result, dropped: dates.length - result.length };
};

/** Kunci pasangan jurnal berdampingan (guru asli ↔ guru pengganti) untuk satu penugasan. */
export const sideBySideKey = (j) => j.pair_key || j.substitute_assignment_id || j.replaced_assignment_id || null;

/**
 * Susun ulang riwayat jurnal agar catatan guru asli dan guru pengganti pada slot & tanggal
 * yang sama tampil berurutan (guru asli dulu), urutan lain dipertahankan.
 * Setiap item diberi `pair_position`: 'first' | 'second' | undefined.
 */
export function groupSideBySideJournals(items = []) {
  const byKey = new Map();
  items.forEach((j) => {
    const key = sideBySideKey(j);
    if (key) byKey.set(key, [...(byKey.get(key) || []), j]);
  });
  const placed = new Set();
  const out = [];
  items.forEach((j) => {
    if (placed.has(j.id)) return;
    const group = byKey.get(sideBySideKey(j));
    if (!group || group.length < 2) {
      out.push(j);
      placed.add(j.id);
      return;
    }
    const ordered = [...group].sort((a, b) => Number(a.fill_mode === 'substitute') - Number(b.fill_mode === 'substitute'));
    ordered.forEach((g, i) => {
      out.push({ ...g, pair_position: i === 0 ? 'first' : 'second' });
      placed.add(g.id);
    });
  });
  return out;
}
