/**
 * Susunan kolom baku berkas Excel Data GTK (unduh, template, impor).
 * Urutan & judul kolom HARUS identik dengan backend agar ekspor–impor akurat.
 * Semua field berada di dokumen `users` (tab Data Guru pada detail GTK).
 *
 * Tiap kolom: { key, label, grup, path, kunci? }
 *  - path 'user.<field>' atau 'jenis' (Guru / Tenaga Kependidikan, dihitung dari peran)
 */
const kolom = (grup, daftar) => daftar.map(([key, label, extra]) => ({ key, label, grup, path: `user.${key}`, ...(extra || {}) }));

export const KOLOM_DATA_GTK = [
  ...kolom('Identitas', [
    ['id', 'ID GTK', { kunci: true }],
    ['nip', 'NIP', { kunci: true }],
    ['full_name', 'Nama Lengkap'],
  ]),
  { key: 'jenis', label: 'Jenis GTK', grup: 'Identitas', path: 'jenis' },
  ...kolom('Nama & Gelar', [
    ['gelar_depan', 'Gelar Depan'],
    ['nama_tanpa_gelar', 'Nama Tanpa Gelar'],
    ['gelar_belakang', 'Gelar Belakang'],
  ]),
  ...kolom('Data Diri', [
    ['gender', 'Jenis Kelamin (L/P)'],
    ['birth_place', 'Tempat Lahir'],
    ['birth_date', 'Tanggal Lahir (YYYY-MM-DD)'],
    ['nik', 'NIK'],
    ['nomor_kk', 'Nomor KK'],
    ['nama_ibu_kandung', 'Nama Ibu Kandung'],
    ['agama', 'Agama'],
  ]),
  ...kolom('Kepegawaian', [
    ['status_kepegawaian', 'Status Kepegawaian (pns/pppk/non_asn)'],
    ['peg_id', 'Peg ID'],
    ['nuptk', 'NUPTK'],
    ['npk', 'NPK'],
    ['nrg', 'NRG'],
    ['tmt_pns', 'TMT PNS (YYYY-MM-DD)'],
    ['no_sk_pns', 'No SK PNS'],
    ['tanggal_sk_pns', 'Tanggal SK (YYYY-MM-DD)'],
  ]),
  ...kolom('Informasi Lain', [
    ['phone', 'Nomor HP'],
    ['email', 'Email Pribadi'],
    ['email_madrasah', 'Email Madrasah Hebat'],
    ['bpjs_kesehatan', 'BPJS Kesehatan'],
    ['bpjs_ketenagakerjaan', 'BPJS Ketenagakerjaan'],
    ['npwp', 'NPWP'],
    ['golongan_darah', 'Golongan Darah'],
    ['nama_rekening', 'Nama Pemilik Rekening'],
    ['nomor_rekening', 'Nomor Rekening'],
    ['bank', 'Bank'],
  ]),
  ...kolom('Tempat Tinggal', [
    ['status_tempat_tinggal', 'Status Tempat Tinggal (milik_sendiri/sewa/menumpang/dinas)'],
    ['provinsi', 'Provinsi'],
    ['kab_kota', 'Kabupaten/Kota'],
    ['kecamatan', 'Kecamatan'],
    ['kelurahan', 'Kelurahan/Desa'],
    ['rt', 'RT'],
    ['rw', 'RW'],
    ['kode_pos', 'Kode Pos'],
    ['jarak_ke_sekolah', 'Jarak ke Sekolah (km)'],
    ['transportasi', 'Transportasi'],
    ['waktu_tempuh', 'Waktu Tempuh (menit)'],
    ['lintang', 'Lintang'],
    ['bujur', 'Bujur'],
  ]),
  ...kolom('Status Perkawinan', [
    ['status_perkawinan', 'Status Perkawinan (belum_menikah/menikah/duda/janda)'],
    ['nama_pasangan', 'Nama Suami/Istri'],
  ]),
  ...kolom('Penugasan', [
    ['jenis_ptk', 'Jenis PTK (guru_mapel/guru_bk/kepala_sekolah/tenaga_administrasi/pustakawan/laboran)'],
    ['tmt_pegawai', 'TMT Pegawai (YYYY-MM-DD)'],
    ['tmt_guru', 'TMT Guru/Tanggal SK PTK (YYYY-MM-DD)'],
    ['tugas_utama', 'Tugas Utama'],
    ['tugas_tambahan', 'Tugas Tambahan'],
  ]),
];

export const GURU_ROLES = ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'];
export const TENDIK_ROLES = ['tenaga_kependidikan'];

/** 'guru' | 'tendik' | null — guru didahulukan bila punya kedua peran. */
export function jenisGtk(user) {
  const roles = user?.roles || [];
  if (roles.some((r) => GURU_ROLES.includes(r))) return 'guru';
  if (roles.some((r) => TENDIK_ROLES.includes(r))) return 'tendik';
  return null;
}

/** Field lama yang dipakai bila field baku kosong (data impor lama menyimpan NUPTK di nip_nuptk). */
export const FALLBACK_GTK = { nuptk: 'nip_nuptk' };

export function nilaiKolomGtk(k, user) {
  if (k.path === 'jenis') {
    const j = jenisGtk(user);
    return j === 'guru' ? 'Guru' : j === 'tendik' ? 'Tenaga Kependidikan' : '';
  }
  const field = k.path.slice(5);
  let v = user?.[field];
  if ((v == null || v === '') && FALLBACK_GTK[field]) v = user?.[FALLBACK_GTK[field]];
  if (Array.isArray(v)) return v.join('; ');
  return v == null ? '' : v;
}

/** Baris-baris Excel (array of array) termasuk baris judul. */
export function barisDataGtk(users) {
  return [KOLOM_DATA_GTK.map((k) => k.label), ...users.map((u) => KOLOM_DATA_GTK.map((k) => nilaiKolomGtk(k, u)))];
}
