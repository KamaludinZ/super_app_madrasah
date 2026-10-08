/**
 * Detail pengisian PCL siswa: ringkasan per kategori (jumlah & persentase, bisa dibuka untuk melihat item
 * yang dipilih), jawaban uraian, serta tanggapan & rekomendasi Guru BK. Data dari riwayat offline.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '@/api/endpoints';
import type { PCLForm, PCLSubmission } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { KV, TanggapanCard, formatSubmitted } from '@/bk/ui';

export default function PCLDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const form = useCached<PCLForm>('siswa.pcl.form', api.bk.pclForm);
  const hist = useCached<PCLSubmission[]>('siswa.pcl.history', api.bk.pclHistory);
  const h = (hist.data ?? []).find((x) => x.id === id);
  const [open, setOpen] = useState<string | null>(null);

  if (!h) {
    return (
      <Screen title="Detail PCL" back refreshing={hist.refreshing} onRefresh={hist.refresh}>
        {hist.loading ? <CardSkeleton lines={6} /> : <ErrorState message="Pengisian tidak ditemukan." onRetry={hist.refresh} />}
      </Screen>
    );
  }
  const cats = form.data?.categories ?? [];

  return (
    <Screen title="Detail PCL" subtitle={formatSubmitted(h.submitted_at)} back refreshing={hist.refreshing} onRefresh={hist.refresh}
      offline={{ fromCache: hist.fromCache, updatedAt: hist.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <Card style={styles.row}>
          <T variant="title" color={colors.brandPrimary}>{h.scoring?.total_dipilih ?? 0}</T>
          <T tone="secondary" style={{ flex: 1 }}>masalah dipilih ({h.scoring?.persentase_keseluruhan ?? 0}% dari seluruh item)</T>
        </Card>

        <TanggapanCard s={h} />

        <Card padded={false}>
          <T variant="label" tone="muted" style={{ padding: spacing.md, paddingBottom: 0 }}>PER KATEGORI</T>
          {(h.scoring?.by_category ?? []).map((c) => {
            const items = cats.find((x) => x.kode === c.kode)?.items ?? [];
            const picked = h.selected?.[c.kode] ?? [];
            const isOpen = open === c.kode;
            return (
              <View key={c.kode}>
                <Pressable onPress={() => setOpen(isOpen ? null : c.kode)} disabled={!picked.length} style={styles.cat} accessibilityRole="button">
                  <T weight={picked.length ? 'semibold' : 'regular'} tone={picked.length ? undefined : 'muted'} style={{ flex: 1 }}>{c.nama}</T>
                  <Badge label={`${c.jumlah_dipilih}/${c.total_item} · ${c.persentase}%`} tone={c.jumlah_dipilih ? 'warning' : 'neutral'} small />
                  {picked.length ? <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} /> : null}
                </Pressable>
                {isOpen ? (
                  <View style={styles.items}>
                    {picked.map((i) => (
                      <View key={i} style={styles.row}>
                        <Icon name="checkmark-circle" size={16} color={colors.warning} />
                        <T variant="caption" style={{ flex: 1 }}>{items[i] ?? `Item ${i + 1}`}</T>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <T variant="label" tone="muted">JAWABAN URAIAN</T>
          <KV label="Masalah lain" value={h.masalah_lain} />
          <KV label="Masalah saat ini" value={h.masalah_saat_ini} />
          <KV label="Tempat bercerita" value={h.tempat_curhat} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cat: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 48 },
  items: { gap: 6, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
});
