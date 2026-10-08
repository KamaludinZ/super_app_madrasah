/**
 * Detail pengisian CLKB siswa: skor (total, positif, negatif), seluruh pernyataan dengan tanda dipilih,
 * keterangan tambahan, serta tanggapan & rekomendasi Guru BK. Data dari riwayat yang tersimpan offline.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '@/api/endpoints';
import type { CLKBForm, CLKBSubmission } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { KV, TanggapanCard, formatSubmitted } from '@/bk/ui';

export default function CLKBDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const form = useCached<CLKBForm>('siswa.clkb.form', api.bk.clkbForm);
  const hist = useCached<CLKBSubmission[]>('siswa.clkb.history', api.bk.clkbHistory);
  const h = (hist.data ?? []).find((x) => x.id === id);

  if (!h) {
    return (
      <Screen title="Detail CLKB" back refreshing={hist.refreshing} onRefresh={hist.refresh}>
        {hist.loading ? <CardSkeleton lines={6} /> : <ErrorState message="Pengisian tidak ditemukan." onRetry={hist.refresh} />}
      </Screen>
    );
  }
  const sel = new Set(h.selected ?? []);
  const sc = h.scoring;

  return (
    <Screen title="Detail CLKB" subtitle={formatSubmitted(h.submitted_at)} back refreshing={hist.refreshing} onRefresh={hist.refresh}
      offline={{ fromCache: hist.fromCache, updatedAt: hist.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <View style={styles.stats}>
          <Stat label="Dipilih" value={sc?.total_selected ?? sel.size} color={colors.onSurface} />
          <Stat label="Positif" value={sc?.plus_count ?? 0} color={colors.success} icon="thumbs-up-outline" />
          <Stat label="Negatif" value={sc?.minus_count ?? 0} color={colors.error} icon="thumbs-down-outline" />
        </View>

        <TanggapanCard s={h} />

        <Card style={{ gap: spacing.md }}>
          <T variant="label" tone="muted">KETERANGAN TAMBAHAN</T>
          <KV label="Rata-rata belajar" value={[h.waktu_belajar_jam, h.waktu_belajar_dari || h.waktu_belajar_sampai ? `(${h.waktu_belajar_dari || '-'}–${h.waktu_belajar_sampai || '-'})` : null].filter(Boolean).join(' ') || null} />
          <KV label="Perlu info cara belajar" value={h.perlu_info_cara_belajar === true ? 'Ya' : h.perlu_info_cara_belajar === false ? 'Tidak' : null} />
          {h.perlu_info_cara_belajar ? <KV label="Topik diminati" value={[...(h.topik_diminati ?? []), h.topik_lainnya].filter(Boolean).join(', ') || null} /> : null}
          <KV label="Kebiasaan ingin diperbaiki" value={(h.kebiasaan_diperbaiki ?? []).join('; ') || null} />
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <T variant="label" tone="muted">JAWABAN PERNYATAAN</T>
          {(form.data?.items ?? []).map((it) => {
            const on = sel.has(it.no);
            return (
              <View key={it.no} style={styles.item}>
                <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={on ? colors.success : colors.border} />
                <T variant="caption" tone={on ? undefined : 'muted'} style={{ flex: 1 }}>{it.no}. {it.pernyataan}</T>
              </View>
            );
          })}
          {!form.data ? <T variant="caption" tone="muted">Daftar pernyataan belum tersimpan; sambungkan ke internet untuk melihatnya.</T> : null}
        </Card>
      </View>
    </Screen>
  );
}

function Stat({ label, value, color, icon }: { label: string; value: number; color: string; icon?: React.ComponentProps<typeof Icon>['name'] }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.statVal}>
        {icon ? <Icon name={icon} size={16} color={color} /> : null}
        <T variant="title" color={color}>{value}</T>
      </View>
      <T variant="small" tone="muted">{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  statVal: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});
