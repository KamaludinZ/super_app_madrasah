// Master Jenis Pelanggaran: kelola jenis aturan (kode, nama, jalur poin, besar poin, kategori, deskripsi, aktif).
// Daftar, kategori, dan simpan jenis lewat API; status aktif SEMENTARA masih data tiruan di memori. Kontrak:
//   GET    /tatib/jenis-aturan                  -> [{ id, kode_aturan, nama, jalur_poin, besar_poin, poin, kategori_id,
//                                                     kategori_nama, deskripsi, aktif, jumlah_catatan }]
//   POST   /tatib/jenis-aturan                  -> jenis ; PUT /tatib/jenis-aturan/{id} -> jenis
//   PATCH  /tatib/jenis-aturan/{id}/aktif       -> { aktif } (nonaktif tanpa menghapus riwayat)
//   GET    /tatib/kategori                      -> [{ id, nama }]

import { api } from '@/lib/api';
import { ambilKategoriTatib, simpanKategoriTatib } from '@/lib/inputTatib';

const jeda = (data) => new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), 150));

const kategoriTiruan = [
  { id: 'kat-kedisiplinan', nama: 'Kedisiplinan' },
  { id: 'kat-kerapian', nama: 'Kerapian' },
  { id: 'kat-akhlak', nama: 'Akhlak & Ibadah' },
];

const jenisTiruan = [
  { id: 'jen-1', kode_aturan: 'DIS-01', nama: 'Terlambat masuk madrasah', jalur_poin: 'minus', besar_poin: 5, kategori_id: 'kat-kedisiplinan', deskripsi: 'Datang setelah bel masuk', aktif: true, jumlah_catatan: 12 },
  { id: 'jen-2', kode_aturan: 'DIS-02', nama: 'Membolos jam pelajaran', jalur_poin: 'minus', besar_poin: 15, kategori_id: 'kat-kedisiplinan', deskripsi: '', aktif: true, jumlah_catatan: 3 },
  { id: 'jen-3', kode_aturan: 'KER-01', nama: 'Seragam tidak sesuai jadwal', jalur_poin: 'minus', besar_poin: 5, kategori_id: 'kat-kerapian', deskripsi: '', aktif: true, jumlah_catatan: 0 },
  { id: 'jen-5', kode_aturan: 'AKH-01', nama: 'Menjadi imam/muadzin salat berjamaah', jalur_poin: 'plus', besar_poin: 5, kategori_id: 'kat-akhlak', deskripsi: '', aktif: true, jumlah_catatan: 7 },
  { id: 'jen-7', kode_aturan: 'AKH-03', nama: 'Berkata kasar kepada teman', jalur_poin: 'minus', besar_poin: 10, kategori_id: 'kat-akhlak', deskripsi: '', aktif: false, jumlah_catatan: 2 },
];

const namaKategori = (id) => kategoriTiruan.find((k) => k.id === id)?.nama || 'Lainnya';

const tampil = (j) => ({
  ...j,
  kategori_nama: namaKategori(j.kategori_id),
  poin: j.jalur_poin === 'minus' ? -Math.abs(j.besar_poin) : Math.abs(j.besar_poin),
});

// Jenis lain yang sudah memakai kode yang sama (tanpa beda huruf/spasi tepi), atau null. `kecualiId` = jenis yang sedang diubah.
export function cariKodeGanda(jenisList, kode, kecualiId) {
  const kunci = (kode || '').trim().toUpperCase();
  if (!kunci) return null;
  return jenisList.find((j) => j.id !== kecualiId && (j.kode_aturan || '').trim().toUpperCase() === kunci) || null;
}

// Semua jenis termasuk nonaktif, beserta jumlah_catatan; `cari` opsional (kode/nama, disaring server).
export async function ambilMasterJenis({ cari } = {}) {
  const { data } = await api.get('/tatib/jenis-aturan', { params: cari ? { cari } : {} });
  return data || [];
}

export const ambilKategoriMaster = ambilKategoriTatib;

// Tambah (tanpa id) atau ubah jenis aturan. Server menormalkan kode (huruf besar) dan menolak kode ganda (409)
// atau kategori yang tidak ada (404) dengan pesan di `detail`.
export async function simpanMasterJenis({ id, kode_aturan, nama, jalur_poin, besar_poin, kategori_id, deskripsi }) {
  const isian = {
    kode_aturan: (kode_aturan || '').trim().toUpperCase(),
    nama: (nama || '').trim(),
    jalur_poin,
    besar_poin: Math.abs(parseInt(besar_poin, 10) || 0),
    kategori_id,
    deskripsi: (deskripsi || '').trim() || null,
  };
  const { data } = id ? await api.put(`/tatib/jenis-aturan/${id}`, isian) : await api.post('/tatib/jenis-aturan', isian);
  return data;
}

// Tambah kategori dari form jenis (endpoint sama dengan Input Tata Tertib: POST /tatib/kategori).
export const simpanKategoriMaster = ({ nama, deskripsi }) => simpanKategoriTatib({ nama, deskripsi });

// Aktif/nonaktifkan jenis. Jenis nonaktif tidak bisa dipilih saat mencatat, tetapi riwayat catatannya tetap ada.
export async function ubahStatusJenis(id, aktif) {
  const j = jenisTiruan.find((x) => x.id === id);
  if (!j) throw new Error('Jenis aturan tidak ditemukan');
  j.aktif = Boolean(aktif);
  return jeda(tampil(j));
}
