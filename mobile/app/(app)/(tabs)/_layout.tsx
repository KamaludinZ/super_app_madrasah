/**
 * Tab bawah sesuai peran aktif:
 *  Beranda · Riwayat Jurnal (guru/piket/admin/waka/wali kelas) · Guru Pengganti (hanya bila
 *  GET /guru-pengganti/config → can_manage) · Notifikasi (badge belum dibaca) · Profil.
 */
import React from 'react';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/api/endpoints';
import { CacheKeys } from '@/db/cache';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { fonts, useTheme } from '@/theme';
import { Icon, IconName } from '@/components/ui/Icon';
import { canSeeJournals } from '@/utils/roles';

const tabIcon = (name: IconName, active: IconName) =>
  ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) =>
    <Icon name={focused ? active : name} size={size} color={color as string} />;

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeRole } = useAuth();
  const gp = useCached(`${CacheKeys.gpConfig}.${activeRole}`, api.gp.config, { staleTime: 5 * 60_000 });
  const unread = useCached(CacheKeys.unread, api.notifications.unreadCount, { staleTime: 60_000 });
  const unreadCount = unread.data?.unread ?? 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda', tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen
        name="jurnal"
        options={{ title: 'Jurnal', href: canSeeJournals(activeRole) ? undefined : null, tabBarIcon: tabIcon('book-outline', 'book') }}
      />
      <Tabs.Screen
        name="pengganti"
        options={{ title: 'Pengganti', href: gp.data?.can_manage ? undefined : null, tabBarIcon: tabIcon('swap-horizontal-outline', 'swap-horizontal') }}
      />
      <Tabs.Screen
        name="pengumuman"
        options={{
          title: 'Notifikasi',
          tabBarIcon: tabIcon('notifications-outline', 'notifications'),
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.error, fontFamily: fonts.semibold, fontSize: 10 },
        }}
      />
      <Tabs.Screen name="profil" options={{ title: 'Profil', tabBarIcon: tabIcon('person-circle-outline', 'person-circle') }} />
    </Tabs>
  );
}
