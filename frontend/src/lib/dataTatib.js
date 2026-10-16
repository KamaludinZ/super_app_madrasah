import { api } from '@/lib/api';
import { nilaiPoin } from '@/components/tatib/RingkasanPoin';
import { ASAL_INPUT } from '@/lib/inputTatib';

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
    asal_input: String(c.asal_input ?? '').trim() || null,
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

// Jumlah catatan per asal input (urutan daftar baku), plus 'Belum diisi' untuk catatan lama bila ada.
export function sebaranAsalInput(baris) {
  const n = {};
  baris.forEach((b) => { const k = b.asal_input || null; n[k] = (n[k] || 0) + 1; });
  const hasil = ASAL_INPUT.map((asal) => ({ asal, jumlah: n[asal] || 0 }));
  if (n[null]) hasil.push({ asal: null, jumlah: n[null] });
  return hasil;
}

export const FILTER_DATA_KOSONG = { kategori: '', jenis: '', asal: '', cari: '' };
// Nilai filter asal untuk catatan lama yang belum punya asal input.
export const ASAL_KOSONG = '__belum';

// Pilihan filter dari data yang dimuat: kategori (nama) dan jenis ({id: kode-nama}) — jenis disaring kategori.
export function pilihanFilterData(baris, kategori = '') {
  const kategoriList = [...new Set(baris.map((b) => b.kategori_nama))].sort((a, b) => a.localeCompare(b, 'id'));
  const jenis = new Map();
  baris.filter((b) => !kategori || b.kategori_nama === kategori).forEach((b) => {
    const kunci = b.jenis_id || b.kode_aturan;
    if (!jenis.has(kunci)) jenis.set(kunci, { id: kunci, kode: b.kode_aturan, nama: b.jenis_nama });
  });
  return { kategori: kategoriList, jenis: [...jenis.values()].sort((a, b) => (a.kode || '').localeCompare(b.kode || '')) };
}

// Saring baris menurut kategori (nama), jenis (id/kode), asal input (ASAL_KOSONG = belum diisi), dan kata kunci
// (nama/NIS/NISN/kelas siswa atau asal input).
export function saringData(baris, { kategori, jenis, asal, cari } = {}) {
  const kata = (cari || '').toLowerCase().split(/\s+/).filter(Boolean);
  return baris.filter((b) => {
    if (kategori && b.kategori_nama !== kategori) return false;
    if (jenis && (b.jenis_id || b.kode_aturan) !== jenis) return false;
    if (asal && (asal === ASAL_KOSONG ? Boolean(b.asal_input) : b.asal_input !== asal)) return false;
    if (kata.length) {
      const teks = `${b.siswa_nama} ${b.siswa_nis || ''} ${b.siswa_nisn || ''} ${b.siswa_kelas || ''} ${b.asal_input || ''}`.toLowerCase();
      if (!kata.every((k) => teks.includes(k))) return false;
    }
    return true;
  });
}
