import { levelCapaian, predikatJenjang } from '@/lib/pkgPenilaian';

// Rekap hasil penilaian kinerja per periode.
//
// TIRUAN SEMENTARA: meniru kontrak yang direncanakan; saat endpoint backend tersedia ganti dengan `api`:
//   GET /pkg/rekap?periode_id= -> rekap   (periode bawaan: periode berjalan)
//   GET /pkg/rekap/guru/{guru_id}?periode_id= -> rincian  (hanya lembar dalam cakupan pengguna)
//   GET /pkg/rekap/periode -> [{ id, nama_periode, tahun_pelajaran, semester, status }]  (terbaru dulu)
// rincian = { periode, guru: { id, nama, nip, mapel }, penilai_nama, status, hasil | null, catatan_umum,
//             instrumen: { id, versi_template, revisi, kompetensi }, isian: { kode_sub: { centang, catatan_bukti, tanggapan } } }
// rekap = { periode, sk: { id, nomor_sk } | null, cakupan: 'semua' | 'penilai' | 'pribadi', ringkasan: { total, terkunci, draf, belum, rata_capaian },
//           guru: [baris] }
// baris = { guru_id, nama, nip, mapel, penilai_nama, status: 'belum'|'draf'|'terkunci', nilai_akhir, nilai_maks,
//           capaian_persen, level_capaian, predikat, terkunci_pada, per_kompetensi: { kode: subtotal } }
// Cakupan: kepala madrasah melihat semua guru; penilai melihat guru yang dinilainya; guru yang dinilai hanya
// melihat hasilnya sendiri setelah lembar dikunci. Nilai hanya dihitung untuk lembar terkunci.

const tunda = (hasil, ms = 200) => new Promise((r) => { setTimeout(() => r(JSON.parse(JSON.stringify(hasil))), ms); });

function baris(guru_id, nama, nip, mapel, penilai_nama, status, perKompetensi = null, terkunci_pada = null) {
  const nilai = perKompetensi ? Object.values(perKompetensi).reduce((a, b) => a + b, 0) : null;
  const persen = nilai == null ? null : Math.round((nilai / 60) * 10000) / 100;
  return {
    guru_id, nama, nip, mapel, penilai_nama, status,
    nilai_akhir: nilai, nilai_maks: 60, capaian_persen: persen,
    level_capaian: persen == null ? null : levelCapaian(persen),
    predikat: persen == null ? null : predikatJenjang(persen),
    terkunci_pada, per_kompetensi: perKompetensi || {},
  };
}

const GURU = [
  baris('g1', 'Ahmad Fauzi, S.Pd.', '198703122019031004', 'Matematika', 'Drs. H. Mahmud, M.Pd.', 'terkunci', { 1: 12, 2: 11, 3: 10, 4: 13 }, '2026-10-15T09:00:00+07:00'),
  baris('g2', 'Siti Rahmawati, S.Ag.', '199001252020122012', 'Akidah Akhlak', 'Ahmad Fauzi, S.Pd.', 'terkunci', { 1: 9, 2: 10, 3: 8, 4: 9 }, '2026-10-16T10:30:00+07:00'),
  baris('g3', 'Dedi Kurniawan, M.Pd.', '198511082014031002', 'Bahasa Inggris', 'Drs. H. Mahmud, M.Pd.', 'terkunci', { 1: 14, 2: 14, 3: 13, 4: 15 }, '2026-10-17T08:15:00+07:00'),
  baris('g4', 'Nur Aini, S.Si.', null, 'IPA', 'Ahmad Fauzi, S.Pd.', 'draf'),
  baris('g5', 'Rina Kartika, S.Pd.', '199204172022212008', 'Bahasa Indonesia', 'Dedi Kurniawan, M.Pd.', 'terkunci', { 1: 7, 2: 8, 3: 7, 4: 8 }, '2026-10-18T13:00:00+07:00'),
  baris('g6', 'Hasan Basri, S.Pd.I.', '198309202009011007', 'Fikih', 'Dedi Kurniawan, M.Pd.', 'belum'),
];

const PERIODE_TIRUAN = [
  { id: 'p-2026-ganjil', nama_periode: 'PKG Semester Ganjil 2026/2027', tahun_pelajaran: '2026/2027', semester: 'Ganjil', status: 'berjalan' },
  { id: 'p-2025-genap', nama_periode: 'PKG Semester Genap 2025/2026', tahun_pelajaran: '2025/2026', semester: 'Genap', status: 'ditutup' },
  { id: 'p-2025-ganjil', nama_periode: 'PKG Semester Ganjil 2025/2026', tahun_pelajaran: '2025/2026', semester: 'Ganjil', status: 'ditutup' },
];

export const daftarPeriodeRekap = () => tunda(PERIODE_TIRUAN);

