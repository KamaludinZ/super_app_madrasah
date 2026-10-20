import { api } from '@/lib/api';

// Rekap hasil penilaian kinerja per periode (backend/routers/pkg_rekap_api.py).
//   GET /pkg/rekap?periode_id= -> rekap   (periode bawaan: periode berjalan)
//   GET /pkg/rekap/guru/{guru_id}?periode_id= -> rincian  (hanya lembar dalam cakupan pengguna; di luar cakupan 403)
//   GET /pkg/rekap/guru/{guru_id}/kompetensi?periode_id= -> modelKompetensi  (cakupan sama dengan rincian)
//   GET /pkg/rekap/periode -> [{ id, nama_periode, tahun_pelajaran, semester, status }]  (periode tempat pengguna personil)
// rekap = { periode, sk: { id, nomor_sk } | null, cakupan: 'semua' | 'penilai' | 'pribadi',
//           ringkasan: { total, terkunci, draf, belum, rata_capaian }, statistik, guru: [baris] }
// baris = { guru_id, nama, nip, mapel, penilai_nama, status: 'belum'|'draf'|'terkunci', nilai_akhir, nilai_maks,
//           capaian_persen, level_capaian, predikat, terkunci_pada, per_kompetensi: { kode: subtotal } }
// rincian = { periode, guru: { id, nama, nip, mapel }, penilai_nama, status, hasil | null, catatan_umum,
//             instrumen: { id, versi_template, revisi, kompetensi } | null, isian }
// modelKompetensi = { periode, guru, penilai_nama, status, instrumen | null, model | null, level_guru | null }
// nilai_akhir_360 = { komponen: [{ kunci, label, hasil, proporsi, nilai, jumlah_responden }], nilai_kompetensi,
//   tidak_hadir_hari, indeks_kehadiran_persen, nilai_akhir, predikat, level_teks, lengkap, angket_kurang, kehadiran_terisi }
// level_guru = { normal, plus_360, rata, simpulan, deskripsi: { pedagogik, kepribadian, sosial, profesional, umum } | null }
// model = { kompetensi: [{ kode, nama, label, jumlah_skor, skor_maks, sub: [{ no, kode, nama, nilai_rating, tingkat,
//           skor_maks }] }], total_skor, skor_maks, nkg, level_capaian, predikat, terisi, jumlah_sub }
// Cakupan: kepala madrasah melihat semua guru; penilai melihat guru yang dinilainya; guru yang dinilai hanya
// melihat hasilnya sendiri setelah lembar dikunci. Nilai hanya dihitung untuk lembar terkunci.

async function panggil(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    const d = e?.response?.data?.detail;
    throw new Error(typeof d === 'string' ? d : d?.pesan || cadangan);
  }
}

export const ambilRekap = ({ periodeId } = {}) => panggil(
  () => api.get('/pkg/rekap', { params: periodeId ? { periode_id: periodeId } : {} }), 'Gagal memuat rekap.',
);

export const daftarPeriodeRekap = () => panggil(() => api.get('/pkg/rekap/periode'), 'Gagal memuat daftar periode.');

export const ambilRekapGuru = (guruId, periodeId) => panggil(
  () => api.get(`/pkg/rekap/guru/${guruId}`, { params: periodeId ? { periode_id: periodeId } : {} }), 'Gagal memuat rekap guru.',
);

export const ambilModelKompetensi = (guruId, periodeId) => panggil(
  () => api.get(`/pkg/rekap/guru/${guruId}/kompetensi`, { params: periodeId ? { periode_id: periodeId } : {} }),
  'Gagal memuat rekap model kompetensi.',
);

// Urutan status untuk peringkat: terkunci (punya nilai) dulu, lalu draf, lalu belum.
const URUT_STATUS = { terkunci: 0, draf: 1, belum: 2 };

