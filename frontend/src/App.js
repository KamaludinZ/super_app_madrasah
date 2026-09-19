import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import BootScreen from '@/components/BootScreen';
import LoginPage from '@/pages/LoginPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import PublicMonitoring from '@/pages/PublicMonitoring';
import PublicPrestasi from '@/pages/PublicPrestasi';
import PublicAgenda from '@/pages/PublicAgenda';
import PublicRKAMPage from '@/pages/PublicRKAMPage';
import AppShell from '@/components/layout/AppShell';
import InstallPWA from '@/components/pwa/InstallPWA';
import useForegroundNotification from '@/hooks/useForegroundNotification';
import { startSyncListener } from '@/lib/syncManager';
import { SyncStatusIndicator } from '@/components/offline/SyncStatusIndicator';
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
import WaliKelasAttendanceReportPage from '@/pages/WaliKelasAttendanceReportPage';
import WaliKelasAttendancePage from '@/pages/WaliKelasAttendancePage';
import WaliKelasJurnalKelasPage from '@/pages/WaliKelasJurnalKelasPage';
import StudentAttendancePage from '@/pages/StudentAttendancePage';
import KebersihanPage from '@/pages/KebersihanPage';
import WaliKelasCleanlinessReportPage from '@/pages/WaliKelasCleanlinessReportPage';
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
import AdminAplikasiMadrasahPage from '@/pages/admin/AdminAplikasiMadrasahPage';
import AdminCurriculumsPage from '@/pages/admin/AdminCurriculumsPage';
import AdminGTKPage from '@/pages/admin/AdminGTKPage';
import AdminGTKDetailPage from '@/pages/admin/AdminGTKDetailPage';
import AdminLaporanAbsensiPage from '@/pages/admin/AdminLaporanAbsensiPage';
import AdminAgendaGuruPage from '@/pages/admin/AdminAgendaGuruPage';
import AdminAgendaTendikPage from '@/pages/admin/AdminAgendaTendikPage';
import AdminMadrasahEventsPage from '@/pages/admin/AdminMadrasahEventsPage';
import AdminRKAMPage from '@/pages/admin/AdminRKAMPage';
import MyAgendaPage from '@/pages/MyAgendaPage';
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
import AdminMateriPage from '@/pages/admin/AdminMateriPage';
import AdminTugasPage from '@/pages/admin/AdminTugasPage';
import GuruInputIndikatorMateriPage from '@/pages/GuruInputIndikatorMateriPage';
import GuruMateriPage from '@/pages/guru/GuruMateriPage';
import GuruTugasPage from '@/pages/guru/GuruTugasPage';
import AdminTatibKategoriPage from '@/pages/admin/AdminTatibKategoriPage';
import AdminTatibInputPage from '@/pages/admin/AdminTatibInputPage';
import AdminTatibPenangananPage from '@/pages/admin/AdminTatibPenangananPage';
import AdminTatibDataPage from '@/pages/admin/AdminTatibDataPage';
import AdminBKKunjunganPage from '@/pages/admin/bk/AdminBKKunjunganPage';
import AdminBKClkbPage from '@/pages/admin/bk/AdminBKClkbPage';
import AdminBKPclPage from '@/pages/admin/bk/AdminBKPclPage';
import AdminBKHomeVisitPage from '@/pages/admin/bk/AdminBKHomeVisitPage';
import AdminBKSekolahLanjutanPage from '@/pages/admin/bk/AdminBKSekolahLanjutanPage';
import AdminBKLaporanPage from '@/pages/admin/bk/AdminBKLaporanPage';
import AdminPerpusKoleksiPage from '@/pages/admin/perpus/AdminPerpusKoleksiPage';
import AdminPerpusPeminjamanPage from '@/pages/admin/perpus/AdminPerpusPeminjamanPage';
import AdminPerpusKunjunganPage from '@/pages/admin/perpus/AdminPerpusKunjunganPage';
import AdminPerpusLaporanPage from '@/pages/admin/perpus/AdminPerpusLaporanPage';
import AdminUKSKunjunganPage from '@/pages/admin/uks/AdminUKSKunjunganPage';
import AdminUKSCkgPage from '@/pages/admin/uks/AdminUKSCkgPage';
import AdminUKSObatPage from '@/pages/admin/uks/AdminUKSObatPage';
import AdminUKSJenisPenangananPage from '@/pages/admin/uks/AdminUKSJenisPenangananPage';
import AdminUKSDataSiswaGtkPage from '@/pages/admin/uks/AdminUKSDataSiswaGtkPage';
import AdminUKSAsetPage from '@/pages/admin/uks/AdminUKSAsetPage';
import AdminUKSLaporanPage from '@/pages/admin/uks/AdminUKSLaporanPage';
import AdminSarprasAsetTetapPage from '@/pages/admin/sarpras/AdminSarprasAsetTetapPage';
import AdminSarprasAsetLancarPage from '@/pages/admin/sarpras/AdminSarprasAsetLancarPage';
import AdminSarprasRuanganAsetPage from '@/pages/admin/sarpras/AdminSarprasRuanganAsetPage';
import AdminSarprasPenghapusanPage from '@/pages/admin/sarpras/AdminSarprasPenghapusanPage';
import AdminSarprasPeminjamanBarangPage from '@/pages/admin/sarpras/AdminSarprasPeminjamanBarangPage';
import AdminSarprasPeminjamanRuanganPage from '@/pages/admin/sarpras/AdminSarprasPeminjamanRuanganPage';
import AdminSarprasJurnalRuanganPage from '@/pages/admin/sarpras/AdminSarprasJurnalRuanganPage';
import AdminSarprasJurnalAlatPage from '@/pages/admin/sarpras/AdminSarprasJurnalAlatPage';
import AdminSarprasJurnalPerawatanPage from '@/pages/admin/sarpras/AdminSarprasJurnalPerawatanPage';
import AdminSarprasKerusakanPage from '@/pages/admin/sarpras/AdminSarprasKerusakanPage';
import LabAlatBahanPage from '@/pages/lab/LabAlatBahanPage';
import LabJadwalPage from '@/pages/lab/LabJadwalPage';
import LabJurnalPenggunaanPage from '@/pages/lab/LabJurnalPenggunaanPage';
import LabJurnalPengelolaanPage from '@/pages/lab/LabJurnalPengelolaanPage';
import LabPeminjamanAlatPage from '@/pages/lab/LabPeminjamanAlatPage';
import LabKerusakanPage from '@/pages/lab/LabKerusakanPage';
import MyVervalRequestsPage from '@/pages/MyVervalRequestsPage';
import ProfilePage from '@/pages/ProfilePage';
import ProfilePageEMIS from '@/pages/ProfilePageEMIS';
import ProfilePageSiswa from '@/pages/ProfilePageSiswa';
import ProfilePageGuru from '@/pages/ProfilePageGuru';
import ProfilePageTendik from '@/pages/ProfilePageTendik';
import PanduanPage from '@/pages/PanduanPage';
import ErrorPage from '@/pages/ErrorPage';
import MaintenancePage from '@/pages/MaintenancePage';
import { PublicPageGuard } from '@/components/PublicPageGuard';

