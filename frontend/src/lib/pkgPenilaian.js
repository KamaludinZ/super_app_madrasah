import { api } from '@/lib/api';

// Lembar penilaian kinerja satu guru oleh penilai yang ditugaskan (backend/routers/pkg_penilaian_api.py).
//   GET  /pkg/penilaian/lembar/{guru_id} -> lembar
//        gagal 403 -> detail { alasan: 'bukan_penugasan' | 'belum_disupervisi' | ..., pesan }
//   POST /pkg/penilaian/draft  { guru_id, isian, catatan_umum } -> { id, status: 'draf', progres, updated_at }
//        (lembar dibuat saat draf pertama; terkunci 409; di luar masa 403 di_luar_masa)
//   GET  /pkg/penilaian/lembar/{guru_id}/riwayat -> jejak aksi lembar (mulai, buka, draf, kirim)
//   POST /pkg/penilaian/submit { guru_id, isian, catatan_umum } -> lembar terkunci (dengan `hasil`)
//        belum lengkap 400 -> detail { pesan, galat: { kode_sub: pesan } }
// lembar = { id | null, status: 'belum' | 'draf' | 'terkunci', guru: { id, nama, nip, mapel, akun_aktif, juga_penilai },
//            periode: { id, nama_periode, tanggal_buka, tanggal_tutup }, dapat_diisi, alasan_tidak_dapat_diisi,
//            instrumen: { id, versi_template, revisi, kompetensi }, isian: { [sub_kode]: isianSub }, catatan_umum,
//            hasil: { nilai_akhir, nilai_maks, capaian_persen, level_capaian, predikat, terkunci_pada } | null, updated_at }
// isianSub = { centang: [level...], catatan_bukti, tanggapan }   (catatan & tanggapan maks BATAS_TEKS karakter)
//
// Aturan nilai mengikuti rumus template resmi pkg_template_v2026.xlsx (sama dengan backend pkg_nilai.py):
//   - skor sub-kompetensi = jumlah indikator perilaku yang dicentang (KOMP-n!K6 = COUNTA(centang)/5*5), 0–5;
//   - jumlah = total skor (maks 60); capaian % = jumlah/60*100 (04-RKAP-PKG!H45);
//   - level capaian & predikat jenjang jabatan dari capaian % (04-RKAP-PKG!G45 & F45).
// Centang yang tidak berurutan dari Level 1 tetap dihitung, namun diberi peringatan agar penilai memeriksanya.

export const BATAS_TEKS = 500;

// Galat akses/isian lembar: `penolakan` = { alasan, pesan } dari 403; `galat` = { kode_sub: pesan } dari 400.
export class GalatLembar extends Error {
  constructor(pesan, penolakan = null, galat = null) {
    super(pesan);
    this.penolakan = penolakan;
    this.galat = galat;
  }
}

async function panggil(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    const status = e?.response?.status;
    const d = e?.response?.data?.detail;
    if (status === 403 && d?.alasan) throw new GalatLembar(d.pesan || cadangan, d);
    // galat per sub berbentuk objek {kode_sub: pesan}; galat validasi 422 berbentuk daftar {lokasi, pesan} -> cukup pesannya.
    if (d && typeof d === 'object' && !Array.isArray(d)) throw new GalatLembar(d.pesan || cadangan, null, d.galat && !Array.isArray(d.galat) ? d.galat : null);
    if (typeof d === 'string') throw new GalatLembar(d);
    if (Array.isArray(d) && d[0]?.msg) throw new GalatLembar(`Isian tidak valid: ${d[0].msg}`);
    throw new GalatLembar(cadangan);
  }
}

// Hanya field yang diterima server yang dikirim.
function isianBersih(isian = {}) {
  return Object.fromEntries(Object.entries(isian).map(([kode, x]) => [kode, {
    centang: [...new Set((x?.centang || []).filter((l) => Number.isInteger(l) && l >= 1 && l <= 5))],
    catatan_bukti: (x?.catatan_bukti || '').slice(0, BATAS_TEKS),
    tanggapan: (x?.tanggapan || '').slice(0, BATAS_TEKS),
  }]));
}

export const ambilLembar = (guruId) => panggil(() => api.get(`/pkg/penilaian/lembar/${guruId}`), 'Gagal memuat lembar penilaian.');

export const simpanDraf = (guruId, { isian, catatanUmum }) => panggil(
  () => api.post('/pkg/penilaian/draft', { guru_id: guruId, isian: isianBersih(isian), catatan_umum: (catatanUmum || '').slice(0, BATAS_TEKS) }),
  'Gagal menyimpan draf.',
);

// Riwayat aksi lembar ini (penilainya): [{ aksi, label, aktor_nama, timestamp, terakhir, jumlah, progres, nilai_akhir }].
export const riwayatLembar = (guruId) => panggil(() => api.get(`/pkg/penilaian/lembar/${guruId}/riwayat`), 'Gagal memuat riwayat lembar.');

export const kirimLembar = (guruId, { isian, catatanUmum }) => panggil(
  () => api.post('/pkg/penilaian/submit', { guru_id: guruId, isian: isianBersih(isian), catatan_umum: (catatanUmum || '').slice(0, BATAS_TEKS) }),
  'Gagal mengirim penilaian.',
);

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

// Hasil akhir lembar dari isian (pratinjau di dialog konfirmasi kirim; server menghitung ulang saat mengunci).
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

