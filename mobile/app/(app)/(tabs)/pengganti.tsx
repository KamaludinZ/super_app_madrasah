/**
 * Guru Pengganti (Admin, Waka Kurikulum, Guru Piket — GET /guru-pengganti/config → can_manage).
 *  Daftar  : penugasan mendatang (aktif, mulai hari ini) atau riwayat 60 hari (semua status),
 *            dikelompokkan per tanggal, dengan pencarian & ringkasan status jurnal.
 *  Kalender: jumlah penugasan aktif per tanggal dalam sebulan; ketuk tanggal untuk melihat daftarnya.
 * Tombol + membuka wizard penugasan (/pengganti/baru); ketuk kartu → detail (/pengganti/[id]).
 */
import React, { useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import type { GPAssignment } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { addDays, addMonths, formatDateLong, monthOf, monthRange, todayISO } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Button, IconButton } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { AssignmentCard } from '@/components/AssignmentCard';
import { MonthCalendar } from '@/components/MonthCalendar';

type View_ = 'daftar' | 'kalender';
type Range = 'mendatang' | 'riwayat';

export default function PenggantiScreen() {
  const router = useRouter();
  const [view, setView] = useState<View_>('daftar');
  const add = () => router.push('/pengganti/baru' as any);

  return (
    <Screen
      title="Guru Pengganti"
      subtitle="Penugasan pengganti guru berhalangan"
      headerTone="brand"
      scroll={false}
      right={<IconButton name="add" color="#FFFFFF" bg="rgba(255,255,255,0.18)" accessibilityLabel="Tugaskan guru pengganti" onPress={add} />}
    >
      <SegmentedControl<View_>
        segments={[{ value: 'daftar', label: 'Daftar' }, { value: 'kalender', label: 'Kalender' }]}
        value={view}
        onChange={setView}
        style={{ marginBottom: spacing.md }}
      />
      {view === 'daftar' ? <DaftarView onAdd={add} /> : <KalenderView onAdd={add} />}
    </Screen>
  );
}

function DaftarView({ onAdd }: { onAdd: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [range, setRange] = useState<Range>('mendatang');
  const [query, setQuery] = useState('');
  const today = todayISO();

  const params = range === 'mendatang'
    ? { from: today, to: addDays(today, 120), status: 'active' as const }
    : { from: addDays(today, -60), to: addDays(today, -1), status: 'all' as const };
  const res = useCached<GPAssignment[]>(`gp.assignments.${range}`, () => api.gp.assignments({ ...params, limit: 1000 }));

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = res.data ?? [];
    return q ? list.filter((a) => [a.original_teacher_name, a.substitute_teacher_name, a.class_name, a.subject_name]
      .some((v) => (v || '').toLowerCase().includes(q))) : list;
  }, [res.data, query]);

  const sections = useMemo(() => {
    const byDate = new Map<string, GPAssignment[]>();
    const sorted = [...items].sort((a, b) => (range === 'mendatang' ? 1 : -1) * (a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || '')));
    sorted.forEach((a) => byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]));
    return [...byDate.entries()].map(([date, data]) => ({ date, data }));
  }, [items, range]);

  const stats = useMemo(() => {
    const list = res.data ?? [];
    return {
      today: list.filter((a) => a.date === today && a.status === 'active').length,
      pending: list.filter((a) => a.status === 'active' && a.journal_status === 'pending').length,
      missing: list.filter((a) => a.status === 'active' && a.journal_status === 'missing').length,
      filled: list.filter((a) => a.journal_status === 'filled').length,
    };
  }, [res.data, today]);

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      <SegmentedControl<Range>
        small
        segments={[{ value: 'mendatang', label: 'Mendatang' }, { value: 'riwayat', label: 'Riwayat 60 hari' }]}
        value={range}
        onChange={setRange}
      />
      <Input icon="search" placeholder="Cari guru, kelas, atau mapel…" value={query} onChangeText={setQuery} />
      {res.data && res.data.length ? (
        <View style={styles.stats}>
          {range === 'mendatang' ? (
            <>
              <Stat label="Hari ini" value={stats.today} color={colors.brandPrimary} />
              <Stat label="Total aktif" value={res.data.length} color={colors.onSurface} />
              <Stat label="Belum diisi" value={stats.pending} color={colors.warning} />
            </>
          ) : (
            <>
              <Stat label="Terisi" value={stats.filled} color={colors.success} />
              <Stat label="Terlewat" value={stats.missing} color={colors.error} />
              <Stat label="Total" value={res.data.length} color={colors.onSurface} />
            </>
          )}
        </View>
      ) : null}
    </View>
  );

  if (res.loading) return <View style={{ gap: spacing.md }}>{header}<CardSkeleton lines={3} /><CardSkeleton lines={3} /></View>;
  if (res.error && !res.data) return <View>{header}<ErrorState message="Daftar penugasan belum tersimpan di perangkat. Sambungkan ke internet lalu coba lagi." onRetry={res.refresh} /></View>;

  return (
    <SectionList
      sections={sections}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={header}
      renderSectionHeader={({ section }) => (
        <View style={[styles.sectionHead, { backgroundColor: colors.surfaceSecondary }]}>
          <T variant="label" weight="semibold" tone={section.date === today ? 'brand' : 'secondary'}>
            {section.date === today ? 'Hari ini · ' : ''}{formatDateLong(section.date)}
          </T>
          <T variant="caption" tone="muted">{section.data.length} slot</T>
        </View>
      )}
      renderItem={({ item }) => <AssignmentCard a={item} showDate={false} onPress={() => router.push(`/pengganti/${item.id}` as any)} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      SectionSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      stickySectionHeadersEnabled
      ListEmptyComponent={(
        <Card>
          <EmptyState
            icon="swap-horizontal-outline"
            title={query ? 'Tidak ada yang cocok' : range === 'mendatang' ? 'Belum ada penugasan mendatang' : 'Belum ada riwayat'}
            message={query ? 'Coba kata kunci lain.' : 'Tugaskan guru pengganti saat ada guru yang berhalangan hadir.'}
            actionLabel={range === 'mendatang' && !query ? 'Tugaskan guru pengganti' : undefined}
            onAction={onAdd}
            compact
          />
        </Card>
      )}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
    />
  );
}

