import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import AdminDashboard from './dashboards/AdminDashboard';
import GuruDashboard from './dashboards/GuruDashboard';
import SiswaDashboard from './dashboards/SiswaDashboard';
import StaffDashboard from './dashboards/StaffDashboard';
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
    'guru_piket',
    'guru_bk',
    'guru_tata_tertib',
    'guru_ekstrakurikuler',
    'wali_kelas'
  ].includes(activeRole);

  let DashboardComponent;
  switch (activeRole) {
    case 'admin':
    case 'kepala_sekolah':
    case 'kepala_tata_usaha':
    case 'waka_sarana_prasarana':
    case 'waka_kesiswaan':
    case 'waka_kurikulum':
    case 'waka_humas':
      DashboardComponent = AdminDashboard; break;
    case 'siswa':
      DashboardComponent = SiswaDashboard; break;
    case 'tenaga_kependidikan':
      DashboardComponent = StaffDashboard; break;
    case 'wali_kelas':
      DashboardComponent = WaliKelasDashboard; break;
    case 'kelas':
      DashboardComponent = KelasDashboard; break;
    case 'guru':
    case 'guru_piket':
    case 'guru_bk':
    case 'guru_tata_tertib':
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
