import {
  ClipboardList, UsersRound, DoorClosed, UserCheck, SlidersHorizontal, ClipboardCheck, FileSignature, Printer, Archive,
  FileSpreadsheet, IdCard, Armchair, Link2, FileUp, FolderDown, ShieldCheck,
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
  tautan_publik: Link2,
  berkas_soal: FolderDown,
  audit_publik: ShieldCheck,
  daftar_hadir: ClipboardCheck,
  berita_acara: FileSignature,
  cetak: Printer,
  kartu_peserta: IdCard,
  kartu_meja: Armchair,
  arsip: Archive,
  nilai: FileSpreadsheet,
};

// Peran yang perlu memeriksa akses ujian ke server (semua GTK & pimpinan; siswa/kelas/orang tua/satpam tidak).
export const perluMenuUjian = (role) => mungkinPanitia(role);

/**
 * Item grup menu Ujian dari akses pengguna: Beranda bila pengguna pengelola, pimpinan, atau menjabat panitia;
 * lalu sub-menu yang boleh diakses dan halamannya sudah dibangun.
 */
// Guru PJ mata pelajaran (akses.pj_berkas dari server) dan admin mengunggah kisi-kisi & kartu soal; guru PJ yang
// bukan panitia hanya mendapat item ini (tanpa Beranda Ujian).
const ITEM_UNGGAH_BERKAS = { to: '/ujian/unggah-berkas', label: 'Unggah Berkas Soal', icon: FileUp, testid: 'nav-ujian-unggah-berkas' };

export function menuUjian(akses) {
  if (!akses) return [];
  const unggah = akses.pengelola || akses.pj_berkas ? [ITEM_UNGGAH_BERKAS] : [];
  if (!(akses.pengelola || akses.pimpinan || akses.jabatan?.length)) return unggah;
  return [
    { to: '/ujian', label: 'Beranda Ujian', icon: ClipboardList, testid: 'nav-ujian-beranda' },
    ...(akses.menu || [])
      .filter((m) => m.akses && RUTE_UJIAN_TERSEDIA.has(m.to))
      .map((m) => ({ to: m.to, label: m.label, icon: IKON_MENU_UJIAN[m.key] || ClipboardList, testid: `nav-ujian-${m.key}` })),
    ...unggah,
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
