/**
 * Izin Kamad (izin keluar GTK & satpam yang diputuskan kepala madrasah) — sama dengan
 * frontend/src/lib/izinKamad.js.
 *
 * Kontrak server (koleksi `izin_kamad`):
 *   GET /izin-kamad/papan-hari-ini -> { tanggal, items: Izin[] }  (status 'disetujui' pada hari ini WIB)
 *   GET /izin-kamad/saya           -> { items: Izin[] }           (pengajuan milik pengguna aktif)
 *   GET /izin-kamad/ringkasan-satpam -> RingkasanSatpam            (jam server WIB)
 *   POST /izin-kamad/{id}/catatan  { isi } -> Catatan              (satpam; dibaca kepala madrasah & kepala TU saja)
 *   POST /izin-kamad { keperluan, tanggal, jam_mulai, jam_selesai } -> Izin (status 'menunggu')
 *   POST /izin-kamad/{id}/batalkan -> Izin                         (pengaju sendiri, selama masih 'menunggu')
 *   GET /izin-kamad/menunggu, GET /izin-kamad/riwayat-keputusan -> { items } (kepala madrasah)
 *   POST /izin-kamad/{id}/setujui -> Izin; POST /izin-kamad/{id}/tolak { alasan } -> Izin (kepala madrasah)
 *
 * Bila server belum menyediakan endpoint (404 "Not Found" dari FastAPI) dipakai data contoh
 * berlabel (`tiruan: true`) agar tampilan bisa dicoba.
 */
import { ApiError, request } from '@/api/client';
import type { BadgeTone } from '@/components/ui/Badge';
import { addDays, minutesOf, todayISO, wibParts } from '@/utils/time';

export type StatusIzin = 'menunggu' | 'disetujui' | 'ditolak' | 'dibatalkan';

export type Izin = {
  id: string;
  pengaju_id: string;
  pengaju_nama: string;
  pengaju_peran: string;
  keperluan: string;
  tanggal: string; // YYYY-MM-DD
  jam_mulai: string; // HH:MM
  jam_selesai: string; // HH:MM
  status: StatusIzin;
  alasan_penolakan?: string | null;
  diputuskan_oleh_nama?: string | null;
  diputuskan_pada?: string | null;
  dibuat_pada?: string | null;
};

export type PapanIzin = { tanggal: string; items: Izin[]; tiruan: boolean };
export type RingkasanSatpam = {
  tanggal: string; jam: string; izin_hari_ini: number; berlangsung: number; akan_datang: number; selesai: number;
  saya_menunggu: number; tiruan: boolean;
};
export type DaftarIzin = { items: Izin[]; tiruan: boolean };

export const STATUS_IZIN: Record<StatusIzin, { label: string; tone: BadgeTone }> = {
  menunggu: { label: 'Menunggu', tone: 'warning' },
  disetujui: { label: 'Disetujui', tone: 'success' },
  ditolak: { label: 'Ditolak', tone: 'error' },
  dibatalkan: { label: 'Dibatalkan', tone: 'neutral' },
};

export type WaktuIzin = 'berlangsung' | 'akan_datang' | 'selesai';
// Keadaan izin disetujui menurut jam sekarang (informasi saja; satpam tidak menandai keluar/kembali).
export const WAKTU_IZIN: Record<WaktuIzin, { label: string; tone: BadgeTone }> = {
  berlangsung: { label: 'Sedang izin', tone: 'success' },
  akan_datang: { label: 'Belum mulai', tone: 'brand' },
  selesai: { label: 'Selesai', tone: 'neutral' },
};

