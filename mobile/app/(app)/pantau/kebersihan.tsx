/**
 * Rekapitulasi Kebersihan Kelas (Kepala Madrasah) — native, pengganti /admin/kebersihan.
 * Semua kelas semester aktif: rata-rata bintang & kondisi 7 penilaian terakhir, penilaian terbaru
 * (GET /cleanliness/admin/recap); ketuk kelas untuk riwayat penilaiannya (GET /cleanliness/class/{id}).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { api } from '@/api/endpoints';
import type { CleanlinessRecord } from '@/api/types';
import { pantau, KebersihanRekap } from '@/pantau/api';
import { cocok, SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { formatDateShort } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

const KONDISI: Record<string, { label: string; tone: BadgeTone }> = {
  bersih: { label: 'Bersih', tone: 'success' }, cukup: { label: 'Cukup', tone: 'warning' }, kotor: { label: 'Kotor', tone: 'error' },
};
type Urut = 'nama' | 'terendah';

function Bintang({ n, size = 14 }: { n: number; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name={i <= Math.round(n) ? 'star' : 'star-outline'} size={size} color={i <= Math.round(n) ? colors.warning : colors.border} />)}
    </View>
  );
}

function Riwayat({ classId }: { classId: string }) {
  const { colors } = useTheme();
  const res = useCached<CleanlinessRecord[]>(`pantau.kebersihan.kelas.${classId}`, () => api.kebersihan.classHistory(classId));
  if (res.loading) return <CardSkeleton lines={2} />;
  const list = res.data ?? [];
  if (!list.length) return <T variant="caption" tone="muted">Belum ada penilaian.</T>;
  return (
    <View style={{ gap: spacing.sm }}>
      {list.slice(0, 14).map((h, i) => (
        <View key={h.id ?? `${h.date}-${i}`} style={[{ gap: 2 }, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
          <View style={styles.row}>
            <T variant="caption" weight="medium" style={{ flex: 1 }}>{formatDateShort(h.date)}</T>
            <Bintang n={h.rating ?? 0} size={12} />
            {h.condition ? <Badge label={KONDISI[h.condition]?.label ?? h.condition} tone={KONDISI[h.condition]?.tone ?? 'neutral'} small /> : null}
          </View>
          {h.notes ? <T variant="small" tone="muted">{h.notes}</T> : null}
        </View>
      ))}
    </View>
  );
}

export default function PantauKebersihan() {
  const { colors } = useTheme();
  const res = useCached<KebersihanRekap[]>('pantau.kebersihan', pantau.kebersihanRekap);
  const [q, setQ] = useState('');
  const [urut, setUrut] = useState<Urut>('nama');
  const [buka, setBuka] = useState<string | null>(null);
  const rows = (res.data ?? []).filter((r) => cocok(r.class.name, q)).sort((a, b) => urut === 'nama'
    ? a.class.name.localeCompare(b.class.name, 'id', { numeric: true })
    : (a.total_records ? a.avg_rating_7days : 99) - (b.total_records ? b.avg_rating_7days : 99));
  const dinilai = (res.data ?? []).filter((r) => r.total_records);
  const rata = dinilai.length ? dinilai.reduce((n, r) => n + r.avg_rating_7days, 0) / dinilai.length : 0;

  return (
    <Screen title="Kebersihan Kelas" subtitle="Rekap 7 penilaian terakhir per kelas" back refreshing={res.refreshing} onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        {res.loading ? <CardSkeleton lines={6} /> : res.error && !res.data ? (
          <ErrorState message="Rekap kebersihan belum tersimpan di perangkat." onRetry={res.refresh} compact />
        ) : (
          <>
            <Card style={[styles.row, { gap: spacing.md }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <T weight="semibold">Rata-rata madrasah</T>
                <T variant="caption" tone="muted">{dinilai.length} dari {(res.data ?? []).length} kelas sudah dinilai</T>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <T variant="title">{dinilai.length ? rata.toFixed(1) : '—'}</T>
                <Bintang n={rata} />
              </View>
            </Card>
            <SearchBox value={q} onChange={setQ} placeholder="Cari kelas…" />
            <SegmentedControl<Urut> small segments={[{ value: 'nama', label: 'Urut nama' }, { value: 'terendah', label: 'Nilai terendah' }]} value={urut} onChange={setUrut} />
            {rows.length === 0 ? <Card><EmptyState icon="sparkles-outline" title="Tidak ada kelas" compact /></Card> : rows.map((r) => {
              const terbuka = buka === r.class.id;
              const c = r.condition_count_7days;
              return (
                <Card key={r.class.id} style={{ gap: spacing.sm }}>
                  <Pressable onPress={() => setBuka(terbuka ? null : r.class.id)} accessibilityRole="button" accessibilityState={{ expanded: terbuka }} style={{ gap: 4 }}>
                    <View style={styles.row}>
                      <T weight="semibold" style={{ flex: 1 }}>{r.class.name}</T>
                      {r.total_records ? <><T weight="bold">{r.avg_rating_7days.toFixed(1)}</T><Bintang n={r.avg_rating_7days} /></> : <Badge label="Belum dinilai" tone="neutral" small />}
                      <Icon name={terbuka ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
                    </View>
                    {r.total_records ? (
                      <T variant="caption" tone="muted">
                        Bersih {c.bersih} · Cukup {c.cukup} · Kotor {c.kotor}{r.latest ? ` · terakhir ${formatDateShort(r.latest.date)}` : ''}
                      </T>
                    ) : null}
                  </Pressable>
                  {terbuka ? <Riwayat classId={r.class.id} /> : null}
                </Card>
              );
            })}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm } });
