/**
 * Rincian absensi satu GTK (Kepala Madrasah) — GET /gtk/absensi/rekap?gtk_id: ringkasan & status per hari
 * pada rentang tanggal (hadir, izin, alpha, libur).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { pantau, GtkRekapDetail } from '@/pantau/api';
import { Counts, PctRow } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { formatDateLong, formatDateShort } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  hadir: { label: 'Hadir', tone: 'success' }, alpha: { label: 'Alpha', tone: 'error' }, libur: { label: 'Libur', tone: 'neutral' },
  belum: { label: 'Belum ada jurnal', tone: 'neutral' }, sakit: { label: 'Sakit', tone: 'warning' }, cuti: { label: 'Cuti', tone: 'brand' },
  dinas_luar: { label: 'Dinas Luar', tone: 'brand' }, lainnya: { label: 'Izin lainnya', tone: 'neutral' },
};

export default function PantauAbsensiGtkDetail() {
  const { colors } = useTheme();
  const p = useLocalSearchParams<{ id: string; name?: string; dari: string; sampai: string }>();
  const res = useCached<GtkRekapDetail>(`pantau.gtk.detail.${p.id}.${p.dari}.${p.sampai}`, () => pantau.gtkRekapDetail(p.id, p.dari, p.sampai), { enabled: !!p.id });
  const s = res.data?.summary;
  const days = [...(res.data?.days ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Screen title={p.name ?? res.data?.gtk_name ?? 'Absensi GTK'} subtitle={`${formatDateShort(p.dari)} – ${formatDateShort(p.sampai)}`} back
      refreshing={res.refreshing} onRefresh={res.refresh} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        {res.loading ? <CardSkeleton lines={6} /> : res.error && !res.data ? (
          <ErrorState message="Rincian belum tersimpan di perangkat." onRetry={res.refresh} compact />
        ) : s ? (
          <>
            <Card style={{ gap: spacing.md }}>
              <PctRow title="Persentase hadir" subtitle={`${s.hadir} dari ${s.total_hari_wajib} hari wajib`} pct={s.persentase_hadir} ada={s.persentase_hadir != null} />
              <Counts items={[
                { label: 'Hadir', value: s.hadir, color: colors.success }, { label: 'Izin', value: s.total_izin, color: colors.brandPrimary },
                { label: 'Alpha', value: s.alpha, color: colors.error }, { label: 'Libur', value: s.libur },
              ]} />
            </Card>
            {days.length === 0 ? <Card><EmptyState icon="calendar-outline" title="Tidak ada hari" compact /></Card> : (
              <Card style={{ gap: spacing.sm }}>
                {days.map((d, i) => {
                  const st = STATUS[d.status] ?? { label: d.status, tone: 'neutral' as BadgeTone };
                  return (
                    <View key={d.date} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
                      <T style={{ flex: 1 }}>{formatDateLong(d.date)}</T>
                      <Badge label={st.label} tone={st.tone} small />
                    </View>
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

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm } });
