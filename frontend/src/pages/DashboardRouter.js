import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import AdminDashboard from './dashboards/AdminDashboard';
import GuruDashboard from './dashboards/GuruDashboard';
import GuruBkDashboard from './dashboards/GuruBkDashboard';
import GuruTatibDashboard from './dashboards/GuruTatibDashboard';
import KepsekDashboard from './dashboards/KepsekDashboard';
import SiswaDashboard from './dashboards/SiswaDashboard';
import StaffDashboard from './dashboards/StaffDashboard';
import UnitKesehatanDashboard from './dashboards/UnitKesehatanDashboard';
import WaliKelasDashboard from './dashboards/WaliKelasDashboard';
import KelasDashboard from './dashboards/KelasDashboard';
import AnnouncementsCard from '@/components/notifications/AnnouncementsCard';
import PublicPagesSection from '@/components/PublicPagesSection';
import NotificationPermissionBanner from '@/components/NotificationPermissionBanner';

/**
 * Wrapper that shows common sections (announcements, public pages) at top of dashboard,
 * then delegates to the role-specific dashboard component.
 */
export default function DashboardRouter() {
  const { activeRole } = useAuth();

  // Roles that should see admin-style dashboard with stats
  const adminLikeRoles = [
    'admin',
    'kepala_sekolah',
    'kepala_tata_usaha',
    'waka_sarana_prasarana',
    'waka_kesiswaan',
    'waka_kurikulum',
    'waka_humas'
  ];

  const isAdmin = adminLikeRoles.includes(activeRole);

  // Check if user is a teacher (should see notification banner)
  const isTeacher = [
    'guru',
    'guru_ipa',
    'guru_ips',
    'guru_bahasa',
    'guru_seni',
    'guru_agama',
    'guru_tik',
    'guru_piket',
    'guru_bk',
    'guru_tata_tertib',
    'guru_ekstrakurikuler',
    'wali_kelas'
  ].includes(activeRole);

  let DashboardComponent;
  switch (activeRole) {
    case 'admin':
    case 'kepala_tata_usaha':
    case 'waka_sarana_prasarana':
    case 'waka_kesiswaan':
    case 'waka_kurikulum':
    case 'waka_humas':
      DashboardComponent = AdminDashboard; break;
    case 'kepala_sekolah':
      DashboardComponent = KepsekDashboard; break;
    case 'siswa':
      DashboardComponent = SiswaDashboard; break;
    case 'tenaga_kependidikan':
      DashboardComponent = StaffDashboard; break;
    case 'unit_kesehatan':
      DashboardComponent = UnitKesehatanDashboard; break;
    case 'wali_kelas':
      DashboardComponent = WaliKelasDashboard; break;
    case 'kelas':
      DashboardComponent = KelasDashboard; break;
    case 'guru_bk':
      DashboardComponent = GuruBkDashboard; break;
    case 'guru_tata_tertib':
      DashboardComponent = GuruTatibDashboard; break;
    case 'guru':
    case 'guru_ipa':
    case 'guru_ips':
    case 'guru_bahasa':
    case 'guru_seni':
    case 'guru_agama':
    case 'guru_tik':
    case 'guru_piket':
    case 'guru_ekstrakurikuler':
      DashboardComponent = GuruDashboard; break;
    default:
      DashboardComponent = StaffDashboard;
  }

  return (
    <div className="space-y-4">
      {/* Notification permission banner for all non-admin users */}
      {!isAdmin && <NotificationPermissionBanner />}

      {!isAdmin && <AnnouncementsCard />}
      <DashboardComponent />
      {!isAdmin && <PublicPagesSection />}
    </div>
  );
}
