import { api } from '@/lib/api';

// Komponen kehadiran PKG (sheet INDEK-HDIR) — backend/routers/pkg_kehadiran_api.py & backend/pkg_kehadiran.py.
//   GET /pkg/kehadiran/ringkasan?periode_id= -> { periode, guru: [{ guru_id, nama, mapel, penilai_nama, status, terisi,
//        indeks, indeks_persen, jumlah }] }
//   GET /pkg/kehadiran/{guru_id}?periode_id= -> { periode, guru, terisi, bulan: [baris], jumlah, indeks, indeks_persen,
//        diinput_oleh_nama, diubah_pada }
//   PUT /pkg/kehadiran/{guru_id} { periode_id?, bulan: [{ bulan: 'YYYY-MM', terlambat_menit, pulang_cepat_menit,
//        tanpa_keterangan, hadir, izin, sakit }] }  (hanya periode berjalan; mengganti data sebelumnya)
// Rumus (sama dengan backend): jumlah menit = terlambat + pulang cepat; konversi = menit / 480 (hari);
// tidak hadir = konversi + tanpa keterangan; indeks kehadiran = 1 - total tidak hadir / 46. Hadir/izin/sakit hanya
// informasi (tidak masuk rumus template).

export const MENIT_PER_HARI = 8 * 60;
export const PEMBAGI_HARI = 46;
export const KOLOM_INPUT = [
  { kunci: 'terlambat_menit', label: 'Terlambat', satuan: 'menit', maks: 20000, rumus: true },
  { kunci: 'pulang_cepat_menit', label: 'Pulang cepat', satuan: 'menit', maks: 20000, rumus: true },
  { kunci: 'tanpa_keterangan', label: 'Tanpa keterangan', satuan: 'hari', maks: 31, rumus: true },
  { kunci: 'hadir', label: 'Hadir', satuan: 'hari', maks: 31 },
  { kunci: 'izin', label: 'Izin', satuan: 'hari', maks: 31 },
  { kunci: 'sakit', label: 'Sakit', satuan: 'hari', maks: 31 },
];

export function hitungBulan(b) {
  const menit = (Number(b.terlambat_menit) || 0) + (Number(b.pulang_cepat_menit) || 0);
  const konversi = menit / MENIT_PER_HARI;
  const tidakHadir = konversi + (Number(b.tanpa_keterangan) || 0);
  return { menit, konversi, tidakHadir, persenHadir: 1 - tidakHadir / PEMBAGI_HARI };
}

export function hitungIndeks(bulan = []) {
  const tidakHadir = bulan.reduce((a, b) => a + hitungBulan(b).tidakHadir, 0);
  return { tidakHadir, indeks: 1 - tidakHadir / PEMBAGI_HARI };
}

async function panggil(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    const d = e?.response?.data?.detail;
    throw new Error(typeof d === 'string' ? d : d?.pesan || cadangan);
  }
}

const params = (periodeId) => ({ params: periodeId ? { periode_id: periodeId } : {} });

export const ringkasanKehadiran = (periodeId) => panggil(() => api.get('/pkg/kehadiran/ringkasan', params(periodeId)), 'Gagal memuat ringkasan kehadiran.');
export const ambilKehadiranGuru = (guruId, periodeId) => panggil(() => api.get(`/pkg/kehadiran/${guruId}`, params(periodeId)), 'Gagal memuat kehadiran guru.');
export const simpanKehadiran = (guruId, { periodeId, bulan }) => panggil(
  () => api.put(`/pkg/kehadiran/${guruId}`, {
    periode_id: periodeId || undefined,
    bulan: bulan.map((b) => Object.fromEntries([['bulan', b.bulan], ...KOLOM_INPUT.map((k) => [k.kunci, Number(b[k.kunci]) || 0])])),
  }),
  'Gagal menyimpan rekap kehadiran.',
);
