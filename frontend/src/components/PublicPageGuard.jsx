import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePublicPagesVisibility } from '@/hooks/usePublicPagesVisibility';
import { FullPageLoader } from '@/components/ui/page-loader';

/**
 * Guard component for public pages accessed via /public/* routes
 * - If visibility is 'public', render the page
 * - If visibility is 'hidden', show 404 (page not available)
 * - If visibility is 'dashboard', redirect to login (needs auth to see in dashboard)
 */
export function PublicPageGuard({ pageName, children }) {
  const { visibility, loading } = usePublicPagesVisibility();

  if (loading) {
    return <FullPageLoader message="Memuat pengaturan..." />;
  }

  const visibilitySetting = visibility[`${pageName}_visibility`];

  // If hidden, show not found message
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

  // If dashboard-only, redirect to login so they can access via dashboard
  if (visibilitySetting === 'dashboard') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center space-y-4 max-w-md p-6">
          <div className="text-6xl">🔐</div>
          <h1 className="text-2xl font-bold text-slate-900">Login Diperlukan</h1>
          <p className="text-slate-600">
            Halaman ini hanya tersedia untuk pengguna yang sudah login. Silakan login untuk mengakses halaman ini melalui dashboard.
          </p>
          <a href="/login" className="inline-block mt-4 px-6 py-2 bg-[#006837] text-white rounded-lg hover:bg-[#0B7A3B]">
            Login
          </a>
        </div>
      </div>
    );
  }

  // If public or undefined/default, render the page
  return children;
}
