import { ambilInstrumenAktif } from '@/lib/pkgInstrumen';

// Lembar penilaian kinerja satu guru oleh penilai yang ditugaskan.
//
// TIRUAN SEMENTARA: meniru kontrak yang direncanakan; saat endpoint backend tersedia ganti dengan `api`:
//   GET /pkg/penilaian/lembar/{guru_id} -> lembar
// lembar = { id | null, status: 'belum' | 'draf' | 'terkunci', guru: { id, nama, nip, mapel }, periode,
//            instrumen: { id, versi_template, revisi, kompetensi }, isian: { [sub_kode]: isianSub }, updated_at }
// isianSub = { centang: [level...], catatan_bukti, tanggapan }   (catatan & tanggapan maks BATAS_TEKS karakter)
// lembar juga memuat catatan_umum (rekomendasi penilai untuk rekap per guru).
//
// Aturan nilai (template resmi PKG): indikator perilaku tiap sub-kompetensi dicentang per level; tingkat kompetensi
// = level tertinggi L yang Level 1..L seluruhnya tercentang (0 bila Level 1 belum). Nilai rating = tingkat (1–5).

export const BATAS_TEKS = 500;

const GURU_TIRUAN = {
  g1: { id: 'g1', nama: 'Ahmad Fauzi, S.Pd.', nip: '198703122019031004', mapel: 'Matematika' },
  g2: { id: 'g2', nama: 'Siti Rahmawati, S.Ag.', nip: '199001252020122012', mapel: 'Akidah Akhlak' },
};

const ISIAN_TIRUAN = {
  g1: { '1.1': { centang: [1, 2, 3, 4], catatan_bukti: 'RPP & foto kelas', tanggapan: '' }, '1.2': { centang: [1, 2, 3], catatan_bukti: '', tanggapan: '' } },
};

const tunda = (hasil, ms = 150) => new Promise((r) => { setTimeout(() => r(JSON.parse(JSON.stringify(hasil))), ms); });

export async function ambilLembar(guruId) {
  const instrumen = await ambilInstrumenAktif();
  if (!instrumen) throw new Error('Instrumen PKG belum dimuat. Hubungi kepala madrasah.');
  const isian = ISIAN_TIRUAN[guruId] || {};
  return tunda({
    id: Object.keys(isian).length ? `lembar-${guruId}` : null,
    status: Object.keys(isian).length ? 'draf' : 'belum',
    guru: GURU_TIRUAN[guruId] || { id: guruId, nama: 'Guru yang dinilai', nip: null, mapel: null },
    periode: { id: 'p-2026-ganjil', nama_periode: 'PKG Semester Ganjil 2026/2027' },
    instrumen: { id: instrumen.id, versi_template: instrumen.versi_template, revisi: instrumen.revisi, kompetensi: instrumen.kompetensi },
    isian,
    catatan_umum: '',
    updated_at: null,
  });
}

// Tingkat kompetensi dari level yang dicentang: level tertinggi berurutan mulai Level 1.
export function hitungTingkat(centang = []) {
  const ada = new Set(centang);
  let tingkat = 0;
  while (ada.has(tingkat + 1)) tingkat += 1;
  return tingkat;
}

// Ringkasan nilai lembar: per sub { kode, tingkat }, total, maksimal, persen capaian, dan jumlah sub terisi.
export function hitungNilai(kompetensi = [], isian = {}) {
  const sub = kompetensi.flatMap((k) => k.sub || []);
  const perSub = sub.map((s) => ({ kode: s.kode, tingkat: hitungTingkat(isian[s.kode]?.centang), levelMaks: (s.indikator || []).length }));
  const total = perSub.reduce((n, s) => n + s.tingkat, 0);
  const maks = perSub.reduce((n, s) => n + s.levelMaks, 0);
  return {
    perSub,
    total,
    maks,
    persen: maks ? (total / maks) * 100 : 0,
    terisi: perSub.filter((s) => s.tingkat > 0).length,
    jumlahSub: perSub.length,
  };
}

// Validasi kelengkapan lembar (aturan sama dengan backend saat kirim & kunci):
//   - setiap sub-kompetensi wajib dinilai (minimal Level 1 tercentang);
//   - level dicentang berurutan dari Level 1 tanpa lompatan;
//   - teks catatan/tanggapan tidak melebihi BATAS_TEKS.
// Hasil: { sah, kosong: [kode], lompat: [kode], galat: { [kode]: pesan } }.
export function validasiLembar(kompetensi = [], isian = {}) {
  const kosong = [];
  const lompat = [];
  const galat = {};
  kompetensi.flatMap((k) => k.sub || []).forEach((s) => {
    const isi = isian[s.kode] || {};
    const centang = isi.centang || [];
    const tingkat = hitungTingkat(centang);
    if (tingkat === 0) {
      kosong.push(s.kode);
      galat[s.kode] = centang.length ? 'Level 1 belum dicentang.' : 'Belum dinilai.';
    } else if (centang.some((l) => l > tingkat)) {
      lompat.push(s.kode);
      galat[s.kode] = `Centang melompat setelah Level ${tingkat}; lengkapi level di antaranya atau lepas centang yang lebih tinggi.`;
    }
    ['catatan_bukti', 'tanggapan'].forEach((kunci) => {
      if ((isi[kunci] || '').length > BATAS_TEKS) galat[s.kode] = `Teks melebihi ${BATAS_TEKS} karakter.`;
    });
  });
  return { sah: Object.keys(galat).length === 0, kosong, lompat, galat };
}
