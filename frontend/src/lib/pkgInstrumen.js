import { api } from '@/lib/api';

// Master instrumen PKG (backend/routers/pkg_instrumen_api.py): kompetensi -> sub-kompetensi -> indikator Level 1–5.
//   GET  /pkg/instrumen/aktif                 -> instrumen | null (belum diimpor)
//   GET  /pkg/instrumen                       -> [versi]  (terbaru dulu)
//   POST /pkg/instrumen/impor/pratinjau       multipart { sumber: 'template' | 'unggah', berkas? }  (kepala)
//        -> pratinjau = { token, sumber, nama_berkas, versi_template, checksum, cocok_resmi, kompetensi, peringatan }
//        gagal 422 -> detail { pesan, galat: [{ lokasi, pesan }] }
//   POST /pkg/instrumen/impor { token }       -> { instrumen, hasil }  (kepala)
//   PUT  /pkg/instrumen/aktif/sub/{kode}      { nama, bobot, indikator, alasan } -> instrumen  (kepala)
//   POST /pkg/instrumen/{id}/aktifkan         { alasan } -> instrumen  (kepala)
// instrumen = { id, versi_template, revisi, checksum, cocok_resmi, sumber, nama_berkas, is_active, diimpor_pada,
//               kompetensi: [{ kode, nama, sub: [{ kode, nama, bobot, indikator: [{ level, teks }] }] }] }
// versi = { id, versi_template, revisi, checksum, cocok_resmi, is_active, diimpor_pada, dipakai_penilaian }
// Skor (rumus template resmi): jumlah indikator dicentang per sub (0–5), maksimal 12 x 5 = 60.

// Galat pembacaan instrumen dengan rincian per lokasi sel.
export class GalatImpor extends Error {
  constructor(pesan, galat = []) {
    super(pesan);
    this.galat = galat;
  }
}

function galatDari(e, cadangan) {
  const d = e?.response?.data?.detail;
  if (d && typeof d === 'object' && !Array.isArray(d)) return new GalatImpor(d.pesan || cadangan, d.galat || []);
  if (typeof d === 'string') return new GalatImpor(d);
  if (Array.isArray(d) && d[0]?.msg) return new GalatImpor(`Isian tidak valid: ${d[0].msg}`);
  return new GalatImpor(cadangan);
}

async function panggil(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    throw galatDari(e, cadangan);
  }
}

export const BATAS_UKURAN_UNGGAH = 10 * 1024 * 1024;

export const labelVersi = (v) => (v ? `Template ${v.versi_template}${v.revisi ? ` · Rev ${v.revisi}` : ''}` : '-');

export const ambilInstrumenAktif = () => panggil(() => api.get('/pkg/instrumen/aktif'), 'Gagal memuat instrumen PKG.');

export const daftarVersiInstrumen = () => panggil(() => api.get('/pkg/instrumen'), 'Gagal memuat daftar versi instrumen.');

export function pratinjauImpor({ sumber, berkas = null }) {
  if (sumber === 'unggah') {
    if (!berkas) return Promise.reject(new GalatImpor('Pilih berkas Excel (.xlsx) terlebih dahulu.'));
    if (!/\.xlsx$/i.test(berkas.name)) return Promise.reject(new GalatImpor('Berkas harus berformat .xlsx.'));
    if (berkas.size > BATAS_UKURAN_UNGGAH) return Promise.reject(new GalatImpor('Ukuran berkas melebihi 10 MB.'));
  }
  const form = new FormData();
  form.append('sumber', sumber === 'unggah' ? 'unggah' : 'template');
  if (sumber === 'unggah') form.append('berkas', berkas);
  return panggil(
    () => api.post('/pkg/instrumen/impor/pratinjau', form, { headers: { 'Content-Type': 'multipart/form-data' } }),
    'Gagal membaca instrumen.',
  );
}

// Riwayat perubahan instrumen (kepala): GET /pkg/instrumen/riwayat -> [{ id, aksi, label, aktor_nama, timestamp,
// instrumen_id, versi_template, revisi, kode_sub, alasan, perubahan: [teks], sumber, nama_berkas }] (terbaru dulu).
export const riwayatInstrumen = () => panggil(() => api.get('/pkg/instrumen/riwayat'), 'Gagal memuat riwayat instrumen.');