// Periode lama (tiruan): semua lembar sudah terkunci dengan nilai sedikit berbeda.
function guruPeriode(periodeId) {
  if (!periodeId || periodeId === PERIODE_TIRUAN[0].id) return GURU;
  const geser = periodeId === 'p-2025-genap' ? -1 : -2;
  return GURU.map((g, i) => baris(g.guru_id, g.nama, g.nip, g.mapel, g.penilai_nama, 'terkunci',
    Object.fromEntries(['1', '2', '3', '4'].map((k) => [k, Math.max(3, Math.min(15, (g.per_kompetensi[k] || 9 + (i % 3)) + geser))])),
    '2026-04-25T09:00:00+07:00'));
}

export async function ambilRekap({ periodeId } = {}) {
  const periode = PERIODE_TIRUAN.find((p) => p.id === periodeId) || PERIODE_TIRUAN[0];
  const guru = guruPeriode(periode.id);
  const terkunci = guru.filter((g) => g.status === 'terkunci');
  return tunda({
    periode,
    sk: { id: 'sk-1', nomor_sk: 'B-123/Mts.10.05/KP.07.6/10/2026' },
    cakupan: 'semua',
    ringkasan: {
      total: guru.length,
      terkunci: terkunci.length,
      draf: guru.filter((g) => g.status === 'draf').length,
      belum: guru.filter((g) => g.status === 'belum').length,
      rata_capaian: terkunci.length ? Math.round((terkunci.reduce((n, g) => n + g.capaian_persen, 0) / terkunci.length) * 100) / 100 : null,
    },
    guru,
  });
}

// Struktur ringkas 12 sub-kompetensi (nama dari template resmi) untuk rincian tiruan.
const KOMPETENSI_TIRUAN = [
  ['1', 'Kompetensi Pedagogik', ['Lingkungan pembelajaran yang aman dan nyaman bagi peserta didik', 'Pembelajaran efektif yang berpusat pada peserta didik', 'Asesmen, umpan balik, dan pelaporan yang berpusat pada peserta didik']],
  ['2', 'Kompetensi Kepribadian', ['Kematangan moral, emosi, dan spiritual untuk berperilaku sesuai dengan kode etik guru', 'Pengembangan diri melalui kebiasaan refleksi', 'Orientasi berpusat pada peserta didik']],
  ['3', 'Kompetensi Sosial', ['Kolaborasi untuk peningkatan pembelajaran', 'Keterlibatan orangtua/wali dan masyarakat dalam pembelajaran', 'Keterlibatan dalam organisasi profesi dan jejaring yang lebih luas untuk peningkatan pembelajaran']],
  ['4', 'Kompetensi Profesional', ['Pengetahuan konten pembelajaran dan cara mengajarkannya', 'Karakteristik dan cara belajar peserta didik', 'Kurikulum dan cara menggunakannya']],
].map(([kode, nama, sub]) => ({
  kode, nama, sub: sub.map((n, i) => ({ kode: `${kode}.${i + 1}`, nama: n, bobot: 1, indikator: [1, 2, 3, 4, 5].map((level) => ({ level, teks: `Indikator Level ${level}` })) })),
}));

// Bagi subtotal kompetensi ke tiga sub (mis. 11 -> 4, 4, 3) menjadi centang Level 1..n.
function isianDariSubtotal(perKompetensi) {
  const isian = {};
  KOMPETENSI_TIRUAN.forEach((k) => {
    let sisa = perKompetensi[k.kode] || 0;
    k.sub.forEach((s, i) => {
      const n = Math.min(5, Math.ceil(sisa / (k.sub.length - i)));
      sisa -= n;
      isian[s.kode] = { centang: Array.from({ length: n }, (_, j) => j + 1), catatan_bukti: n >= 4 ? 'Dokumen RPP, foto kegiatan' : '', tanggapan: n <= 2 ? 'Perlu pendampingan sejawat' : '' };
    });
  });
  return isian;
}

export async function ambilRekapGuru(guruId) {
  const g = GURU.find((x) => x.guru_id === guruId);
  if (!g) throw new Error('Data rekap guru tidak ditemukan dalam cakupan Anda.');
  const terkunci = g.status === 'terkunci';
  return tunda({
    periode: { id: 'p-2026-ganjil', nama_periode: 'PKG Semester Ganjil 2026/2027' },
    guru: { id: g.guru_id, nama: g.nama, nip: g.nip, mapel: g.mapel },
    penilai_nama: g.penilai_nama,
    status: g.status,
    hasil: terkunci ? { nilai_akhir: g.nilai_akhir, nilai_maks: g.nilai_maks, capaian_persen: g.capaian_persen, level_capaian: g.level_capaian, predikat: g.predikat, terkunci_pada: g.terkunci_pada } : null,
    catatan_umum: terkunci ? 'Konsisten menerapkan pembelajaran berpusat pada peserta didik; tingkatkan kolaborasi sejawat.' : '',
    instrumen: { id: 'instrumen-2026', versi_template: '2026', revisi: 1, kompetensi: KOMPETENSI_TIRUAN },
    isian: terkunci ? isianDariSubtotal(g.per_kompetensi) : {},
  });
}

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
