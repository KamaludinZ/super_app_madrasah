/**
 * Menu per peran = menu web (src/menu/webMenu.json, disinkron dari navForRole web lewat
 * `node scripts/sync-web-menu.mjs`). Item yang sudah punya layar native diarahkan ke layar
 * aplikasi (scan QR, riwayat jurnal, guru pengganti, tugas piket); sisanya dibuka di modul web
 * (/web?path=…) dalam keadaan sudah masuk.
 */
import { api } from '@/api/endpoints';
import { CacheKeys } from '@/db/cache';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import type { IconName } from '@/components/ui/Icon';
import { menuIcon } from './icons';
import webMenu from './webMenu.json';
import { nativeRoute, webHref } from './routes';

export { webHref } from './routes';

export type MenuItem = {
  key: string;
  label: string;
  icon: IconName;
  /** Rute web (path) asal item ini. */
  path: string;
  /** Rute aplikasi tujuan (native atau /web?path=…). */
  href: string;
  native: boolean;
  highlight?: boolean;
};
export type MenuGroup = { title: string | null; items: MenuItem[] };

type WebItem = { to: string; label: string; icon: string; highlight?: boolean };
const ROLES = (webMenu as { roles: Record<string, { title: string | null; items: WebItem[] }[]> }).roles;

export function menuForRole(role: string | null | undefined, opts: { canManageGP: boolean }): MenuGroup[] {
  if (!role) return [];
  // Peran tanpa menu khusus di web hanya mendapat Dashboard (sama dengan navForRole).
  const groups = ROLES[role] ?? [{ title: null, items: [{ to: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard' }] }];
  return groups
    .map((g, gi) => ({
      title: g.title,
      items: g.items
        .filter((i) => opts.canManageGP || i.to !== '/guru-pengganti')
        .map((i, ii) => {
          const nat = nativeRoute(i.to, role);
          return {
            key: `${gi}.${ii}.${i.to}`,
            label: i.label,
            icon: menuIcon(i.icon),
            path: i.to,
            href: nat ?? webHref(i.to, i.label),
            native: !!nat,
            highlight: i.highlight,
          };
        }),
    }))
    .filter((g) => g.items.length > 0);
}

/** Menu peran aktif (memperhitungkan izin Guru Pengganti dari server). */
export function useRoleMenu(): MenuGroup[] {
  const { activeRole } = useAuth();
  const gp = useCached(`${CacheKeys.gpConfig}.${activeRole}`, api.gp.config, { staleTime: 5 * 60_000 });
  const canManageGP = gp.data?.can_manage ?? ['admin', 'waka_kurikulum', 'guru_piket'].includes(activeRole ?? '');
  return menuForRole(activeRole, { canManageGP });
}

/** Pintasan Beranda: item pertama menu peran (tanpa Dashboard & Profil), maksimal `n`. */
export function quickItems(groups: MenuGroup[], n = 8): MenuItem[] {
  const seen = new Set<string>();
  const all = groups.flatMap((g) => g.items).filter((i) => {
    if (i.path === '/dashboard' || i.path.startsWith('/profile') || seen.has(i.path)) return false;
    seen.add(i.path);
    return true;
  });
  return [...all.filter((i) => i.highlight), ...all.filter((i) => !i.highlight)].slice(0, n);
}