// Jadikan versi instrumen acuan aktif (kepala; alasan wajib): POST /pkg/instrumen/{id}/aktifkan -> instrumen.
export const aktifkanInstrumen = (id, alasan) => panggil(
  () => api.post(`/pkg/instrumen/${id}/aktifkan`, { alasan }), 'Gagal menetapkan instrumen acuan.',
);

export const terapkanImpor = (token) => panggil(() => api.post('/pkg/instrumen/impor', { token }), 'Gagal menerapkan instrumen.');

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

export const BATAS_INSTRUMEN = { nama: 200, teks: 500, alasan: 300, bobotMin: 0.01, bobotMaks: 100 };

// Validasi isian ubah sub-kompetensi; mengembalikan { field: pesan } (kosong bila sah).
export function validasiUbahSub(isian) {
  const galat = {};
  const nama = (isian.nama || '').trim();
  if (!nama) galat.nama = 'Nama sub-kompetensi wajib diisi.';
  else if (nama.length > BATAS_INSTRUMEN.nama) galat.nama = `Maksimal ${BATAS_INSTRUMEN.nama} karakter.`;
  const bobotTeks = String(isian.bobot ?? '').replace(',', '.').trim();
  const bobot = Number(bobotTeks);
  if (!bobotTeks || !Number.isFinite(bobot)) galat.bobot = 'Bobot harus berupa angka.';
  else if (bobot < BATAS_INSTRUMEN.bobotMin || bobot > BATAS_INSTRUMEN.bobotMaks) galat.bobot = 'Bobot antara 0,01 dan 100.';
  else if (!/^\d+(\.\d{1,2})?$/.test(bobotTeks)) galat.bobot = 'Bobot maksimal dua angka desimal.';
  (isian.indikator || []).forEach((i) => {
    const teks = (i.teks || '').trim();
    if (!teks) galat[`indikator_${i.level}`] = `Teks indikator Level ${i.level} wajib diisi.`;
    else if (teks.length > BATAS_INSTRUMEN.teks) galat[`indikator_${i.level}`] = `Maksimal ${BATAS_INSTRUMEN.teks} karakter.`;
  });
  const alasan = (isian.alasan || '').trim();
  if (!alasan) galat.alasan = 'Alasan perubahan wajib diisi (tercatat di jejak audit).';
  else if (alasan.length > BATAS_INSTRUMEN.alasan) galat.alasan = `Maksimal ${BATAS_INSTRUMEN.alasan} karakter.`;
  return galat;
}

export function ubahSubKompetensi(kode, isian) {
  const galat = validasiUbahSub(isian);
  if (Object.keys(galat).length) return Promise.reject(new GalatImpor(Object.values(galat)[0]));
  return panggil(() => api.put(`/pkg/instrumen/aktif/sub/${kode}`, {
    nama: isian.nama.trim(),
    bobot: Number(String(isian.bobot).replace(',', '.')),
    indikator: isian.indikator.map((i) => ({ level: i.level, teks: i.teks.trim() })),
    alasan: isian.alasan.trim(),
  }), 'Gagal menyimpan perubahan.');
}

// Bandingkan instrumen aktif dengan template instrumen resmi di server (GET /pkg/template/info).
// Hasil: null bila sejalan; { jenis: 'versi' | 'isi', versiInstrumen, versiTemplate } bila berbeda.
//   'versi' = instrumen aktif berasal dari versi template lain (perlu impor ulang),
//   'isi'   = versi sama namun isi instrumen tidak lagi sama dengan berkas resmi (diubah/diunggah).
export function bandingkanVersiTemplate(instrumen, infoTemplate) {
  const berkas = infoTemplate?.berkas?.find((b) => b.jenis === 'instrumen');
  if (!instrumen || !infoTemplate || !berkas) return null;
  const versiTemplate = berkas.versi || infoTemplate.versi_template;
  if (String(instrumen.versi_template) !== String(versiTemplate)) {
    return { jenis: 'versi', versiInstrumen: instrumen.versi_template, versiTemplate };
  }
  if (instrumen.cocok_resmi === false || (instrumen.checksum && berkas.checksum_resmi && instrumen.checksum !== berkas.checksum_resmi)) {
    return { jenis: 'isi', versiInstrumen: instrumen.versi_template, versiTemplate };
  }
  return null;
}