/** Jam sekarang menurut WIB, 'HH:MM'. */
export function jamSekarangWIB(now = Date.now()): string {
  const p = wibParts(now);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

export function waktuIzin(izin: Izin, jam = jamSekarangWIB()): WaktuIzin {
  if (jam < izin.jam_mulai) return 'akan_datang';
  if (jam >= izin.jam_selesai) return 'selesai';
  return 'berlangsung';
}

const urutJam = (a: Izin, b: Izin) => a.jam_mulai.localeCompare(b.jam_mulai) || a.pengaju_nama.localeCompare(b.pengaju_nama);

/** Izin hari ini dikelompokkan menurut jam berjalan, masing-masing urut jam mulai. */
export function kelompokkanWaktu(items: Izin[], jam = jamSekarangWIB()): Record<WaktuIzin, Izin[]> {
  const g: Record<WaktuIzin, Izin[]> = { berlangsung: [], akan_datang: [], selesai: [] };
  [...items].sort(urutJam).forEach((i) => g[waktuIzin(i, jam)].push(i));
  return g;
}

/** Lama izin, mis. "1 jam 30 menit". */
export function teksDurasi(mulai: string, selesai: string): string {
  const d = minutesOf(selesai) - minutesOf(mulai);
  if (d <= 0) return '';
  const j = Math.floor(d / 60);
  const m = d % 60;
  return [j ? `${j} jam` : '', m ? `${m} menit` : ''].filter(Boolean).join(' ');
}

const waktuMs = (v?: string | null) => (v ? Date.parse(v) || 0 : 0);
/** Pengajuan terbaru dulu (waktu pengajuan). */
export const urutTerbaru = (a: Izin, b: Izin) => waktuMs(b.dibuat_pada) - waktuMs(a.dibuat_pada);

// ---- Data tiruan (tanggal relatif terhadap hari ini agar papan selalu terisi) ----
export function papanTiruan(): Izin[] {
  const t = todayISO();
  const dasar = { tanggal: t, status: 'disetujui' as const, alasan_penolakan: null, diputuskan_oleh_nama: 'Kepala Madrasah (contoh)',
    dibuat_pada: `${t}T06:45:00+07:00`, diputuskan_pada: `${t}T06:55:00+07:00` };
  return [
    { ...dasar, id: 'contoh-izin-1', pengaju_id: 'contoh-guru-1', pengaju_nama: 'Ahmad Fauzi (contoh)', pengaju_peran: 'guru', keperluan: 'Mengantar anak periksa ke puskesmas', jam_mulai: '07:30', jam_selesai: '09:00' },
    { ...dasar, id: 'contoh-izin-2', pengaju_id: 'contoh-tendik-1', pengaju_nama: 'Siti Rahmawati (contoh)', pengaju_peran: 'tenaga_kependidikan', keperluan: 'Mengurus berkas ke Kantor Kemenag Kabupaten', jam_mulai: '09:00', jam_selesai: '12:00' },
    { ...dasar, id: 'contoh-izin-3', pengaju_id: 'contoh-ktu-1', pengaju_nama: 'Hendra Saputra (contoh)', pengaju_peran: 'kepala_tata_usaha', keperluan: 'Rapat koordinasi keuangan di KKM', jam_mulai: '10:30', jam_selesai: '13:00' },
    { ...dasar, id: 'contoh-izin-4', pengaju_id: 'contoh-guru-2', pengaju_nama: 'Nur Aini (contoh)', pengaju_peran: 'guru', keperluan: 'Takziah ke rumah wali murid', jam_mulai: '13:00', jam_selesai: '14:30' },
  ];
}

export function sayaTiruan({ nama = 'Satpam (contoh)', peran = 'satpam' }: { nama?: string; peran?: string } = {}): Izin[] {
  const t = todayISO();
  const dasar = { pengaju_id: 'contoh-satpam', pengaju_nama: nama, pengaju_peran: peran, alasan_penolakan: null, diputuskan_oleh_nama: null, diputuskan_pada: null };
  return [
    { ...dasar, id: 'contoh-saya-1', keperluan: 'Mengurus perpanjangan SIM', tanggal: addDays(t, 2), jam_mulai: '08:00', jam_selesai: '10:00', status: 'menunggu', dibuat_pada: `${t}T06:30:00+07:00` },
    { ...dasar, id: 'contoh-saya-2', keperluan: 'Kontrol kesehatan rutin', tanggal: addDays(t, -3), jam_mulai: '13:00', jam_selesai: '14:00', status: 'disetujui', diputuskan_oleh_nama: 'Kepala Madrasah (contoh)', diputuskan_pada: `${addDays(t, -4)}T10:00:00+07:00`, dibuat_pada: `${addDays(t, -5)}T07:00:00+07:00` },
    { ...dasar, id: 'contoh-saya-3', keperluan: 'Keperluan keluarga', tanggal: addDays(t, -7), jam_mulai: '07:00', jam_selesai: '11:00', status: 'ditolak', alasan_penolakan: 'Bertepatan dengan kegiatan PHBI, mohon ajukan di hari lain.', diputuskan_oleh_nama: 'Kepala Madrasah (contoh)', diputuskan_pada: `${addDays(t, -8)}T09:00:00+07:00`, dibuat_pada: `${addDays(t, -9)}T07:00:00+07:00` },
  ];
}

// ---- Pengajuan izin: peran pengaju & validasi waktu (sama dengan web lib/izinKamad.js & backend) ----
export const PERAN_PENGAJU_IZIN = [
  'kepala_tata_usaha', 'guru', 'guru_ipa', 'guru_ips', 'guru_bahasa', 'guru_seni', 'guru_agama', 'guru_tik',
  'tenaga_kependidikan', 'satpam',
];
export const bolehAjukanIzin = (role?: string | null) => role === 'admin' || PERAN_PENGAJU_IZIN.includes(role ?? '');
export const PERAN_PEMUTUS_IZIN = ['kepala_sekolah'];
// Pemantau izin hari ini (/izin/pemantau): kepala TU; kepala madrasah & admin juga boleh membuka.
export const PERAN_PEMANTAU_IZIN = ['kepala_tata_usaha'];
export const bolehPantauIzin = (role?: string | null) =>
  role === 'admin' || PERAN_PEMANTAU_IZIN.includes(role ?? '') || PERAN_PEMUTUS_IZIN.includes(role ?? '');
export const bolehPutuskanIzin = (role?: string | null) => role === 'admin' || PERAN_PEMUTUS_IZIN.includes(role ?? '');
export const ALASAN_TOLAK_MIN = 5;
export const ALASAN_TOLAK_MAKS = 300;

export function validasiAlasanTolak(alasan: string): string {
  const n = alasan.trim().length;
  if (!n) return 'Alasan penolakan wajib diisi';
  if (n < ALASAN_TOLAK_MIN) return `Alasan minimal ${ALASAN_TOLAK_MIN} karakter`;
  if (n > ALASAN_TOLAK_MAKS) return `Maksimal ${ALASAN_TOLAK_MAKS} karakter`;
  return '';
}
export const KEPERLUAN_MAKS = 300;
export const DURASI_MIN_MENIT = 15;
const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;

export type IsiIzin = { keperluan: string; tanggal: string; jam_mulai: string; jam_selesai: string };
export type GalatIzin = Partial<Record<keyof IsiIzin, string>>;

/** Galat per isian (kosong = sah): wajib diisi, tanggal hari ini/ke depan, jam selesai > jam mulai (min 15 menit), belum lewat. */
export function validasiIzin(v: IsiIzin, { hariIni = todayISO(), jam = jamSekarangWIB() } = {}): GalatIzin {
  const g: GalatIzin = {};
  if (!v.keperluan.trim()) g.keperluan = 'Keperluan wajib diisi';
  else if (v.keperluan.trim().length > KEPERLUAN_MAKS) g.keperluan = `Maksimal ${KEPERLUAN_MAKS} karakter`;
  if (!v.tanggal) g.tanggal = 'Tanggal wajib diisi';
  else if (v.tanggal < hariIni) g.tanggal = 'Tanggal izin hanya boleh hari ini atau ke depan';
  if (!v.jam_mulai) g.jam_mulai = 'Jam mulai wajib diisi';
  else if (!POLA_JAM.test(v.jam_mulai)) g.jam_mulai = 'Jam tidak valid (JJ:MM)';
  if (!v.jam_selesai) g.jam_selesai = 'Jam selesai wajib diisi';
  else if (!POLA_JAM.test(v.jam_selesai)) g.jam_selesai = 'Jam tidak valid (JJ:MM)';
  if (!g.jam_mulai && !g.jam_selesai) {
    const d = minutesOf(v.jam_selesai) - minutesOf(v.jam_mulai);
    if (d <= 0) g.jam_selesai = 'Jam selesai harus setelah jam mulai';
    else if (d < DURASI_MIN_MENIT) g.jam_selesai = `Izin minimal ${DURASI_MIN_MENIT} menit`;
    else if (v.tanggal === hariIni && v.jam_selesai <= jam) g.jam_selesai = `Jam selesai sudah lewat (sekarang pukul ${jam} WIB)`;
  }
  return g;
}

// ---- Catatan satpam ----
// Ditulis satpam; HANYA dibaca kepala madrasah & kepala TU (GET /izin-kamad/{id}/catatan, sama dengan backend).
export type Catatan = { id: string; izin_id: string; isi: string; dibuat_pada: string; penulis_nama?: string | null };
export const PERAN_PEMBACA_CATATAN = ['kepala_sekolah', 'kepala_tata_usaha'];
export const bolehBacaCatatan = (role?: string | null) => role === 'admin' || PERAN_PEMBACA_CATATAN.includes(role ?? '');
export const CATATAN_MIN = 3;
export const CATATAN_MAKS = 500;

/** Pesan galat isian catatan, '' bila sah (sama dengan web & backend). */
export function validasiCatatan(isi: string): string {
  const n = isi.trim().length;
  if (n < CATATAN_MIN) return `Catatan minimal ${CATATAN_MIN} karakter.`;
  if (n > CATATAN_MAKS) return `Catatan maksimal ${CATATAN_MAKS} karakter.`;
  return '';
}

export function menungguTiruan(): Izin[] {
  const t = todayISO();
  const dasar = { status: 'menunggu' as const, alasan_penolakan: null, diputuskan_oleh_nama: null, diputuskan_pada: null };
  return [
    { ...dasar, id: 'contoh-tunggu-1', pengaju_id: 'contoh-guru-3', pengaju_nama: 'Rina Kurniasih (contoh)', pengaju_peran: 'guru_ipa', keperluan: 'Mengantar orang tua kontrol ke rumah sakit', tanggal: t, jam_mulai: '10:00', jam_selesai: '12:00', dibuat_pada: `${t}T06:20:00+07:00` },
    { ...dasar, id: 'contoh-tunggu-2', pengaju_id: 'contoh-satpam-2', pengaju_nama: 'Slamet Riyadi (contoh)', pengaju_peran: 'satpam', keperluan: 'Mengurus perpanjangan SIM', tanggal: addDays(t, 1), jam_mulai: '08:00', jam_selesai: '10:00', dibuat_pada: `${t}T07:05:00+07:00` },
    { ...dasar, id: 'contoh-tunggu-3', pengaju_id: 'contoh-tendik-2', pengaju_nama: 'Dewi Lestari (contoh)', pengaju_peran: 'tenaga_kependidikan', keperluan: 'Mengambil SK di Kantor Kemenag', tanggal: addDays(t, 2), jam_mulai: '09:00', jam_selesai: '11:30', dibuat_pada: `${t}T07:40:00+07:00` },
  ];
}

export function riwayatTiruan(): Izin[] {
  const t = todayISO();
  return [
    ...papanTiruan().slice(0, 2),
    { id: 'contoh-riwayat-1', pengaju_id: 'contoh-guru-4', pengaju_nama: 'Agus Salim (contoh)', pengaju_peran: 'guru', keperluan: 'Acara keluarga', tanggal: addDays(t, -1), jam_mulai: '07:00', jam_selesai: '12:00', status: 'ditolak', alasan_penolakan: 'Bertepatan dengan asesmen sumatif; mohon diatur ulang.', diputuskan_oleh_nama: 'Kepala Madrasah (contoh)', diputuskan_pada: `${addDays(t, -2)}T13:00:00+07:00`, dibuat_pada: `${addDays(t, -3)}T07:00:00+07:00` },
  ];
}

// ---- Pemanggil API ----
const endpointBelumAda = (e: unknown) => e instanceof ApiError && e.status === 404 && e.detail === 'Not Found';

async function denganTiruan<T extends object>(fn: () => Promise<T>, tiruan: () => T): Promise<T & { tiruan: boolean }> {
  try {
    return { ...(await fn()), tiruan: false };
  } catch (e) {
    if (endpointBelumAda(e)) return { ...tiruan(), tiruan: true };
    throw e;
  }
}

export const izinApi = {
  papanHariIni: (): Promise<PapanIzin> => denganTiruan(
    async () => {
      const d = await request<{ tanggal: string; items?: Izin[] }>('/izin-kamad/papan-hari-ini');
      return { tanggal: d.tanggal, items: d.items ?? [] };
    },
    () => ({ tanggal: todayISO(), items: papanTiruan() }),
  ),
  ringkasanSatpam: (): Promise<RingkasanSatpam> => denganTiruan(
    () => request<Omit<RingkasanSatpam, 'tiruan'>>('/izin-kamad/ringkasan-satpam'),
    () => {
      const jam = jamSekarangWIB();
      const g = kelompokkanWaktu(papanTiruan(), jam);
      return {
        tanggal: todayISO(), jam, izin_hari_ini: papanTiruan().length, berlangsung: g.berlangsung.length,
        akan_datang: g.akan_datang.length, selesai: g.selesai.length,
        saya_menunggu: sayaTiruan().filter((i) => i.status === 'menunggu').length,
      };
    },
  ),
  kirimCatatan: (izinId: string, isi: string): Promise<{ catatan: Catatan; tiruan: boolean }> => denganTiruan(
    async () => ({ catatan: await request<Catatan>(`/izin-kamad/${izinId}/catatan`, { method: 'POST', body: { isi: isi.trim() } }) }),
    () => ({ catatan: { id: `contoh-catatan-${Date.now()}`, izin_id: izinId, isi: isi.trim(), dibuat_pada: new Date().toISOString() } }),
  ),
  catatan: (izinId: string): Promise<{ items: Catatan[]; tiruan: boolean }> => denganTiruan(
    async () => ({ items: (await request<{ items?: Catatan[] }>(`/izin-kamad/${izinId}/catatan`)).items ?? [] }),
    () => ({
      items: izinId === 'contoh-izin-1' ? [
        { id: 'contoh-catatan-a', izin_id: izinId, penulis_nama: 'Slamet Riyadi (contoh)', isi: 'Keluar pukul 07.35 bersama anak, naik motor sendiri.', dibuat_pada: `${todayISO()}T07:36:00+07:00` },
      ] : [],
    }),
  ),
  saya: (pengaju?: { nama: string; peran: string }): Promise<DaftarIzin> => denganTiruan(
    async () => ({ items: (await request<{ items?: Izin[] }>('/izin-kamad/saya')).items ?? [] }),
    () => ({ items: sayaTiruan(pengaju) }),
  ),
  ajukan: (isi: IsiIzin, pengaju: { nama: string; peran: string }): Promise<{ izin: Izin; tiruan: boolean }> => denganTiruan(
    async () => ({ izin: await request<Izin>('/izin-kamad', { method: 'POST', body: { ...isi, keperluan: isi.keperluan.trim() } }) }),
    () => ({
      izin: {
        ...isi, keperluan: isi.keperluan.trim(), id: `contoh-baru-${Date.now()}`, pengaju_id: 'contoh-saya', pengaju_nama: pengaju.nama,
        pengaju_peran: pengaju.peran, status: 'menunggu' as const, alasan_penolakan: null, diputuskan_oleh_nama: null,
        diputuskan_pada: null, dibuat_pada: new Date().toISOString(),
      },
    }),
  ),
  menunggu: (): Promise<DaftarIzin> => denganTiruan(
    async () => ({ items: (await request<{ items?: Izin[] }>('/izin-kamad/menunggu')).items ?? [] }),
    () => ({ items: menungguTiruan() }),
  ),
  riwayatKeputusan: (): Promise<DaftarIzin> => denganTiruan(
    async () => ({ items: (await request<{ items?: Izin[] }>('/izin-kamad/riwayat-keputusan')).items ?? [] }),
    () => ({ items: riwayatTiruan() }),
  ),
  setujui: (izin: Izin, pemutus: string): Promise<{ izin: Izin; tiruan: boolean }> => denganTiruan(
    async () => ({ izin: await request<Izin>(`/izin-kamad/${izin.id}/setujui`, { method: 'POST' }) }),
    () => ({ izin: { ...izin, status: 'disetujui' as const, alasan_penolakan: null, diputuskan_oleh_nama: pemutus, diputuskan_pada: new Date().toISOString() } }),
  ),
  tolak: (izin: Izin, alasan: string, pemutus: string): Promise<{ izin: Izin; tiruan: boolean }> => denganTiruan(
    async () => ({ izin: await request<Izin>(`/izin-kamad/${izin.id}/tolak`, { method: 'POST', body: { alasan: alasan.trim() } }) }),
    () => ({ izin: { ...izin, status: 'ditolak' as const, alasan_penolakan: alasan.trim(), diputuskan_oleh_nama: pemutus, diputuskan_pada: new Date().toISOString() } }),
  ),
  batalkan: (izin: Izin): Promise<{ izin: Izin; tiruan: boolean }> => denganTiruan(
    async () => ({ izin: await request<Izin>(`/izin-kamad/${izin.id}/batalkan`, { method: 'POST' }) }),
    () => ({ izin: { ...izin, status: 'dibatalkan' as const } }),
  ),
};
