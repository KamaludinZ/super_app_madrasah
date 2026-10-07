/**
 * Materi Mapel (siswa) — native, pengganti /siswa/materi. GET /kelas/materi (materi untuk kelas & siswa
 * tertentu), dikelompokkan per mapel, pencarian, tersimpan offline.
 */
import React, { useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import type { KelasMateri } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { formatDateShort } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

export default function SiswaMateriScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const res = useCached<KelasMateri[]>('siswa.materi', api.kelas.materi);
  const [q, setQ] = useState('');

  const sections = useMemo(() => {
    const n = q.trim().toLowerCase();
    const list = (res.data ?? []).filter((m) => !n || `${m.judul} ${m.subject_name ?? ''} ${m.teacher_name ?? ''} ${m.deskripsi ?? ''}`.toLowerCase().includes(n));
    const by = new Map<string, KelasMateri[]>();
    list.forEach((m) => { const k = m.subject_name || 'Mata Pelajaran'; by.set(k, [...(by.get(k) ?? []), m]); });
    return [...by.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([title, data]) => ({ title, data: data.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? '')) }));
  }, [res.data, q]);

  return (
    <Screen title="Materi Mapel" subtitle={`${res.data?.length ?? 0} materi`} back scroll={false} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <SectionList
        sections={sections}
        keyExtractor={(m) => m.id}
        ListHeaderComponent={<Input icon="search" placeholder="Cari materi, mapel, atau guru…" value={q} onChangeText={setQ} containerStyle={{ marginBottom: spacing.md }} />}
        renderSectionHeader={({ section }) => (
          <View style={[styles.section, { backgroundColor: colors.surfaceSecondary }]}>
            <T variant="label" weight="semibold" tone="secondary">{section.title.toUpperCase()}</T>
            <T variant="small" tone="muted">{section.data.length}</T>
          </View>
        )}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/siswa/materi/${item.id}` as any)} style={styles.card}>
            <View style={[styles.icon, { backgroundColor: colors.brandTertiary }]}>
              <Icon name="book-outline" size={20} color={colors.onBrandTertiary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T weight="semibold" numberOfLines={2}>{item.judul}</T>
              {item.deskripsi ? <T variant="caption" tone="secondary" numberOfLines={2}>{item.deskripsi}</T> : null}
              <View style={styles.meta}>
                <T variant="small" tone="muted">{item.teacher_name ?? 'Guru'}{item.created_at ? ` · ${formatDateShort(item.created_at)}` : ''}</T>
                {item.file_url ? <Badge label="Lampiran" icon="attach-outline" tone="neutral" small /> : null}
              </View>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.muted} />
          </Card>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        stickySectionHeadersEnabled
        ListEmptyComponent={res.loading ? <View style={{ gap: spacing.md }}><CardSkeleton /><CardSkeleton /></View>
          : res.error && !res.data ? <ErrorState message="Materi belum tersimpan di perangkat. Sambungkan ke internet lalu coba lagi." onRetry={res.refresh} />
            : <Card><EmptyState icon="library-outline" title={q ? 'Tidak ada yang cocok' : 'Belum ada materi'} message={q ? 'Coba kata kunci lain.' : 'Materi dari guru akan muncul di sini.'} compact /></Card>}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, marginTop: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
});
