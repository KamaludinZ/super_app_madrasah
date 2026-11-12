/**
 * Grup menu "Penilaian Kinerja" (PKG) — sama dengan frontend/src/lib/menuPkg.js. Isinya bergantung pada
 * keanggotaan SK aktif (GET /pkg/sk/my-membership) dan akses per sub-menu (GET /pkg/beranda/menu), bukan peran
 * saja: kepala madrasah dan guru yang ditugaskan sebagai tim penilai/dinilai mendapat menu ini. Halaman PKG dibuka
 * di modul web (sudah masuk); unduhan cetak PKG ditangani jembatan unduhan WebView.
 */
import { request } from '@/api/client';
import type { IconName } from '@/components/ui/Icon';
import type { MenuGroup } from './index';
import { webHref } from './routes';

type Keanggotaan = { anggota: boolean };
export type ItemMenuPkg = { key: string; label: string; to: string; akses: boolean };

export const JUDUL_GRUP_PKG = 'Penilaian Kinerja';

// Peran tanpa menu PKG (sama dengan PERAN_NON_GTK di frontend/src/lib/menuUmum.js).
const PERAN_NON_GTK = ['siswa', 'kelas', 'orang_tua', 'alumni', 'satpam'];
export const perluMenuPkg = (role: string | null | undefined) => !!role && !PERAN_NON_GTK.includes(role);

// Sub-menu yang halamannya sudah dibangun di web (RUTE_PKG_TERSEDIA di frontend/src/lib/pkg.js).
const RUTE_PKG_TERSEDIA = new Set(['/pkg/periode', '/pkg/sk', '/pkg/penugasan', '/pkg/supervisi', '/pkg/instrumen', '/pkg/penilaian', '/pkg/komponen', '/pkg/rekap', '/pkg/cetak', '/pkg/audit']);

const IKON: Record<string, IconName> = {
  periode: 'calendar-outline',
  sk: 'document-text-outline',
  penugasan: 'git-branch-outline',
  supervisi: 'shield-checkmark-outline',
  instrumen: 'list-outline',
  penilaian: 'create-outline',
  komponen: 'people-outline',
  rekap: 'stats-chart-outline',
  cetak: 'print-outline',
  audit: 'time-outline',
};

/** Sub-menu PKG milik pengguna; [] bila bukan anggota SK aktif. */
export async function ambilMenuPkg(): Promise<ItemMenuPkg[]> {
  const k = await request<Keanggotaan>('/pkg/sk/my-membership');
  return k?.anggota ? request<ItemMenuPkg[]>('/pkg/beranda/menu') : [];
}

/** Grup PKG: Beranda PKG + sub-menu yang boleh diakses dan halamannya sudah ada; null bila kosong. */
export function grupPkg(menu: ItemMenuPkg[] | undefined): MenuGroup | null {
  if (!menu?.length) return null;
  const items = [
    { to: '/pkg', label: 'Beranda PKG', key: 'beranda' },
    ...menu.filter((m) => m.akses && RUTE_PKG_TERSEDIA.has(m.to)),
  ].map((m) => ({
    key: `pkg.${m.key}`,
    label: m.label,
    icon: IKON[m.key] ?? 'ribbon-outline',
    path: m.to,
    href: webHref(m.to, m.label),
    native: false,
  }));
  return { title: JUDUL_GRUP_PKG, items };
}

/** Sisipkan grup PKG sebelum "Layanan Umum" (sama dengan tambahMenuPkg web), atau di akhir. */
export function tambahGrupPkg(groups: MenuGroup[], grup: MenuGroup | null): MenuGroup[] {
  if (!grup) return groups;
  const iUmum = groups.findIndex((g) => g.title === 'Layanan Umum');
  return iUmum === -1 ? [...groups, grup] : [...groups.slice(0, iUmum), grup, ...groups.slice(iUmum)];
}
