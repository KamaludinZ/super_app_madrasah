/**
 * Area setelah login: wajib sesi (kalau tidak → /login), layar kunci saat idle, dan bootstrap
 * (sinkron antrean, izin offline, pengingat lokal, registrasi perangkat push, ketukan notifikasi).
 */
import React from 'react';
import { View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/store/auth';
import { useTheme } from '@/theme';
import { useAppBootstrap } from '@/hooks/useAppBootstrap';
import { LockScreen } from '@/components/LockScreen';
import { LoadingState } from '@/components/ui/States';

function Bootstrap() {
  useAppBootstrap();
  return null;
}

export default function AppLayout() {
  const { loading, session, locked } = useAuth();
  const { colors } = useTheme();

  if (loading) return <LoadingState message="Memuat sesi…" />;
  if (!session) return <Redirect href="/login" />;

  return (
    <View style={{ flex: 1 }}>
      <Bootstrap />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surfaceSecondary }, animation: 'slide_from_right' }} />
      {locked ? <LockScreen /> : null}
    </View>
  );
}
