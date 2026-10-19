import { ambilInstrumenAktif } from '@/lib/pkgInstrumen';

// Lembar penilaian kinerja satu guru oleh penilai yang ditugaskan.
//
// TIRUAN SEMENTARA: meniru kontrak yang direncanakan; saat endpoint backend tersedia ganti dengan `api`:
//   GET /pkg/penilaian/lembar/{guru_id} -> lembar
//   POST /pkg/penilaian/draft { guru_id, isian, catatan_umum } -> { id, status: 'draf', progres, updated_at }
//        (lembar dibuat saat draf pertama disimpan; lembar terkunci ditolak 409)
//   POST /pkg/penilaian/submit { guru_id, isian, catatan_umum } -> lembar terkunci + hasil
//        hasil = { nilai_akhir, nilai_maks, capaian_persen, level_capaian, predikat, terkunci_pada }
//        (backend memvalidasi ulang kelengkapan; lembar terkunci permanen dan tercatat di jejak audit)
//   gagal 403 -> detail { alasan: 'bukan_penugasan' | 'belum_disupervisi' | ..., pesan }
// lembar = { id | null, status: 'belum' | 'draf' | 'terkunci', guru: { id, nama, nip, mapel, akun_aktif, juga_penilai },
//            periode: { id, nama_periode, tanggal_buka, tanggal_tutup }, dapat_diisi, alasan_tidak_dapat_diisi,
//            instrumen: { id, versi_template, revisi, kompetensi }, isian: { [sub_kode]: isianSub }, updated_at }
// isianSub = { centang: [level...], catatan_bukti, tanggapan }   (catatan & tanggapan maks BATAS_TEKS karakter)
// lembar juga memuat catatan_umum (rekomendasi penilai untuk rekap per guru).
//
// Aturan nilai mengikuti rumus template resmi pkg_template_v2026.xlsx:
//   - skor sub-kompetensi = jumlah indikator perilaku yang dicentang (KOMP-n!K6 = COUNTA(centang)/5*5), 0–5,
//     ditampilkan sebagai "Level <skor>" (04-RKAP-PKG kolom G);
//   - jumlah = total skor 12 sub (maks 60); capaian % = jumlah/60*100 (04-RKAP-PKG!H45);
//   - level capaian & predikat jenjang jabatan dari capaian % (04-RKAP-PKG!G45 & F45), lihat levelCapaian/predikatJenjang.
// Centang yang tidak berurutan dari Level 1 tetap dihitung, namun diberi peringatan agar penilai memeriksanya.

export const BATAS_TEKS = 500;

const GURU_TIRUAN = {
  g1: { id: 'g1', nama: 'Ahmad Fauzi, S.Pd.', nip: '198703122019031004', mapel: 'Matematika', akun_aktif: true, juga_penilai: true },
  g2: { id: 'g2', nama: 'Siti Rahmawati, S.Ag.', nip: '199001252020122012', mapel: 'Akidah Akhlak', akun_aktif: false, juga_penilai: false },
};

// Galat akses lembar (bentuk sama dengan lib/pkg GalatPkg): `penolakan` = { alasan, pesan } dari detail 403.
export class GalatLembar extends Error {
  constructor(pesan, penolakan = null) {
    super(pesan);
    this.penolakan = penolakan;
  }
}

const ISIAN_TIRUAN = {
  g1: { '1.1': { centang: [1, 2, 3, 4], catatan_bukti: 'RPP & foto kelas', tanggapan: '' }, '1.2': { centang: [1, 2, 3], catatan_bukti: '', tanggapan: '' } },
};
const DRAF_TIRUAN = {}; // guru_id -> { catatan_umum, updated_at }
const TERKUNCI_TIRUAN = {}; // guru_id -> hasil

const tunda = (hasil, ms = 150) => new Promise((r) => { setTimeout(() => r(JSON.parse(JSON.stringify(hasil))), ms); });

export async function ambilLembar(guruId) {
  // Tiruan: ?lembar=tolak (development) mensimulasikan guru yang tidak dibagikan kepada penilai.
  if (process.env.NODE_ENV !== 'production' && new URLSearchParams(window.location.search).get('lembar') === 'tolak') {
    throw new GalatLembar('Guru ini tidak dibagikan kepada Anda.', { alasan: 'bukan_penugasan', pesan: 'Guru ini tidak dibagikan kepada Anda pada periode berjalan.' });
  }
  const instrumen = await ambilInstrumenAktif();
  if (!instrumen) throw new Error('Instrumen PKG belum dimuat. Hubungi kepala madrasah.');
  const isian = ISIAN_TIRUAN[guruId] || {};
  const hasil = TERKUNCI_TIRUAN[guruId] || null;
  return tunda({
    id: Object.keys(isian).length ? `lembar-${guruId}` : null,
    status: hasil ? 'terkunci' : Object.keys(isian).length ? 'draf' : 'belum',
    hasil,
    guru: GURU_TIRUAN[guruId] || { id: guruId, nama: 'Guru yang dinilai', nip: null, mapel: null, akun_aktif: true, juga_penilai: false },
    periode: { id: 'p-2026-ganjil', nama_periode: 'PKG Semester Ganjil 2026/2027', tanggal_buka: '2026-10-01', tanggal_tutup: '2026-11-30' },
    // Server menentukan apakah lembar boleh diisi (masa penilaian, supervisi, status kunci).
    dapat_diisi: !hasil,
    alasan_tidak_dapat_diisi: hasil ? 'terkunci' : null,
    instrumen: { id: instrumen.id, versi_template: instrumen.versi_template, revisi: instrumen.revisi, kompetensi: instrumen.kompetensi },
    isian,
    catatan_umum: DRAF_TIRUAN[guruId]?.catatan_umum || '',
    updated_at: DRAF_TIRUAN[guruId]?.updated_at || null,
  });
}

