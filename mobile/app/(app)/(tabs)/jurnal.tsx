/**
 * Riwayat Jurnal. Sumber data sesuai peran:
 *  guru → GET /jurnal/my (termasuk jurnal sebagai guru pengganti, berpasangan)
 *  guru piket → GET /jurnal/piket-filled · admin & waka kurikulum → GET /admin/jurnal (30 hari)
 *  wali kelas → GET /admin/jurnal?class_id={kelas wali}
 * Jurnal yang masih di antrean offline ditampilkan di atas.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import type { Journal } from '@/api/types';
import { CacheKeys } from '@/db/cache';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { listQueue, QueueItem } from '@/offline/queue';
import { addDays, todayISO } from '@/utils/time';
import { homeKind } from '@/utils/roles';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { JournalCard } from '@/components/JournalCard';

export default function JurnalScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user, activeRole } = useAuth();
  const kind = homeKind(activeRole);
  const [query, setQuery] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const { key, fetcher, subtitle } = useMemo(() => {
    if (kind === 'piket') return { key: 'jurnal.piket', fetcher: api.jurnal.piketFilled, subtitle: 'Jurnal yang diisi sebagai guru piket' };
    if (kind === 'manager') {
      return {
        key: CacheKeys.adminJournals,
        fetcher: () => api.jurnal.admin({ start_date: addDays(todayISO(), -30), end_date: todayISO(), limit: 300 }).then((r) => r.items ?? []),
        subtitle: 'Semua jurnal 30 hari terakhir',
      };
    }
    if (kind === 'walas' && user?.homeroom_class_id) {
      const cid = user.homeroom_class_id;
      return {
        key: CacheKeys.classJournals(cid),
        fetcher: () => api.jurnal.admin({ class_id: cid, start_date: addDays(todayISO(), -30), end_date: todayISO(), limit: 300 }).then((r) => r.items ?? []),
        subtitle: 'Jurnal kelas wali 30 hari terakhir',
      };
    }
    return { key: CacheKeys.myJournals, fetcher: api.jurnal.my, subtitle: 'Jurnal mengajar Anda' };
  }, [kind, user?.homeroom_class_id]);

  const res = useCached<Journal[]>(key, fetcher);

  useFocusEffect(useCallback(() => {
    if (!user?.id) return;
    listQueue(user.id).then((q) => setQueue(q.filter((i) => i.status !== 'synced'))).catch(() => {});
  }, [user?.id]));

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = res.data ?? [];
    if (!q) return list;
    return list.filter((j) => [j.class_name, j.subject_name, j.materi, j.teacher_name, j.diisi_oleh]
      .some((v) => (v || '').toLowerCase().includes(q)));
  }, [res.data, query]);

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      <Input icon="search" placeholder="Cari kelas, mapel, materi, guru…" value={query} onChangeText={setQuery} />
      {queue.length > 0 ? (
        <Card tone="warning" onPress={() => router.push('/antrean')} style={styles.queue}>
          <Icon name="cloud-upload-outline" size={20} color={colors.onWarning} />
          <View style={{ flex: 1 }}>
            <T weight="semibold" color={colors.onWarning}>{queue.length} jurnal belum terkirim</T>
            <T variant="caption" color={colors.onWarning} numberOfLines={1}>
              {queue.slice(0, 2).map((i) => `${i.meta.class_name ?? ''} (${i.meta.date})`).join(', ')}
            </T>
          </View>
          {queue.some((i) => i.status === 'failed') ? <Badge label="Ada yang gagal" tone="error" small /> : null}
        </Card>
      ) : null}
    </View>
  );

  return (
    <Screen title="Riwayat Jurnal" subtitle={subtitle} headerTone="brand" scroll={false} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      {res.loading ? (
        <View style={{ gap: spacing.md }}>{header}<CardSkeleton lines={3} /><CardSkeleton lines={3} /></View>
      ) : res.error && !res.data ? (
        <View>{header}<ErrorState message="Riwayat jurnal belum tersimpan di perangkat. Sambungkan ke internet lalu coba lagi." onRetry={res.refresh} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(j) => j.id}
          ListHeaderComponent={header}
          renderItem={({ item }) => <JournalCard j={item} onPress={() => router.push(`/jurnal/${item.id}` as any)} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListEmptyComponent={<Card><EmptyState icon="book-outline" title={query ? 'Tidak ada yang cocok' : 'Belum ada jurnal'} message={query ? 'Coba kata kunci lain.' : 'Jurnal yang Anda isi akan muncul di sini.'} compact /></Card>}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          refreshControl={<RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
          initialNumToRender={10}
          windowSize={7}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  queue: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
});
