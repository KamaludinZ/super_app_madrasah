import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import LoginPage from '@/pages/LoginPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import PublicMonitoring from '@/pages/PublicMonitoring';
import PublicPrestasi from '@/pages/PublicPrestasi';
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
import WaliKelasDashboard from '@/pages/WaliKelasDashboard';
import DataSiswaPage from '@/pages/DataSiswaPage';
import KehadiranPage from '@/pages/KehadiranPage';
import KebersihanPage from '@/pages/KebersihanPage';
import AdminKebersihanPage from '@/pages/admin/AdminKebersihanPage';
import JadwalPiketPage from '@/pages/admin/JadwalPiketPage';
import AdminJurnalRekapPage from '@/pages/admin/AdminJurnalRekapPage';
import AdminImportPage from '@/pages/admin/AdminImportPage';
import AdminHolidaysPage from '@/pages/admin/AdminHolidaysPage';
import AdminBackupPage from '@/pages/admin/AdminBackupPage';
import PiketTasksPage from '@/pages/PiketTasksPage';
import MySchedulePage from '@/pages/MySchedulePage';
import AdminMutationsPage from '@/pages/admin/AdminMutationsPage';
import AchievementsPage from '@/pages/AchievementsPage';
import EkstrakurikulerPage from '@/pages/EkstrakurikulerPage';
import GradesInputPage from '@/pages/GradesInputPage';
import RaporPage from '@/pages/RaporPage';
import AnnouncementsListPage from '@/pages/AnnouncementsListPage';
import AdminAnnouncementsPage from '@/pages/admin/AdminAnnouncementsPage';
import AdminCurriculumsPage from '@/pages/admin/AdminCurriculumsPage';
import AdminGTKPage from '@/pages/admin/AdminGTKPage';
import ReportPage from '@/pages/ReportPage';
import WaliKelasReportsPage from '@/pages/WaliKelasReportsPage';
import AdminReportsPage from '@/pages/admin/AdminReportsPage';
import PanduanPage from '@/pages/PanduanPage';
import ErrorPage from '@/pages/ErrorPage';
import MaintenancePage from '@/pages/MaintenancePage';

import './App.css';

function MaintenanceGate({ children }) {
  const { settings, user } = useAuth();
  const isAdmin = (user?.roles || []).includes('admin');
  if (settings?.maintenance_mode && !isAdmin) {
    return <MaintenancePage />;
  }
  return children;
}

function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return (
    <MaintenanceGate>
      <AppShell><Outlet /></AppShell>
    </MaintenanceGate>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/public/monitoring" element={<PublicMonitoring />} />
          <Route path="/public/prestasi" element={<PublicPrestasi />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<DashboardRouter />} />
            <Route path="/jurnal/scan" element={<JurnalScanPage />} />
            <Route path="/jurnal/riwayat" element={<JurnalHistoryPage />} />
            <Route path="/jadwal" element={<JadwalPage />} />
            <Route path="/wali-kelas" element={<WaliKelasDashboard />} />
            <Route path="/wali-kelas/siswa" element={<DataSiswaPage />} />
            <Route path="/wali-kelas/kehadiran" element={<KehadiranPage />} />
            <Route path="/wali-kelas/kebersihan" element={<KebersihanPage />} />
            <Route path="/wali-kelas/laporan" element={<WaliKelasReportsPage />} />
            <Route path="/guru/kebersihan" element={<KebersihanPage />} />
            <Route path="/guru/laporan" element={<ReportPage />} />
            <Route path="/admin/siswa" element={<DataSiswaPage />} />
            <Route path="/admin/kehadiran" element={<KehadiranPage />} />
            <Route path="/admin/kebersihan" element={<AdminKebersihanPage />} />
            <Route path="/admin/laporan" element={<AdminReportsPage />} />
            <Route path="/admin/jadwal-piket" element={<JadwalPiketPage />} />
            <Route path="/admin/jurnal" element={<AdminJurnalRekapPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/gtk" element={<AdminGTKPage />} />
            <Route path="/admin/classes" element={<AdminClassesPage />} />
            <Route path="/admin/rooms" element={<AdminRoomsPage />} />
            <Route path="/admin/subjects" element={<AdminSubjectsPage />} />
            <Route path="/admin/schedules" element={<AdminSchedulesPage />} />
            <Route path="/admin/qr-generator" element={<AdminQRGeneratorPage />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/academic-year" element={<AdminAcademicYearPage />} />
            <Route path="/admin/import" element={<AdminImportPage />} />
            <Route path="/admin/holidays" element={<AdminHolidaysPage />} />
            <Route path="/admin/backup" element={<AdminBackupPage />} />
            <Route path="/admin/pengumuman" element={<AdminAnnouncementsPage />} />
            <Route path="/admin/kurikulum" element={<AdminCurriculumsPage />} />
            <Route path="/piket/tugas" element={<PiketTasksPage />} />
            <Route path="/jadwal/atur" element={<MySchedulePage />} />
            <Route path="/admin/mutasi" element={<AdminMutationsPage />} />
            <Route path="/prestasi" element={<AchievementsPage />} />
            <Route path="/ekstrakurikuler" element={<EkstrakurikulerPage />} />
            <Route path="/nilai/input" element={<GradesInputPage />} />
            <Route path="/rapor" element={<RaporPage />} />
            <Route path="/pengumuman" element={<AnnouncementsListPage />} />
            <Route path="/panduan" element={<PanduanPage />} />
            <Route path="/panduan/:slug" element={<PanduanPage />} />
            <Route path="/error/:code" element={<ErrorPage />} />
          </Route>
          <Route path="*" element={<ErrorPage code={404} />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
