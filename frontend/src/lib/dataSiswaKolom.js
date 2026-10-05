/**
 * Susunan kolom baku berkas Excel Data Siswa (unduh, template, impor).
 * Urutan & judul kolom HARUS identik dengan backend agar ekspor–impor akurat.
 *
 * Tiap kolom: { key, label, grup, path }
 *  - key   : nama unik kolom (dipakai saat impor)
 *  - label : judul kolom di Excel
 *  - grup  : 'Identitas' | 'Data Siswa' | 'Data Orang Tua' | 'Data Alamat'
 *  - path  : lokasi nilai — 'user.<field>' (koleksi users), 'detail.<field>' /
 *            'detail.<obj>.<field>' (student_details), atau 'kelas' (nama kelas)
 *  - kunci : true untuk kolom penanda baris (tidak boleh diubah saat pengisian)
 *  - daftar: true untuk nilai berupa daftar (dipisah "; " di Excel)
 */

const ORTU_FIELDS = [
  ['nama', 'Nama'], ['status', 'Status'], ['citizenship', 'Kewarganegaraan'], ['nik', 'NIK'],
  ['asal_negara', 'Asal Negara (WNA)'], ['nomor_izin_tinggal', 'Nomor Izin Tinggal (WNA)'],
  ['tempat_lahir', 'Tempat Lahir'], ['tgl_lahir', 'Tanggal Lahir'], ['pendidikan', 'Pendidikan'],
  ['pekerjaan', 'Pekerjaan'], ['penghasilan', 'Penghasilan'], ['no_hp', 'No. HP'],
  ['no_hp_unavailable', 'Tidak Punya Nomor HP (Ya/Tidak)'],
];

const ortu = (obj, label, extra = []) => [...ORTU_FIELDS, ...extra].map(([f, l]) => ({
  key: `${obj}_${f}`, label: `${label} - ${l}`, grup: 'Data Orang Tua', path: `detail.${obj}.${f}`,
}));

const ALAMAT_FIELDS = [
  ['tinggal_luar_negeri', 'Tinggal di Luar Negeri (Ya/Tidak)'], ['status_kepemilikan', 'Status Kepemilikan Rumah'],
  ['provinsi', 'Provinsi'], ['kabupaten', 'Kabupaten/Kota'], ['kecamatan', 'Kecamatan'], ['kelurahan', 'Kelurahan/Desa'],
  ['rt', 'RT'], ['rw', 'RW'], ['kode_pos', 'Kode Pos'], ['alamat', 'Alamat Lengkap'],
];

const alamat = (obj, label, extra = []) => [...extra, ...ALAMAT_FIELDS].map(([f, l]) => ({
  key: `${obj}_${f}`, label: `${label} - ${l}`, grup: 'Data Alamat', path: `detail.${obj}.${f}`,
}));

