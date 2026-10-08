/**
 * Kehadiran per kelas (Kepala Madrasah) — GET /admin/attendance/by-class: rekap kelas sebulan dan per siswa
 * (persentase, S/I/A); ketuk siswa untuk melihat catatan tidak hadirnya (mapel, guru, tanggal).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { pantau, KehadiranKelas } from '@/pantau/api';
import { bulanIni, cocok, Counts, MonthBar, PctRow, pecahBulan, SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { formatDateShort } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  sakit: { label: 'Sakit', tone: 'warning' }, izin: { label: 'Izin', tone: 'brand' }, alpa: { label: 'Alpa', tone: 'error' }, alpha: { label: 'Alpa', tone: 'error' },
};

export default function PantauKehadiranKelas() {
  const { colors } = useTheme();
  const p = useLocalSearchParams<{ id: string; name?: string; month?: string }>();
  const [month, setMonth] = useState(p.month || bulanIni());
  const { y, m } = pecahBulan(month);
  const res = useCached<KehadiranKelas>(`pantau.kehadiran.kelas.${p.id}.${month}`, () => pantau.kehadiranKelas(p.id, m, y), { enabled: !!p.id });
  const [q, setQ] = useState('');
  const [buka, setBuka] = useState<string | null>(null);
  const s = res.data?.class_statistics;
  const siswa = [...(res.data?.students ?? [])].filter((x) => cocok(x.student_name, q)).sort((a, b) => a.student_name.localeCompare(b.student_name));

  return (
    <Screen title={`Kehadiran ${p.name ?? res.data?.class?.name ?? 'Kelas'}`} subtitle="Rekap per siswa" back refreshing={res.refreshing} onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <MonthBar month={month} onChange={setMonth} />
        {res.loading ? <CardSkeleton lines={5} /> : res.error && !res.data ? (
          <ErrorState message="Data kehadiran kelas belum tersimpan di perangkat." onRetry={res.refresh} compact />
        ) : s ? (
          <>
            <Card style={{ gap: spacing.md }}>
              <PctRow title="Kehadiran kelas" subtitle={s.total ? `${s.hadir} hadir dari ${s.total} catatan` : 'Belum ada catatan bulan ini'} pct={s.percentage} ada={!!s.total} />
              <Counts items={[
                { label: 'Hadir', value: s.hadir, color: colors.success }, { label: 'Sakit', value: s.sakit, color: colors.warning },
                { label: 'Izin', value: s.izin, color: colors.brandPrimary }, { label: 'Alpa', value: s.alpa, color: colors.error },
              ]} />
            </Card>
            <SearchBox value={q} onChange={setQ} placeholder="Cari siswa…" />
            {siswa.length === 0 ? <Card><EmptyState icon="people-outline" title="Tidak ada siswa" compact /></Card> : (
              <Card style={{ gap: spacing.md }}>
                {siswa.map((x, i) => {
                  const absen = x.records.filter((r) => r.status !== 'hadir').sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
                  const terbuka = buka === x.student_id;
                  return (
                    <Pressable key={x.student_id} onPress={() => absen.length && setBuka(terbuka ? null : x.student_id)} disabled={!absen.length}
                      style={[{ gap: spacing.sm }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.md }]}>
                      <PctRow title={x.student_name} subtitle={x.total ? `S ${x.sakit} · I ${x.izin} · A ${x.alpa}${absen.length ? (terbuka ? ' · tutup rincian' : ' · ketuk untuk rincian') : ''}` : 'Belum ada catatan'}
                        pct={x.percentage} ada={!!x.total} />
                      {terbuka ? absen.map((r, j) => {
                        const st = STATUS[r.status] ?? { label: r.status, tone: 'neutral' as BadgeTone };
                        return (
                          <View key={r.id ?? j} style={styles.rec}>
                            <View style={{ flex: 1 }}>
                              <T variant="caption" weight="medium">{r.subject_name ?? '-'}</T>
                              <T variant="small" tone="muted">{r.date ? formatDateShort(r.date) : '-'}{r.teacher_name ? ` · ${r.teacher_name}` : ''}</T>
                            </View>
                            <Badge label={st.label} tone={st.tone} small />
                          </View>
                        );
                      }) : null}
                    </Pressable>
                  );
                })}
              </Card>
            )}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rec: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md },
});
