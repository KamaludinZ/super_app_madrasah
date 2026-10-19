import {
  Award, CalendarCog, FileBadge, Split, ShieldCheck, ListTree, ClipboardPen, BarChart3, Printer, History,
} from 'lucide-react';
import { adalahGtk } from '@/lib/menuUmum';
import { RUTE_PKG_TERSEDIA } from '@/lib/pkg';

// Grup menu "Penilaian Kinerja" di sidebar (navForRole AppShell). Isinya bergantung pada keanggotaan SK aktif,
// bukan peran saja: dibangun dari GET /pkg/sk/my-membership + GET /pkg/beranda/menu (akses per sub-menu).
// Hanya akun GTK yang diperiksa; siswa/kelas/orang tua/alumni tidak pernah mendapat menu PKG.

const IKON_MENU_PKG = {
  periode: CalendarCog,
  sk: FileBadge,
  penugasan: Split,
  supervisi: ShieldCheck,
  instrumen: ListTree,
  penilaian: ClipboardPen,
  rekap: BarChart3,
  cetak: Printer,
  audit: History,
};

export const JUDUL_GRUP_PKG = 'Penilaian Kinerja';

export const perluMenuPkg = (role) => adalahGtk(role);

// Item grup PKG: Beranda + sub-menu yang boleh diakses dan halamannya sudah dibangun.
export function menuPkg(keanggotaan, menu = []) {
  if (!keanggotaan?.anggota) return [];
  return [
    { to: '/pkg', label: 'Beranda PKG', icon: Award, testid: 'nav-pkg-beranda' },
    ...menu
      .filter((m) => m.akses && RUTE_PKG_TERSEDIA.has(m.to))
      .map((m) => ({ to: m.to, label: m.label, icon: IKON_MENU_PKG[m.key] || Award, testid: `nav-pkg-${m.key}` })),
  ];
}

// Tambahkan grup PKG ke hasil navForRole: menu berkelompok -> grup sendiri sebelum "Layanan Umum",
// menu datar -> di akhir.
export function tambahMenuPkg(nav, itemPkg) {
  if (!itemPkg?.length) return nav;
  if (!nav.some((i) => Array.isArray(i.items))) return [...nav, ...itemPkg];
  const grup = { title: JUDUL_GRUP_PKG, items: itemPkg };
  const iUmum = nav.findIndex((i) => i.title === 'Layanan Umum');
  return iUmum === -1 ? [...nav, grup] : [...nav.slice(0, iUmum), grup, ...nav.slice(iUmum)];
}
