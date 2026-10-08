import { KeyRound, MapPinned, LockKeyhole, BellRing } from 'lucide-react';

// Menu lintas peran yang ditambahkan ke navForRole (AppShell): Simpan Akun (GTK), Masterplan (semua
// peran; admin mengelola, lainnya melihat), dan Reset PIN Simpan Akun (admin).
// Peran non-GTK tidak memakai Simpan Akun (sama dengan PERAN_NON_GTK di backend/routers/simpan_akun.py).
export const PERAN_NON_GTK = ['siswa', 'kelas', 'orang_tua', 'alumni'];

export const adalahGtk = (role) => !!role && !PERAN_NON_GTK.includes(role);

// Reset PIN Simpan Akun (tanpa melihat isi brankas) hanya untuk admin.
export const bolehResetPinSimpanAkun = (role) => role === 'admin';

export function menuUmum(role) {
  const items = [];
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
