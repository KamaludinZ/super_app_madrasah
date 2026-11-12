/**
 * Izin Kamad: izin keluar GTK & satpam yang diputuskan kepala madrasah.
 *
 * Kontrak server (backend menyusul; koleksi `izin_kamad`, terpisah dari gtk_izin):
 *   GET /izin-kamad/papan-hari-ini
 *     -> { tanggal: 'YYYY-MM-DD', items: [Izin] }   (hanya status 'disetujui' pada tanggal berjalan WIB)
 *   GET /izin-kamad/saya
 *     -> { items: [Izin] }                          (pengajuan milik pengguna aktif, terbaru dulu)
 *   POST /izin-kamad { keperluan, tanggal, jam_mulai, jam_selesai }
 *     -> Izin   (status 'menunggu'; pengaju = pengguna login)
 *   POST /izin-kamad/{id}/batalkan
 *     -> Izin   (status 'dibatalkan'; hanya pengaju, selama status masih 'menunggu')
 *   GET /izin-kamad/{id}
 *     -> Izin   (hanya-lihat; pengaju, kepala madrasah, admin, atau pembaca papan untuk izin disetujui)
 *   GET /izin-kamad/menunggu
 *     -> { items: [Izin] }   (kepala madrasah: semua pengajuan menunggu, tanggal & jam terdekat dulu)
 *   GET /izin-kamad/riwayat-keputusan
 *     -> { items: [Izin] }   (kepala madrasah: izin disetujui/ditolak, keputusan terbaru dulu)
 *   POST /izin-kamad/{id}/setujui
 *     -> Izin   (kepala madrasah; hanya izin menunggu; langsung tampil di papan bila tanggalnya hari ini)
 *   POST /izin-kamad/{id}/tolak { alasan }
 *     -> Izin   (kepala madrasah; alasan wajib 5–300 karakter, terlihat oleh pengaju)
 *   GET /izin-kamad/ringkasan-satpam
 *     -> { tanggal, jam, izin_hari_ini, berlangsung, akan_datang, selesai, saya_menunggu }  (jam server WIB)
 *
 *   Izin = { id, pengaju_id, pengaju_nama, pengaju_peran, keperluan,
 *            tanggal: 'YYYY-MM-DD', jam_mulai: 'HH:MM', jam_selesai: 'HH:MM',
 *            status: 'menunggu'|'disetujui'|'ditolak'|'dibatalkan',
 *            alasan_penolakan, diputuskan_oleh_nama, diputuskan_pada, dibuat_pada }
 *
 * Bila server belum menyediakan endpoint (404) dipakai data contoh berlabel (`tiruan: true`)
 * agar tampilan bisa dicoba.
 */
import { api, ROLE_LABELS } from '@/lib/api';
import { hariIniWIB } from '@/lib/tanggal';
import { WIB_TIMEZONE, parseServerDate } from '@/lib/datetime';
import { PERAN_PEMANTAU_IZIN, PERAN_PEMUTUS_IZIN, PERAN_PENGAJU_IZIN } from '@/lib/menuUmum';

// Beranda satpam: halaman dashboard tersendiri. /dashboard milik satpam dialihkan ke sini.
export const BERANDA_SATPAM = '/satpam';
// Peran yang boleh membuka beranda satpam; admin hanya untuk pratinjau.
export const PERAN_BUKA_BERANDA_SATPAM = ['satpam', 'admin'];
export const bolehBukaBerandaSatpam = (role) => PERAN_BUKA_BERANDA_SATPAM.includes(role);

// Persetujuan izin (/izin/persetujuan): kepala madrasah/kepala sekolah memutuskan; admin pratinjau.
export const HALAMAN_PERSETUJUAN_IZIN = '/izin/persetujuan';
export { PERAN_PEMUTUS_IZIN };
export const bolehPutuskanIzin = (role) => role === 'admin' || PERAN_PEMUTUS_IZIN.includes(role);

