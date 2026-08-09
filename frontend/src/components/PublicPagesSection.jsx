import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink } from 'lucide-react';
import { usePublicPagesVisibility } from '@/hooks/usePublicPagesVisibility';
import { getPublicPagesMenuItems } from '@/lib/publicPagesMenu';

/**
 * PublicPagesSection - Section untuk menampilkan menu halaman publik di dashboard
 * Hanya menampilkan halaman dengan visibility = 'dashboard'
 */
export default function PublicPagesSection() {
  const { visibility, loading } = usePublicPagesVisibility();

  // Get menu items for dashboard-only visibility
  const menuItems = getPublicPagesMenuItems(visibility);

  // Don't render if no items or still loading
  if (loading || menuItems.length === 0) {
    return null;
  }

  // Color schemes untuk setiap jenis halaman
  const colorSchemes = {
    '/public/monitoring': {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      textPrimary: 'text-blue-900',
      textSecondary: 'text-blue-800/80',
      linkColor: 'text-blue-700',
    },
    '/public/prestasi': {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      textPrimary: 'text-amber-900',
      textSecondary: 'text-amber-800/80',
      linkColor: 'text-amber-700',
    },
    '/public/agenda': {
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      textPrimary: 'text-purple-900',
      textSecondary: 'text-purple-800/80',
      linkColor: 'text-purple-700',
    },
    '/public/rkam': {
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      textPrimary: 'text-emerald-900',
      textSecondary: 'text-emerald-800/80',
      linkColor: 'text-emerald-700',
    },
  };

  // Deskripsi untuk setiap halaman
  const descriptions = {
    '/public/monitoring': 'Pantau aktivitas mengajar guru secara realtime',
    '/public/prestasi': 'Lihat pencapaian dan penghargaan siswa',
    '/public/agenda': 'Jadwal kegiatan dan agenda madrasah',
    '/public/rkam': 'Laporan anggaran dan realisasi dana',
  };

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="text-base font-semibold text-slate-900 mb-3">Halaman Publik</h2>
        <div className="space-y-3">
          {menuItems.map((item) => {
            const scheme = colorSchemes[item.to] || colorSchemes['/public/monitoring'];
            const description = descriptions[item.to] || 'Halaman publik';
            const Icon = item.icon;

            return (
              <div
                key={item.to}
                className={`flex items-center justify-between rounded-xl ${scheme.bg} border ${scheme.border} p-4`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <Icon className={`h-5 w-5 ${scheme.linkColor}`} />
                  <div>
                    <div className={`font-semibold ${scheme.textPrimary}`}>{item.label}</div>
                    <div className={`text-xs ${scheme.textSecondary}`}>{description}</div>
                  </div>
                </div>
                <Link
                  to={item.to}
                  className={`${scheme.linkColor} font-semibold flex items-center gap-1 hover:underline whitespace-nowrap`}
                  data-testid={item.testid}
                >
                  Lihat <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
