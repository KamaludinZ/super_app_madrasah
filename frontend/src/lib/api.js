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
  guru: 'Guru Mata Pelajaran',
  wali_kelas: 'Wali Kelas',
  siswa: 'Siswa',
  tenaga_kependidikan: 'Tenaga Kependidikan',
  guru_piket: 'Guru Piket',
  guru_bk: 'Guru BK',
  guru_tata_tertib: 'Guru Tata Tertib',
  guru_ekstrakurikuler: 'Guru Ekstrakurikuler',
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
