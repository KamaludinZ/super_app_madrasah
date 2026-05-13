import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import LoginPage from '@/pages/LoginPage';
import PublicMonitoring from '@/pages/PublicMonitoring';
import AppShell from '@/components/layout/AppShell';
import DashboardRouter from '@/pages/DashboardRouter';
import JurnalScanPage from '@/pages/JurnalScanPage';
import JurnalHistoryPage from '@/pages/JurnalHistoryPage';
import JadwalPage from '@/pages/JadwalPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminClassesPage from '@/pages/admin/AdminClassesPage';
import AdminRoomsPage from '@/pages/admin/AdminRoomsPage';
import AdminSubjectsPage from '@/pages/admin/AdminSubjectsPage';
import AdminSchedulesPage from '@/pages/admin/AdminSchedulesPage';
import AdminQRGeneratorPage from '@/pages/admin/AdminQRGeneratorPage';
import AdminAuditLogsPage from '@/pages/admin/AdminAuditLogsPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';
import AdminAcademicYearPage from '@/pages/admin/AdminAcademicYearPage';
import ParentDashboard from '@/pages/ParentDashboard';
import WaliKelasDashboard from '@/pages/WaliKelasDashboard';

import './App.css';

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return <AppShell><Outlet /></AppShell>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/public/monitoring" element={<PublicMonitoring />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<DashboardRouter />} />
            <Route path="/jurnal/scan" element={<JurnalScanPage />} />
            <Route path="/jurnal/riwayat" element={<JurnalHistoryPage />} />
            <Route path="/jadwal" element={<JadwalPage />} />
            <Route path="/parent" element={<ParentDashboard />} />
            <Route path="/wali-kelas" element={<WaliKelasDashboard />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/classes" element={<AdminClassesPage />} />
            <Route path="/admin/rooms" element={<AdminRoomsPage />} />
            <Route path="/admin/subjects" element={<AdminSubjectsPage />} />
            <Route path="/admin/schedules" element={<AdminSchedulesPage />} />
            <Route path="/admin/qr-generator" element={<AdminQRGeneratorPage />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/academic-year" element={<AdminAcademicYearPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