// Kelas Digital Pages
import KelasLoginPage from '@/pages/KelasLoginPage';
import KelasDataSiswaPage from '@/pages/kelas/KelasDataSiswaPage';
import KelasJadwalPage from '@/pages/kelas/KelasJadwalPage';
import KelasMateriPage from '@/pages/kelas/KelasMateriPage';
import KelasTugasPage from '@/pages/kelas/KelasTugasPage';
import SiswaMateriPage from '@/pages/siswa/SiswaMateriPage';
import SiswaTugasPage from '@/pages/siswa/SiswaTugasPage';
import SiswaCLKBPage from '@/pages/siswa/SiswaCLKBPage';
import SiswaPCLPage from '@/pages/siswa/SiswaPCLPage';
import KelasJurnalPage from '@/pages/kelas/KelasJurnalPage';
import KelasKehadiranPage from '@/pages/kelas/KelasKehadiranPage';

// Waka Kurikulum Pages
import WakaKurSiswaPage from '@/pages/wakakur/WakaKurSiswaPage';
import WakaKurSchedulesPage from '@/pages/wakakur/WakaKurSchedulesPage';
import WakaKurJurnalPage from '@/pages/wakakur/WakaKurJurnalPage';
import WakaKurKehadiranPage from '@/pages/wakakur/WakaKurKehadiranPage';
import WakaKurMateriPage from '@/pages/wakakur/WakaKurMateriPage';
import WakaKurTugasPage from '@/pages/wakakur/WakaKurTugasPage';
import WakaKurKegiatanPage from '@/pages/wakakur/WakaKurKegiatanPage';
import WakaKurPengumumanPage from '@/pages/wakakur/WakaKurPengumumanPage';
import WakaKurPrestasiPage from '@/pages/wakakur/WakaKurPrestasiPage';
import WakaKurAlumniPage from '@/pages/wakakur/WakaKurAlumniPage';
import WakaKurMutasiPage from '@/pages/wakakur/WakaKurMutasiPage';
import WakaKurNaikKelasPage from '@/pages/wakakur/WakaKurNaikKelasPage';
import WakaKurIndikatorMateriPage from '@/pages/wakakur/WakaKurIndikatorMateriPage';
import WakaKurJadwalPiketPage from '@/pages/wakakur/WakaKurJadwalPiketPage';

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

