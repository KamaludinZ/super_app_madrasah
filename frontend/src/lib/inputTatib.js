import { api } from '@/lib/api';
import { hariIniWIB } from '@/lib/tanggal';

// Input Tata Tertib terpadu: siswa → kategori → jenis aturan (poin otomatis) → tanggal & keterangan.
// Fungsi yang sudah tersambung ke API memakai `api`; sisanya SEMENTARA memakai data tiruan di memori
// (frontend dibangun lebih dulu). Kontrak:
//   GET  /tatib/kategori            -> [{ id, nama, deskripsi }]
//   GET  /tatib/jenis-aturan        -> [{ id, kode_aturan, nama, jalur_poin: 'minus'|'plus', besar_poin, poin, kategori_id, kategori_nama, deskripsi, aktif }]
//   GET  /students                  -> [{ id, nis, nisn, full_name, class_name }]
//   GET  /tatib/input/terbaru       -> { items: catatan terbaru (bentuk `lengkapiCatatan`), ada_lagi }
//   POST /tatib/input               -> { siswa_id, jenis_id, tanggal, asal_input, keterangan } ; poin dihitung server dari jenis
// Fungsi di sini diganti ke pemanggil API saat backend fase ini dikerjakan.

// Sumber pencatatan (daftar baku); disimpan bersama catatan dan tampil di laporan/rekap.
export const ASAL_INPUT = ['BIPH', 'Screening pagi', 'Ibadah', 'Keputrian', 'Whatsapp', 'BAP', 'Razia', 'Laporan langsung'];

const jeda = (data) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), 150));

const kategoriTiruan = [
  { id: 'kat-kedisiplinan', nama: 'Kedisiplinan', deskripsi: 'Kehadiran, ketepatan waktu, dan ketertiban' },
  { id: 'kat-kerapian', nama: 'Kerapian', deskripsi: 'Seragam, rambut, dan atribut' },
  { id: 'kat-akhlak', nama: 'Akhlak & Ibadah', deskripsi: 'Sikap, sopan santun, dan ibadah' },
];

const jenisTiruan = [
  { id: 'jen-1', kode_aturan: 'DIS-01', nama: 'Terlambat masuk madrasah', jalur_poin: 'minus', besar_poin: 5, kategori_id: 'kat-kedisiplinan', deskripsi: 'Datang setelah bel masuk', aktif: true },
  { id: 'jen-2', kode_aturan: 'DIS-02', nama: 'Membolos jam pelajaran', jalur_poin: 'minus', besar_poin: 15, kategori_id: 'kat-kedisiplinan', deskripsi: '', aktif: true },
  { id: 'jen-3', kode_aturan: 'KER-01', nama: 'Seragam tidak sesuai jadwal', jalur_poin: 'minus', besar_poin: 5, kategori_id: 'kat-kerapian', deskripsi: '', aktif: true },
  { id: 'jen-4', kode_aturan: 'KER-02', nama: 'Rambut panjang (putra)', jalur_poin: 'minus', besar_poin: 10, kategori_id: 'kat-kerapian', deskripsi: '', aktif: true },
  { id: 'jen-5', kode_aturan: 'AKH-01', nama: 'Menjadi imam/muadzin salat berjamaah', jalur_poin: 'plus', besar_poin: 5, kategori_id: 'kat-akhlak', deskripsi: '', aktif: true },
  { id: 'jen-6', kode_aturan: 'AKH-02', nama: 'Mengembalikan barang temuan', jalur_poin: 'plus', besar_poin: 10, kategori_id: 'kat-akhlak', deskripsi: '', aktif: true },
  { id: 'jen-7', kode_aturan: 'AKH-03', nama: 'Berkata kasar kepada teman', jalur_poin: 'minus', besar_poin: 10, kategori_id: 'kat-akhlak', deskripsi: '', aktif: false },
];

const siswaTiruan = [
  { id: 'sis-1', nis: '2401', nisn: '0098765401', full_name: 'Ahmad Fauzan', class_name: 'VII A' },
  { id: 'sis-2', nis: '2402', nisn: '0098765402', full_name: 'Aisyah Putri Ramadhani', class_name: 'VII A' },
  { id: 'sis-3', nis: '2315', nisn: '0098765315', full_name: 'Muhammad Rizki Pratama', class_name: 'VIII B' },
  { id: 'sis-4', nis: '2316', nisn: '0098765316', full_name: 'Nur Halimah', class_name: 'VIII B' },
  { id: 'sis-5', nis: '2207', nisn: '0098765207', full_name: 'Fikri Hidayatullah', class_name: 'IX C' },
];

const namaKategori = (id) => kategoriTiruan.find((k) => k.id === id)?.nama || 'Lainnya';

let catatanTiruan = [
  { id: 'cat-1', siswa_id: 'sis-3', jenis_id: 'jen-1', tanggal: hariIniWIB(), asal_input: 'Screening pagi', keterangan: 'Terlambat 15 menit', petugas_nama: 'Guru Tatib' },
  { id: 'cat-2', siswa_id: 'sis-2', jenis_id: 'jen-6', tanggal: hariIniWIB(), asal_input: 'Laporan langsung', keterangan: 'Dompet di musala', petugas_nama: 'Guru Tatib' },
  { id: 'cat-3', siswa_id: 'sis-5', jenis_id: 'jen-3', tanggal: hariIniWIB(), asal_input: 'Razia', keterangan: '', petugas_nama: 'Waka Kesiswaan' },
].map(lengkapiCatatan);

