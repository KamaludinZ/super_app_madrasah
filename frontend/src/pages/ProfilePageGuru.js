import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { adalahTendik } from '@/lib/jenisGtk';
import AdminGTKDetailPage from '@/pages/admin/AdminGTKDetailPage';

export default function ProfilePageGuru() {
  const { user } = useAuth();

  if (!user?.id) return null;
  // Tendik/KTU (tanpa peran guru) memakai halaman tendik.
  if (adalahTendik(user.roles)) return <Navigate to="/profile/tendik" replace />;

  return <AdminGTKDetailPage userIdOverride={user.id} hideBackButton={true} />;
}
