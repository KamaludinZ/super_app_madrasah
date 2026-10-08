/**
 * Agenda Saya (guru, tendik, kepala) — native, pengganti /my-agenda. Ringkasan durasi (GET /staff-events/stats/
 * duration), daftar agenda milik sendiri (GET /staff-events) dengan filter Mendatang/Selesai/Semua & pencarian,
 * status otomatis menurut waktu, ubah & hapus; tambah lewat form.
 */
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { StaffEvent, StaffEventStats } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { formatDateShort } from '@/utils/time';
import { PRIORITIES, autoStatus, categoryLabel } from '@/agenda/options';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon, IconName } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

type Filter = 'mendatang' | 'selesai' | 'semua';

export default function AgendaSaya() {
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const res = useCached<StaffEvent[]>('agenda.list', api.agenda.list);
  const stats = useCached<StaffEventStats>('agenda.stats', api.agenda.stats);
  const [filter, setFilter] = useState<Filter>('mendatang');
  const [search, setSearch] = useState('');

  const items = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (res.data ?? [])
      .map((a) => ({ a, st: autoStatus(a) }))
      .filter(({ a, st }) => {
        if (filter === 'mendatang' && (st.value === 'completed' || st.value === 'cancelled')) return false;
        if (filter === 'selesai' && !(st.value === 'completed' || st.value === 'cancelled')) return false;
        return !s || [a.event_name, a.description, a.location].some((x) => (x ?? '').toLowerCase().includes(s));
      })
      .sort((x, y) => (filter === 'mendatang' ? 1 : -1) * `${x.a.date}${x.a.start_time}`.localeCompare(`${y.a.date}${y.a.start_time}`));
  }, [res.data, filter, search]);

  const remove = (a: StaffEvent) => Alert.alert('Hapus agenda?', a.event_name, [
    { text: 'Batal', style: 'cancel' },
    {
      text: 'Hapus', style: 'destructive', onPress: async () => {
        try {
          await api.agenda.remove(a.id);
          toast.success('Agenda dihapus');
          await qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('agenda.') });
        } catch (e) { toast.error(errorMessage(e, 'Gagal menghapus agenda.')); }
      },
    },
  ]);

  const st = stats.data;
  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      {st && st.total_events > 0 ? (
        <View style={styles.stats}>
          <Stat icon="calendar-outline" label="Rata-rata" value={`${st.avg_duration_days} hari`} />
          <Stat icon="time-outline" label="Rata-rata" value={`${st.avg_duration_hours} jam`} />
          <Stat icon="layers-outline" label="Multi hari" value={String(st.multi_day_count)} />
          <Stat icon="today-outline" label="Satu hari" value={String(st.single_day_count)} />
        </View>
      ) : null}
      <SegmentedControl<Filter> small segments={[{ value: 'mendatang', label: 'Mendatang' }, { value: 'selesai', label: 'Selesai' }, { value: 'semua', label: 'Semua' }]}
        value={filter} onChange={setFilter} />
      <Input icon="search-outline" placeholder="Cari kegiatan, lokasi…" value={search} onChangeText={setSearch} returnKeyType="search" />
    </View>
  );

  return (
    <Screen title="Agenda Saya" subtitle={`${res.data?.length ?? 0} agenda`} back scroll={false}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}
      footer={<Button title="Tambah agenda" icon="add-circle-outline" size="lg" fullWidth disabled={!online} onPress={() => router.push('/agenda/form')} />}>
      <FlatList
        data={items}
        keyExtractor={({ a }) => a.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: { a, st: status } }) => {
          const pr = PRIORITIES.find((p) => p.value === a.priority);
          return (
            <Card style={{ gap: spacing.sm }}>
              <View style={styles.row}>
                <T weight="semibold" style={{ flex: 1 }}>{a.event_name}</T>
                <Badge label={status.label} tone={status.tone} small />
              </View>
              <Meta icon="calendar-outline" text={`${formatDateShort(a.date)}${a.end_date && a.end_date !== a.date ? ` – ${formatDateShort(a.end_date)}` : ''} · ${a.start_time}–${a.end_time}`} />
              {a.location ? <Meta icon="location-outline" text={a.location} /> : null}
              {a.description ? <T variant="caption" tone="secondary" numberOfLines={3}>{a.description}</T> : null}
              <View style={styles.row}>
                {a.category ? <Badge label={categoryLabel(a.category)} tone="neutral" small /> : null}
                {pr ? <Badge label={pr.label} tone={pr.tone} small /> : null}
                <Badge label={a.is_public === false ? 'Privat' : 'Publik'} icon={a.is_public === false ? 'eye-off-outline' : 'eye-outline'} tone="neutral" small />
                <View style={{ flex: 1 }} />
                <Button title="Ubah" icon="create-outline" variant="ghost" size="sm" disabled={!online}
                  onPress={() => router.push({ pathname: '/agenda/form', params: { id: a.id } })} />
                <Button title="Hapus" icon="trash-outline" variant="ghost" size="sm" disabled={!online} onPress={() => remove(a)} />
              </View>
            </Card>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={res.loading ? <CardSkeleton lines={3} /> : res.error && !res.data
          ? <ErrorState message="Agenda belum tersimpan di perangkat. Sambungkan ke internet lalu coba lagi." onRetry={res.refresh} />
          : <Card><EmptyState icon="calendar-clear-outline" title={search ? 'Tidak ada yang cocok' : filter === 'mendatang' ? 'Tidak ada agenda mendatang' : 'Belum ada agenda'}
              message="Catat rapat, pelatihan, dan kegiatan lain lewat “Tambah agenda”." compact /></Card>}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={res.refreshing} onRefresh={() => { void res.refresh(); void stats.refresh(); }} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      />
    </Screen>
  );
}

function Stat({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name={icon} size={16} color={colors.brandPrimary} />
      <T weight="semibold">{value}</T>
      <T variant="small" tone="muted">{label}</T>
    </View>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={14} color={colors.muted} />
      <T variant="caption" tone="secondary" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.sm, borderRadius: radius.md, borderWidth: 1 },
});
