/**
 * Jenis GTK dari peran. Aturan kanonis, sinkron dengan backend/core.py dan
 * mobile/src/utils/gtk.ts:
 * - guru  = punya salah satu peran guru (termasuk kepala_sekolah); guru didahulukan bila merangkap tendik.
 * - tendik = punya peran tendik (tenaga_kependidikan, kepala_tata_usaha) dan bukan guru.
 * - null  = bukan GTK (mis. siswa, satpam).
 *
 * Satpam sengaja TIDAK masuk PERAN_GURU_GTK maupun PERAN_TENDIK_GTK: akunnya hanya akun pengguna,
 * sehingga tidak muncul di data guru/tendik, rekap absensi GTK, E-Kinerja, UKS, lab, events, dan
 * impor Excel GTK.
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

export const PERAN_SATPAM = 'satpam';

export const adalahTendik = (roles) => jenisGtk(roles) === 'tendik';
export const adalahSatpam = (roles) => (roles || []).includes(PERAN_SATPAM);
export const adalahGuruGtk = (roles) => jenisGtk(roles) === 'guru';

/**
 * Label status kepegawaian dari data tersimpan. Form detail GTK & impor menyimpan kode
 * (pns / pppk / non_asn) di `status_kepegawaian`; data lama memakai `employee_status`
 * (mis. "PNS"). Keduanya dinormalkan ke label PNS / PPPK / Non ASN.
 */
export function labelKepegawaian(u) {
  const raw = String(u?.status_kepegawaian || u?.employee_status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!raw) return null;
  if (raw === 'pns') return 'PNS';
  if (raw === 'pppk' || raw === 'p3k') return 'PPPK';
  if (['non_asn', 'nonasn', 'honorer', 'gtt', 'ptt', 'gty', 'pty'].includes(raw)) return 'Non ASN';
  return null;
}

/**
 * Isi kolom NIP/NIPM: PNS & PPPK -> field `nip`; Non ASN -> field `nipm` (NIP buatan madrasah, formatnya sama
 * dengan NIP). Status belum diisi: `nip` bila ada, selain itu `nipm`. Nilai diambil apa adanya.
 */
export function nomorIndukGtk(u) {
  const nip = String(u?.nip || '').trim();
  const nipm = String(u?.nipm || '').trim();
  const status = labelKepegawaian(u);
  if (status === 'PNS' || status === 'PPPK') return nip;
  if (status === 'Non ASN') return nipm;
  return nip || nipm;
}