// Poin bertanda mengikuti master jenis: jalur 'minus' -> negatif, 'plus' -> positif.
export function poinJenis(jenis) {
  if (!jenis) return null;
  const besar = Math.abs(Number(jenis.besar_poin) || 0);
  return jenis.jalur_poin === 'minus' ? -besar : besar;
}

function lengkapiCatatan(c) {
  const siswa = siswaTiruan.find((s) => s.id === c.siswa_id) || {};
  const jenis = jenisTiruan.find((j) => j.id === c.jenis_id) || {};
  return {
    ...c,
    siswa_nama: siswa.full_name,
    siswa_nis: siswa.nis,
    siswa_kelas: siswa.class_name,
    kode_aturan: jenis.kode_aturan,
    jenis_nama: jenis.nama,
    kategori_id: jenis.kategori_id,
    kategori_nama: namaKategori(jenis.kategori_id),
    poin: poinJenis(jenis),
    created_at: c.created_at || new Date().toISOString(),
  };
}

export async function ambilKategoriTatib() {
  const { data } = await api.get('/tatib/kategori');
  return (data || []).map(({ id, nama, deskripsi }) => ({ id, nama, deskripsi: deskripsi || '' }));
}

// Semua jenis (termasuk nonaktif, agar catatan lama tetap bisa diperbaiki); halaman menyaring yang aktif.
export async function ambilJenisAturan({ kategori_id, aktif } = {}) {
  const params = {};
  if (kategori_id) params.kategori_id = kategori_id;
  if (aktif != null) params.aktif = aktif;
  const { data } = await api.get('/tatib/jenis-aturan', { params });
  return data || [];
}

export const ambilSiswaTatib = () => jeda(siswaTiruan);

// Catatan terbaru (urut waktu input, terbaru dulu); `siswa_id` membatasi ke satu siswa.
// Kontrak: GET /tatib/input/terbaru?batas=&siswa_id= -> { items, ada_lagi }.
export function ambilRiwayatInputTerbaru({ batas = 10, siswa_id } = {}) {
  const cocok = catatanTiruan.filter((c) => !siswa_id || c.siswa_id === siswa_id);
  return jeda({ items: cocok.slice(0, batas), ada_lagi: cocok.length > batas });
}

export async function simpanInputTatib({ siswa_id, jenis_id, tanggal, asal_input, keterangan }) {
  const jenis = jenisTiruan.find((j) => j.id === jenis_id);
  if (!jenis || jenis.aktif === false) throw new Error('Jenis aturan tidak ditemukan atau sudah nonaktif');
  if (!ASAL_INPUT.includes(asal_input)) throw new Error('Asal input wajib dipilih dari daftar');
  const catatan = lengkapiCatatan({
    id: `cat-${Date.now()}`, siswa_id, jenis_id, tanggal, asal_input, keterangan: keterangan || '', petugas_nama: 'Anda',
  });
  catatanTiruan = [catatan, ...catatanTiruan];
  return jeda(catatan);
}

// Tambah (tanpa id) atau ubah kategori langsung dari halaman input.
// Server menolak nama kosong (400) atau ganda tanpa beda huruf (409) dengan pesan di `detail`.
export async function simpanKategoriTatib({ id, nama, deskripsi }) {
  const isian = { nama: (nama || '').trim(), deskripsi: (deskripsi || '').trim() || null };
  if (!isian.nama) throw new Error('Nama kategori wajib diisi');
  const { data } = id ? await api.put(`/tatib/kategori/${id}`, isian) : await api.post('/tatib/kategori', isian);
  return data;
}

// Perbaiki catatan yang salah input; poin dihitung ulang dari jenis yang dipilih.
// Kontrak: PUT /tatib/input/{id} -> catatan; DELETE /tatib/input/{id} (hanya admin).
export async function ubahInputTatib(id, { siswa_id, jenis_id, tanggal, asal_input, keterangan }) {
  const i = catatanTiruan.findIndex((c) => c.id === id);
  if (i < 0) throw new Error('Catatan tidak ditemukan');
  if (!ASAL_INPUT.includes(asal_input)) throw new Error('Asal input wajib dipilih dari daftar');
  const jenis = jenisTiruan.find((j) => j.id === jenis_id);
  if (!jenis) throw new Error('Jenis aturan tidak ditemukan');
  const lama = catatanTiruan[i];
  // Kategori lama dipertahankan bila jenis tidak berganti, agar riwayat tetap konsisten.
  const baru = lengkapiCatatan({ ...lama, siswa_id, jenis_id, tanggal, asal_input, keterangan: keterangan || '' });
  catatanTiruan[i] = lama.jenis_id === jenis_id ? { ...baru, kategori_nama: lama.kategori_nama } : baru;
  return jeda(catatanTiruan[i]);
}

export async function hapusInputTatib(id) {
  catatanTiruan = catatanTiruan.filter((c) => c.id !== id);
  return jeda({ ok: true });
}
