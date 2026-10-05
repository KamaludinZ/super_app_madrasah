/**
 * Definisi & hitungan % kelengkapan data wajib GTK per bagian (sejajar dengan
 * compute_completeness siswa). Backend memakai aturan yang sama
 * (compute_completeness_gtk); nilai dari server (`u.kelengkapan`) diutamakan bila ada.
 *
 * Jenis aturan:
 *  - field  : field users wajib terisi (fallback: field lama bila field baku kosong)
 *  - daftar : daftar (array) minimal satu item, ATAU penanda "tidak ada" bernilai true
 */
export const BAGIAN_KELENGKAPAN_GTK = [
  {
    key: 'data_guru',
    label: 'Data Guru',
    syarat: [
      ['full_name', 'Nama Lengkap'], ['gender', 'Jenis Kelamin'], ['birth_place', 'Tempat Lahir'], ['birth_date', 'Tanggal Lahir'],
      ['nik', 'NIK'], ['nomor_kk', 'Nomor KK'], ['nama_ibu_kandung', 'Nama Ibu Kandung'], ['agama', 'Agama'],
      ['status_kepegawaian', 'Status Kepegawaian'], ['nuptk', 'NUPTK'], ['phone', 'Nomor HP'], ['email', 'Email'],
      ['status_tempat_tinggal', 'Status Tempat Tinggal'], ['provinsi', 'Provinsi'], ['kab_kota', 'Kabupaten/Kota'],
      ['kecamatan', 'Kecamatan'], ['kelurahan', 'Kelurahan/Desa'], ['status_perkawinan', 'Status Perkawinan'],
      ['jenis_ptk', 'Jenis PTK'], ['tugas_utama', 'Tugas Utama'],
    ].map(([field, label]) => ({ jenis: 'field', field, label })),
  },
  {
    key: 'status_riwayat',
    label: 'Status & Riwayat',
    syarat: [
      { jenis: 'daftar', field: 'jabatan_ids', label: 'Fungsi/Jabatan' },
      { jenis: 'field', field: 'status_penugasan', label: 'Status Penugasan' },
      { jenis: 'field', field: 'pangkat_golongan', label: 'Pangkat/Golongan' },
      { jenis: 'field', field: 'status_keaktifan', label: 'Status Keaktifan' },
    ],
  },
  { key: 'pendidikan', label: 'Pendidikan', syarat: [{ jenis: 'daftar', field: 'riwayat_pendidikan', label: 'Riwayat Pendidikan Formal' }] },
  { key: 'data_anak', label: 'Data Anak', syarat: [{ jenis: 'daftar', field: 'data_anak', tidakAda: 'tidak_punya_anak', label: 'Data Anak (atau "tidak punya anak")' }] },
  {
    key: 'riwayat_pesantren',
    label: 'Riwayat Pesantren',
    syarat: [{ jenis: 'daftar', field: 'riwayat_pesantren', tidakAda: 'tidak_pernah_pesantren', label: 'Riwayat Pesantren (atau "tidak pernah")' }],
  },
  {
    key: 'arsip_berkas',
    label: 'Arsip Berkas',
    syarat: [['berkas_ktp', 'KTP'], ['berkas_kk', 'Kartu Keluarga'], ['berkas_ijazah', 'Ijazah Terakhir'], ['berkas_sk', 'SK Pengangkatan']]
      .map(([field, label]) => ({ jenis: 'field', field, label })),
  },
];

const FALLBACK = { nuptk: 'nip_nuptk' };

const terisi = (v) => !(v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && !v.trim()));

function cekSyarat(s, u) {
  if (s.jenis === 'daftar') return terisi(u?.[s.field]) || (s.tidakAda ? u?.[s.tidakAda] === true : false);
  return terisi(u?.[s.field]) || (FALLBACK[s.field] ? terisi(u?.[FALLBACK[s.field]]) : false);
}

/**
 * Hitung kelengkapan satu GTK: { persen, terisi, total, bagian: [{ key, label, persen, terisi, total, kurang: [label] }] }.
 * Persen keseluruhan = total syarat terpenuhi / total syarat (bobot per syarat).
 */
export function hitungKelengkapanGtk(user) {
  let isi = 0;
  let total = 0;
  const bagian = BAGIAN_KELENGKAPAN_GTK.map((b) => {
    const kurang = b.syarat.filter((s) => !cekSyarat(s, user)).map((s) => s.label);
    const t = b.syarat.length;
    const f = t - kurang.length;
    isi += f;
    total += t;
    return { key: b.key, label: b.label, persen: t ? Math.round((f / t) * 100) : 100, terisi: f, total: t, kurang };
  });
  return { persen: total ? Math.round((isi / total) * 100) : 0, terisi: isi, total, bagian };
}

/** Kelengkapan dari server bila tersedia (u.kelengkapan), selain itu dihitung di browser. */
export const kelengkapanGtk = (user) => user?.kelengkapan || hitungKelengkapanGtk(user);

export const warnaPersen = (p) => (p >= 80 ? 'emerald' : p >= 50 ? 'amber' : 'rose');
