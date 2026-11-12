import React from 'react';
import { Eye } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { BingkaiDashboard } from '@/pages/DashboardRouter';
import SatpamDashboard from '@/pages/dashboards/SatpamDashboard';
import AksesDitolak from '@/components/security/AksesDitolak';
import { PERAN_BUKA_BERANDA_SATPAM, bolehBukaBerandaSatpam } from '@/lib/izinKamad';

/**
 * Rute /satpam: beranda satpam dengan bagian umum dashboard (pengumuman, aplikasi terhubung).
 * Peran lain mendapat pesan akses ditolak; admin boleh membuka sebagai pratinjau.
 */
export default function BerandaSatpamPage() {
  const { activeRole } = useAuth();
  if (!bolehBukaBerandaSatpam(activeRole)) {
    return <AksesDitolak halaman="Dashboard Satpam" untuk="satpam" peranBerhak={PERAN_BUKA_BERANDA_SATPAM} />;
  }

  return (
    <BingkaiDashboard>
      {activeRole !== 'satpam' && (
        <p className="flex items-center gap-1.5 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800" data-testid="info-pratinjau-satpam">
          <Eye className="h-3.5 w-3.5" /> Pratinjau — tampilan ini adalah dashboard untuk akun berperan Satpam.
        </p>
      )}
      <SatpamDashboard />
    </BingkaiDashboard>
  );
}
