/**
 * Tugas (siswa) — native, pengganti halaman web /siswa/tugas. GET /kelas/tugas (tugas untuk kelas &
 * untuk siswa tertentu) dengan status pengumpulan; filter Belum/Sudah/Semua, pencarian, tersimpan offline.
 * Belum dikumpulkan diurutkan menurut tenggat terdekat.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import type { KelasTugas } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { dueInfo } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Filter = 'belum' | 'sudah' | 'semua';

export default function SiswaTugasScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const res = useCached<KelasTugas[]>('siswa.tugas', api.kelas.tugas);
  const [filter, setFilter] = useState<Filter>('belum');
  const [q, setQ] = useState('');

  const all = res.data ?? [];
  const belum = all.filter((t) => t.submission_status !== 'submitted');
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    const base = filter === 'belum' ? belum : filter === 'sudah' ? all.filter((t) => t.submission_status === 'submitted') : all;
    const found = n ? base.filter((t) => `${t.judul} ${t.subject_name ?? ''} ${t.teacher_name ?? ''}`.toLowerCase().includes(n)) : base;
    // Belum dikumpulkan: tenggat terdekat dulu (yang lewat di akhir); lainnya: terbaru dulu.
    return [...found].sort((a, b) => {
      if (filter === 'belum') {
        const da = a.deadline ?? '9999', db = b.deadline ?? '9999';
        const oa = dueInfo(a.deadline)?.overdue ? 1 : 0, ob = dueInfo(b.deadline)?.overdue ? 1 : 0;
        return oa - ob || da.localeCompare(db);
      }
      return (b.created_at ?? '').localeCompare(a.created_at ?? '');
    });
  }, [all, belum, filter, q]);

  return (
    <Screen title="Tugas" subtitle={`${belum.length} belum dikumpulkan`} back scroll={false} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <FlatList
        data={list}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={(
          <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
            <SegmentedControl<Filter>
              small
              segments={[{ value: 'belum', label: `Belum (${belum.length})` }, { value: 'sudah', label: `Sudah (${all.length - belum.length})` }, { value: 'semua', label: 'Semua' }]}
              value={filter}
              onChange={setFilter}
            />
            <Input icon="search" placeholder="Cari judul, mapel, atau guru…" value={q} onChangeText={setQ} />
          </View>
        )}
        renderItem={({ item }) => <TugasCard t={item} onPress={() => router.push(`/siswa/tugas/${item.id}` as any)} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={res.loading ? <View style={{ gap: spacing.md }}><CardSkeleton lines={3} /><CardSkeleton lines={3} /></View>
          : res.error && !res.data ? <ErrorState message="Daftar tugas belum tersimpan di perangkat. Sambungkan ke internet lalu coba lagi." onRetry={res.refresh} />
            : <Card><EmptyState icon="checkmark-done-circle-outline" title={filter === 'belum' && !q ? 'Semua tugas sudah dikumpulkan' : 'Tidak ada tugas'} message={q ? 'Coba kata kunci lain.' : 'Tugas dari guru akan muncul di sini.'} compact /></Card>}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      />
    </Screen>
  );
}

function TugasCard({ t, onPress }: { t: KelasTugas; onPress: () => void }) {
  const { colors } = useTheme();
  const due = dueInfo(t.deadline);
  const done = t.submission_status === 'submitted';
  return (
    <Card onPress={onPress} style={[styles.card, !done && due?.overdue ? { borderLeftWidth: 4, borderLeftColor: colors.error } : null]}>
      <View style={styles.head}>
        <View style={{ flex: 1, gap: 2 }}>
          <T weight="semibold" numberOfLines={2}>{t.judul}</T>
          <T variant="caption" tone="muted" numberOfLines={1}>{t.subject_name ?? 'Mapel'} · {t.teacher_name ?? 'Guru'}</T>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      </View>
      <View style={styles.badges}>
        {done ? <Badge label="Sudah dikumpulkan" icon="checkmark-circle-outline" tone="success" small />
          : <Badge label={due?.overdue ? 'Belum dikumpulkan · terlambat' : 'Belum dikumpulkan'} icon="time-outline" tone={due?.overdue ? 'error' : 'warning'} small />}
        {due ? <Badge label={due.label} icon="calendar-outline" tone={done ? 'neutral' : due.tone} small /> : null}
        {t.file_url ? <Badge label="Lampiran" icon="attach-outline" tone="neutral" small /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