// Kelompokkan baris rekap per penilai (tim dalam satu SK) dan urutkan anggotanya.
// urut: 'capaian' (tertinggi dulu) | 'nama'. Hasil: [{ penilai_nama, guru: [baris + peringkat], terkunci, rata_capaian }].
export function kelompokkanPerTim(guru = [], urut = 'capaian') {
  const tim = new Map();
  guru.forEach((g) => {
    const kunci = g.penilai_nama || 'Belum dibagikan';
    if (!tim.has(kunci)) tim.set(kunci, []);
    tim.get(kunci).push(g);
  });
  const banding = urut === 'nama'
    ? (a, b) => a.nama.localeCompare(b.nama, 'id')
    : (a, b) => (URUT_STATUS[a.status] - URUT_STATUS[b.status]) || ((b.capaian_persen ?? -1) - (a.capaian_persen ?? -1)) || a.nama.localeCompare(b.nama, 'id');
  return [...tim.entries()].map(([penilai_nama, daftar]) => {
    const terurut = [...daftar].sort(banding);
    const dinilai = terurut.filter((g) => g.capaian_persen != null);
    let peringkat = 0;
    return {
      penilai_nama,
      guru: terurut.map((g) => ({ ...g, peringkat: g.capaian_persen != null ? (peringkat += 1) : null })),
      terkunci: dinilai.length,
      rata_capaian: dinilai.length ? Math.round((dinilai.reduce((n, g) => n + g.capaian_persen, 0) / dinilai.length) * 100) / 100 : null,
    };
  }).sort((a, b) => a.penilai_nama.localeCompare(b.penilai_nama, 'id'));
}

// Urutan tetap predikat jenjang (rumus template 04-RKAP-PKG!F45), dari capaian terendah ke tertinggi.
export const URUTAN_PREDIKAT = [
  { kunci: 'Terpenuhi pada Jenjang Jabatan Guru Ahli Pertama', label: 'Ahli Pertama', rentang: '≤ 55%' },
  { kunci: 'Terpenuhi pada Jenjang Jabatan Guru Ahli Muda', label: 'Ahli Muda', rentang: '55–75%' },
  { kunci: 'Terpenuhi pada Jenjang Jabatan Guru Ahli Madya', label: 'Ahli Madya', rentang: '75–90%' },
  { kunci: 'Terpenuhi pada Jenjang Jabatan Guru Ahli Utama', label: 'Ahli Utama', rentang: '> 90%' },
];

const bulat2 = (n) => Math.round(n * 100) / 100;

// Statistik capaian dari lembar terkunci: jumlah, rata-rata, median, tertinggi, terendah, dan sebaran predikat
// (semua kelas predikat selalu ada, termasuk yang nol, dalam URUTAN_PREDIKAT).
export function hitungStatistik(guru = []) {
  const nilai = guru.filter((g) => g.status === 'terkunci' && g.capaian_persen != null);
  const capaian = nilai.map((g) => g.capaian_persen).sort((a, b) => a - b);
  const n = capaian.length;
  const median = n ? (n % 2 ? capaian[(n - 1) / 2] : (capaian[n / 2 - 1] + capaian[n / 2]) / 2) : null;
  const tertinggi = n ? nilai.reduce((a, b) => (b.capaian_persen > a.capaian_persen ? b : a)) : null;
  const terendah = n ? nilai.reduce((a, b) => (b.capaian_persen < a.capaian_persen ? b : a)) : null;
  return {
    jumlah: n,
    rata: n ? bulat2(capaian.reduce((a, b) => a + b, 0) / n) : null,
    median: median == null ? null : bulat2(median),
    tertinggi: tertinggi && { nilai: tertinggi.capaian_persen, nama: tertinggi.nama },
    terendah: terendah && { nilai: terendah.capaian_persen, nama: terendah.nama },
    sebaranPredikat: URUTAN_PREDIKAT.map((p) => {
      const jumlah = nilai.filter((g) => g.predikat === p.kunci).length;
      return { ...p, jumlah, persen: n ? bulat2((jumlah / n) * 100) : 0 };
    }),
  };
}
