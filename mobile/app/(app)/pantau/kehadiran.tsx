/**
 * Kehadiran Siswa (Kepala Madrasah) — native, pengganti /admin/kehadiran. Rekap seluruh madrasah per bulan
 * (GET /admin/attendance/overall: bulan, minggu ini, hari ini) dan per tingkat → kelas; ketuk kelas untuk
 * rekap per siswa (pantau/kehadiran-kelas).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { pantau, KehadiranOverall, Rekap } from '@/pantau/api';
import { bulanIni, Counts, MonthBar, PctRow, pecahBulan, usePctColor } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

export default function PantauKehadiran() {
  const { colors } = useTheme();
  const router = useRouter();
  const pctColor = usePctColor();
  const [month, setMonth] = useState(bulanIni());
  const { y, m } = pecahBulan(month);
  const res = useCached<KehadiranOverall>(`pantau.kehadiran.${month}`, () => pantau.kehadiranOverall(m, y));
  const [buka, setBuka] = useState<string | null>(null);
  const d = res.data;
  const kini = month === bulanIni();

  const ringkas = (r: Rekap) => `${r.hadir} hadir dari ${r.total} catatan`;

  return (
    <Screen title="Kehadiran Siswa" subtitle="Rekap madrasah per bulan" back refreshing={res.refreshing} onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <MonthBar month={month} onChange={(v) => { setMonth(v); setBuka(null); }} />
        {res.loading ? <CardSkeleton lines={4} /> : res.error && !d ? (
          <ErrorState message="Rekap kehadiran belum tersimpan di perangkat." onRetry={res.refresh} compact />
        ) : d ? (
          <>
            <Card style={{ gap: spacing.md }}>
              <View style={styles.row}>
                <View style={[styles.pct, { borderColor: pctColor(d.monthly.percentage, !!d.monthly.total) }]}>
                  <T variant="title" color={pctColor(d.monthly.percentage, !!d.monthly.total)}>{d.monthly.total ? `${Math.round(d.monthly.percentage)}%` : '—'}</T>
                  <T variant="small" tone="muted">hadir</T>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <T weight="semibold">{d.monthly.total ? ringkas(d.monthly) : 'Belum ada kehadiran tercatat'}</T>
                  {kini ? (
                    <T variant="caption" tone="muted">
                      Minggu ini {d.weekly.total ? `${Math.round(d.weekly.percentage)}%` : '—'} · Hari ini {d.daily.total ? `${Math.round(d.daily.percentage)}%` : '—'}
                    </T>
                  ) : null}
                </View>
              </View>
              <Counts items={[
                { label: 'Hadir', value: d.monthly.hadir, color: colors.success },
                { label: 'Sakit', value: d.monthly.sakit, color: colors.warning },
                { label: 'Izin', value: d.monthly.izin, color: colors.brandPrimary },
                { label: 'Alpa', value: d.monthly.alpa, color: colors.error },
              ]} />
            </Card>

            <T variant="subtitle" style={{ marginTop: spacing.sm }}>Per tingkat</T>
            {d.by_grade.length === 0 ? (
              <Card><EmptyState icon="school-outline" title="Belum ada kelas aktif" compact /></Card>
            ) : [...d.by_grade].sort((a, b) => String(a.tingkat).localeCompare(String(b.tingkat), 'id', { numeric: true })).map((g) => {
              const key = String(g.tingkat);
              const terbuka = buka === key;
              return (
                <Card key={key} style={{ gap: spacing.sm }}>
                  <Pressable onPress={() => setBuka(terbuka ? null : key)} accessibilityRole="button" accessibilityState={{ expanded: terbuka }}>
                    <PctRow title={`Kelas ${g.tingkat}`} subtitle={`${g.class_count} kelas · ${g.total ? ringkas(g) : 'belum ada catatan'}`} pct={g.percentage} ada={!!g.total}
                      right={<Icon name={terbuka ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />} />
                  </Pressable>
                  {terbuka ? [...g.classes].sort((a, b) => a.class_name.localeCompare(b.class_name, 'id', { numeric: true })).map((c) => (
                    <Pressable key={c.class_id} accessibilityRole="button" style={[styles.kelas, { borderTopColor: colors.divider }]}
                      onPress={() => router.push({ pathname: '/pantau/kehadiran-kelas', params: { id: c.class_id, name: c.class_name, month } })}>
                      <PctRow title={c.class_name} subtitle={c.total ? `S ${c.sakit} · I ${c.izin} · A ${c.alpa}` : 'Belum ada catatan'} pct={c.percentage} ada={!!c.total}
                        right={<Icon name="chevron-forward" size={18} color={colors.muted} />} />
                    </Pressable>
                  )) : null}
                </Card>
              );
            })}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  pct: { width: 84, height: 84, borderRadius: 42, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  kelas: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
});
