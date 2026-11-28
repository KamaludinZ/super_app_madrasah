import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const BASE = `${BACKEND_URL}/api`;
// Alamat dasar API (mis. untuk ditampilkan sebagai alamat yang dipasang di aplikasi lain).
export const BASE_API = BASE;

export const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('matsa_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---- Laporan galat browser ke tab "Errors" (/admin/audit-logs) ----
// Galat yang tidak pernah sampai ke backend (koneksi terputus, diblokir Cloudflare/proxy, 502/503/504/52x dari proxy)
// tidak tercatat di server, jadi dilaporkan dari sini. Pakai klien terpisah agar tidak berulang, dibatasi per alamat.
const STATUS_PROXY = [502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 530];
const pelapor = axios.create({ baseURL: BASE, timeout: 15000 });
const jejakLapor = {};

function ukuranUnggahan(data) {
  try {
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
      let n = 0;
      data.forEach((v) => { n += v && typeof v === 'object' && 'size' in v ? v.size : String(v).length; });
      return n;
    }
  } catch { /* abaikan */ }
  return undefined;
}

export function laporGalatBrowser(err) {
  try {
    const cfg = err?.config || {};
    const status = err?.response?.status;
    if (err?.code === 'ERR_CANCELED' || (cfg.url || '').includes('/admin/error-logs/klien')) return;
    const habisWaktu = err?.code === 'ECONNABORTED';
    const terputus = !err?.response && !habisWaktu;
    if (!terputus && !habisWaktu && !STATUS_PROXY.includes(status)) return;
    const token = localStorage.getItem('matsa_token');
    if (!token) return;
    const metode = (cfg.method || 'get').toUpperCase();
    const kunci = `${metode} ${cfg.url}`;
    const kini = Date.now();
    if (jejakLapor[kunci] && kini - jejakLapor[kunci] < 15000) return;
    jejakLapor[kunci] = kini;
    const isi = {
      jenis: terputus ? 'jaringan' : habisWaktu ? 'Waktu habis' : `HTTP ${status} dari proxy`,
      pesan: `${err?.message || ''}${err?.code ? ` (${err.code})` : ''}`.slice(0, 500),
      metode, path: `/api${(cfg.url || '').startsWith('/') ? '' : '/'}${cfg.url || ''}`.slice(0, 300), status: status ?? null,
      halaman: window.location.pathname.slice(0, 300), ukuran_unggahan: ukuranUnggahan(cfg.data),
      online: typeof navigator !== 'undefined' ? navigator.onLine : null,
    };
    const kirim = (sisa) => pelapor.post('/admin/error-logs/klien', isi, { headers: { Authorization: `Bearer ${token}` } })
      .catch(() => { if (sisa > 0) setTimeout(() => kirim(sisa - 1), 10000); });
    setTimeout(() => kirim(1), 1000);
  } catch { /* pelaporan tidak boleh mengganggu aplikasi */ }
}

api.interceptors.response.use(
  (r) => r,
  (err) => {
    laporGalatBrowser(err);
    if (err?.response?.status === 401) {
      localStorage.removeItem('matsa_token');
      localStorage.removeItem('matsa_user');
      // soft redirect
      const path = window.location.pathname;
      if (!path.startsWith('/login') &&
          !path.startsWith('/public') &&
          !path.startsWith('/kelas-login') &&
          !path.startsWith('/forgot-password') &&
          !path.startsWith('/reset-password')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Buka file yang di-protect auth (mis. /api/students/detail/upload/.../file/...) di tab baru.
// Link <a href> biasa tidak menyertakan Authorization header, jadi harus fetch via axios lalu
// dibuka sebagai blob URL.
export async function openAuthedFile(pathOrUrl) {
  const path = pathOrUrl.startsWith(BASE) ? pathOrUrl.slice(BASE.length) : pathOrUrl.replace(/^\/api/, '');
  const { data } = await api.get(path, { responseType: 'blob' });
  const blobUrl = URL.createObjectURL(data);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}

export const ROLE_LABELS = {
  admin: 'Administrator',
  siswa: 'Siswa',
  guru: 'Guru Mata Pelajaran',
  guru_ipa: 'Guru IPA',
  guru_ips: 'Guru IPS',
  guru_bahasa: 'Guru Bahasa',
  guru_seni: 'Guru Seni',
  guru_agama: 'Guru Agama',
  guru_tik: 'Guru TIK',
  tenaga_kependidikan: 'Tenaga Kependidikan',
  guru_ekstrakurikuler: 'Guru Ekstrakurikuler',
  guru_piket: 'Guru Piket',
  guru_bk: 'Guru BK',
  wali_kelas: 'Wali Kelas',
  guru_tata_tertib: 'Guru Tata Tertib',
  alumni: 'Alumni',
  kepala_sekolah: 'Kepala Sekolah',
  kepala_tata_usaha: 'Kepala Tata Usaha',
  waka_kesiswaan: 'Waka Kesiswaan',
  waka_kurikulum: 'Waka Kurikulum',
  waka_sarpras: 'Waka Sarana Prasarana',
  waka_humas: 'Waka Humas',
  bendahara: 'Bendahara',
  kepegawaian: 'Kepegawaian',
  perpustakaan: 'Perpustakaan',
  unit_pelayanan: 'Unit Pelayanan',
  unit_kesehatan: 'Unit Kesehatan',
  penjamin_mutu: 'Penjamin Mutu',
  unit_pengaduan: 'Unit Pengaduan',
  unit_ubudiyah: 'Unit Ubudiyah',
  unit_olimpiade: 'Unit Olimpiade',
  unit_tahfidz: 'Unit Tahfidz',
  unit_kopsis: 'Unit Kopsis',
  mundhir_mahad: 'Mundhir Mahad',
  musrif_mahad: 'Musrif Mahad',
  musrifah_mahad: 'Musrifah Mahad',
  murabbi_mahad: 'Murabbi Mahad',
  bendahara_mahad: 'Bendahara Mahad',
  satpam: 'Satpam',
};

export const DAY_LABELS = {
  senin: 'Senin', selasa: 'Selasa', rabu: 'Rabu',
  kamis: 'Kamis', jumat: 'Jumat', sabtu: 'Sabtu', minggu: 'Minggu',
};

export const STATUS_COLORS = {
  filled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  missing: 'bg-rose-50 text-rose-700 border-rose-200',
  not_started: 'bg-slate-50 text-slate-600 border-slate-200',
};

export const STATUS_LABELS = {
  filled: 'Jurnal Terisi',
  pending: 'Sedang Berlangsung',
  missing: 'Belum Diisi',
  not_started: 'Akan Datang',
};
