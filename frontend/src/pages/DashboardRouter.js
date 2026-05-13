import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import AdminDashboard from './dashboards/AdminDashboard';
import GuruDashboard from './dashboards/GuruDashboard';
import SiswaDashboard from './dashboards/SiswaDashboard';
import StaffDashboard from './dashboards/StaffDashboard';

export default function DashboardRouter() {
  const { activeRole } = useAuth();
  switch (activeRole) {
    case 'admin':
      return <AdminDashboard />;
    case 'siswa':
      return <SiswaDashboard />;
    case 'tenaga_kependidikan':
      return <StaffDashboard />;
    case 'guru':
    case 'wali_kelas':
    case 'guru_piket':
    case 'guru_bk':
    case 'guru_tata_tertib':
    case 'guru_ekstrakurikuler':
      return <GuruDashboard />;
    default:
      return <StaffDashboard />;
  }
}
