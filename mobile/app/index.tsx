import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/store/auth';
import { LoadingState } from '@/components/ui/States';

/** Titik masuk: arahkan ke beranda bila ada sesi tersimpan, selain itu ke layar masuk. */
export default function Index() {
  const { loading, session } = useAuth();
  if (loading) return <LoadingState message="Menyiapkan aplikasi…" />;
  return <Redirect href={session ? '/(app)/(tabs)' : '/login'} />;
}
