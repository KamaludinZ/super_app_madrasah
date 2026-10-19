// Master instrumen PKG (kompetensi -> sub-kompetensi -> indikator perilaku Level 1–5).
//
// TIRUAN SEMENTARA: struktur & teks diambil dari berkas resmi pkg_template_v2026.xlsx (sheet KOMP-1..KOMP (4)),
// meniru kontrak yang direncanakan. Saat endpoint backend tersedia, ganti isi fungsi dengan panggilan `api`:
//   GET /pkg/instrumen/aktif -> instrumen
// instrumen = { id, versi_template, checksum, is_active, diimpor_pada, kompetensi: [kompetensi] }
// kompetensi = { kode, nama, sub: [{ kode, nama, bobot, indikator: [{ level, teks }] }] }
// Penilaian: tingkat kompetensi tiap sub = level 1–5 (nilai rating), jumlah maksimal 12 x 5 = 60.

const KOMPETENSI = [
  {
    kode: '1', nama: 'Kompetensi Pedagogik', sub: [
      {
        kode: '1.1', nama: 'Lingkungan pembelajaran yang aman dan nyaman bagi peserta didik', bobot: 1, indikator: [
          { level: 1, teks: 'Memahami manfaat dan pentingnya lingkungan pembelajaran yang aman dan nyaman bagi peserta didik' },
          { level: 2, teks: 'Menerapkan strategi lingkungan pembelajaran yang aman dan nyaman bagi peserta didik' },
          { level: 3, teks: 'Mengevaluasi strategi implementasi lingkungan pembelajaran yang aman dan nyaman bagi peserta didik dan merancang perbaikannya' },
          { level: 4, teks: 'Berkolaborasi dengan rekan sejawat terkait strategi implementasi ingkungan pembelajaran yang aman dan nyaman bagi peserta didik' },
          { level: 5, teks: 'Membimbing rekan sejawat dalam melakukan strategi implementasi lingkungan pembelajaran yang aman dan nyaman bagi peserta didik' },
        ],
      },
      {
        kode: '1.2', nama: 'Pembelajaran efektif yang berpusat pada peserta didik', bobot: 1, indikator: [
          { level: 1, teks: 'Memahami penting dan manfaat pembelajaran efektif yang berpusat pada peserta didik' },
          { level: 2, teks: 'Menerapkan pembelajaran efektif yang berpusat pada peserta didik' },
          { level: 3, teks: 'Mengevaluasi pembelajaran efektif yang berpusat pada peserta didik dan merancang perbaikannya' },
          { level: 4, teks: 'Berkolaborasi dengan rekan sejawat terkait pemilihan strategi implementasi pembelajaran efektif yang berpusat pada peserta didik' },
          { level: 5, teks: 'Membimbing rekan sejawat dalam melakukan strategi implementasi pembelajaran efektif yang berpusat pada peserta didik.' },
        ],
      },
      {
        kode: '1.3', nama: 'Asesmen, umpan balik, dan pelaporan yang berpusat pada peserta didik', bobot: 1, indikator: [
          { level: 1, teks: 'Memahami penting dan manfaat asesmen, umpan balik, dan pelaporan yang berpusat pada peserta didik' },
          { level: 2, teks: 'Melakukan asesmen, umpan balik, dan pelaporan yang berpusat pada peserta didik' },
          { level: 3, teks: 'Mengevaluasi asesmen, umpan balik, dan pelaporan yang berpusat pada peserta didik dan merancang perbaikannya.' },
          { level: 4, teks: 'Berkolaborasi dengan rekan sejawat terkait pelaksanaan asesmen, umpan balik, dan pelaporan yang berpusat pada peserta didik.' },
          { level: 5, teks: 'Membimbing rekan sejawat dalam melakukan asesmen, umpan balik, dan pelaporan yang berpusat pada peserta didik.' },
        ],
      },
    ],
  },
  {
    kode: '2', nama: 'Kompetensi Kepribadian', sub: [
      {
        kode: '2.1', nama: 'Kematangan moral, emosi, dan spiritual untuk berperilaku sesuai dengan kode etik guru', bobot: 1, indikator: [
          { level: 1, teks: 'Memahami manfaat dan pentingnya perilaku yang mencerminkan kematangan moral, emosi dan spiritual untuk berperilaku sesuai dengan kode etik guru' },
          { level: 2, teks: 'Menerapkan perilaku yang mencerminkan kematangan moral, emosi dan spiritual untuk berperilaku sesuai dengan kode etik guru' },
          { level: 3, teks: 'Mengevaluasi perilaku yang mencerminkan kematangan moral, emosi dan spiritual untuk berperilaku sesuai dengan kode etik guru dan merencanakan perbaikannya' },
          { level: 4, teks: 'Berkolaborasi dengan rekan sejawat terkait penerapan perilaku yang mencerminkan kematangan moral, emosi dan spiritual untuk berperilaku sesuai dengan kode etik guru' },
          { level: 5, teks: 'Membimbing rekan sejawat dalam penerapan perilaku yang mencerminkan kematangan moral, emosi, dan spiritual untuk berperilaku sesuai dengan kode etik guru' },
        ],
      },
      {
        kode: '2.2', nama: 'Pengembangan diri melalui kebiasaan refleksi', bobot: 1, indikator: [
          { level: 1, teks: 'Memahami penting dan manfaat pengembangan diri melalui kebiasaan refleksi' },
          { level: 2, teks: 'Menerapkan pengembangan diri melalui kebiasaan refleksi' },
          { level: 3, teks: 'Mengevaluasi penerapan pengembangan diri melalui kebiasaan refleksi serta merancang perbaikannya' },
          { level: 4, teks: 'Berkolaborasi dengan rekan sejawat terkait penerapan pengembangan diri melalui kebiasaan refleksi' },
          { level: 5, teks: 'Membimbing rekam sejawat dalam berkolaborasi dengan rekan sejawat terkait penerapan pengembangan diri melalui kebiasaan refleksi' },
        ],
      },
      {
        kode: '2.3', nama: 'Orientasi berpusat pada peserta didik', bobot: 1, indikator: [
          { level: 1, teks: 'Memahami penting dan manfaat asesmen, umpan balik, dan pelaporan yang berpusat pada peserta didik' },
          { level: 2, teks: 'Membiasakan pentingnya menempatkan peserta didik sebagai pusat dari pembelajaran' },
          { level: 3, teks: 'Mengevaluasi kebiasaan dalam menempatkan peserta didik sebagai pusat dari pembelajaran dan merancang perbaikannya' },
          { level: 4, teks: 'Berkolaborasi dengan rekan sejawat terkait kebiasaan dalam menempatkan peserta didik sebagai pusat dari pembelajaran' },
          { level: 5, teks: 'Membimbing rekan sejawat dalam kebiasaan dalam menempatkan peserta didik sebagai pusat dari pembelajaran' },
        ],
      },
    ],
  },
  {
    kode: '3', nama: 'Kompetensi Sosial', sub: [
      {
        kode: '3.1', nama: 'Kolaborasi untuk peningkatan pembelajaran', bobot: 1, indikator: [
          { level: 1, teks: 'Memahami manfaat dan pentingnya kolaborasi untuk peningkatan kualitas pembelajaran' },
          { level: 2, teks: 'Melakukan kolaborasi untuk peningkatan kualitas pembelajaran' },
          { level: 3, teks: 'Mengevaluasi strategi kolaborasi untuk peningkatan kualitas pembelajaran dan merancang perbaikannya' },
          { level: 4, teks: 'Berbagi praktik baik dengan rekan sejawat terkait strategi kolaborasi untuk peningkatan kualitas pembelajaran' },
          { level: 5, teks: 'Membimbing rekan sejawat dalam berbagi praktik baik terkait strategi kolaborasi untuk peningkatan kualitas pembelajaran' },
        ],
      },
      {
        kode: '3.2', nama: 'Keterlibatan orangtua/wali dan masyarakat dalam pembelajaran', bobot: 1, indikator: [
          { level: 1, teks: 'Memahami penting dan manfaat Melibatkan orangtua/wali dan masyarakat dalam pembelajaran' },
          { level: 2, teks: 'Melibatkan orangtua/wali dan masyarakat dalam pembelajaran' },
          { level: 3, teks: 'Mengevaluasi pelibatan orangtua/wali dan masyarakat dalam pembelajaran dan merancang strategi pelibatan yang lebih efektif' },
          { level: 4, teks: 'Berkolaborasi dengan rekan sejawat terkait pelibatan orangtua/wali dan masyarakat yang efektif dalam pembelajaran' },
          { level: 5, teks: 'Membimbing rekam sejawat dalam berkolaborasi dengan rekan sejawat terkait pelibatan orangtua/wali dan masyarakat yang efektif dalam pembelajaran' },
        ],
      },
      {
        kode: '3.3', nama: 'Keterlibatan dalam organisasi profesi dan jejaring yang lebih luas untuk peningkatan pembelajaran', bobot: 1, indikator: [
          { level: 1, teks: 'Memahami penting dan manfaat peran dalam organisasi profesi dan jejaring yang lebih luas untuk peningkatan kualitas pembelajaran peserta didik.' },
          { level: 2, teks: 'Berperan dalam organisasi profesi dan jejaring yang lebih luas untuk peningkatan kualitas pembelajaran peserta didik.' },
          { level: 3, teks: 'Mengevaluasi peran dalam organisasi profesi dan jejaring yang lebih luas untuk mengoptimalkan keterlibatan dalam peningkatan kualitas pembelajaran peserta didik' },
          { level: 4, teks: 'Berkolaborasi dengan rekan sejawat terkait peran yang optimal dalam organisasi profesi dan jejaring yang lebih luas untuk peningkatan kualitas pembelajaran peserta didik' },
          { level: 5, teks: 'Membimbing rekan sejawat dalam berkolaborasi terkait peran yang optimal dalam organisasi profesi dan jejaring yang lebih luas untuk peningkatan kualitas pembelajaran peserta didik' },
        ],
      },
    ],
  },
  {
    kode: '4', nama: 'Kompetensi Profesional', sub: [
      {
        kode: '4.1', nama: 'Pengetahuan konten pembelajaran dan cara mengajarkannya', bobot: 1, indikator: [
          { level: 1, teks: 'Memahami manfaat dan pentingnya penggunaan konten pembelajaran dan cara mengajarkannya' },
          { level: 2, teks: 'Menggunakan konten pembelajaran dan cara mengajarkannya' },
          { level: 3, teks: 'Mengevaluasi konten pembelajaran dan merancang cara perbaikannya' },
          { level: 4, teks: 'Berkolaborasi dengan rekan sejawat terkait pengetahuan konten pembelajaran dan cara mengajarkannya' },
          { level: 5, teks: 'Membimbing rekan sejawat dalam berkolaborasi dengan rekan sejawat terkait pengetahuan konten pembelajaran dan cara mengajarkannya' },
        ],
      },
      {
        kode: '4.2', nama: 'Karakteristik dan cara belajar peserta didik', bobot: 1, indikator: [
          { level: 1, teks: 'Memahami penting dan manfaat pengetahuan dalam menentukan karakteristik yang akan mempengaruhi cara belajar peserta didik' },
          { level: 2, teks: 'Menggunakan pengetahuan dalam menentukan karakteristik yang akan mempengaruhi cara belajar peserta didik' },
          { level: 3, teks: 'Mengevaluasi pengetahuan dalam menentukan karakteristik yang akan mempengaruhi cara belajar peserta didik dan merencanakan perbaikannya.' },
          { level: 4, teks: 'Berkolaborasi dengan rekan sejawat terkait pengetahuan dalam menentukan karakteristik yang akan mempengaruhi cara belajar peserta didik' },
          { level: 5, teks: 'Membimbing rekam sejawat dalam pengetahuan dalam menentukan karakteristik yang akan mempengaruhi cara belajar peserta didik dan merencanakan perbaikannya.' },
        ],
      },
      {
        kode: '4.3', nama: 'Kurikulum dan cara menggunakannya', bobot: 1, indikator: [
          { level: 1, teks: 'Memahami penting dan manfaat pengetahuan tentang komponen kurikulum dan cara menggunakannya untuk merancang desain pembelajaran' },
          { level: 2, teks: 'Menggunakan pengetahuan tentang komponen kurikulum dan cara menggunakannya untuk merancang desain pembelajaran' },
          { level: 3, teks: 'Mengevaluasi pengetahuan tentang komponen kurikulum dan cara menggunakannya untuk merancang desain pembelajaran dan merencanakan perbaikannya.' },
          { level: 4, teks: 'Berkolaborasi dengan rekan sejawat terkait pengetahuan tentang komponen kurikulum dan cara menggunakannya untuk merancang desain pembelajaran' },
          { level: 5, teks: 'Membimbing rekan sejawat dalam berkolaborasi terkait pengetahuan tentang komponen kurikulum dan cara menggunakannya untuk merancang desain pembelajaran' },
        ],
      },
    ],
  },
];

