/**
 * Laboratorium (guru IPA/IPS/Bahasa/Seni/Agama/TIK) — endpoint & tipe /lab/{lab_key}/… untuk layar native.
 * lab_key: ipa | ips | bahasa | seni | agama | komputer. Akses dicek server menurut peran aktif (guru lab itu / admin).
 */
import { request } from '@/api/client';

export const LAB_NAMA: Record<string, string> = {
  ipa: 'Lab IPA', ips: 'Lab IPS', bahasa: 'Lab Bahasa', seni: 'Lab Seni', agama: 'Lab Agama', komputer: 'Lab Komputer',
};
export const MENU_LAB: Record<string, string> = {
  'alat-bahan': 'Alat dan Bahan', jadwal: 'Jadwal Penggunaan', 'jurnal-penggunaan': 'Jurnal Penggunaan',
  'jurnal-pengelolaan': 'Jurnal Pengelolaan', 'peminjaman-alat': 'Peminjaman Alat', kerusakan: 'Laporan Kerusakan',
};

export type LabMeta = { kategori_alat_bahan: string[]; kerusakan_status: string[]; hari: string[] };
export type AlatBahan = {
  id: string; aset_tipe: 'tetap' | 'lancar'; nama: string; sumber_dana?: string; kategori?: string | null; satuan?: string | null;
  lokasi_penyimpanan?: string | null; ruangan_id?: string | null; ruangan_nama?: string | null; keterangan?: string | null;
  jumlah_baik?: number; jumlah_rusak?: number; stok?: number; stok_minimum?: number;
};
export type AlatBahanList = { room: { id: string; name: string }; items: AlatBahan[] };
export type JadwalLab = {
  id: string; minggu_ke: number; hari: string; jam_mulai?: string | null; jam_selesai?: string | null; jp_mulai?: number | null; jp_selesai?: number | null;
  kelas: string; guru_nama: string; keterangan?: string | null;
};
export type JurnalPenggunaan = {
  id: string; tanggal: string; jam_mulai?: string | null; jam_selesai?: string | null; judul_percobaan: string; alat_bahan_digunakan?: string | null;
  kegiatan?: string | null; kondisi_setelah?: string | null; keterangan?: string | null; pengguna_nama?: string | null; penanggung_jawab_nama?: string | null;
};
export type JurnalPengelolaan = {
  id: string; aset_tipe: string; aset_id: string; aset_nama?: string | null; tanggal: string; jenis_perawatan: string; petugas_pelaksana?: string | null;
  biaya?: number | null; hasil?: string | null; keterangan?: string | null;
};
export type PeminjamanAlat = {
  id: string; aset_tipe: 'tetap' | 'lancar'; aset_id: string; aset_nama?: string | null; peminjam_id: string; peminjam_nama?: string | null;
  tanggal_pinjam: string; tanggal_kembali_rencana?: string | null; tanggal_kembali_aktual?: string | null; jumlah: number; status?: string | null;
  keperluan?: string | null; catatan?: string | null;
};
export type KerusakanLab = {
  id: string; aset_tipe: string; aset_id: string; aset_nama?: string | null; tanggal_lapor: string; pelapor_id?: string | null; pelapor_nama?: string | null;
  jumlah_rusak: number; deskripsi_kerusakan: string; status?: string | null; tanggal_perbaikan?: string | null; biaya_perbaikan?: number | null; hasil_perbaikan?: string | null;
};
export type Warga = { id: string; full_name: string; nis?: string | null; nip_nuptk?: string | null; roles?: string[] };

const base = (lab: string) => `/lab/${lab}`;
export const labApi = {
  meta: (lab: string) => request<LabMeta>(`${base(lab)}/meta`),
  alatBahan: (lab: string) => request<AlatBahanList>(`${base(lab)}/alat-bahan`),
  simpanAlatBahan: (lab: string, item: AlatBahan | null, body: Record<string, unknown>) =>
    request(item ? `${base(lab)}/alat-bahan/${item.aset_tipe}/${item.id}` : `${base(lab)}/alat-bahan`, { method: item ? 'PUT' : 'POST', body }),
  hapusAlatBahan: (lab: string, item: AlatBahan) => request(`${base(lab)}/alat-bahan/${item.aset_tipe}/${item.id}`, { method: 'DELETE' }),
  daftar: <T>(lab: string, menu: string) => request<T[]>(`${base(lab)}/${menu}`),
  simpan: (lab: string, menu: string, id: string | null, body: Record<string, unknown>) =>
    request(id ? `${base(lab)}/${menu}/${id}` : `${base(lab)}/${menu}`, { method: id ? 'PUT' : 'POST', body }),
  hapus: (lab: string, menu: string, id: string) => request(`${base(lab)}/${menu}/${id}`, { method: 'DELETE' }),
  guruLab: (lab: string) => request<{ id: string; full_name: string }[]>(`${base(lab)}/guru-lab`),
  warga: (lab: string, search: string) => request<Warga[]>(`${base(lab)}/warga-madrasah`, { query: { search } }),
};
