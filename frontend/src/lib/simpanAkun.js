import { api } from '@/lib/api';

// Simpan Akun: pemanggil API (backend/routers/simpan_akun.py) + aturan PIN.
// Token brankas (terbit setelah PIN benar, berlaku singkat) hanya disimpan di MEMORI — tidak di
// localStorage — dan dikirim lewat header X-Simpan-Akun-Token untuk endpoint isi brankas.

export const BATAS_PERCOBAAN_PIN = 5;

export const pinValid = (pin) => /^\d{6}$/.test(pin || '');

// PIN mudah ditebak -> alasan (string) atau '' bila cukup kuat (sama dengan alasan_pin_lemah di server).
export function alasanPinLemah(pin) {
  if (!pinValid(pin)) return 'PIN harus 6 angka';
  if (/^(\d)\1{5}$/.test(pin)) return 'PIN tidak boleh angka yang sama semua';
  if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'PIN tidak boleh angka berurutan';
  if (/^(\d\d)\1\1$/.test(pin) || /^(\d{3})\1$/.test(pin)) return 'PIN tidak boleh pola berulang';
  return '';
}

let tokenBrankas = null;
const pendengarSesiBerakhir = new Set();

// Daftarkan fungsi yang dipanggil saat sesi brankas berakhir (token kedaluwarsa) -> kembalikan pelepas.
export function onSesiBerakhir(fn) {
  pendengarSesiBerakhir.add(fn);
  return () => pendengarSesiBerakhir.delete(fn);
}

export const brankasTerbuka = () => !!tokenBrankas;

export function kunciBrankas() {
  tokenBrankas = null;
}

const headerBrankas = () => ({ headers: { 'X-Simpan-Akun-Token': tokenBrankas || '' } });

// Ubah galat API menjadi Error berpesan jelas; 401 pada isi brankas = sesi brankas berakhir.
function galatBrankas(e, cadangan) {
  const detail = e?.response?.data?.detail;
  const err = new Error((typeof detail === 'string' ? detail : detail?.pesan) || cadangan);
  if (detail && typeof detail === 'object') {
    err.sisa = detail.sisa_percobaan;
    err.terkunci = !!detail.terkunci;
  }
  err.status = e?.response?.status;
  return err;
}

async function panggilBrankas(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    const err = galatBrankas(e, cadangan);
    if (err.status === 401) {
      kunciBrankas();
      err.sesiBerakhir = true;
      pendengarSesiBerakhir.forEach((fn) => fn());
    }
    throw err;
  }
}

// ---- PIN ----
export async function statusPin() {
  return (await api.get('/simpan-akun/pin/status')).data;
}

export async function buatPin(pin) {
  try {
    tokenBrankas = (await api.post('/simpan-akun/pin', { pin })).data.token;
  } catch (e) {
    throw galatBrankas(e, 'Gagal membuat PIN');
  }
}

export async function verifikasiPin(pin) {
  try {
    tokenBrankas = (await api.post('/simpan-akun/pin/verifikasi', { pin })).data.token;
  } catch (e) {
    throw galatBrankas(e, 'PIN salah');
  }
}

export async function ajukanResetPin(keterangan = '') {
  try {
    return (await api.post('/simpan-akun/pin/lupa', { keterangan: keterangan || null })).data;
  } catch (e) {
    throw galatBrankas(e, 'Gagal mengajukan reset PIN');
  }
}

// ---- Isi brankas (butuh token) ----
export const ambilDaftarAkun = () => panggilBrankas(() => api.get('/simpan-akun', headerBrankas()), 'Gagal memuat daftar akun');
export const ambilDetailAkun = (id) => panggilBrankas(() => api.get(`/simpan-akun/${id}`, headerBrankas()), 'Gagal memuat rincian akun');
export const tambahAkun = (isi) => panggilBrankas(() => api.post('/simpan-akun', isi, headerBrankas()), 'Gagal menyimpan akun');
export const ubahAkun = (id, isi) => panggilBrankas(() => api.put(`/simpan-akun/${id}`, isi, headerBrankas()), 'Gagal menyimpan akun');
export const hapusAkun = (id) => panggilBrankas(() => api.delete(`/simpan-akun/${id}`, headerBrankas()), 'Gagal menghapus akun');

// ---- Reset PIN oleh admin (tanpa akses ke isi brankas) ----
export async function daftarPermintaanReset() {
  return (await api.get('/admin/simpan-akun/reset-pin')).data;
}

export async function resetPinOlehAdmin(userId) {
  try {
    return (await api.post(`/admin/simpan-akun/reset-pin/${userId}`)).data;
  } catch (e) {
    throw galatBrankas(e, 'Gagal mereset PIN');
  }
}
