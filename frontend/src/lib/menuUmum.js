import { KeyRound, MapPinned, LockKeyhole, BellRing, DoorOpen, Gavel, ShieldCheck } from 'lucide-react';

// Menu lintas peran yang ditambahkan ke navForRole (AppShell): Persetujuan Izin (kepala madrasah),
// Pengajuan Izin (pengaju izin kamad),
// Simpan Akun (GTK), Masterplan (semua peran; admin mengelola, lainnya melihat), dan Reset PIN Simpan
// Akun (admin). File ini ikut dievaluasi mobile/scripts/sync-web-menu.mjs: tulis daftar & path secara
// literal di sini (bukan diimpor dari modul lain).
// Peran non-GTK tidak memakai Simpan Akun (sama dengan PERAN_NON_GTK di backend/routers/simpan_akun.py).
// Satpam hanya punya akun pengguna (bukan GTK), jadi juga tanpa Simpan Akun.
export const PERAN_NON_GTK = ['siswa', 'kelas', 'orang_tua', 'alumni', 'satpam'];

export const adalahGtk = (role) => !!role && !PERAN_NON_GTK.includes(role);

// Pengaju Izin Kamad: kepala tata usaha, guru mata pelajaran, tenaga kependidikan, satpam
// (sama dengan PERAN_PENGAJU_IZIN di backend/izin_kamad.py).
export const PERAN_PENGAJU_IZIN = [
  'kepala_tata_usaha', 'guru', 'guru_ipa', 'guru_ips', 'guru_bahasa', 'guru_seni', 'guru_agama', 'guru_tik',
  'tenaga_kependidikan', 'satpam',
];
// Pemutus Izin Kamad (sama dengan PERAN_PEMUTUS_IZIN di backend/izin_kamad.py).
export const PERAN_PEMUTUS_IZIN = ['kepala_sekolah'];
// Pemantau izin hari ini (halaman /izin/pemantau): kepala tata usaha. Kepala madrasah memantau dari tab
// "Izin Hari Ini" di Persetujuan Izin; satpam dari dashboard-nya.
export const PERAN_PEMANTAU_IZIN = ['kepala_tata_usaha'];

// Reset PIN Simpan Akun (tanpa melihat isi brankas) hanya untuk admin.
export const bolehResetPinSimpanAkun = (role) => role === 'admin';

export function menuUmum(role) {
  const items = [];
  if (PERAN_PEMUTUS_IZIN.includes(role)) {
    items.push({ to: '/izin/persetujuan', label: 'Persetujuan Izin', icon: Gavel, testid: `nav-${role}-persetujuan-izin` });
  }
  if (PERAN_PEMANTAU_IZIN.includes(role)) {
    items.push({ to: '/izin/pemantau', label: 'Pemantau Izin Hari Ini', icon: ShieldCheck, testid: `nav-${role}-pemantau-izin` });
  }
  if (PERAN_PENGAJU_IZIN.includes(role)) {
    items.push({ to: '/izin', label: 'Pengajuan Izin', icon: DoorOpen, testid: `nav-${role}-pengajuan-izin` });
  }
  if (adalahGtk(role)) {
    items.push({ to: '/gtk/simpan-akun', label: 'Simpan Akun', icon: KeyRound, testid: `nav-${role}-simpan-akun` });
  }
  items.push({ to: '/masterplan', label: 'Masterplan Sekolah', icon: MapPinned, testid: `nav-${role}-masterplan` });
  if (bolehResetPinSimpanAkun(role)) {
    items.push({ to: '/admin/reset-pin-simpan-akun', label: 'Reset PIN Simpan Akun', icon: LockKeyhole, testid: 'nav-admin-reset-pin-simpan-akun' });
  }
  if (role === 'admin') {
    items.push({ to: '/admin/uji-notifikasi', label: 'Uji Notifikasi', icon: BellRing, testid: 'nav-admin-uji-notifikasi' });
  }
  return items;
}

// Tambahkan menu umum ke hasil navForRole: menu berkelompok -> grup "Layanan Umum", menu datar -> di akhir.
export function tambahMenuUmum(nav, role) {
  const tambahan = menuUmum(role);
  if (!tambahan.length) return nav;
  const berkelompok = nav.some((i) => Array.isArray(i.items));
  return berkelompok ? [...nav, { title: 'Layanan Umum', items: tambahan }] : [...nav, ...tambahan];
}
