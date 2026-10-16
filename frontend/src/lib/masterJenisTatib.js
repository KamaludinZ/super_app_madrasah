// Master Jenis Pelanggaran: kelola jenis aturan (kode, nama, jalur poin, besar poin, kategori, deskripsi, aktif).
// Semua data lewat API. Kontrak:
//   GET    /tatib/jenis-aturan                  -> [{ id, kode_aturan, nama, jalur_poin, besar_poin, poin, kategori_id,
//                                                     kategori_nama, deskripsi, aktif, jumlah_catatan }]
//   POST   /tatib/jenis-aturan                  -> jenis ; PUT /tatib/jenis-aturan/{id} -> jenis
//   PATCH  /tatib/jenis-aturan/{id}/aktif       -> { aktif } (nonaktif tanpa menghapus riwayat)
//   GET    /tatib/kategori                      -> [{ id, nama }]

import { api } from '@/lib/api';
import { ambilKategoriTatib, simpanKategoriTatib } from '@/lib/inputTatib';

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
  const { data } = await api.patch(`/tatib/jenis-aturan/${id}/aktif`, { aktif: Boolean(aktif) });
  return data;
}
