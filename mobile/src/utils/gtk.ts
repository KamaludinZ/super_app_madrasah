/**
 * Pengelompokan GTK (guru & tenaga kependidikan) untuk Data GTK, profil, agenda: kepala madrasah termasuk guru
 * (tanpa wajib jadwal/jam mengajar), Kepala TU termasuk tendik. HARUS sama dengan backend/core.py
 * (PERAN_GURU_GTK, PERAN_TENDIK_GTK) dan frontend/src/lib/jenisGtk.js. Bukan kelompok "guru yang mengajar"
 * (itu GURU_ROLES di ./roles.ts).
 */
export const PERAN_GURU_GTK = [
  'guru', 'guru_ipa', 'guru_ips', 'guru_bahasa', 'guru_seni', 'guru_agama', 'guru_tik',
  'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler', 'kepala_sekolah',
];
export const PERAN_TENDIK_GTK = ['tenaga_kependidikan', 'kepala_tata_usaha'];

export type JenisGtk = 'guru' | 'tendik';

/** 'guru' | 'tendik' | null (bukan GTK); guru didahulukan bila merangkap peran tendik. */
export function jenisGtk(roles: string[] | null | undefined): JenisGtk | null {
  const r = roles ?? [];
  if (r.some((x) => PERAN_GURU_GTK.includes(x))) return 'guru';
  if (r.some((x) => PERAN_TENDIK_GTK.includes(x))) return 'tendik';
  return null;
}

export const adalahTendik = (roles: string[] | null | undefined) => jenisGtk(roles) === 'tendik';
