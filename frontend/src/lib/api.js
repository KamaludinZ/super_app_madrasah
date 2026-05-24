import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const BASE = `${BACKEND_URL}/api`;

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

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('matsa_token');
      localStorage.removeItem('matsa_user');
      // soft redirect
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/public')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export const ROLE_LABELS = {
  admin: 'Administrator',
  siswa: 'Siswa',
  guru: 'Guru Mata Pelajaran',
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
