import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePublicPagesVisibility } from '@/hooks/usePublicPagesVisibility';
import { FullPageLoader } from '@/components/ui/page-loader';

/**
 * Guard component for public pages accessed via /public/* routes
 *
 * Visibility modes:
 * - 'public': Page is accessible to everyone, menu shows everywhere
 * - 'dashboard': Page is STILL accessible to everyone at /public/* URL,
 *                but menu only appears in dashboard (when logged in)
 * - 'hidden': Page is NOT accessible, shows 404
 */
export function PublicPageGuard({ pageName, children }) {
  const { visibility, loading } = usePublicPagesVisibility();

  if (loading) {
    return <FullPageLoader message="Memuat pengaturan..." />;
  }

  const visibilitySetting = visibility[`${pageName}_visibility`];

  // ONLY block if visibility is 'hidden'
  // Note: 'dashboard' mode still allows page access, only menu visibility is restricted
  if (visibilitySetting === 'hidden') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-4 max-w-md p-6">
          <div className="text-6xl">🔒</div>
          <h1 className="text-2xl font-bold text-slate-900">Halaman Tidak Tersedia</h1>
          <p className="text-slate-600">
            Halaman ini sedang tidak dapat diakses. Silakan hubungi administrator untuk informasi lebih lanjut.
          </p>
          <a href="/" className="inline-block mt-4 px-6 py-2 bg-[#006837] text-white rounded-lg hover:bg-[#0B7A3B]">
            Kembali ke Beranda
          </a>
        </div>
      </div>
    );
  }

  // For 'public' and 'dashboard' modes, render the page
  // The difference is only in menu visibility (handled by PublicHeader and LoginPage)
  return children;
}