export const KOLOM_DATA_SISWA = [
  { key: 'id', label: 'ID Siswa', grup: 'Identitas', path: 'user.id', kunci: true },
  { key: 'nisn', label: 'NISN', grup: 'Identitas', path: 'user.nisn', kunci: true },
  { key: 'nis', label: 'NIS', grup: 'Identitas', path: 'user.nis' },
  { key: 'full_name', label: 'Nama Lengkap', grup: 'Identitas', path: 'user.full_name' },
  { key: 'kelas', label: 'Kelas', grup: 'Identitas', path: 'kelas' },
  { key: 'gender', label: 'Jenis Kelamin (L/P)', grup: 'Data Siswa', path: 'user.gender' },
  { key: 'birth_place', label: 'Tempat Lahir', grup: 'Data Siswa', path: 'user.birth_place' },
  { key: 'birth_date', label: 'Tanggal Lahir (YYYY-MM-DD)', grup: 'Data Siswa', path: 'user.birth_date' },
  { key: 'email', label: 'Email Siswa', grup: 'Data Siswa', path: 'user.email' },
  { key: 'phone', label: 'Nomor HP', grup: 'Data Siswa', path: 'user.phone' },
  { key: 'no_hp_unavailable', label: 'Tidak Punya Nomor HP (Ya/Tidak)', grup: 'Data Siswa', path: 'detail.no_hp_unavailable' },
  { key: 'citizenship', label: 'Kewarganegaraan', grup: 'Data Siswa', path: 'detail.citizenship' },
  { key: 'nik', label: 'NIK', grup: 'Data Siswa', path: 'detail.nik' },
  { key: 'asal_negara', label: 'Asal Negara (WNA)', grup: 'Data Siswa', path: 'detail.asal_negara' },
  { key: 'nomor_izin_tinggal', label: 'Nomor Izin Tinggal (WNA)', grup: 'Data Siswa', path: 'detail.nomor_izin_tinggal' },
  { key: 'jumlah_saudara', label: 'Jumlah Saudara', grup: 'Data Siswa', path: 'detail.jumlah_saudara' },
  { key: 'anak_ke', label: 'Anak Ke-', grup: 'Data Siswa', path: 'detail.anak_ke' },
  { key: 'agama', label: 'Agama', grup: 'Data Siswa', path: 'detail.agama' },
  { key: 'cita_cita', label: 'Cita-cita', grup: 'Data Siswa', path: 'detail.cita_cita' },
  { key: 'hobi', label: 'Hobi', grup: 'Data Siswa', path: 'detail.hobi' },
  { key: 'pembiaya_sekolah', label: 'Yang Membiayai Sekolah', grup: 'Data Siswa', path: 'detail.pembiaya_sekolah' },
  { key: 'pra_sekolah', label: 'Pra-Sekolah', grup: 'Data Siswa', path: 'detail.pra_sekolah', daftar: true },
  { key: 'imunisasi', label: 'Imunisasi', grup: 'Data Siswa', path: 'detail.imunisasi', daftar: true },
  { key: 'nomor_kip', label: 'Nomor KIP', grup: 'Data Siswa', path: 'detail.nomor_kip' },
  { key: 'nomor_kk', label: 'Nomor KK', grup: 'Data Siswa', path: 'detail.nomor_kk' },
  { key: 'nama_kepala_keluarga', label: 'Nama Kepala Keluarga', grup: 'Data Siswa', path: 'detail.nama_kepala_keluarga' },
  { key: 'santri_mahad', label: 'Santri Mahad (Ya/Tidak)', grup: 'Data Siswa', path: 'detail.santri_mahad' },
  { key: 'kamar_mahad', label: 'Kamar Mahad', grup: 'Data Siswa', path: 'detail.kamar_mahad' },
  ...ortu('ayah', 'Ayah'),
  ...ortu('ibu', 'Ibu'),
  ...ortu('wali', 'Wali', [['hubungan_wali', 'Hubungan'], ['nomor_kks', 'Nomor KKS'], ['nomor_pkh', 'Nomor PKH']]),
  ...alamat('alamat_ayah', 'Alamat Ayah'),
  ...alamat('alamat_ibu', 'Alamat Ibu', [['sama_dengan_ayah', 'Sama dengan Alamat Ayah (Ya/Tidak)']]),
  ...alamat('alamat_wali', 'Alamat Wali', [['status_wali', 'Status Wali'], ['sama_dengan_ayah', 'Sama dengan Alamat Ayah (Ya/Tidak)']]),
  ...[
    ['status_tempat_tinggal', 'Status Tempat Tinggal'], ['jarak_tempuh', 'Jarak Tempuh'],
    ['transportasi', 'Transportasi'], ['waktu_tempuh', 'Waktu Tempuh'],
  ].map(([f, l]) => ({ key: `alamat_siswa_${f}`, label: `Siswa - ${l}`, grup: 'Data Alamat', path: `detail.alamat_siswa.${f}` })),
];

const ambil = (obj, parts) => parts.reduce((v, p) => (v == null ? undefined : v[p]), obj);

/** Nilai satu sel Excel dari data siswa ({ user, detail, kelas }). */
export function nilaiKolom(kolom, { user = {}, detail = {}, kelas = '' }) {
  const [sumber, ...rest] = kolom.path.split('.');
  let v;
  if (sumber === 'kelas') v = kelas;
  else v = ambil(sumber === 'user' ? user : detail, rest);
  if (Array.isArray(v)) return v.join('; ');
  if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak';
  return v == null ? '' : v;
}

/** Baris-baris Excel (array of array) termasuk baris judul. */
export function barisDataSiswa(daftar) {
  return [
    KOLOM_DATA_SISWA.map((k) => k.label),
    ...daftar.map((s) => KOLOM_DATA_SISWA.map((k) => nilaiKolom(k, s))),
  ];
}
