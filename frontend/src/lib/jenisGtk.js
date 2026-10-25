/**
 * Jenis GTK dari peran. Aturan kanonis, sinkron dengan backend/core.py dan
 * mobile/src/utils/gtk.ts:
 * - guru  = punya salah satu peran guru (termasuk kepala_sekolah); guru didahulukan bila merangkap tendik.
 * - tendik = punya peran tendik (tenaga_kependidikan, kepala_tata_usaha) dan bukan guru.
 * - null  = bukan GTK.
 */
export const PERAN_GURU_GTK = [
  'guru', 'guru_ipa', 'guru_ips', 'guru_bahasa', 'guru_seni', 'guru_agama', 'guru_tik',
  'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler', 'kepala_sekolah',
];
export const PERAN_TENDIK_GTK = ['tenaga_kependidikan', 'kepala_tata_usaha'];
export const PERAN_GTK = [...PERAN_GURU_GTK, ...PERAN_TENDIK_GTK];

/** 'guru' | 'tendik' | null (bukan GTK). */
export const jenisGtk = (roles) => {
  const r = roles || [];
  if (r.some((x) => PERAN_GURU_GTK.includes(x))) return 'guru';
  if (r.some((x) => PERAN_TENDIK_GTK.includes(x))) return 'tendik';
  return null;
};

export const adalahTendik = (roles) => jenisGtk(roles) === 'tendik';
export const adalahGuruGtk = (roles) => jenisGtk(roles) === 'guru';
