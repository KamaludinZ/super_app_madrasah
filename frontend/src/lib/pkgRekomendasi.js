import { api } from '@/lib/api';

// Rekomendasi PKB per guru per periode (backend/routers/pkg_rekomendasi_api.py), oleh penilai maupun kepala madrasah.
//   GET /pkg/rekomendasi-pkb/opsi -> { opsi: [{ kode, label }], fokus: [{ kode, label }] }
//   GET /pkg/rekomendasi-pkb/ringkasan?periode_id= -> { periode, guru: [{ guru_id, nama, mapel, status, level_capaian, rekomendasi | null }] }
//   GET /pkg/rekomendasi-pkb/{guru_id}?periode_id= -> { periode, guru, status_penilaian, level_guru, level_acuan, saran: [kode],
//        rekomendasi: { pilihan_pkb, fokus_kompetensi, catatan, disusun_oleh_nama, peran_penyusun, tanggal, teks } | null }
//   PUT /pkg/rekomendasi-pkb/{guru_id} { periode_id?, pilihan_pkb, fokus_kompetensi, catatan } (minimal satu opsi atau catatan;
//        hanya periode berjalan). Teks rekomendasi tampil di rekap & berkas cetak.

async function panggil(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    const d = e?.response?.data?.detail;
    throw new Error(typeof d === 'string' ? d : d?.pesan || cadangan);
  }
}

const params = (periodeId) => ({ params: periodeId ? { periode_id: periodeId } : {} });

export const opsiPkb = () => panggil(() => api.get('/pkg/rekomendasi-pkb/opsi'), 'Gagal memuat opsi PKB.');
export const ringkasanPkb = (periodeId) => panggil(() => api.get('/pkg/rekomendasi-pkb/ringkasan', params(periodeId)), 'Gagal memuat rekomendasi PKB.');
export const ambilRekomendasiGuru = (guruId, periodeId) => panggil(() => api.get(`/pkg/rekomendasi-pkb/${guruId}`, params(periodeId)), 'Gagal memuat rekomendasi PKB guru.');
export const simpanRekomendasi = (guruId, { periodeId, pilihan, fokus, catatan }) => panggil(
  () => api.put(`/pkg/rekomendasi-pkb/${guruId}`, {
    periode_id: periodeId || undefined, pilihan_pkb: pilihan, fokus_kompetensi: fokus, catatan: catatan || null,
  }),
  'Gagal menyimpan rekomendasi PKB.',
);
