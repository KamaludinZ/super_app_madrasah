import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import AdminGTKDetailPage from '@/pages/admin/AdminGTKDetailPage';

export default function ProfilePageGuru() {
  const { user } = useAuth();

  if (!user?.id) return null;

  return <AdminGTKDetailPage userIdOverride={user.id} hideBackButton={true} />;
}