function ProfilePageByRole() {
  const { user } = useAuth();
  const roles = user?.roles || [];

  if (roles.includes('siswa')) return <Navigate to="/profile/siswa" replace />;
  if (roles.includes('guru') || roles.includes('kepala_sekolah')) return <Navigate to="/profile/guru" replace />;
  if (roles.includes('tenaga_kependidikan')) return <Navigate to="/profile/tendik" replace />;

  return <Navigate to="/profile/guru" replace />;
}

function NotificationManager() {
  // Initialize foreground notification handler
  useForegroundNotification();

  // Initialize offline sync listener
  React.useEffect(() => {
    const cleanup = startSyncListener((results) => {
      // Callback when sync completes
      console.log('Sync completed:', results);

      // Optional: show user notification
      if (results.synced > 0) {
        console.log(`✓ ${results.synced} jurnal berhasil disinkronkan`);
      }
    });

    return cleanup;
  }, []);

  return <SyncStatusIndicator />;
}

function App() {
  const [bootComplete, setBootComplete] = useState(false);

  // Show boot screen until connection is verified
  if (!bootComplete) {
    return <BootScreen onComplete={() => setBootComplete(true)} />;
  }

  return (
    <AuthProvider>
      <DynamicFavicon />
      <NotificationManager />
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <InstallPWA />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/kelas-login" element={<KelasLoginPage />} />
          <Route path="/public/monitoring" element={<PublicPageGuard pageName="monitoring"><PublicMonitoring /></PublicPageGuard>} />
          <Route path="/public/prestasi" element={<PublicPageGuard pageName="prestasi"><PublicPrestasi /></PublicPageGuard>} />
          <Route path="/public/agenda" element={<PublicPageGuard pageName="agenda"><PublicAgenda /></PublicPageGuard>} />
          <Route path="/public/rkam" element={<PublicPageGuard pageName="rkam"><PublicRKAMPage /></PublicPageGuard>} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<DashboardRouter />} />
            <Route path="/jurnal/scan" element={<JurnalScanPage />} />
            <Route path="/jurnal/riwayat" element={<JurnalHistoryPage />} />
            <Route path="/jadwal" element={<JadwalPage />} />
            <Route path="/wali-kelas" element={<WaliKelasDashboard />} />
            <Route path="/wali-kelas/siswa" element={<DataSiswaPage />} />
            <Route path="/wali-kelas/jurnal-kelas" element={<WaliKelasJurnalKelasPage />} />
            <Route path="/wali-kelas/kehadiran" element={<WaliKelasAttendanceReportPage />} />
            <Route path="/wali-kelas/kebersihan" element={<WaliKelasCleanlinessReportPage />} />
            <Route path="/wali-kelas/laporan" element={<WaliKelasReportsPage />} />
            <Route path="/siswa/kehadiran" element={<StudentAttendancePage />} />
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
            <Route path="/admin/kegiatan-madrasah" element={<AdminMadrasahEventsPage />} />
            <Route path="/admin/dana-rkam" element={<AdminRKAMPage />} />
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
            <Route path="/admin/aplikasi-madrasah" element={<AdminAplikasiMadrasahPage />} />
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
            <Route path="/admin/materi" element={<AdminMateriPage />} />
            <Route path="/admin/tugas" element={<AdminTugasPage />} />
            <Route path="/admin/pip/penerima" element={<AdminPIPReceiverPage />} />
            <Route path="/admin/pip/ajuan" element={<AdminPIPProposalPage />} />
            <Route path="/admin/tatib/kategori" element={<AdminTatibKategoriPage />} />
            <Route path="/admin/tatib/input" element={<AdminTatibInputPage />} />
            <Route path="/admin/tatib/penanganan" element={<AdminTatibPenangananPage />} />
            <Route path="/admin/tatib/data" element={<AdminTatibDataPage />} />
            <Route path="/admin/bk/kunjungan" element={<AdminBKKunjunganPage />} />
            <Route path="/admin/bk/clkb" element={<AdminBKClkbPage />} />
            <Route path="/admin/bk/pcl" element={<AdminBKPclPage />} />
            <Route path="/admin/bk/home-visit" element={<AdminBKHomeVisitPage />} />
            <Route path="/admin/bk/sekolah-lanjutan" element={<AdminBKSekolahLanjutanPage />} />
            <Route path="/admin/bk/laporan" element={<AdminBKLaporanPage />} />
            <Route path="/admin/perpus/koleksi" element={<AdminPerpusKoleksiPage />} />
            <Route path="/admin/perpus/peminjaman" element={<AdminPerpusPeminjamanPage />} />
            <Route path="/admin/perpus/kunjungan" element={<AdminPerpusKunjunganPage />} />
            <Route path="/admin/perpus/laporan" element={<AdminPerpusLaporanPage />} />
            <Route path="/admin/uks/kunjungan" element={<AdminUKSKunjunganPage />} />
            <Route path="/admin/uks/ckg" element={<AdminUKSCkgPage />} />
            <Route path="/admin/uks/obat" element={<AdminUKSObatPage />} />
            <Route path="/admin/uks/jenis-penanganan" element={<AdminUKSJenisPenangananPage />} />
            <Route path="/admin/uks/data-siswa-gtk" element={<AdminUKSDataSiswaGtkPage />} />
            <Route path="/admin/uks/aset" element={<AdminUKSAsetPage />} />
            <Route path="/admin/uks/laporan" element={<AdminUKSLaporanPage />} />
            <Route path="/admin/sarpras/aset-tetap" element={<AdminSarprasAsetTetapPage />} />
            <Route path="/admin/sarpras/aset-lancar" element={<AdminSarprasAsetLancarPage />} />
            <Route path="/admin/sarpras/ruangan-aset" element={<AdminSarprasRuanganAsetPage />} />
            <Route path="/admin/sarpras/penghapusan" element={<AdminSarprasPenghapusanPage />} />
            <Route path="/admin/sarpras/peminjaman-barang" element={<AdminSarprasPeminjamanBarangPage />} />
            <Route path="/admin/sarpras/peminjaman-ruangan" element={<AdminSarprasPeminjamanRuanganPage />} />
            <Route path="/admin/sarpras/jurnal-ruangan" element={<AdminSarprasJurnalRuanganPage />} />
            <Route path="/admin/sarpras/jurnal-alat" element={<AdminSarprasJurnalAlatPage />} />
            <Route path="/admin/sarpras/jurnal-perawatan" element={<AdminSarprasJurnalPerawatanPage />} />
            <Route path="/admin/sarpras/kerusakan" element={<AdminSarprasKerusakanPage />} />
            <Route path="/lab/:labKey/alat-bahan" element={<LabAlatBahanPage />} />
            <Route path="/lab/:labKey/jadwal" element={<LabJadwalPage />} />
            <Route path="/lab/:labKey/jurnal-penggunaan" element={<LabJurnalPenggunaanPage />} />
            <Route path="/lab/:labKey/jurnal-pengelolaan" element={<LabJurnalPengelolaanPage />} />
            <Route path="/lab/:labKey/peminjaman-alat" element={<LabPeminjamanAlatPage />} />
            <Route path="/lab/:labKey/kerusakan" element={<LabKerusakanPage />} />
            <Route path="/guru/indikator-materi" element={<GuruInputIndikatorMateriPage />} />
            <Route path="/guru/materi" element={<GuruMateriPage />} />
            <Route path="/guru/tugas" element={<GuruTugasPage />} />
            <Route path="/verval/ajuan-saya" element={<MyVervalRequestsPage />} />
            <Route path="/my-agenda" element={<MyAgendaPage />} />
            <Route path="/profile" element={<ProfilePageByRole />} />
            <Route path="/profile/siswa" element={<ProfilePageSiswa />} />
            <Route path="/profile/guru" element={<ProfilePageGuru />} />
            <Route path="/profile/tendik" element={<ProfilePageTendik />} />
            <Route path="/profile-old" element={<ProfilePage />} />
            <Route path="/prestasi" element={<AchievementsPage />} />
            <Route path="/ekstrakurikuler" element={<EkstrakurikulerPage />} />
            <Route path="/nilai/input" element={<GradesInputPage />} />
            <Route path="/rapor" element={<RaporPage />} />
            <Route path="/pengumuman" element={<AnnouncementsListPage />} />
            <Route path="/panduan" element={<PanduanPage />} />
            <Route path="/panduan/:slug" element={<PanduanPage />} />
            {/* Kelas Digital - Protected Routes */}
            <Route path="/kelas/siswa" element={<KelasDataSiswaPage />} />
            <Route path="/kelas/jadwal" element={<KelasJadwalPage />} />
            <Route path="/kelas/materi" element={<KelasMateriPage />} />
            <Route path="/kelas/tugas" element={<KelasTugasPage />} />
            <Route path="/kelas/jurnal" element={<KelasJurnalPage />} />
            <Route path="/kelas/kehadiran" element={<KelasKehadiranPage />} />
            {/* Siswa Routes */}
            <Route path="/siswa/materi" element={<SiswaMateriPage />} />
            <Route path="/siswa/tugas" element={<SiswaTugasPage />} />
            <Route path="/siswa/clkb" element={<SiswaCLKBPage />} />
            <Route path="/siswa/pcl" element={<SiswaPCLPage />} />
            {/* Waka Kurikulum Routes */}
            <Route path="/wakakur/siswa" element={<WakaKurSiswaPage />} />
            <Route path="/wakakur/jadwal" element={<WakaKurSchedulesPage />} />
            <Route path="/wakakur/jurnal" element={<WakaKurJurnalPage />} />
            <Route path="/wakakur/kehadiran" element={<WakaKurKehadiranPage />} />
            <Route path="/wakakur/materi" element={<WakaKurMateriPage />} />
            <Route path="/wakakur/tugas" element={<WakaKurTugasPage />} />
            <Route path="/wakakur/kegiatan" element={<WakaKurKegiatanPage />} />
            <Route path="/wakakur/pengumuman" element={<WakaKurPengumumanPage />} />
            <Route path="/wakakur/prestasi" element={<WakaKurPrestasiPage />} />
            <Route path="/wakakur/alumni" element={<WakaKurAlumniPage />} />
            <Route path="/wakakur/mutasi" element={<WakaKurMutasiPage />} />
            <Route path="/wakakur/naik-kelas" element={<WakaKurNaikKelasPage />} />
            <Route path="/wakakur/indikator-materi" element={<WakaKurIndikatorMateriPage />} />
            <Route path="/wakakur/jadwal-piket" element={<WakaKurJadwalPiketPage />} />
            {/* Dashboard routes for public pages when set to 'dashboard' mode */}
            <Route path="/monitoring" element={<PublicMonitoring />} />
            <Route path="/prestasi-siswa" element={<PublicPrestasi />} />
            <Route path="/agenda-madrasah" element={<PublicAgenda />} />
            <Route path="/rkam" element={<PublicRKAMPage />} />
            <Route path="/error/:code" element={<ErrorPage />} />
          </Route>
          <Route path="*" element={<ErrorPage code={404} />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