// Pemantau izin hari ini (/izin/pemantau): kepala tata usaha; kepala madrasah & admin juga boleh membuka.
export const HALAMAN_PEMANTAU_IZIN = '/izin/pemantau';
export { PERAN_PEMANTAU_IZIN };
export const bolehPantauIzin = (role) => role === 'admin' || PERAN_PEMANTAU_IZIN.includes(role) || PERAN_PEMUTUS_IZIN.includes(role);

// Pengajuan izin (/izin): daftar peran pengaju ada di lib/menuUmum.js (ikut menu & sinkron HP).
export const HALAMAN_PENGAJUAN_IZIN = '/izin';
export { PERAN_PENGAJU_IZIN };
// Admin boleh membuka halaman (pratinjau), sama dengan require_role di backend.
export const bolehAjukanIzin = (role) => role === 'admin' || PERAN_PENGAJU_IZIN.includes(role);

export const STATUS_IZIN = {
  menunggu: { label: 'Menunggu', kelas: 'bg-amber-50 text-amber-700 border-amber-200' },
  disetujui: { label: 'Disetujui', kelas: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  ditolak: { label: 'Ditolak', kelas: 'bg-rose-50 text-rose-700 border-rose-200' },
  dibatalkan: { label: 'Dibatalkan', kelas: 'bg-slate-50 text-slate-600 border-slate-200' },
};

// Keadaan izin disetujui menurut jam sekarang (informasi saja; satpam tidak menandai keluar/kembali).
export const WAKTU_IZIN = {
  berlangsung: { label: 'Sedang izin', kelas: 'bg-emerald-600 text-white border-emerald-600' },
  akan_datang: { label: 'Belum mulai', kelas: 'bg-sky-50 text-sky-700 border-sky-200' },
  selesai: { label: 'Selesai', kelas: 'bg-slate-50 text-slate-500 border-slate-200' },
};

export const labelPeran = (peran) => ROLE_LABELS[peran] || peran || '-';

/** Jam sekarang menurut WIB, 'HH:MM'. */
export const jamSekarangWIB = () => new Date().toLocaleTimeString('en-GB', {
  timeZone: WIB_TIMEZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** 'berlangsung' | 'akan_datang' | 'selesai' untuk izin pada hari ini (jam 'HH:MM' dibandingkan sebagai teks). */
export function waktuIzin(izin, jam = jamSekarangWIB()) {
  if (jam < izin.jam_mulai) return 'akan_datang';
  if (jam >= izin.jam_selesai) return 'selesai';
  return 'berlangsung';
}

const menitDari = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

/** Lama izin, mis. "1 jam 30 menit"; '' bila jam tidak sah. */
export function teksDurasi(jamMulai, jamSelesai) {
  const a = menitDari(jamMulai);
  const b = menitDari(jamSelesai);
  if (a === null || b === null || b <= a) return '';
  const j = Math.floor((b - a) / 60);
  const m = (b - a) % 60;
  return [j && `${j} jam`, m && `${m} menit`].filter(Boolean).join(' ');
}

// ---- Validasi waktu pengajuan (sama dengan alasan_waktu_tidak_sah di backend/izin_kamad.py) ----
export const DURASI_MIN_MENIT = 15;

/**
 * Galat waktu pengajuan per isian -> { tanggal?, jam_mulai?, jam_selesai? } (kosong = sah).
 * Aturan: tanggal hari ini atau ke depan; jam selesai setelah jam mulai (minimal 15 menit);
 * izin untuk hari ini tidak boleh sudah berakhir (jam selesai setelah jam sekarang).
 */
export function validasiWaktuIzin({ tanggal, jam_mulai: mulai, jam_selesai: selesai }, { hariIni = hariIniWIB(), jam = jamSekarangWIB() } = {}) {
  const galat = {};
  if (tanggal && tanggal < hariIni) galat.tanggal = 'Tanggal izin hanya boleh hari ini atau ke depan';
  const a = menitDari(mulai);
  const b = menitDari(selesai);
  if (a !== null && b !== null) {
    if (b <= a) galat.jam_selesai = 'Jam selesai harus setelah jam mulai';
    else if (b - a < DURASI_MIN_MENIT) galat.jam_selesai = `Izin minimal ${DURASI_MIN_MENIT} menit`;
    else if (tanggal === hariIni && selesai <= jam) galat.jam_selesai = `Jam selesai sudah lewat (sekarang pukul ${jam} WIB)`;
  }
  return galat;
}

// ---- Daftar menunggu (kepala madrasah) ----
export const URGENSI_MENUNGGU = {
  lewat: { label: 'Waktu lewat', kelas: 'bg-slate-100 text-slate-600 border-slate-200' },
  mendesak: { label: 'Mendesak', kelas: 'bg-rose-50 text-rose-700 border-rose-200' },
};

/** 'lewat' (izin sudah berakhir tanpa keputusan), 'mendesak' (mulai ≤ 60 menit lagi / sedang berjalan), atau null. */
export function urgensiMenunggu(izin, { hariIni = hariIniWIB(), jam = jamSekarangWIB() } = {}) {
  if (izin.tanggal < hariIni || (izin.tanggal === hariIni && izin.jam_selesai <= jam)) return 'lewat';
  if (izin.tanggal === hariIni && menitDari(izin.jam_mulai) - menitDari(jam) <= 60) return 'mendesak';
  return null;
}

/** Kelompok tanggal untuk daftar menunggu: [{ kunci, judul, items }] urut tanggal & jam. */
export function kelompokMenunggu(items = [], hariIni = hariIniWIB()) {
  const besok = new Date(`${hariIni}T12:00:00+07:00`);
  besok.setUTCDate(besok.getUTCDate() + 1);
  const kunciBesok = besok.toISOString().slice(0, 10);
  const urut = [...items].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.jam_mulai.localeCompare(b.jam_mulai));
  const grup = [
    { kunci: 'lampau', judul: 'Tanggal sudah lewat', items: urut.filter((i) => i.tanggal < hariIni) },
    { kunci: 'hari-ini', judul: 'Hari ini', items: urut.filter((i) => i.tanggal === hariIni) },
    { kunci: 'besok', judul: 'Besok', items: urut.filter((i) => i.tanggal === kunciBesok) },
    { kunci: 'nanti', judul: 'Akan datang', items: urut.filter((i) => i.tanggal > kunciBesok) },
  ];
  return grup.filter((g) => g.items.length);
}

/** Riwayat keputusan: saring status ('semua'|'disetujui'|'ditolak') & kata kunci, keputusan terbaru dulu. */
export function saringRiwayat(items = [], { status = 'semua', cari = '' } = {}) {
  const q = cari.trim().toLowerCase();
  return saringStatus(items, status)
    .filter((i) => !q || `${i.pengaju_nama} ${i.keperluan} ${i.alasan_penolakan || ''}`.toLowerCase().includes(q))
    .sort((a, b) => waktuMs(b.diputuskan_pada) - waktuMs(a.diputuskan_pada));
}

/** Urut jam mulai, lalu nama pengaju. */
export const urutJam = (a, b) => a.jam_mulai.localeCompare(b.jam_mulai) || a.pengaju_nama.localeCompare(b.pengaju_nama);

/** Pengajuan terbaru dulu (waktu pengajuan). */
const waktuMs = (v) => parseServerDate(v)?.getTime() ?? 0;
export const urutTerbaru = (a, b) => waktuMs(b.dibuat_pada) - waktuMs(a.dibuat_pada);

/** Saring menurut status; 'semua' = tanpa saringan. */
export const saringStatus = (items = [], status = 'semua') => (status === 'semua' ? items : items.filter((i) => i.status === status));

/** Izin hari ini dikelompokkan menurut jam berjalan, masing-masing urut jam mulai. */
export function kelompokkanWaktu(items = [], jam = jamSekarangWIB()) {
  const g = { berlangsung: [], akan_datang: [], selesai: [] };
  [...items].sort(urutJam).forEach((i) => g[waktuIzin(i, jam)].push(i));
  return g;
}

/** Ringkasan dashboard satpam dari papan hari ini + pengajuan sendiri (bentuk sama dengan respons server). */
export function ringkasanSatpam(papan = [], saya = [], jam = jamSekarangWIB()) {
  const g = kelompokkanWaktu(papan, jam);
  return {
    tanggal: hariIniWIB(),
    jam,
    izin_hari_ini: papan.length,
    berlangsung: g.berlangsung.length,
    akan_datang: g.akan_datang.length,
    selesai: g.selesai.length,
    saya_menunggu: saya.filter((i) => i.status === 'menunggu').length,
  };
}

/** 'YYYY-MM-DD' digeser n hari dari tanggal WIB hari ini (untuk data contoh). */
function geserHari(n) {
  const d = new Date(`${hariIniWIB()}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---- Data tiruan (tanggal relatif terhadap hari ini agar papan selalu terisi) ----
const ID_SAYA = 'contoh-satpam';

export function papanTiruan() {
  const t = hariIniWIB();
  const dasar = { tanggal: t, status: 'disetujui', alasan_penolakan: null, diputuskan_oleh_nama: 'Kepala Madrasah (contoh)' };
  return [
    { ...dasar, id: 'contoh-izin-1', pengaju_id: 'contoh-guru-1', pengaju_nama: 'Ahmad Fauzi (contoh)', pengaju_peran: 'guru', keperluan: 'Mengantar anak periksa ke puskesmas', jam_mulai: '07:30', jam_selesai: '09:00' },
    { ...dasar, id: 'contoh-izin-2', pengaju_id: 'contoh-tendik-1', pengaju_nama: 'Siti Rahmawati (contoh)', pengaju_peran: 'tenaga_kependidikan', keperluan: 'Mengurus berkas ke Kantor Kemenag Kabupaten', jam_mulai: '09:00', jam_selesai: '12:00' },
    { ...dasar, id: 'contoh-izin-3', pengaju_id: 'contoh-ktu-1', pengaju_nama: 'Hendra Saputra (contoh)', pengaju_peran: 'kepala_tata_usaha', keperluan: 'Rapat koordinasi keuangan di KKM', jam_mulai: '10:30', jam_selesai: '13:00' },
    { ...dasar, id: 'contoh-izin-4', pengaju_id: 'contoh-guru-2', pengaju_nama: 'Nur Aini (contoh)', pengaju_peran: 'guru', keperluan: 'Takziah ke rumah wali murid', jam_mulai: '13:00', jam_selesai: '14:30' },
  ].map((i) => ({ ...i, dibuat_pada: `${t}T06:45:00+07:00`, diputuskan_pada: `${t}T06:55:00+07:00` }));
}

export function sayaTiruan({ nama = 'Satpam (contoh)', peran = 'satpam' } = {}) {
  const dasar = { pengaju_id: ID_SAYA, pengaju_nama: nama, pengaju_peran: peran, alasan_penolakan: null, diputuskan_oleh_nama: null, diputuskan_pada: null };
  return [
    { ...dasar, id: 'contoh-saya-1', keperluan: 'Mengurus perpanjangan SIM', tanggal: geserHari(2), jam_mulai: '08:00', jam_selesai: '10:00', status: 'menunggu', dibuat_pada: `${hariIniWIB()}T06:30:00+07:00` },
    { ...dasar, id: 'contoh-saya-2', keperluan: 'Kontrol kesehatan rutin', tanggal: geserHari(-3), jam_mulai: '13:00', jam_selesai: '14:00', status: 'disetujui', diputuskan_oleh_nama: 'Kepala Madrasah (contoh)', diputuskan_pada: `${geserHari(-4)}T10:00:00+07:00`, dibuat_pada: `${geserHari(-5)}T07:00:00+07:00` },
    { ...dasar, id: 'contoh-saya-3', keperluan: 'Keperluan keluarga', tanggal: geserHari(-7), jam_mulai: '07:00', jam_selesai: '11:00', status: 'ditolak', alasan_penolakan: 'Bertepatan dengan kegiatan PHBI, mohon ajukan di hari lain.', diputuskan_oleh_nama: 'Kepala Madrasah (contoh)', diputuskan_pada: `${geserHari(-8)}T09:00:00+07:00`, dibuat_pada: `${geserHari(-9)}T07:00:00+07:00` },
  ];
}

/** Pengajuan menunggu keputusan kepala madrasah (contoh). */
export function menungguTiruan() {
  const t = hariIniWIB();
  const dasar = { status: 'menunggu', alasan_penolakan: null, diputuskan_oleh_nama: null, diputuskan_pada: null };
  return [
    { ...dasar, id: 'contoh-tunggu-1', pengaju_id: 'contoh-guru-3', pengaju_nama: 'Rina Kurniasih (contoh)', pengaju_peran: 'guru_ipa', keperluan: 'Mengantar orang tua kontrol ke rumah sakit', tanggal: t, jam_mulai: '10:00', jam_selesai: '12:00', dibuat_pada: `${t}T06:20:00+07:00` },
    { ...dasar, id: 'contoh-tunggu-2', pengaju_id: 'contoh-satpam-2', pengaju_nama: 'Slamet Riyadi (contoh)', pengaju_peran: 'satpam', keperluan: 'Mengurus perpanjangan SIM', tanggal: geserHari(1), jam_mulai: '08:00', jam_selesai: '10:00', dibuat_pada: `${t}T07:05:00+07:00` },
    { ...dasar, id: 'contoh-tunggu-3', pengaju_id: 'contoh-tendik-2', pengaju_nama: 'Dewi Lestari (contoh)', pengaju_peran: 'tenaga_kependidikan', keperluan: 'Mengambil SK di Kantor Kemenag', tanggal: geserHari(2), jam_mulai: '09:00', jam_selesai: '11:30', dibuat_pada: `${t}T07:40:00+07:00` },
  ];
}

/** Izin yang sudah diputuskan (contoh). */
export function riwayatTiruan() {
  const dasar = { diputuskan_oleh_nama: 'Kepala Madrasah (contoh)' };
  return [
    ...papanTiruan().slice(0, 2),
    { ...dasar, id: 'contoh-riwayat-1', pengaju_id: 'contoh-guru-4', pengaju_nama: 'Agus Salim (contoh)', pengaju_peran: 'guru', keperluan: 'Acara keluarga', tanggal: geserHari(-1), jam_mulai: '07:00', jam_selesai: '12:00', status: 'ditolak', alasan_penolakan: 'Bertepatan dengan asesmen sumatif; mohon diatur ulang.', diputuskan_pada: `${geserHari(-2)}T13:00:00+07:00`, dibuat_pada: `${geserHari(-3)}T07:00:00+07:00` },
    { ...dasar, id: 'contoh-riwayat-2', pengaju_id: 'contoh-ktu-2', pengaju_nama: 'Hendra Saputra (contoh)', pengaju_peran: 'kepala_tata_usaha', keperluan: 'Rekonsiliasi BOS di KPPN', tanggal: geserHari(-2), jam_mulai: '08:00', jam_selesai: '11:00', status: 'disetujui', alasan_penolakan: null, diputuskan_pada: `${geserHari(-3)}T09:30:00+07:00`, dibuat_pada: `${geserHari(-4)}T07:00:00+07:00` },
  ];
}

/** Izin contoh berdasarkan id (halaman detail saat server belum menyediakan endpoint). */
export const cariIzinTiruan = (id) => [...papanTiruan(), ...sayaTiruan(), ...menungguTiruan(), ...riwayatTiruan()]
  .find((i) => i.id === id) || null;

// ---- Pemanggil API (jatuh ke data tiruan bila endpoint belum ada) ----
// Rute yang belum terdaftar dijawab FastAPI 404 "Not Found"; 404 dengan pesan lain (mis. izin
// tidak ditemukan) adalah galat sungguhan.
const endpointBelumAda = (e) => e?.response?.status === 404 && e.response.data?.detail === 'Not Found';

/** Galat 403 dari server (require_role): peran aktif tidak berhak. */
export const aksesDitolak = (e) => e?.response?.status === 403;

export const pesanGalat = (e, cadangan) => {
  const d = e?.response?.data?.detail;
  return typeof d === 'string' && d !== 'Not Found' ? d : cadangan;
};

async function denganTiruan(fn, tiruan) {
  try {
    return { ...(await fn()), tiruan: false };
  } catch (e) {
    if (endpointBelumAda(e)) return { ...tiruan(), tiruan: true };
    throw e;
  }
}

/** Papan izin disetujui hari ini -> { tanggal, items, tiruan }. */
export const muatPapanHariIni = () => denganTiruan(
  async () => {
    const { data } = await api.get('/izin-kamad/papan-hari-ini');
    return { tanggal: data.tanggal, items: data.items || [] };
  },
  () => ({ tanggal: hariIniWIB(), items: papanTiruan() }),
);

export const KEPERLUAN_MAKS = 300;

/** Kirim pengajuan izin -> { izin, tiruan }. `pengaju` ({nama, peran}) mengisi data contoh. */
export const ajukanIzin = (isi, { nama = 'Anda', peran = '' } = {}) => denganTiruan(
  async () => ({ izin: (await api.post('/izin-kamad', isi)).data }),
  () => ({
    izin: {
      ...isi, id: `contoh-baru-${Date.now()}`, pengaju_id: ID_SAYA, pengaju_nama: nama, pengaju_peran: peran,
      status: 'menunggu', alasan_penolakan: null, diputuskan_oleh_nama: null, diputuskan_pada: null,
      dibuat_pada: new Date().toISOString(),
    },
  }),
);

/** Batalkan pengajuan sendiri yang masih menunggu -> { izin, tiruan }. */
export const batalkanIzin = (izin) => denganTiruan(
  async () => ({ izin: (await api.post(`/izin-kamad/${izin.id}/batalkan`)).data }),
  () => ({ izin: { ...izin, status: 'dibatalkan' } }),
);

/** Pengajuan menunggu keputusan -> { items, tiruan } (khusus kepala madrasah). */
export const muatMenunggu = () => denganTiruan(
  async () => ({ items: (await api.get('/izin-kamad/menunggu')).data.items || [] }),
  () => ({ items: menungguTiruan() }),
);

/** Riwayat keputusan (disetujui/ditolak) -> { items, tiruan } (khusus kepala madrasah). */
export const muatRiwayatKeputusan = () => denganTiruan(
  async () => ({ items: (await api.get('/izin-kamad/riwayat-keputusan')).data.items || [] }),
  () => ({ items: riwayatTiruan() }),
);

/** Setujui pengajuan yang menunggu -> { izin, tiruan }. `pemutus` = nama kepala madrasah (data contoh). */
export const setujuiIzin = (izin, pemutus = 'Anda') => denganTiruan(
  async () => ({ izin: (await api.post(`/izin-kamad/${izin.id}/setujui`)).data }),
  () => ({ izin: { ...izin, status: 'disetujui', alasan_penolakan: null, diputuskan_oleh_nama: pemutus, diputuskan_pada: new Date().toISOString() } }),
);

export const ALASAN_TOLAK_MIN = 5;
export const ALASAN_TOLAK_MAKS = 300;

/** Tolak pengajuan yang menunggu dengan alasan wajib -> { izin, tiruan }. */
export const tolakIzin = (izin, alasan, pemutus = 'Anda') => denganTiruan(
  async () => ({ izin: (await api.post(`/izin-kamad/${izin.id}/tolak`, { alasan: String(alasan).trim() })).data }),
  () => ({ izin: { ...izin, status: 'ditolak', alasan_penolakan: String(alasan).trim(), diputuskan_oleh_nama: pemutus, diputuskan_pada: new Date().toISOString() } }),
);

/** Detail satu izin dari server -> Izin, atau null bila endpoint belum ada (pakai data daftar). */
export async function muatDetailIzin(id) {
  try {
    return (await api.get(`/izin-kamad/${id}`)).data;
  } catch (e) {
    if (endpointBelumAda(e)) return null;
    throw e;
  }
}

/** Ringkasan dashboard satpam menurut jam server -> { ...ringkasan, tiruan }. */
export const muatRingkasanSatpam = () => denganTiruan(
  async () => (await api.get('/izin-kamad/ringkasan-satpam')).data,
  () => ringkasanSatpam(papanTiruan(), sayaTiruan()),
);

/** Pengajuan milik pengguna aktif -> { items, tiruan }. `pengaju` ({nama, peran}) mengisi data contoh. */
export const muatPengajuanSaya = (pengaju) => denganTiruan(
  async () => {
    const { data } = await api.get('/izin-kamad/saya');
    return { items: data.items || [] };
  },
  () => ({ items: sayaTiruan(pengaju) }),
);

// ---- Catatan satpam pada satu izin ----
// Ditulis satpam; hanya dapat dibaca kepala madrasah/kepala sekolah & kepala tata usaha.
//   POST /izin-kamad/{id}/catatan { isi } -> { id, izin_id, isi, dibuat_pada }
//   GET  /izin-kamad/{id}/catatan -> { items: [{ id, izin_id, penulis_nama, isi, dibuat_pada }] } (pembaca saja)
// Sama dengan PERAN_PEMBACA_CATATAN di backend/izin_kamad.py.
export const PERAN_PEMBACA_CATATAN = ['kepala_sekolah', 'kepala_tata_usaha'];
export const bolehBacaCatatan = (role) => role === 'admin' || PERAN_PEMBACA_CATATAN.includes(role);
export const CATATAN_MIN = 3;
export const CATATAN_MAKS = 500;

/** Pesan galat isian catatan, '' bila sah. */
export function validasiCatatan(isi) {
  const t = String(isi || '').trim();
  if (t.length < CATATAN_MIN) return `Catatan minimal ${CATATAN_MIN} karakter.`;
  if (t.length > CATATAN_MAKS) return `Catatan maksimal ${CATATAN_MAKS} karakter.`;
  return '';
}

/** Kirim catatan -> { catatan, tiruan }. */
export const kirimCatatan = (izinId, isi) => denganTiruan(
  async () => {
    const { data } = await api.post(`/izin-kamad/${izinId}/catatan`, { isi: String(isi).trim() });
    return { catatan: data };
  },
  () => ({ catatan: { id: `contoh-catatan-${Date.now()}`, izin_id: izinId, isi: String(isi).trim(), dibuat_pada: new Date().toISOString() } }),
);

/** Catatan satpam pada izin (contoh). */
const catatanTiruan = (izinId) => (izinId === 'contoh-izin-1' ? [
  { id: 'contoh-catatan-a', izin_id: izinId, penulis_nama: 'Slamet Riyadi (contoh)', isi: 'Keluar pukul 07.35 bersama anak, naik motor sendiri.', dibuat_pada: `${hariIniWIB()}T07:36:00+07:00` },
  { id: 'contoh-catatan-b', izin_id: izinId, penulis_nama: 'Slamet Riyadi (contoh)', isi: 'Kembali pukul 08.50 lewat gerbang depan.', dibuat_pada: `${hariIniWIB()}T08:51:00+07:00` },
] : []);

/** Riwayat catatan satpam pada satu izin -> { items, tiruan }. Panggil hanya bila bolehBacaCatatan(peran). */
export const muatCatatan = (izinId) => denganTiruan(
  async () => ({ items: (await api.get(`/izin-kamad/${izinId}/catatan`)).data.items || [] }),
  () => ({ items: catatanTiruan(izinId) }),
);
