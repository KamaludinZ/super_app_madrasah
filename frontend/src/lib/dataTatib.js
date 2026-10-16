import { api } from '@/lib/api';
import { nilaiPoin } from '@/components/tatib/RingkasanPoin';

// Data Tata Tertib (struktur baru): daftar catatan poin dengan kategori, kode & jenis aturan, jalur, poin,
// asal input, dan keterangan. Sumber: GET /tatib/penanganan (server membatasi cakupan per peran;
// tiap catatan memuat poin, jenis_poin, asal_input, keterangan — catatan lama ikut diterjemahkan).

// Bentuk baris tampilan dari satu catatan server.
export function barisCatatan(c) {
  const poin = nilaiPoin(c);
  return {
    id: c.id,
    tanggal: (c.tanggal || '').slice(0, 10),
    siswa_id: c.siswa_id,
    siswa_nama: c.siswa_nama || '-',
    siswa_nis: c.siswa_nis,
    siswa_nisn: c.siswa_nisn,
    siswa_kelas: c.siswa_kelas,
    kategori_id: c.kategori_id || null,
    kategori_nama: c.kategori_nama || 'Lainnya',
    jenis_id: c.jenis_id || c.tatib_id || null,
    kode_aturan: c.kode_aturan || c.tatib_kode || '-',
    jenis_nama: c.tatib_nama || c.jenis_nama || '-',
    jalur_poin: poin < 0 ? 'minus' : 'plus',
    poin,
    asal_input: c.asal_input || null,
    keterangan: c.keterangan ?? c.catatan ?? null,
    petugas_nama: c.petugas_nama || '-',
    semester_id: c.semester_id || null,
  };
}

export async function ambilDataTatib(params = {}) {
  const bersih = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null));
  const { data } = await api.get('/tatib/penanganan', { params: bersih });
  return (data || []).map(barisCatatan);
}

// Ringkasan angka dari baris yang sedang ditampilkan.
export function ringkasData(baris) {
  const minus = baris.filter((b) => b.poin < 0);
  const plus = baris.filter((b) => b.poin > 0);
  return {
    jumlah: baris.length,
    siswa: new Set(baris.map((b) => b.siswa_id)).size,
    jumlah_pelanggaran: minus.length,
    jumlah_kebaikan: plus.length,
    total_minus: minus.reduce((s, b) => s + b.poin, 0),
    total_plus: plus.reduce((s, b) => s + b.poin, 0),
  };
}