// Skor sub-kompetensi = jumlah indikator (Level 1–5) yang dicentang.
export function hitungTingkat(centang = []) {
  return new Set((centang || []).filter((l) => Number.isInteger(l) && l >= 1 && l <= 5)).size;
}

// Level yang belum dicentang padahal ada level lebih tinggi yang dicentang (mis. [1, 3] -> [2]).
export function levelBolong(centang = []) {
  const ada = new Set(centang);
  const maks = Math.max(0, ...ada);
  return Array.from({ length: maks }, (_, i) => i + 1).filter((l) => !ada.has(l));
}

// Level capaian dari persen capaian (04-RKAP-PKG!G45).
export function levelCapaian(persen) {
  if (!persen) return null;
  if (persen < 55) return 'Level 1';
  if (persen === 55) return 'Level 2';
  if (persen <= 75) return 'Level 3';
  if (persen <= 90) return 'Level 4';
  return 'Level 5';
}

// Predikat ketercapaian jenjang jabatan dari persen capaian (04-RKAP-PKG!F45).
export function predikatJenjang(persen) {
  if (!persen) return null;
  if (persen <= 55) return 'Terpenuhi pada Jenjang Jabatan Guru Ahli Pertama';
  if (persen <= 75) return 'Terpenuhi pada Jenjang Jabatan Guru Ahli Muda';
  if (persen <= 90) return 'Terpenuhi pada Jenjang Jabatan Guru Ahli Madya';
  return 'Terpenuhi pada Jenjang Jabatan Guru Ahli Utama';
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
//   - setiap sub-kompetensi wajib dinilai (minimal satu indikator dicentang) — memblokir kirim;
//   - teks catatan/tanggapan tidak melebihi BATAS_TEKS — memblokir kirim;
//   - centang tidak berurutan dari Level 1 — hanya peringatan.
// Hasil: { sah, kosong: [kode], galat: { [kode]: pesan }, peringatan: { [kode]: pesan } }.
export function validasiLembar(kompetensi = [], isian = {}) {
  const kosong = [];
  const galat = {};
  const peringatan = {};
  kompetensi.flatMap((k) => k.sub || []).forEach((s) => {
    const isi = isian[s.kode] || {};
    const centang = isi.centang || [];
    if (hitungTingkat(centang) === 0) {
      kosong.push(s.kode);
      galat[s.kode] = 'Belum dinilai: centang minimal satu indikator.';
    } else if (levelBolong(centang).length) {
      peringatan[s.kode] = `Level ${levelBolong(centang).join(', ')} belum dicentang padahal level di atasnya dicentang; periksa kembali.`;
    }
    ['catatan_bukti', 'tanggapan'].forEach((kunci) => {
      if ((isi[kunci] || '').length > BATAS_TEKS) galat[s.kode] = `Teks melebihi ${BATAS_TEKS} karakter.`;
    });
  });
  return { sah: Object.keys(galat).length === 0, kosong, galat, peringatan };
}

export async function simpanDraf(guruId, { isian, catatanUmum, kompetensi }) {
  const terlalu = Object.values(isian || {}).some((x) => (x.catatan_bukti || '').length > BATAS_TEKS || (x.tanggapan || '').length > BATAS_TEKS)
    || (catatanUmum || '').length > BATAS_TEKS;
  if (terlalu) throw new Error(`Teks melebihi ${BATAS_TEKS} karakter.`);
  ISIAN_TIRUAN[guruId] = JSON.parse(JSON.stringify(isian || {}));
  const updated = new Date().toISOString();
  DRAF_TIRUAN[guruId] = { catatan_umum: catatanUmum || '', updated_at: updated };
  const n = hitungNilai(kompetensi, isian);
  return tunda({ id: `lembar-${guruId}`, status: 'draf', progres: n.jumlahSub ? Math.round((n.terisi / n.jumlahSub) * 100) : 0, updated_at: updated }, 300);
}

// Hasil akhir lembar dari isian (dipakai pratinjau konfirmasi & tiruan submit).
export function hitungHasilAkhir(kompetensi, isian) {
  const n = hitungNilai(kompetensi, isian);
  const persen = Math.round(n.persen * 100) / 100;
  return {
    nilai_akhir: n.total,
    nilai_maks: n.maks,
    capaian_persen: persen,
    level_capaian: levelCapaian(persen),
    predikat: predikatJenjang(persen),
  };
}

export async function kirimLembar(guruId, { isian, catatanUmum, kompetensi }) {
  if (TERKUNCI_TIRUAN[guruId]) throw new Error('Lembar penilaian ini sudah dikunci.');
  const v = validasiLembar(kompetensi, isian);
  if (!v.sah) throw new Error(`${Object.keys(v.galat).length} sub-kompetensi belum lengkap.`);
  await simpanDraf(guruId, { isian, catatanUmum, kompetensi });
  TERKUNCI_TIRUAN[guruId] = { ...hitungHasilAkhir(kompetensi, isian), terkunci_pada: new Date().toISOString() };
  return ambilLembar(guruId);
}
