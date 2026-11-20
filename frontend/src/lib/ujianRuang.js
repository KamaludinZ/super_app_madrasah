/**
 * Ujian Madrasah — Ruang & Peserta: ruang ujian (boleh berisi dua jenjang), pengelompokan siswa ke ruang, dan nomor
 * peserta. Penempatan ruang & nomor peserta ditetapkan SEKALI dan berlaku untuk seluruh hari/sesi ujian; perubahan
 * hanya oleh admin dan tercatat di jejak audit.
 *
 * Kontrak server (backend menyusul; koleksi `ruang_ujian`, `peserta_ruang`):
 *   GET /ujian/{ujian_id}/ruang
 *     -> { ujian: Ujian, boleh_ubah, items: [Ruang],
 *          ringkasan: { jumlah_ruang, jumlah_peserta, kapasitas, belum_ditempatkan, per_jenjang: { '7': n, ... } },
 *          plotting: { ditetapkan_pada, diubah_pada, diubah_oleh_nama, jumlah_perubahan, berlaku: 'seluruh_masa_ujian' },
 *          kesiapan: { ruang_kosong: [nama], tanpa_nomor, belum_ditempatkan, siap } }
 *        (admin, ketua & sekretaris panitia ujian itu; boleh_ubah hanya admin; plotting = penempatan pertama & terakhir)
 *   GET /ujian/{ujian_id}/ruang/riwayat
 *     -> { items: [{ id, aksi, oleh_nama, waktu, ringkasan, alasan }] }   (jejak audit ruang & peserta, terbaru dulu)
 *        aksi: ruang_tambah | ruang_ubah | ruang_hapus | peserta_tambah | peserta_hapus | peserta_pindah |
 *              nomor_ubah | impor_template
 *
 *   POST   /ujian/{ujian_id}/ruang { nama_ruang, jenjang: [7, 8], kapasitas, keterangan }  -> Ruang   (admin)
 *   PUT    /ujian/{ujian_id}/ruang/{ruang_id} { ...sama }                                  -> Ruang   (admin;
 *          jenjang yang sudah berisi peserta tidak boleh dilepas -> 409)
 *   DELETE /ujian/{ujian_id}/ruang/{ruang_id}                                              -> { ok }  (admin;
 *          ruang yang masih berisi peserta tidak boleh dihapus -> 409)
 *   Nama ruang unik per ujian; jenjang 1–2 dari 7/8/9; kapasitas 1–60. Semua perubahan tercatat di jejak audit.
 *
 *   Ruang = { id, ujian_id, nama_ruang, jenjang: [7, 8], kapasitas, jumlah_peserta, per_jenjang: { '7': n, '8': m },
 *             keterangan }
 *
 * Bila server belum menyediakan endpoint (404 "Not Found") dipakai data contoh berlabel (`tiruan: true`).
 */
import { api } from '@/lib/api';
import { berandaTiruan, denganTiruan } from '@/lib/ujian';

export const HALAMAN_RUANG_UJIAN = '/ujian/ruang';
export const JENJANG = [7, 8, 9];
export const KAPASITAS_BAWAAN = 32; // satu lembar daftar hadir memuat 32 peserta

export const KAPASITAS_MAKS = 60;
export const NAMA_RUANG_MAKS = 40;
export const KETERANGAN_RUANG_MAKS = 120;

export const labelJenjang = (jenjang = []) => (jenjang.length ? `Kelas ${[...jenjang].sort((a, b) => a - b).join(' + ')}` : 'Belum ada jenjang');

// ---- Data tiruan (disimpan selama sesi agar perubahan terasa saat dicoba) ----
let ruangContoh = null;

function buatRuangContoh() {
  const r = (id, nama, jenjang, perJenjang, keterangan = '') => ({
    id, ujian_id: null, nama_ruang: nama, jenjang, kapasitas: KAPASITAS_BAWAAN, keterangan,
    per_jenjang: perJenjang, jumlah_peserta: Object.values(perJenjang).reduce((a, b) => a + b, 0),
  });
  return [
    r('contoh-r01', '01', [7, 8], { 7: 16, 8: 16 }, 'Gedung A lantai 1'),
    r('contoh-r02', '02', [7, 8], { 7: 16, 8: 15 }, 'Gedung A lantai 1'),
    r('contoh-r03', '03', [7, 9], { 7: 14, 9: 16 }, 'Gedung B lantai 2'),
    r('contoh-r04', '04', [9], { 9: 20 }, 'Laboratorium Komputer'),
  ];
}

export function ruangTiruan(ujianId) {
  if (!ruangContoh) ruangContoh = buatRuangContoh();
  const ujian = berandaTiruan('admin').items.find((u) => u.id === ujianId) || berandaTiruan('admin').items[0];
  const items = ruangContoh.map((r) => ({ ...r, ujian_id: ujian.id }));
  const perJenjang = {};
  items.forEach((r) => Object.entries(r.per_jenjang).forEach(([j, n]) => { perJenjang[j] = (perJenjang[j] || 0) + n; }));
  return {
    ujian,
    boleh_ubah: true,
    items,
    ringkasan: {
      jumlah_ruang: items.length,
      jumlah_peserta: items.reduce((a, r) => a + r.jumlah_peserta, 0),
      kapasitas: items.reduce((a, r) => a + r.kapasitas, 0),
      belum_ditempatkan: 7,
      per_jenjang: perJenjang,
    },
    kesiapan: { ruang_kosong: [], tanpa_nomor: 12, belum_ditempatkan: 7, siap: false },
    plotting: {
      ditetapkan_pada: '2026-11-15T09:00:00+07:00',
      diubah_pada: riwayatContoh()[0]?.waktu || null,
      diubah_oleh_nama: riwayatContoh()[0]?.oleh_nama || null,
      jumlah_perubahan: riwayatContoh().length,
    },
  };
}

