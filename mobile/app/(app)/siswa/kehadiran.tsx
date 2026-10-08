/**
 * Kehadiran Siswa (siswa) — native, pengganti /siswa/kehadiran. Rekap bulan, minggu ini & hari ini
 * (GET /students/my-attendance/stats) dan daftar kehadiran per pertemuan (GET /students/my-attendance),
 * dengan pemilih bulan; tersimpan offline per bulan.
 */
import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '@/api/endpoints';
import type { KehadiranRecord, KehadiranStats } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { addMonths, formatDateLong, formatTime, monthLabel, monthOf, todayISO } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  hadir: { label: 'Hadir', tone: 'success' },
  sakit: { label: 'Sakit', tone: 'warning' },
  izin: { label: 'Izin', tone: 'brand' },
  alpa: { label: 'Alpa', tone: 'error' },
  alpha: { label: 'Alpa', tone: 'error' },
};

export default function SiswaKehadiranScreen() {
  const { colors } = useTheme();
  const thisMonth = monthOf(todayISO());
  const [month, setMonth] = useState(thisMonth);
  const [y, m] = month.split('-').map((x) => parseInt(x, 10));
  const stats = useCached<KehadiranStats>(`siswa.kehadiran.stats.${month}`, () => api.students.myAttendanceStats(m, y));
  const list = useCached<{ records: KehadiranRecord[] }>(`siswa.kehadiran.${month}`, () => api.students.myAttendance(m, y));

  const byDay = useMemo(() => {
    const map = new Map<string, KehadiranRecord[]>();
    [...(list.data?.records ?? [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')).forEach((r) => {
      const k = (r.date || '').slice(0, 10);
      map.set(k, [...(map.get(k) ?? []), r]);
    });
    return [...map.entries()];
  }, [list.data]);

  const mon = stats.data?.monthly;
  // Belum ada pertemuan → netral (bukan 0% merah).
  const pctColor = (x: { total: number; percentage: number }) =>
    !x.total ? colors.border : x.percentage >= 90 ? colors.success : x.percentage >= 75 ? colors.warning : colors.error;
  const refreshing = stats.refreshing || list.refreshing;

  return (
    <Screen title="Kehadiran Saya" back scroll={false} offline={{ fromCache: stats.fromCache || list.fromCache, updatedAt: stats.updatedAt }}>
      <ScrollView
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void stats.refresh(); void list.refresh(); }} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      >
        <View style={styles.monthBar}>
          <IconButton name="chevron-back" accessibilityLabel="Bulan sebelumnya" onPress={() => setMonth(addMonths(month, -1))} color={colors.onSurface} />
          <T variant="subtitle">{monthLabel(month)}</T>
          <IconButton name="chevron-forward" accessibilityLabel="Bulan berikutnya" onPress={() => month < thisMonth && setMonth(addMonths(month, 1))}
            color={month < thisMonth ? colors.onSurface : colors.border} />
        </View>

        {stats.loading ? <CardSkeleton lines={3} /> : stats.error && !stats.data ? (
          <ErrorState message="Rekap kehadiran belum tersimpan di perangkat." onRetry={stats.refresh} compact />
        ) : mon ? (
          <Card style={{ gap: spacing.md }}>
            <View style={styles.pctRow}>
              <View style={[styles.pct, { borderColor: pctColor(mon) }]}>
                <T variant="title" color={pctColor(mon)}>{mon.total ? `${Math.round(mon.percentage)}%` : '—'}</T>
                <T variant="small" tone="muted">hadir</T>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <T weight="semibold">{mon.total ? `${mon.hadir} dari ${mon.total} pertemuan` : 'Belum ada pertemuan tercatat'}</T>
                {month === thisMonth && stats.data ? (
                  <T variant="caption" tone="muted">
                    Minggu ini {stats.data.weekly.total ? `${Math.round(stats.data.weekly.percentage)}%` : '—'} · Hari ini {stats.data.daily.total ? `${Math.round(stats.data.daily.percentage)}%` : '—'}
                  </T>
                ) : null}
              </View>
            </View>
            <View style={styles.counts}>
              <Count label="Hadir" value={mon.hadir} color={colors.success} />
              <Count label="Sakit" value={mon.sakit ?? 0} color={colors.warning} />
              <Count label="Izin" value={mon.izin ?? 0} color={colors.brandPrimary} />
              <Count label="Alpa" value={mon.alpa ?? 0} color={colors.error} />
            </View>
          </Card>
        ) : null}

        <T variant="subtitle" style={{ marginTop: spacing.sm }}>Riwayat per pertemuan</T>
        {list.loading ? <CardSkeleton lines={4} /> : byDay.length === 0 ? (
          <Card><EmptyState icon="calendar-clear-outline" title="Belum ada data kehadiran" message="Kehadiran dicatat guru saat mengisi jurnal mengajar." compact /></Card>
        ) : byDay.map(([day, recs]) => (
          <Card key={day} style={{ gap: spacing.sm }}>
            <T variant="label" weight="semibold" tone="secondary">{formatDateLong(day)}</T>
            {recs.map((r, i) => {
              const st = STATUS[r.status] ?? { label: r.status, tone: 'neutral' as BadgeTone };
              return (
                <View key={r.id ?? `${day}-${i}`} style={[styles.rec, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}>
                  <View style={{ flex: 1 }}>
                    <T weight="medium">{r.subject_name ?? '-'}</T>
                    <T variant="caption" tone="muted">{formatTime(r.date)}{r.teacher_name ? ` · ${r.teacher_name}` : ''}</T>
                  </View>
                  <Badge label={st.label} tone={st.tone} small />
                </View>
              );
            })}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Count({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.count, { backgroundColor: colors.surfaceSecondary }]}>
      <T variant="subtitle" color={color}>{value}</T>
      <T variant="small" tone="muted">{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pctRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  pct: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  counts: { flexDirection: 'row', gap: spacing.sm },
  count: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
  rec: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
});
