import { BarChart3, Trophy, CalendarDays, DollarSign } from 'lucide-react';

/**
 * Get public pages menu items based on visibility settings
 * Only returns items that are set to 'dashboard' visibility mode
 */
export function getPublicPagesMenuItems(visibility) {
  const items = [];

  if (visibility?.monitoring_visibility === 'dashboard') {
    items.push({
      to: '/monitoring',
      label: 'Monitoring Guru',
      icon: BarChart3,
      testid: 'nav-monitoring',
    });
  }

  if (visibility?.prestasi_visibility === 'dashboard') {
    items.push({
      to: '/prestasi-siswa',
      label: 'Prestasi Siswa',
      icon: Trophy,
      testid: 'nav-prestasi-public',
    });
  }

  if (visibility?.agenda_visibility === 'dashboard') {
    items.push({
      to: '/agenda-madrasah',
      label: 'Agenda Madrasah',
      icon: CalendarDays,
      testid: 'nav-agenda',
    });
  }

  if (visibility?.rkam_visibility === 'dashboard') {
    items.push({
      to: '/rkam',
      label: 'RKAM',
      icon: DollarSign,
      testid: 'nav-rkam',
    });
  }

  return items;
}
