import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import AdminDashboard from './dashboards/AdminDashboard';
import GuruDashboard from './dashboards/GuruDashboard';
import SiswaDashboard from './dashboards/SiswaDashboard';
import StaffDashboard from './dashboards/StaffDashboard';
import WaliKelasDashboard from './WaliKelasDashboard';
import AnnouncementsCard from '@/components/notifications/AnnouncementsCard';

/**
 * Wrapper that shows AnnouncementsCard at top of dashboard for non-admin roles,
 * then delegates to the role-specific dashboard component.
 */
export default function DashboardRouter() {
  const { activeRole } = useAuth();
  const isAdmin = activeRole === 'admin';

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
      {!isAdmin && <AnnouncementsCard />}
      <DashboardComponent />
    </div>
  );
}
