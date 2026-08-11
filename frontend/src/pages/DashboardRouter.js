import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import AdminDashboard from './dashboards/AdminDashboard';
import GuruDashboard from './dashboards/GuruDashboard';
import SiswaDashboard from './dashboards/SiswaDashboard';
import StaffDashboard from './dashboards/StaffDashboard';
import WaliKelasDashboard from './dashboards/WaliKelasDashboard';
import AnnouncementsCard from '@/components/notifications/AnnouncementsCard';
import PublicPagesSection from '@/components/PublicPagesSection';
import NotificationPermissionBanner from '@/components/NotificationPermissionBanner';

/**
 * Wrapper that shows common sections (announcements, public pages) at top of dashboard,
 * then delegates to the role-specific dashboard component.
 */
export default function DashboardRouter() {
  const { activeRole } = useAuth();
  const isAdmin = activeRole === 'admin';

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
      DashboardComponent = AdminDashboard; break;
    case 'siswa':
      DashboardComponent = SiswaDashboard; break;
    case 'tenaga_kependidikan':
      DashboardComponent = StaffDashboard; break;
    case 'wali_kelas':
      DashboardComponent = WaliKelasDashboard; break;
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
