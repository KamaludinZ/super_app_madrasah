/**
 * Notifikasi: gabungan pengumuman + pesan sistem (GET /notifications), belum dibaca di atas.
 * Ketuk pengumuman → detail (ditandai dibaca). "Tandai semua dibaca" → POST /notifications/mark-all-read.
 */
import React, { useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { NotificationItem } from '@/api/types';
import { CacheKeys } from '@/db/cache';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { WEB_URL } from '@/config';
import { formatRelative } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon, IconName } from '@/components/ui/Icon';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

export default function NotifikasiScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const res = useCached<NotificationItem[]>(CacheKeys.notifications, api.notifications.list);
  const [marking, setMarking] = useState(false);
  const items = res.data ?? [];
  const unread = items.filter((n) => !n.is_read).length;

  const refreshBadges = () => {
    void qc.invalidateQueries({ queryKey: [CacheKeys.unread] });
    void qc.invalidateQueries({ queryKey: [CacheKeys.notifications] });
    void qc.invalidateQueries({ queryKey: [CacheKeys.announcements] });
  };

  const markAll = async () => {
    setMarking(true);
    try {
      await api.notifications.markAllRead();
      refreshBadges();
      toast.success('Semua notifikasi ditandai dibaca');
    } catch (e) {
      toast.error(errorMessage(e, 'Gagal menandai dibaca.'));
    } finally {
      setMarking(false);
    }
  };

  const open = (n: NotificationItem) => {
    if (n.source === 'announcement') {
      router.push(`/pengumuman/${n.source_id}` as any);
      return;
    }
    if (n.source_id === 'password_change') {
      void Linking.openURL(`${WEB_URL}/profil/keamanan`);
    }
  };

  return (
    <Screen
      title="Notifikasi"
      subtitle={unread ? `${unread} belum dibaca` : 'Semua sudah dibaca'}
      headerTone="brand"
      scroll={false}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}
    >
      {res.loading ? (
        <View style={{ gap: spacing.md }}><CardSkeleton /><CardSkeleton /><CardSkeleton /></View>
      ) : res.error && !res.data ? (
        <ErrorState message="Notifikasi belum tersimpan di perangkat. Sambungkan ke internet lalu coba lagi." onRetry={res.refresh} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          ListHeaderComponent={unread > 0 ? (
            <View style={styles.headerRow}>
              <Button title="Tandai semua dibaca" icon="checkmark-done" variant="ghost" size="sm" loading={marking} disabled={!online} onPress={markAll} />
            </View>
          ) : null}
          renderItem={({ item }) => <NotifRow n={item} onPress={() => open(item)} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={<Card><EmptyState icon="notifications-off-outline" title="Belum ada notifikasi" message="Pengumuman madrasah akan muncul di sini." compact /></Card>}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
        />
      )}
    </Screen>
  );
}

const SEVERITY: Record<string, { icon: IconName; tone: 'brand' | 'warning' | 'success' | 'error' }> = {
  info: { icon: 'megaphone-outline', tone: 'brand' },
  warning: { icon: 'warning-outline', tone: 'warning' },
  success: { icon: 'checkmark-circle-outline', tone: 'success' },
  danger: { icon: 'alert-circle-outline', tone: 'error' },
};

function NotifRow({ n, onPress }: { n: NotificationItem; onPress: () => void }) {
  const { colors } = useTheme();
  const sev = SEVERITY[n.severity ?? 'info'] ?? SEVERITY.info;
  const icon: IconName = n.source === 'system' ? 'lock-closed-outline' : sev.icon;
  const fg = { brand: colors.brandPrimary, warning: colors.warning, success: colors.success, error: colors.error }[sev.tone];
  return (
    <Card onPress={onPress} style={[styles.row, !n.is_read && { borderLeftWidth: 4, borderLeftColor: colors.brandPrimary }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
        <Icon name={icon} size={20} color={fg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={styles.titleRow}>
          <T weight={n.is_read ? 'medium' : 'bold'} numberOfLines={2} style={{ flex: 1 }}>{n.title}</T>
          {n.is_pinned ? <Icon name="pin" size={14} color={colors.muted} /> : null}
        </View>
        <T variant="caption" tone="secondary" numberOfLines={2}>{n.body}</T>
        <View style={styles.titleRow}>
          {n.created_at ? <T variant="caption" tone="muted">{formatRelative(n.created_at)}</T> : null}
          {!n.is_read ? <Badge label="Baru" tone="brand" small /> : null}
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  iconWrap: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
