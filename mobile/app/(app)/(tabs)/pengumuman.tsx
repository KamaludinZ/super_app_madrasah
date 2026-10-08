/**
 * Notifikasi: gabungan pengumuman, pesan sistem, dan notifikasi pribadi per peran (GET /notifications),
 * belum dibaca di atas. Ketuk pengumuman → detail; notifikasi pribadi → ditandai dibaca lalu dibuka
 * (layar native bila ada, selain itu modul web). "Tandai semua dibaca" → POST /notifications/mark-all-read.
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
import { useAuth } from '@/store/auth';
import { routeForPath } from '@/menu/routes';
import { routeForNotification } from '@/notifications';
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
  const { activeRole } = useAuth();
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
    if (n.source === 'user') {
      if (!n.is_read) api.notifications.markRead('user', n.source_id).then(refreshBadges).catch(() => {});
      // Sama dengan ketukan push: jenis ber-layar native (detail tugas, tanggapan BK, verval, tatib…) dibuka langsung.
      router.push((routeForNotification({ ...(n.data ?? {}), type: n.type, route: n.link || '/dashboard' }, activeRole) ?? routeForPath(n.link || '/dashboard', activeRole, n.title)) as any);
      return;
    }
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

/** Ikon per jenis notifikasi pribadi (notify.py di backend). */
const TYPE_ICON: Record<string, IconName> = {
  class_task_new: 'clipboard-outline',
  class_material_new: 'book-outline',
  teacher_task_new: 'briefcase-outline',
  teacher_task_accepted: 'checkmark-done-outline',
  piket_journal_filled: 'create-outline',
  substitute_assignment: 'swap-horizontal-outline',
  substitute_assignment_cancelled: 'close-circle-outline',
  tatib_record: 'shield-outline',
  verval_new: 'document-text-outline',
  verval_approved: 'checkmark-circle-outline',
  verval_rejected: 'close-circle-outline',
  achievement_new: 'trophy-outline',
  achievement_verified: 'trophy-outline',
  damage_report: 'construct-outline',
  damage_status: 'construct-outline',
  loan_item: 'cube-outline',
  loan_room: 'business-outline',
  bk_response: 'heart-outline',
};

function NotifRow({ n, onPress }: { n: NotificationItem; onPress: () => void }) {
  const { colors } = useTheme();
  const sev = SEVERITY[n.severity ?? 'info'] ?? SEVERITY.info;
  const icon: IconName = n.source === 'system' ? 'lock-closed-outline'
    : n.source === 'user' ? (TYPE_ICON[n.type ?? ''] ?? 'notifications-outline') : sev.icon;
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
