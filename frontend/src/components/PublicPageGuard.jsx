import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePublicPagesVisibility } from '@/hooks/usePublicPagesVisibility';
import { FullPageLoader } from '@/components/ui/page-loader';

/**
 * Guard component for public pages
 * - If visibility is 'public', render the page
 * - If visibility is 'hidden', redirect to login
 * - If visibility is 'dashboard', redirect to login (they need to be authenticated)
 */
export function PublicPageGuard({ pageName, children }) {
  const { visibility, loading } = usePublicPagesVisibility();

  if (loading) {
    return <FullPageLoader message="Memuat pengaturan..." />;
  }

  const visibilitySetting = visibility[`${pageName}_visibility`];

  // If hidden, redirect to login
  if (visibilitySetting === 'hidden') {
    return <Navigate to="/login" replace />;
  }

  // If dashboard-only, redirect to login (user needs to authenticate to see it in dashboard)
  if (visibilitySetting === 'dashboard') {
    return <Navigate to="/login" replace />;
  }

  // If public or undefined/default, render the page
  return children;
}
