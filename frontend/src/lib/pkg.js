import { api } from '@/lib/api';

// Modul PKG (Penilaian Kinerja Guru): pemanggil API (backend/routers/pkg.py).
// Penolakan akses dikirim sebagai HTTP 403 dengan detail { alasan, pesan }.

// Rute sub-menu PKG yang halamannya sudah dibangun; menu lain tampil "Segera".
export const RUTE_PKG_TERSEDIA = new Set([]);

// Galat API PKG: menyimpan status & penolakan terstruktur (bila 403) untuk ditampilkan PesanTolakPkg.
export class GalatPkg extends Error {
  constructor(pesan, status, penolakan) {
    super(pesan);
    this.status = status;
    this.penolakan = penolakan;
  }
}

async function panggil(fn, cadangan) {
  try {
    return (await fn()).data;
  } catch (e) {
    const status = e?.response?.status;
    const d = e?.response?.data?.detail;
    if (status === 403 && d && typeof d === 'object' && d.alasan) throw new GalatPkg(d.pesan || cadangan, status, d);
    throw new GalatPkg(typeof d === 'string' ? d : cadangan, status, null);
  }
}

export const ambilKeanggotaan = () => panggil(() => api.get('/pkg/sk/my-membership'), 'Gagal memuat keanggotaan SK PKG.');
export const ambilMenuPkg = () => panggil(() => api.get('/pkg/beranda/menu'), 'Gagal memuat menu PKG.');
export const ambilBeranda = () => panggil(() => api.get('/pkg/beranda'), 'Gagal memuat beranda PKG.');

export const LABEL_PERAN_PKG = {
  kepala: 'Kepala Madrasah · Penilai',
  penilai: 'Penilai',
  dinilai: 'Guru yang dinilai',
};

// Label peran pengguna pada SK aktif (penilai yang juga dinilai disebut merangkap).
export function labelPeranPkg(k) {
  if (!k?.peran) return null;
  if (k.peran === 'penilai' && k.sebagai_dinilai) return 'Penilai · juga dinilai';
  return LABEL_PERAN_PKG[k.peran] || k.peran;
}
