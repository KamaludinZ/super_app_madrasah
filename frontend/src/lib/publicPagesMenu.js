import { Activity, Trophy, CalendarDays, DollarSign } from 'lucide-react';

/**
 * Get public pages menu items based on visibility settings
 * Only returns items that are set to 'dashboard' visibility mode
 * These items will redirect to /public/* routes
 */
export function getPublicPagesMenuItems(visibility) {
  const items = [];

  if (visibility?.monitoring_visibility === 'dashboard') {
    items.push({
      to: '/public/monitoring',
      label: 'Monitoring Jurnal',
      icon: Activity,
      testid: 'nav-monitoring-public',
    });
  }

  if (visibility?.prestasi_visibility === 'dashboard') {
    items.push({
      to: '/public/prestasi',
      label: 'Prestasi Siswa',
      icon: Trophy,
      testid: 'nav-prestasi-public',
    });
  }

  if (visibility?.agenda_visibility === 'dashboard') {
    items.push({
      to: '/public/agenda',
      label: 'Agenda Madrasah',
      icon: CalendarDays,
      testid: 'nav-agenda-public',
    });
  }

  if (visibility?.rkam_visibility === 'dashboard') {
    items.push({
      to: '/public/rkam',
      label: 'RKAM',
      icon: DollarSign,
      testid: 'nav-rkam-public',
    });
  }

  return items;
}
