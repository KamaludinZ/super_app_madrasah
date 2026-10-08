/**
 * Data Alumni (Kepala Madrasah) — native, pengganti /admin/alumni (hanya lihat). Jumlah lulusan per tahun
 * pelajaran & kelas (GET /alumni/stats) dan pencarian alumni berdasarkan nama/NISN/NIS (GET /alumni?search).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { pantau, Alumni, AlumniStat } from '@/pantau/api';
import { SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { formatDateShort } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

export default function PantauAlumni() {
  const { colors } = useTheme();
  const stats = useCached<AlumniStat[]>('pantau.alumni.stats', pantau.alumniStats, { staleTime: 60 * 60_000 });
  const [q, setQ] = useState('');
  const [cari, setCari] = useState('');
  // Tunda pencarian agar tidak memanggil server di setiap ketukan.
  useEffect(() => { const t = setTimeout(() => setCari(q.trim()), 500); return () => clearTimeout(t); }, [q]);
  const hasil = useCached<Alumni[]>(`pantau.alumni.cari.${cari}`, () => pantau.alumni(cari), { enabled: cari.length >= 3 });

  const perTahun = useMemo(() => {
    const m = new Map<string, AlumniStat[]>();
    (stats.data ?? []).forEach((s) => { const k = s.academic_year_name ?? 'Tanpa tahun pelajaran'; m.set(k, [...(m.get(k) ?? []), s]); });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [stats.data]);
  const total = (stats.data ?? []).reduce((n, s) => n + s.count, 0);

  return (
    <Screen title="Data Alumni" subtitle={stats.data ? `${total} lulusan tercatat` : 'Lulusan madrasah'} back refreshing={stats.refreshing} onRefresh={stats.refresh}
      offline={{ fromCache: stats.fromCache, updatedAt: stats.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <SearchBox value={q} onChange={setQ} placeholder="Cari alumni (nama/NISN, min. 3 huruf)…" />
        {cari.length >= 3 ? (
          hasil.loading ? <CardSkeleton lines={3} /> : (hasil.data ?? []).length === 0 ? (
            <Card><EmptyState icon="search-outline" title="Alumni tidak ditemukan" compact /></Card>
          ) : (
            <Card style={{ gap: spacing.sm }}>
              {(hasil.data ?? []).slice(0, 50).map((a, i) => (
                <View key={a.id} style={[{ gap: 2 }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
                  <T weight="medium">{a.full_name}</T>
                  <T variant="caption" tone="muted">
                    {[a.nisn ? `NISN ${a.nisn}` : null, a.graduation_class_name ? `Kelas ${a.graduation_class_name}` : null, a.graduation_date ? `lulus ${formatDateShort(a.graduation_date)}` : null].filter(Boolean).join(' · ')}
                  </T>
                </View>
              ))}
            </Card>
          )
        ) : null}

        {stats.loading ? <CardSkeleton lines={5} /> : stats.error && !stats.data ? (
          <ErrorState message="Data alumni belum tersimpan di perangkat." onRetry={stats.refresh} compact />
        ) : perTahun.length === 0 ? (
          <Card><EmptyState icon="school-outline" title="Belum ada alumni" compact /></Card>
        ) : perTahun.map(([th, list]) => (
          <Card key={th} style={{ gap: spacing.sm }}>
            <View style={styles.row}>
              <T weight="semibold" style={{ flex: 1 }}>{th}</T>
              <T weight="bold">{list.reduce((n, s) => n + s.count, 0)} lulusan</T>
            </View>
            <View style={styles.chips}>
              {[...list].sort((a, b) => (a.class_name ?? '').localeCompare(b.class_name ?? '', 'id', { numeric: true })).map((s) => (
                <View key={`${s.class_id}`} style={[styles.chip, { backgroundColor: colors.surfaceSecondary }]}>
                  <T variant="small">{s.class_name ?? '-'} · {s.count}</T>
                </View>
              ))}
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999 },
});