const TIRUAN = {
  id: 'instrumen-2026',
  versi_template: '2026',
  checksum: 'e4e768b7b5dfbdbc1a32a1b88d9a731bcceac2c1ffd2af9801aa8a994f637da5',
  is_active: true,
  diimpor_pada: '2026-10-01T08:00:00+07:00',
  kompetensi: KOMPETENSI,
};

export const ambilInstrumenAktif = () => new Promise((r) => { setTimeout(() => r(JSON.parse(JSON.stringify(TIRUAN))), 150); });

// Ringkasan jumlah kompetensi, sub-kompetensi, indikator, dan skor maksimal (level tertinggi x jumlah sub).
export function ringkasInstrumen(instrumen) {
  const kompetensi = instrumen?.kompetensi || [];
  const sub = kompetensi.flatMap((k) => k.sub || []);
  const indikator = sub.reduce((n, s) => n + (s.indikator || []).length, 0);
  const levelMaks = Math.max(0, ...sub.flatMap((s) => (s.indikator || []).map((i) => i.level)));
  return { kompetensi: kompetensi.length, sub: sub.length, indikator, skorMaks: sub.length * levelMaks };
}

const FORMAT_DUA_DESIMAL = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Angka persen dua desimal berformat Indonesia, mis. 8.333 -> '8,33%'. Nilai tidak valid -> '-'.
export function formatPersen(nilai) {
  const n = Number(nilai);
  return Number.isFinite(n) ? `${FORMAT_DUA_DESIMAL.format(n)}%` : '-';
}

// Porsi bobot terhadap total bobot (0–100). Total nol -> null.
export function porsiBobot(bobot, totalBobot) {
  const total = Number(totalBobot) || 0;
  return total > 0 ? ((Number(bobot) || 0) / total) * 100 : null;
}
