/**
 * Daftar baku 15 mata pelajaran ujian madrasah dan jenjangnya. Satu sumber untuk tab jenjang halaman info ujian,
 * monitoring pengumpulan, formulir unggah berkas, dan bundel ZIP admin — urutan di sini adalah urutan tampil.
 * `kode` disimpan di ujian_berkas.mapel (bukan teks bebas); backend memakai daftar yang sama.
 */
export const JENJANG_UJIAN = [7, 8, 9];

export const MAPEL_UJIAN_BAKU = [
  { kode: 'bahasa_indonesia', nama: 'Bahasa Indonesia' },
  { kode: 'akidah_akhlak', nama: 'Akidah Akhlak' },
  { kode: 'matematika', nama: 'Matematika' },
  { kode: 'ski', nama: 'SKI' },
  { kode: 'bahasa_inggris', nama: 'Bahasa Inggris' },
  { kode: 'pkn', nama: 'PKN' },
  { kode: 'ipa', nama: 'IPA' },
  { kode: 'fiqh', nama: 'Fiqh' },
  { kode: 'ips', nama: 'IPS' },
  { kode: 'pjok', nama: 'PJOK' },
  { kode: 'bahasa_arab', nama: 'Bahasa Arab' },
  { kode: 'quran_hadits', nama: 'Quran Hadits' },
  { kode: 'seni_budaya', nama: 'Seni Budaya' },
  { kode: 'bahasa_jawa', nama: 'Bahasa Jawa' },
  { kode: 'informatika', nama: 'Informatika' },
];

const NAMA_PER_KODE = Object.fromEntries(MAPEL_UJIAN_BAKU.map((m) => [m.kode, m.nama]));

/** Nama tampil kode mapel baku; kode tak dikenal dikembalikan apa adanya. */
export const namaMapelUjian = (kode) => NAMA_PER_KODE[kode] || kode || '-';

export const labelJenjang = (j) => `Kelas ${j}`;

/**
 * Daftar mapel satu jenjang: dari server (`mapelServer` = { '7': [{kode, nama}], … } pada respons info/monitoring, mengikuti
 * master ujian_mapel_baku — mapel yang dinonaktifkan admin tidak ikut) atau, bila tidak ada, konstanta MAPEL_UJIAN_BAKU.
 */
export function mapelUntuk(mapelServer, jenjang) {
  const daftar = mapelServer?.[String(jenjang)];
  return Array.isArray(daftar) && daftar.length ? daftar.filter((m) => m && m.kode) : MAPEL_UJIAN_BAKU;
}
