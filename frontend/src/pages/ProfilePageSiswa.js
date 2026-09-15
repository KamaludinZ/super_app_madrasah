import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import StudentDetailDialog from '@/components/students/StudentDetailDialog';

export default function ProfilePageSiswa() {
  const { user } = useAuth();
  if (!user?.id) return null;
  return <StudentDetailDialog student={user} open onClose={() => {}} asPage />;
}
