/**
 * Jadwal pelajaran mingguan — native, pengganti /jadwal. Sumber sesuai peran (sama dengan web):
 *  siswa       → jadwal kelasnya (GET /schedules/grouped?class_id=student_class_id)
 *  wali kelas  → jadwal kelas walinya (class_id=homeroom_class_id)
 *  guru/lainnya→ jadwal mengajarnya (teacher_id=user.id)
 * Jam berurutan mapel yang sama sudah digabung server; pilih hari (bawaan hari ini), tersimpan offline.
 */
import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '@/api/endpoints';
import type { ScheduleItem } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { DAY_LABELS, dayKeyOf, slotStatus, todayISO } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

const DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'] as const;
type Day = (typeof DAYS)[number];

export default function JadwalScreen() {
  const { colors } = useTheme();
  const { user, activeRole } = useAuth();
  const today = dayKeyOf(todayISO());
  const [day, setDay] = useState<Day>((DAYS as readonly string[]).includes(today) ? (today as Day) : 'senin');

  const source = activeRole === 'siswa'
    ? { q: { class_id: user?.student_class_id ?? undefined }, title: 'Jadwal Kelas Saya', who: 'teacher' as const }
    : activeRole === 'wali_kelas'
      ? { q: { class_id: user?.homeroom_class_id ?? undefined }, title: 'Jadwal Kelas', who: 'teacher' as const }
      : { q: { teacher_id: user?.id }, title: 'Jadwal Mengajar Saya', who: 'class' as const };
  const key = `jadwal.${source.q.class_id ? `c.${source.q.class_id}` : `t.${source.q.teacher_id}`}`;
  const res = useCached<ScheduleItem[]>(key, () => api.schedules.grouped(source.q), {
    enabled: !!(source.q.class_id || source.q.teacher_id), staleTime: 10 * 60_000,
  });

  const byDay = useMemo(() => {
    const m = new Map<string, ScheduleItem[]>();
    (res.data ?? []).forEach((s) => { const d = (s.day || '').toLowerCase(); m.set(d, [...(m.get(d) ?? []), s]); });
    m.forEach((l) => l.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')));
    return m;
  }, [res.data]);
  const list = byDay.get(day) ?? [];
  const missingClass = !(source.q.class_id || source.q.teacher_id);

  return (
    <Screen title={source.title} subtitle={`${res.data?.length ?? 0} jam pelajaran sepekan`} back scroll={false} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <ScrollView
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      >
        <SegmentedControl<Day>
          small
          segments={DAYS.map((d) => ({ value: d, label: `${DAY_LABELS[d].slice(0, 3)}${byDay.get(d)?.length ? ` ${byDay.get(d)!.length}` : ''}` }))}
          value={day}
          onChange={setDay}
        />
        <T variant="subtitle">{DAY_LABELS[day]}{day === today ? ' · Hari ini' : ''}</T>

        {missingClass ? (
          <Card><EmptyState icon="school-outline" title="Kelas belum diatur" message="Akun Anda belum terhubung ke kelas. Hubungi wali kelas atau admin." compact /></Card>
        ) : res.loading ? <CardSkeleton lines={3} /> : res.error && !res.data ? (
          <ErrorState message="Jadwal belum tersimpan di perangkat. Sambungkan ke internet lalu coba lagi." onRetry={res.refresh} />
        ) : list.length === 0 ? (
          <Card><EmptyState icon="cafe-outline" title="Tidak ada jadwal" message={`Tidak ada pelajaran pada hari ${DAY_LABELS[day]}.`} compact /></Card>
        ) : list.map((s) => {
          const st = day === today ? slotStatus(s.start_time, s.end_time) : null;
          return (
            <Card key={s.id} style={[styles.card, st === 'ongoing' ? { borderColor: colors.brandPrimary, borderWidth: 1.5 } : null]}>
              <View style={[styles.time, { backgroundColor: st === 'ongoing' ? colors.brandPrimary : colors.surfaceSecondary }]}>
                <T weight="bold" color={st === 'ongoing' ? colors.onBrandPrimary : undefined}>{s.start_time}</T>
                <T variant="small" color={st === 'ongoing' ? colors.onBrandPrimary : colors.muted}>{s.end_time}</T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T weight="semibold" numberOfLines={1}>{s.subject_name ?? '-'}</T>
                <View style={styles.meta}>
                  <Icon name={source.who === 'teacher' ? 'person-outline' : 'people-outline'} size={14} color={colors.muted} />
                  <T variant="caption" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>
                    {source.who === 'teacher' ? s.teacher_name ?? '-' : s.class_name ?? '-'}
                  </T>
                </View>
                {s.room_name ? (
                  <View style={styles.meta}>
                    <Icon name="location-outline" size={14} color={colors.muted} />
                    <T variant="caption" tone="muted">Ruang {s.room_name}</T>
                  </View>
                ) : null}
              </View>
              {st === 'ongoing' ? <Badge label="Berlangsung" tone="brand" small /> : st === 'done' ? <Badge label="Selesai" tone="neutral" small /> : null}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  time: { width: 64, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
