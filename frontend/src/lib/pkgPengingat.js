import { hariIniWIB } from '@/lib/tanggal';

// Pengingat tenggat PKG. Notifikasi lonceng (source 'pkg') dibentuk backend di GET /notifications.

// Selisih hari dari hari ini (WIB) ke tanggal 'YYYY-MM-DD'; null bila pengingat tanpa tanggal.
export const sisaHari = (tanggal) => (tanggal
  ? Math.round((new Date(`${tanggal}T00:00:00Z`) - new Date(`${hariIniWIB()}T00:00:00Z`)) / 86400000)
  : null);
