/**
 * Susunan kolom baku Data CKG (tampilan tabel, template, impor) — urutan sesuai format
 * pelaporan CKG: NO, Nama Lengkap, NIK, Nama Sekolah, Tgl Lahir, Jenis Kelamin, Alamat Lengkap,
 * BB, TB, TD, Jumlah Karies, Visus Mata, Kesehatan Kulit, Fungsi Pendengaran, Hemoglobin, GDS.
 *
 * Tiap kolom: { key, label, field, satuan?, angka? }
 *  - field: nama field pada dokumen CKG dari server. Identitas pasien (NIK, tgl lahir, jenis
 *    kelamin, alamat) & nama sekolah dilengkapi server pada respons daftar CKG.
 */
export const KOLOM_CKG = [
  { key: 'no', label: 'NO', field: null },
  { key: 'nama_lengkap', label: 'Nama Lengkap', field: 'pasien_nama' },
  { key: 'nik', label: 'NIK', field: 'pasien_nik' },
  { key: 'nama_sekolah', label: 'Nama Sekolah', field: 'nama_sekolah' },
  { key: 'tgl_lahir', label: 'Tgl Lahir', field: 'pasien_tgl_lahir' },
  { key: 'jenis_kelamin', label: 'Jenis Kelamin', field: 'pasien_jenis_kelamin' },
  { key: 'alamat', label: 'Alamat Lengkap', field: 'pasien_alamat' },
  { key: 'bb', label: 'BB', field: 'berat_badan', satuan: 'kg', angka: true },
  { key: 'tb', label: 'TB', field: 'tinggi_badan', satuan: 'cm', angka: true },
  { key: 'td', label: 'TD', field: 'tekanan_darah', satuan: 'mmHg' },
  { key: 'jumlah_karies', label: 'Jumlah Karies', field: 'jumlah_karies', angka: true },
  { key: 'visus_mata', label: 'Visus Mata', field: 'visus_mata' },
  { key: 'kesehatan_kulit', label: 'Kesehatan Kulit', field: 'kesehatan_kulit' },
  { key: 'fungsi_pendengaran', label: 'Fungsi Pendengaran', field: 'fungsi_pendengaran' },
  { key: 'hemoglobin', label: 'Hemoglobin', field: 'hemoglobin', satuan: 'g/dL', angka: true },
  { key: 'gds', label: 'GDS', field: 'gds', satuan: 'mg/dL', angka: true },
];

/**
 * Kolom bantu di KANAN kolom baku pada template/impor CKG (tidak tampil di tabel):
 * tanggal pemeriksaan & ID pasien sebagai penanda baris saat impor.
 */
export const KOLOM_BANTU_TEMPLATE_CKG = [
  { key: 'tanggal', label: 'Tanggal Periksa (YYYY-MM-DD)', field: 'tanggal' },
  { key: 'pasien_id', label: 'ID Pasien (jangan diubah)', field: 'pasien_id', kunci: true },
];

/** Kolom identitas yang diisi otomatis dari data siswa/GTK pada template (tidak perlu diketik). */
export const KOLOM_IDENTITAS_CKG = ['nama_lengkap', 'nik', 'nama_sekolah', 'tgl_lahir', 'jenis_kelamin', 'alamat'];

/** Susunan kolom template CKG untuk pratinjau: {key, label, grup, kunci} (16 baku + 2 bantu). */
export const kolomTemplateCkg = () => [
  ...KOLOM_CKG.map((k) => ({
    ...k,
    label: k.satuan ? `${k.label} (${k.satuan})` : k.label,
    grup: k.key === 'no' || KOLOM_IDENTITAS_CKG.includes(k.key) ? 'Identitas (terisi otomatis)' : 'Hasil Pemeriksaan (diisi petugas)',
  })),
  ...KOLOM_BANTU_TEMPLATE_CKG.map((k) => ({ ...k, grup: 'Kolom bantu impor' })),
];

const LABEL_JK = { L: 'Laki-laki', P: 'Perempuan' };

/** Nilai tampilan satu kolom CKG untuk baris ke-`index` (mulai 0). */
export function nilaiCkg(kolom, item, index, namaSekolah) {
  if (kolom.key === 'no') return index + 1;
  let v = item?.[kolom.field];
  if (kolom.key === 'nama_sekolah' && (v == null || v === '')) v = namaSekolah;
  if (kolom.key === 'jenis_kelamin') v = LABEL_JK[v] || v;
  if (v == null || v === '') return '';
  return v;
}

/** Teks yang dicari pada pencarian Data CKG (nama, NIK, alamat, kelas/identitas). */
export const teksCariCkg = (item) => [item.pasien_nama, item.pasien_nik, item.pasien_alamat, item.pasien_identitas, item.pasien_kelas]
  .filter(Boolean).join(' ').toLowerCase();

/**
 * Cocokkan satu data CKG dengan kata kunci: nama (tanpa beda huruf besar/kecil, semua kata harus ada)
 * atau NIK (angka saja, spasi/titik diabaikan, cocok sebagian dari awal maupun tengah).
 */
export function cocokCariCkg(item, kunci) {
  const q = (kunci || '').trim().toLowerCase();
  if (!q) return true;
  const digit = q.replace(/[\s.-]/g, '');
  if (/^\d{3,}$/.test(digit)) {
    return String(item.pasien_nik || '').replace(/\D/g, '').includes(digit) || teksCariCkg(item).includes(q);
  }
  const teks = teksCariCkg(item);
  return q.split(/\s+/).every((kata) => teks.includes(kata));
}

export const FILTER_SEMUA = 'all';
export const FILTER_GTK = '__gtk__';

/** Data CKG milik siswa? (pasien_tipe dari server, atau peran pasien pada data lama). */
export const ckgSiswa = (item) => item?.pasien_tipe ? item.pasien_tipe === 'siswa' : (item?.pasien_roles || []).includes('siswa');

/**
 * Saring data CKG per kelas & jenis kelamin.
 * - kelas: 'all' | '__gtk__' (semua GTK) | nama kelas (mis. '7A') | 'tingkat:7'
 * - jk   : 'all' | 'L' | 'P'
 */
export function cocokFilterCkg(item, { kelas = FILTER_SEMUA, jk = FILTER_SEMUA } = {}) {
  if (jk !== FILTER_SEMUA && item?.pasien_jenis_kelamin !== jk) return false;
  if (kelas === FILTER_SEMUA) return true;
  if (kelas === FILTER_GTK) return !ckgSiswa(item);
  if (!ckgSiswa(item)) return false;
  const nama = String(item?.pasien_kelas || '');
  if (kelas.startsWith('tingkat:')) return nama.startsWith(kelas.slice(8));
  return nama === kelas;
}

/** Pilihan filter kelas dari daftar kelas + kelas yang muncul di data CKG, diurutkan. */
export function opsiKelasCkg(classes, items) {
  const nama = new Set([...(classes || []).map((c) => c.name), ...(items || []).filter(ckgSiswa).map((i) => i.pasien_kelas)].filter(Boolean));
  const urut = [...nama].sort((a, b) => a.localeCompare(b, 'id', { numeric: true }));
  const tingkat = [...new Set(urut.map((n) => (n.match(/^\d+/) || [])[0]).filter(Boolean))];
  return { kelas: urut, tingkat };
}