export const LABEL_AKSI_PLOTTING = {
  ruang_tambah: 'Tambah ruang',
  ruang_ubah: 'Ubah ruang',
  ruang_hapus: 'Hapus ruang',
  peserta_tambah: 'Tempatkan peserta',
  peserta_hapus: 'Keluarkan peserta',
  peserta_pindah: 'Pindah ruang',
  nomor_ubah: 'Ubah nomor peserta',
  impor_template: 'Impor template',
};

function riwayatContoh() {
  return [
    { id: 'contoh-a4', aksi: 'peserta_pindah', oleh_nama: 'Administrator (contoh)', waktu: '2026-11-18T10:12:00+07:00', ringkasan: 'Bagus Saputra (8A): Ruang 01 → Ruang 02', alasan: 'Menyeimbangkan jumlah peserta ruang' },
    { id: 'contoh-a3', aksi: 'impor_template', oleh_nama: 'Administrator (contoh)', waktu: '2026-11-16T13:40:00+07:00', ringkasan: 'Ruang 03: 16 tersimpan, 1 dilewati', alasan: null },
    { id: 'contoh-a2', aksi: 'nomor_ubah', oleh_nama: 'Administrator (contoh)', waktu: '2026-11-16T08:05:00+07:00', ringkasan: 'Ruang 01: 32 nomor peserta', alasan: null },
    { id: 'contoh-a1', aksi: 'peserta_tambah', oleh_nama: 'Administrator (contoh)', waktu: '2026-11-15T09:00:00+07:00', ringkasan: 'Ruang 01: 32 siswa ditempatkan', alasan: null },
  ];
}

/** Jejak audit ruang & peserta satu ujian -> { items, tiruan }. */
export const muatRiwayatPlotting = (ujianId) => denganTiruan(
  async () => ({ items: (await api.get(`/ujian/${ujianId}/ruang/riwayat`)).data.items || [] }),
  () => ({ items: riwayatContoh() }),
);

/** Ruang ujian satu ujian -> { ujian, boleh_ubah, items, ringkasan, tiruan }. */
export const muatRuangUjian = (ujianId) => denganTiruan(
  async () => (await api.get(`/ujian/${ujianId}/ruang`)).data,
  () => ruangTiruan(ujianId),
);

function galatContoh(status, detail) {
  const e = new Error(detail);
  e.response = { status, data: { detail } };
  return e;
}

/** Tambah ruang -> { ruang, tiruan }. isi = { nama_ruang, jenjang, kapasitas, keterangan }. */
export const tambahRuang = (ujianId, isi) => denganTiruan(
  async () => ({ ruang: (await api.post(`/ujian/${ujianId}/ruang`, isi)).data }),
  () => {
    ruangTiruan(ujianId);
    if (ruangContoh.some((r) => r.nama_ruang.toLowerCase() === isi.nama_ruang.toLowerCase())) throw galatContoh(409, `Ruang ${isi.nama_ruang} sudah ada pada ujian ini`);
    const ruang = { ...isi, id: `contoh-ruang-${Date.now()}`, ujian_id: ujianId, jumlah_peserta: 0, per_jenjang: {} };
    ruangContoh.push(ruang);
    return { ruang };
  },
);

/** Ubah ruang -> { ruang, tiruan }. */
export const ubahRuang = (ujianId, ruangId, isi) => denganTiruan(
  async () => ({ ruang: (await api.put(`/ujian/${ujianId}/ruang/${ruangId}`, isi)).data }),
  () => {
    ruangTiruan(ujianId);
    const r = ruangContoh.find((x) => x.id === ruangId);
    const terisi = Object.entries(r?.per_jenjang || {}).filter(([j, n]) => n > 0 && !isi.jenjang.includes(Number(j)));
    if (terisi.length) throw galatContoh(409, `Kelas ${terisi.map(([j]) => j).join(', ')} masih berisi peserta di ruang ini; pindahkan pesertanya dahulu`);
    Object.assign(r, isi);
    return { ruang: { ...r } };
  },
);

/** Hapus ruang kosong -> { tiruan }. */
export const hapusRuang = (ujianId, ruangId) => denganTiruan(
  async () => { await api.delete(`/ujian/${ujianId}/ruang/${ruangId}`); return {}; },
  () => {
    ruangTiruan(ujianId);
    const r = ruangContoh.find((x) => x.id === ruangId);
    if (r?.jumlah_peserta) throw galatContoh(409, `Ruang ${r.nama_ruang} masih berisi ${r.jumlah_peserta} peserta; kosongkan dahulu`);
    ruangContoh = ruangContoh.filter((x) => x.id !== ruangId);
    return {};
  },
);
