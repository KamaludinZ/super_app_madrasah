/** Peran & menu aplikasi mobile. */
export const GURU_ROLES = ['guru', 'guru_ipa', 'guru_ips', 'guru_bahasa', 'guru_seni', 'guru_agama', 'guru_tik', 'guru_ekstrakurikuler'];
export const MANAGER_ROLES = ['admin', 'waka_kurikulum', 'guru_piket'];

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  siswa: 'Siswa',
  guru: 'Guru Mata Pelajaran',
  guru_ipa: 'Guru IPA',
  guru_ips: 'Guru IPS',
  guru_bahasa: 'Guru Bahasa',
  guru_seni: 'Guru Seni',
  guru_agama: 'Guru Agama',
  guru_tik: 'Guru TIK',
  tenaga_kependidikan: 'Tenaga Kependidikan',
  guru_ekstrakurikuler: 'Guru Ekstrakurikuler',
  guru_piket: 'Guru Piket',
  guru_bk: 'Guru BK',
  wali_kelas: 'Wali Kelas',
  guru_tata_tertib: 'Guru Tata Tertib',
  alumni: 'Alumni',
  kepala_sekolah: 'Kepala Sekolah',
  kepala_tata_usaha: 'Kepala Tata Usaha',
  waka_kesiswaan: 'Waka Kesiswaan',
  waka_kurikulum: 'Waka Kurikulum',
  waka_sarpras: 'Waka Sarana Prasarana',
  waka_humas: 'Waka Humas',
  bendahara: 'Bendahara',
  kepegawaian: 'Kepegawaian',
  perpustakaan: 'Perpustakaan',
  unit_pelayanan: 'Unit Pelayanan',
  unit_kesehatan: 'Unit Kesehatan',
  penjamin_mutu: 'Penjamin Mutu',
  unit_pengaduan: 'Unit Pengaduan',
  unit_ubudiyah: 'Unit Ubudiyah',
};

export const roleLabel = (r?: string | null) => (r ? ROLE_LABELS[r] || r.replace(/_/g, ' ') : '-');

export type HomeKind = 'guru' | 'piket' | 'manager' | 'walas' | 'siswa' | 'umum';

/** Jenis beranda berdasarkan peran aktif. */
export function homeKind(activeRole?: string | null): HomeKind {
  if (!activeRole) return 'umum';
  if (GURU_ROLES.includes(activeRole)) return 'guru';
  if (activeRole === 'guru_piket') return 'piket';
  if (activeRole === 'admin' || activeRole === 'waka_kurikulum') return 'manager';
  if (activeRole === 'wali_kelas') return 'walas';
  if (activeRole === 'siswa') return 'siswa';
  return 'umum';
}

export const isGuru = (role?: string | null) => homeKind(role) === 'guru';
export const canScan = (role?: string | null) => homeKind(role) === 'guru';
/** Tugas Piket (GET /piket/schedules/today): peran aktif guru piket, atau akun ber-peran admin. */
export const canPiket = (activeRole?: string | null, roles?: string[] | null) =>
  activeRole === 'guru_piket' || activeRole === 'admin' || !!roles?.includes('admin');

export const canSeeJournals = (role?: string | null) => ['guru', 'piket', 'manager', 'walas'].includes(homeKind(role));

export function initials(name?: string | null): string {
  if (!name) return '?';
  const parts = name.replace(/[,.].*$/, '').trim().split(/\s+/).filter(Boolean);
  const take = parts.filter((p) => !/^(drs|dr|h|hj|ir|prof|m|s|bapak|ibu|bu|pak)$/i.test(p)).slice(0, 2);
  return (take.length ? take : parts.slice(0, 2)).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}
