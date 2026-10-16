import { api } from '@/lib/api';
import { konteksPeriode } from '@/lib/poinTatib';

// Input Tata Tertib terpadu: siswa → kategori → jenis aturan (poin otomatis) → tanggal & keterangan.
// Semua data lewat API, kecuali daftar siswa yang SEMENTARA masih data tiruan. Kontrak:
//   GET  /tatib/kategori            -> [{ id, nama, deskripsi }]
//   GET  /tatib/jenis-aturan        -> [{ id, kode_aturan, nama, jalur_poin: 'minus'|'plus', besar_poin, poin, kategori_id, kategori_nama, deskripsi, aktif }]
//   GET  /students                  -> [{ id, nis, nisn, full_name, class_name }]
//   GET  /tatib/input/terbaru       -> { items: [{ id, siswa_*, kode_aturan, jenis_nama, kategori_nama, poin, tanggal, asal_input, keterangan, petugas_nama }], ada_lagi }
//   PUT  /tatib/input/{id}          -> catatan ; DELETE /tatib/input/{id} (hanya admin)
//   POST /tatib/input               -> { siswa_id, jenis_id, tanggal, asal_input, keterangan } ; poin dihitung server dari jenis

// Sumber pencatatan (daftar baku); disimpan bersama catatan dan tampil di laporan/rekap.
export const ASAL_INPUT = ['BIPH', 'Screening pagi', 'Ibadah', 'Keputrian', 'Whatsapp', 'BAP', 'Razia', 'Laporan langsung'];

const jeda = (data) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), 150));

const siswaTiruan = [
  { id: 'sis-1', nis: '2401', nisn: '0098765401', full_name: 'Ahmad Fauzan', class_name: 'VII A' },
  { id: 'sis-2', nis: '2402', nisn: '0098765402', full_name: 'Aisyah Putri Ramadhani', class_name: 'VII A' },
  { id: 'sis-3', nis: '2315', nisn: '0098765315', full_name: 'Muhammad Rizki Pratama', class_name: 'VIII B' },
  { id: 'sis-4', nis: '2316', nisn: '0098765316', full_name: 'Nur Halimah', class_name: 'VIII B' },
  { id: 'sis-5', nis: '2207', nisn: '0098765207', full_name: 'Fikri Hidayatullah', class_name: 'IX C' },
];

// Poin bertanda mengikuti master jenis: jalur 'minus' -> negatif, 'plus' -> positif.
export function poinJenis(jenis) {
  if (!jenis) return null;
  const besar = Math.abs(Number(jenis.besar_poin) || 0);
  return jenis.jalur_poin === 'minus' ? -besar : besar;
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
export async function ambilRiwayatInputTerbaru({ batas = 10, siswa_id } = {}) {
  const params = { batas };
  if (siswa_id) params.siswa_id = siswa_id;
  const { data } = await api.get('/tatib/input/terbaru', { params });
  return { items: data?.items || [], ada_lagi: Boolean(data?.ada_lagi) };
}

// Simpan pencatatan; poin dihitung server dari master jenis (tidak dikirim). Semester & tahun takwim
// yang sedang dilihat pengguna ikut disimpan (sama seperti Catat Poin Tatib).
export async function simpanInputTatib({ siswa_id, jenis_id, tanggal, asal_input, keterangan }) {
  if (!ASAL_INPUT.includes(asal_input)) throw new Error('Asal input wajib dipilih dari daftar');
  const periode = await konteksPeriode();
  const { data } = await api.post('/tatib/input', {
    siswa_id, jenis_id, tanggal, asal_input, keterangan: (keterangan || '').trim() || null, ...periode,
  });
  return data;
}

// Tambah (tanpa id) atau ubah kategori langsung dari halaman input.
// Server menolak nama kosong (400) atau ganda tanpa beda huruf (409) dengan pesan di `detail`.
export async function simpanKategoriTatib({ id, nama, deskripsi }) {
  const isian = { nama: (nama || '').trim(), deskripsi: (deskripsi || '').trim() || null };
  if (!isian.nama) throw new Error('Nama kategori wajib diisi');
  const { data } = id ? await api.put(`/tatib/kategori/${id}`, isian) : await api.post('/tatib/kategori', isian);
  return data;
}

// Perbaiki catatan yang salah input; poin dihitung ulang server dari jenis yang dipilih.
export async function ubahInputTatib(id, { siswa_id, jenis_id, tanggal, asal_input, keterangan }) {
  if (!ASAL_INPUT.includes(asal_input)) throw new Error('Asal input wajib dipilih dari daftar');
  const { data } = await api.put(`/tatib/input/${id}`, {
    siswa_id, jenis_id, tanggal, asal_input, keterangan: (keterangan || '').trim() || null,
  });
  return data;
}

// Hapus catatan (server hanya mengizinkan admin).
export async function hapusInputTatib(id) {
  const { data } = await api.delete(`/tatib/input/${id}`);
  return data;
}
