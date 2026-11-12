import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import AdminDashboard from './dashboards/AdminDashboard';
import GuruDashboard from './dashboards/GuruDashboard';
import GuruBkDashboard from './dashboards/GuruBkDashboard';
import GuruTatibDashboard from './dashboards/GuruTatibDashboard';
import KepsekDashboard from './dashboards/KepsekDashboard';
import PenjaminMutuDashboard from './dashboards/PenjaminMutuDashboard';
import SiswaDashboard from './dashboards/SiswaDashboard';
import StaffDashboard from './dashboards/StaffDashboard';
import UnitKesehatanDashboard from './dashboards/UnitKesehatanDashboard';
import WaliKelasDashboard from './dashboards/WaliKelasDashboard';
import KelasDashboard from './dashboards/KelasDashboard';
import AnnouncementsCard from '@/components/notifications/AnnouncementsCard';
import PublicPagesSection from '@/components/PublicPagesSection';
import NotificationPermissionBanner from '@/components/NotificationPermissionBanner';
import KartuAplikasiTerhubung from '@/components/sso/KartuAplikasiTerhubung';
import KartuCkgTerakhir from '@/components/uks/KartuCkgTerakhir';
import { BERANDA_SATPAM } from '@/lib/izinKamad';

// Roles that should see admin-style dashboard with stats
const ADMIN_LIKE_ROLES = [
  'admin',
  'kepala_sekolah',
  'kepala_tata_usaha',
  'waka_sarpras',
  'waka_kesiswaan',
  'waka_kurikulum',
  'waka_humas',
  'penjamin_mutu',
];

/**
 * Bagian umum di sekitar dashboard peran: banner izin notifikasi, pengumuman, aplikasi terhubung
 * (atas) dan halaman publik (bawah). Dipakai DashboardRouter dan halaman dashboard tersendiri
 * (mis. dashboard satpam di /satpam).
 */
export function BingkaiDashboard({ children }) {
  const { activeRole } = useAuth();
  const isAdmin = ADMIN_LIKE_ROLES.includes(activeRole);

  return (
    <div className="space-y-4">
      {/* Notification permission banner for all non-admin users */}
      {!isAdmin && <NotificationPermissionBanner />}

      {!isAdmin && <AnnouncementsCard />}
      {/* Aplikasi madrasah lain yang dibuka dengan login Super App (tidak tampil bila tidak ada) */}
      {activeRole !== 'kelas' && <KartuAplikasiTerhubung />}
      {/* Hasil CKG terakhir milik pengguna (tidak tampil bila belum ada; akun kelas & satpam tidak punya data CKG) */}
      {activeRole !== 'kelas' && activeRole !== 'satpam' && <KartuCkgTerakhir />}
      {children}
      {!isAdmin && <PublicPagesSection />}
    </div>
  );
}

/**
 * Wrapper that shows common sections (announcements, public pages) at top of dashboard,
 * then delegates to the role-specific dashboard component.
 */
export default function DashboardRouter() {
  const { activeRole } = useAuth();

  let DashboardComponent;
  switch (activeRole) {
    case 'admin':
    case 'kepala_tata_usaha':
    case 'waka_sarpras':
    case 'waka_kesiswaan':
    case 'waka_kurikulum':
    case 'waka_humas':
      DashboardComponent = AdminDashboard; break;
    case 'kepala_sekolah':
      DashboardComponent = KepsekDashboard; break;
    case 'penjamin_mutu':
      DashboardComponent = PenjaminMutuDashboard; break;
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
    case 'satpam':
      // Satpam punya halaman dashboard sendiri, bukan menumpang dashboard peran lain.
      return <Navigate to={BERANDA_SATPAM} replace />;
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
    <BingkaiDashboard>
      <DashboardComponent />
    </BingkaiDashboard>
  );
}