function KalenderView({ onAdd }: { onAdd: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const today = todayISO();
  const [month, setMonth] = useState(monthOf(today));
  const [selected, setSelected] = useState<string>(today);
  const { start, end } = monthRange(month);
  const res = useCached<GPAssignment[]>(`gp.assignments.month.${month}`, () => api.gp.assignments({ from: start, to: end, status: 'active', limit: 2000 }));

  const byDate = useMemo(() => {
    const m = new Map<string, GPAssignment[]>();
    (res.data ?? []).forEach((a) => m.set(a.date, [...(m.get(a.date) ?? []), a]));
    m.forEach((list) => list.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')));
    return m;
  }, [res.data]);

  const dayList = byDate.get(selected) ?? [];
  const changeMonth = (d: -1 | 1) => {
    const next = addMonths(month, d);
    setMonth(next);
    setSelected(monthOf(today) === next ? today : `${next}-01`);
  };

  return (
    <SectionList
      sections={[{ data: dayList }]}
      keyExtractor={(a) => a.id}
      ListHeaderComponent={(
        <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <Card>
            <MonthCalendar
              month={month}
              onMonthChange={changeMonth}
              loading={res.loading || res.refreshing}
              onPressDay={setSelected}
              dayProps={(iso) => {
                const list = byDate.get(iso) ?? [];
                const missing = list.some((a) => a.journal_status === 'missing');
                return {
                  selected: iso === selected,
                  count: list.length || undefined,
                  dot: list.length ? (missing ? 'error' : list.every((a) => a.journal_status === 'filled') ? 'success' : 'warning') : null,
                };
              }}
            />
            <View style={styles.legend}>
              <Legend color={colors.success} label="Semua jurnal terisi" />
              <Legend color={colors.warning} label="Belum diisi" />
              <Legend color={colors.error} label="Terlewat" />
            </View>
          </Card>
          <View style={styles.dayHead}>
            <T variant="subtitle" style={{ flex: 1 }}>{formatDateLong(selected)}</T>
            <T variant="caption" tone="muted">{dayList.length} penugasan</T>
          </View>
        </View>
      )}
      renderItem={({ item }) => <AssignmentCard a={item} showDate={false} onPress={() => router.push(`/pengganti/${item.id}` as any)} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      ListFooterComponent={res.error && !res.data ? <ErrorState message="Kalender belum bisa dimuat." onRetry={res.refresh} compact /> : (
        dayList.length === 0 && !res.loading ? (
          <Card>
            <EmptyState icon="calendar-clear-outline" title="Tidak ada penugasan" message="Belum ada guru pengganti pada tanggal ini." compact />
            {selected >= today ? <Button title="Tugaskan guru pengganti" icon="add" variant="outline" size="sm" onPress={onAdd} style={{ marginTop: spacing.sm }} /> : null}
          </Card>
        ) : null
      )}
      contentContainerStyle={{ paddingBottom: spacing.xxl }}
      refreshControl={<RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
    />
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card style={styles.stat}>
      <T variant="title" color={color}>{value}</T>
      <T variant="caption" tone="muted" numberOfLines={1}>{label}</T>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <T variant="small" tone="muted">{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, paddingVertical: spacing.md, gap: 2 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  dayHead: { flexDirection: 'row', alignItems: 'center' },
});
