/**
 * Detail pengumuman. Data dari daftar GET /announcements (tersimpan di cache → bisa dibuka offline);
 * saat dibuka online, ditandai dibaca (POST /notifications/announcement/{id}/read).
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import type { Announcement } from '@/api/types';
import { CacheKeys } from '@/db/cache';
import { useCached } from '@/hooks/useCached';
import { formatDateTime } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

const SEVERITY_LABEL: Record<string, { label: string; tone: 'brand' | 'warning' | 'success' | 'error' }> = {
  info: { label: 'Info', tone: 'brand' },
  warning: { label: 'Penting', tone: 'warning' },
  success: { label: 'Kabar baik', tone: 'success' },
  danger: { label: 'Mendesak', tone: 'error' },
};

export default function PengumumanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const res = useCached<Announcement[]>(CacheKeys.announcements, api.announcements.list);
  const ann = res.data?.find((a) => a.id === id);
  const marked = useRef(false);

  useEffect(() => {
    if (!ann || ann.is_read || marked.current || res.fromCache) return;
    marked.current = true;
    api.notifications.markRead('announcement', ann.id)
      .then(() => {
        void qc.invalidateQueries({ queryKey: [CacheKeys.unread] });
        void qc.invalidateQueries({ queryKey: [CacheKeys.notifications] });
      })
      .catch(() => { marked.current = false; });
  }, [ann, res.fromCache, qc]);

  const sev = SEVERITY_LABEL[ann?.severity ?? 'info'] ?? SEVERITY_LABEL.info;

  return (
    <Screen title="Pengumuman" back refreshing={res.refreshing} onRefresh={res.refresh} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      {res.loading ? (
        <CardSkeleton lines={5} />
      ) : res.error && !res.data ? (
        <ErrorState message="Pengumuman belum tersimpan di perangkat." onRetry={res.refresh} />
      ) : !ann ? (
        <EmptyState icon="megaphone-outline" title="Pengumuman tidak ditemukan" message="Mungkin sudah tidak aktif atau tidak ditujukan untuk peran Anda." />
      ) : (
        <Card style={{ gap: spacing.md }}>
          <View style={styles.badges}>
            <Badge label={sev.label} tone={sev.tone} small />
            {ann.is_pinned ? <Badge label="Disematkan" icon="pin" tone="neutral" small /> : null}
          </View>
          <T variant="title">{ann.title}</T>
          <T variant="caption" tone="muted">
            {[ann.created_by_name, ann.created_at ? formatDateTime(ann.created_at) : null].filter(Boolean).join(' · ')}
          </T>
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          <T selectable style={{ lineHeight: 22 }}>{ann.body}</T>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  divider: { height: StyleSheet.hairlineWidth },
});
