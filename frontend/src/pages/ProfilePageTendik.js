import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { PERAN_GURU_GTK } from '@/lib/jenisGtk';
import AdminGTKDetailPage from '@/pages/admin/AdminGTKDetailPage';

export default function ProfilePageTendik() {
  const { user } = useAuth();

  if (!user?.id) return null;
  // Guru (termasuk yang merangkap peran lain) memakai halaman guru.
  if ((user.roles || []).some((r) => PERAN_GURU_GTK.includes(r))) {
    return <Navigate to="/profile/guru" replace />;
  }

  return <AdminGTKDetailPage userIdOverride={user.id} hideBackButton={true} />;
}
