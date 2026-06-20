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
import AdminPenggunaSiswaPage from '@/pages/admin/AdminPenggunaSiswaPage';
import AdminClassesPage from '@/pages/admin/AdminClassesPage';
import AdminJabatanPage from '@/pages/admin/AdminJabatanPage';
import AdminRoomsPage from '@/pages/admin/AdminRoomsPage';
import AdminSubjectsPage from '@/pages/admin/AdminSubjectsPage';
import AdminSchedulesPage from '@/pages/admin/AdminSchedulesPage';
import AdminQRGeneratorPage from '@/pages/admin/AdminQRGeneratorPage';
import AdminAuditLogsPage from '@/pages/admin/AdminAuditLogsPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';
import AdminAcademicYearPage from '@/pages/admin/AdminAcademicYearPage';
import AdminTahunTakwimPage from '@/pages/admin/AdminTahunTakwimPage';
import AdminSemestersPage from '@/pages/admin/AdminSemestersPage';
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
import AdminGTKDetailPage from '@/pages/admin/AdminGTKDetailPage';
import AdminLaporanAbsensiPage from '@/pages/admin/AdminLaporanAbsensiPage';
import AdminAgendaGuruPage from '@/pages/admin/AdminAgendaGuruPage';
import AdminAgendaTendikPage from '@/pages/admin/AdminAgendaTendikPage';
import AdminEKinerjaPage from '@/pages/admin/AdminEKinerjaPage';
import AdminProfesionalitasGTKPage from '@/pages/admin/AdminProfesionalitasGTKPage';
import AdminPIPReceiverPage from '@/pages/admin/AdminPIPReceiverPage';
import AdminPIPProposalPage from '@/pages/admin/AdminPIPProposalPage';
import ReportPage from '@/pages/ReportPage';
import WaliKelasReportsPage from '@/pages/WaliKelasReportsPage';
import AdminReportsPage from '@/pages/admin/AdminReportsPage';
import AdminAppInfoPage from '@/pages/admin/AdminAppInfoPage';
import AdminAlumniPage from '@/pages/admin/AdminAlumniPage';
import AdminPromotionsPage from '@/pages/admin/AdminPromotionsPage';
import AdminStudentRecordsPage from '@/pages/admin/AdminStudentRecordsPage';
import AdminBukuIndukKepegawaianPage from '@/pages/admin/AdminBukuIndukKepegawaianPage';
import AdminCetakAbsensiManualPage from '@/pages/admin/AdminCetakAbsensiManualPage';
import AdminVervalSiswaPage from '@/pages/admin/AdminVervalSiswaPage';
import AdminVervalGTKPage from '@/pages/admin/AdminVervalGTKPage';
import AdminIndikatorMateriPage from '@/pages/admin/AdminIndikatorMateriPage';
import GuruInputIndikatorMateriPage from '@/pages/GuruInputIndikatorMateriPage';
import AdminTatibKategoriPage from '@/pages/admin/AdminTatibKategoriPage';
import AdminTatibInputPage from '@/pages/admin/AdminTatibInputPage';
import AdminTatibPenangananPage from '@/pages/admin/AdminTatibPenangananPage';
import AdminTatibDataPage from '@/pages/admin/AdminTatibDataPage';
import MyVervalRequestsPage from '@/pages/MyVervalRequestsPage';
import ProfilePage from '@/pages/ProfilePage';
import ProfilePageEMIS from '@/pages/ProfilePageEMIS';
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

// Component to dynamically update favicon from settings
function DynamicFavicon() {
  const { settings } = useAuth();

  React.useEffect(() => {
    // Use favicon_url if available, otherwise fallback to logo_url
    const faviconUrl = settings?.favicon_url || settings?.logo_url;

    if (faviconUrl) {
      // Remove existing favicon
      const existingFavicon = document.querySelector("link[rel*='icon']");
      if (existingFavicon) {
        existingFavicon.parentNode.removeChild(existingFavicon);
      }

      // Add new favicon with logo from settings
      const link = document.createElement('link');
      link.type = 'image/x-icon';
      link.rel = 'icon';
      link.href = faviconUrl;
      document.head.appendChild(link);
    }
  }, [settings?.favicon_url, settings?.logo_url]);

  return null;
}

