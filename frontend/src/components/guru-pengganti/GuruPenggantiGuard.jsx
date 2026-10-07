import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { canManageGuruPengganti } from '@/lib/guruPengganti';
import ErrorPage from '@/pages/ErrorPage';

/** Menolak (403) peran selain admin, waka kurikulum, dan guru piket. */
export default function GuruPenggantiGuard({ children }) {
  const { user, activeRole } = useAuth();
  const role = activeRole || user?.active_role || user?.roles?.[0];
  if (!canManageGuruPengganti(role)) {
    return (
      <ErrorPage
        code={403}
        description="Menu Guru Pengganti hanya untuk Admin, Waka Kurikulum, dan Guru Piket."
      />
    );
  }
  return children;
}
