import {
  ClipboardList, UsersRound, DoorClosed, UserCheck, SlidersHorizontal, ClipboardCheck, FileSignature, Printer, Archive,
  FileSpreadsheet,
} from 'lucide-react';
import { PERAN_PENGELOLA_UJIAN, PERAN_PIMPINAN_UJIAN, RUTE_UJIAN_TERSEDIA, mungkinPanitia } from '@/lib/ujian';

// Grup menu "Ujian Madrasah" di sidebar (navForRole AppShell). Isinya dari GET /ujian/akses-saya: pengelola
// (admin) mendapat semua menu, kepala madrasah & waka kurikulum menu pantau, dan GTK yang ditetapkan sebagai
// panitia langsung mendapat menu sesuai jabatannya tanpa pengaturan tambahan.

export { PERAN_PENGELOLA_UJIAN, PERAN_PIMPINAN_UJIAN };
export const JUDUL_GRUP_UJIAN = 'Ujian Madrasah';

export const IKON_MENU_UJIAN = {
  panitia: UsersRound,
  ruang: DoorClosed,
  pengawas: UserCheck,
  formulir: SlidersHorizontal,
  daftar_hadir: ClipboardCheck,
  berita_acara: FileSignature,
  cetak: Printer,
  arsip: Archive,
  nilai: FileSpreadsheet,
};

// Peran yang perlu memeriksa akses ujian ke server (semua GTK & pimpinan; siswa/kelas/orang tua/satpam tidak).
export const perluMenuUjian = (role) => mungkinPanitia(role);

/**
 * Item grup menu Ujian dari akses pengguna: Beranda bila pengguna pengelola, pimpinan, atau menjabat panitia;
 * lalu sub-menu yang boleh diakses dan halamannya sudah dibangun.
 */
export function menuUjian(akses) {
  if (!akses || !(akses.pengelola || akses.pimpinan || akses.jabatan?.length)) return [];
  return [
    { to: '/ujian', label: 'Beranda Ujian', icon: ClipboardList, testid: 'nav-ujian-beranda' },
    ...(akses.menu || [])
      .filter((m) => m.akses && RUTE_UJIAN_TERSEDIA.has(m.to))
      .map((m) => ({ to: m.to, label: m.label, icon: IKON_MENU_UJIAN[m.key] || ClipboardList, testid: `nav-ujian-${m.key}` })),
  ];
}

// Tambahkan grup Ujian ke hasil navForRole: menu berkelompok -> grup sendiri sebelum "Layanan Umum",
// menu datar -> di akhir.
export function tambahMenuUjian(nav, itemUjian) {
  if (!itemUjian?.length) return nav;
  if (!nav.some((i) => Array.isArray(i.items))) return [...nav, ...itemUjian];
  const grup = { title: JUDUL_GRUP_UJIAN, items: itemUjian };
  const iUmum = nav.findIndex((i) => i.title === 'Layanan Umum');
  return iUmum === -1 ? [...nav, grup] : [...nav.slice(0, iUmum), grup, ...nav.slice(iUmum)];
}
