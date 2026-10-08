/**
 * Dashboard Kelas (wali kelas) — native, pengganti /wali-kelas. Ringkasan kelas wali
 * (GET /wali-kelas/dashboard-stats: kehadiran bulan ini, kelengkapan data siswa, prestasi per tingkat,
 * poin tata tertib) dan jadwal kelas hari ini dengan status jurnal (GET /wali-kelas/my-class),
 * plus pintasan ke layar kelas wali.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { request, errorMessage } from '@/api/client';
import { PctRow } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { spacing, radius, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Icon, IconName } from '@/components/ui/Icon';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Stats = {
  attendance: { total_records: number; present_records: number; percentage: number } | null;
  students: { total: number; complete: number; completeness_percentage: number } | null;
  achievements: { by_level: Record<string, number>; total: number } | null;
  discipline: { violation_points: number; achievement_points: number; total_records: number } | null;
};
type Jadwal = { id: string; start_time?: string; end_time?: string; subject_name?: string | null; teacher_name?: string | null; room_name?: string | null; journal_filled?: boolean };
type KelasSaya = { class: { id: string; name: string } | null; today_schedule: Jadwal[]; students: unknown[] };
const TINGKAT: [string, string][] = [['sekolah', 'Sekolah'], ['kecamatan', 'Kecamatan'], ['kabupaten', 'Kab/Kota'], ['provinsi', 'Provinsi'], ['nasional', 'Nasional'], ['internasional', 'Internasional']];
const PINTASAN: { label: string; icon: IconName; href: string }[] = [
  { label: 'Data Siswa', icon: 'people-outline', href: '/pantau/siswa?kelas=wali' },
  { label: 'Kehadiran', icon: 'checkmark-done-outline', href: '/wali/kehadiran' },
  { label: 'Kebersihan', icon: 'sparkles-outline', href: '/wali/kebersihan' },
  { label: 'Poin Tatib', icon: 'shield-checkmark-outline', href: '/tatib/walikelas' },
];

export default function WaliDashboard() {
  const { colors } = useTheme();
  const router = useRouter();
  const kelas = useCached<KelasSaya>('wali.kelas', () => request('/wali-kelas/my-class'));
  const stats = useCached<Stats>('wali.stats', () => request('/wali-kelas/dashboard-stats'));
  const s = stats.data;
  const k = kelas.data;

  return (
    <Screen title={k?.class ? `Kelas ${k.class.name}` : 'Dashboard Kelas'} subtitle="Ringkasan kelas wali" back
      refreshing={kelas.refreshing || stats.refreshing} onRefresh={() => { void kelas.refresh(); void stats.refresh(); }}
      offline={{ fromCache: stats.fromCache, updatedAt: stats.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        {kelas.loading || stats.loading ? <CardSkeleton lines={6} /> : !k?.class ? (
          kelas.error ? <ErrorState message={errorMessage(kelas.error, 'Data kelas belum bisa dimuat.')} onRetry={kelas.refresh} compact />
            : <Card><EmptyState icon="school-outline" title="Belum ada kelas wali" message="Akun Anda belum ditetapkan sebagai wali kelas." compact /></Card>
        ) : (
          <>
            <View style={styles.grid}>
              {PINTASAN.map((p) => (
                <Pressable key={p.href} onPress={() => router.push(p.href as never)} accessibilityRole="button" accessibilityLabel={p.label}
                  style={({ pressed }) => [styles.short, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
                  <Icon name={p.icon} size={22} color={colors.brandPrimary} />
                  <T variant="small" weight="medium" center>{p.label}</T>
                </Pressable>
              ))}
            </View>
            {s ? (
              <Card style={{ gap: spacing.md }}>
                <PctRow title="Kehadiran bulan ini" pct={s.attendance?.percentage} ada={!!s.attendance?.total_records}
                  subtitle={s.attendance?.total_records ? `${s.attendance.present_records} hadir dari ${s.attendance.total_records} catatan` : 'Belum ada catatan'} />
                <PctRow title="Siswa berdata lengkap" pct={s.students?.completeness_percentage} ada={!!s.students?.total}
                  subtitle={s.students ? `${s.students.complete} dari ${s.students.total} siswa sudah 100% lengkap` : undefined} />
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <T weight="medium">Poin tata tertib</T>
                    <T variant="caption" tone="muted">{s.discipline?.total_records ?? 0} catatan</T>
                  </View>
                  <Badge label={`+${s.discipline?.achievement_points ?? 0}`} tone="success" small />
                  <Badge label={`−${s.discipline?.violation_points ?? 0}`} tone="error" small />
                </View>
                <View style={{ gap: spacing.xs }}>
                  <T weight="medium">Prestasi siswa · {s.achievements?.total ?? 0}</T>
                  <View style={styles.chips}>
                    {TINGKAT.filter(([key]) => s.achievements?.by_level?.[key]).map(([key, label]) => (
                      <Badge key={key} label={`${label} ${s.achievements!.by_level[key]}`} tone="brand" small />
                    ))}
                    {!s.achievements?.total ? <T variant="caption" tone="muted">Belum ada prestasi tercatat.</T> : null}
                  </View>
                </View>
              </Card>
            ) : null}
            <T variant="subtitle" style={{ marginTop: spacing.sm }}>Jadwal kelas hari ini</T>
            {(k.today_schedule ?? []).length === 0 ? <Card><EmptyState icon="cafe-outline" title="Tidak ada jadwal hari ini" compact /></Card> : (
              <Card style={{ gap: spacing.sm }}>
                {k.today_schedule.map((j, i) => (
                  <View key={j.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
                    <T weight="bold" style={{ width: 92 }}>{j.start_time}–{j.end_time}</T>
                    <View style={{ flex: 1 }}>
                      <T weight="medium" numberOfLines={1}>{j.subject_name ?? '-'}</T>
                      <T variant="caption" tone="muted" numberOfLines={1}>{j.teacher_name ?? '-'}</T>
                    </View>
                    <Badge label={j.journal_filled ? 'Terisi' : 'Belum'} tone={j.journal_filled ? 'success' : 'neutral'} small />
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', gap: spacing.sm },
  short: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: spacing.md, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