function App() {
  return (
    <AuthProvider>
      <DynamicFavicon />
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
            <Route path="/admin/pengguna-siswa" element={<AdminPenggunaSiswaPage />} />
            <Route path="/admin/gtk" element={<AdminGTKPage />} />
            <Route path="/admin/gtk/:id" element={<AdminGTKDetailPage />} />
            <Route path="/admin/gtk/laporan-absensi" element={<AdminLaporanAbsensiPage />} />
            <Route path="/admin/gtk/agenda-guru" element={<AdminAgendaGuruPage />} />
            <Route path="/admin/gtk/agenda-tendik" element={<AdminAgendaTendikPage />} />
            <Route path="/admin/gtk/e-kinerja" element={<AdminEKinerjaPage />} />
            <Route path="/admin/gtk/profesionalitas" element={<AdminProfesionalitasGTKPage />} />
            <Route path="/admin/classes" element={<AdminClassesPage />} />
            <Route path="/admin/jabatan" element={<AdminJabatanPage />} />
            <Route path="/admin/rooms" element={<AdminRoomsPage />} />
            <Route path="/admin/subjects" element={<AdminSubjectsPage />} />
            <Route path="/admin/schedules" element={<AdminSchedulesPage />} />
            <Route path="/admin/qr-generator" element={<AdminQRGeneratorPage />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/tahun-takwim" element={<AdminTahunTakwimPage />} />
            <Route path="/admin/academic-year" element={<AdminAcademicYearPage />} />
            <Route path="/admin/semesters" element={<AdminSemestersPage />} />
            <Route path="/admin/import" element={<AdminImportPage />} />
            <Route path="/admin/holidays" element={<AdminHolidaysPage />} />
            <Route path="/admin/backup" element={<AdminBackupPage />} />
            <Route path="/admin/pengumuman" element={<AdminAnnouncementsPage />} />
            <Route path="/admin/kurikulum" element={<AdminCurriculumsPage />} />
            <Route path="/admin/app-info" element={<AdminAppInfoPage />} />
            <Route path="/piket/tugas" element={<PiketTasksPage />} />
            <Route path="/jadwal/atur" element={<MySchedulePage />} />
            <Route path="/admin/mutasi" element={<AdminMutationsPage />} />
            <Route path="/admin/alumni" element={<AdminAlumniPage />} />
            <Route path="/admin/naik-kelas" element={<AdminPromotionsPage />} />
            <Route path="/admin/buku-induk" element={<AdminStudentRecordsPage />} />
            <Route path="/admin/buku-induk-kepegawaian" element={<AdminBukuIndukKepegawaianPage />} />
            <Route path="/admin/cetak-absensi-manual" element={<AdminCetakAbsensiManualPage />} />
            <Route path="/admin/verval-siswa" element={<AdminVervalSiswaPage />} />
            <Route path="/admin/verval-gtk" element={<AdminVervalGTKPage />} />
            <Route path="/admin/indikator-materi" element={<AdminIndikatorMateriPage />} />
            <Route path="/admin/pip/penerima" element={<AdminPIPReceiverPage />} />
            <Route path="/admin/pip/ajuan" element={<AdminPIPProposalPage />} />
            <Route path="/admin/tatib/kategori" element={<AdminTatibKategoriPage />} />
            <Route path="/admin/tatib/input" element={<AdminTatibInputPage />} />
            <Route path="/admin/tatib/penanganan" element={<AdminTatibPenangananPage />} />
            <Route path="/admin/tatib/data" element={<AdminTatibDataPage />} />
            <Route path="/guru/indikator-materi" element={<GuruInputIndikatorMateriPage />} />
            <Route path="/verval/ajuan-saya" element={<MyVervalRequestsPage />} />
            <Route path="/profile" element={<ProfilePageEMIS />} />
            <Route path="/profile-old" element={<ProfilePage />} />
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
