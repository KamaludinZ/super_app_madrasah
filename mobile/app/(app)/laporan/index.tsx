/**
 * Laporan Saya (guru & wali kelas) — native, pengganti /guru/laporan. Daftar laporan yang saya kirim
 * (GET /reports): jenis, prioritas, status penanganan, kelas/siswa/lokasi, dan tanggapan Admin/Guru BK;
 * hapus selama status masih "Baru". Buat laporan lewat form.
 */
import React, { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { GuruReport } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { formatDateTime } from '@/utils/time';
import { PRIORITAS, STATUS, JENIS, opt } from '@/laporan/options';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

type Filter = 'aktif' | 'selesai' | 'semua';

export default function LaporanSaya() {
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const res = useCached<GuruReport[]>('laporan.list', api.laporan.list);
  const [filter, setFilter] = useState<Filter>('aktif');
  const [open, setOpen] = useState<string | null>(null);

  const done = (r: GuruReport) => r.status === 'selesai' || r.status === 'ditolak';
  const list = [...(res.data ?? [])]
    .filter((r) => filter === 'semua' || (filter === 'selesai' ? done(r) : !done(r)))
    .sort((a, b) => (b.reported_at ?? '').localeCompare(a.reported_at ?? ''));

  const remove = (r: GuruReport) => Alert.alert('Hapus laporan?', r.title, [
    { text: 'Batal', style: 'cancel' },
    {
      text: 'Hapus', style: 'destructive', onPress: async () => {
        try {
          await api.laporan.remove(r.id);
          toast.success('Laporan dihapus');
          await qc.invalidateQueries({ queryKey: ['laporan.list'] });
        } catch (e) { toast.error(errorMessage(e, 'Gagal menghapus laporan.')); }
      },
    },
  ]);

  return (
    <Screen title="Laporan Saya" subtitle={`${res.data?.length ?? 0} laporan`} back scroll={false}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}
      footer={<Button title="Buat laporan" icon="create-outline" size="lg" fullWidth disabled={!online} onPress={() => router.push('/laporan/buat')} />}>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={<SegmentedControl<Filter> small style={{ marginBottom: spacing.md }} value={filter} onChange={setFilter}
          segments={[{ value: 'aktif', label: 'Diproses' }, { value: 'selesai', label: 'Selesai' }, { value: 'semua', label: 'Semua' }]} />}
        renderItem={({ item: r }) => {
          const st = opt(STATUS, r.status);
          const isOpen = open === r.id;
          return (
            <Card onPress={() => setOpen(isOpen ? null : r.id)} style={{ gap: spacing.sm }}>
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T weight="semibold" numberOfLines={isOpen ? undefined : 2}>{r.title}</T>
                  <T variant="caption" tone="muted">{formatDateTime(r.reported_at ?? '')}</T>
                </View>
                <Badge label={st.label} tone={st.tone} small />
              </View>
              <View style={styles.badges}>
                <Badge label={opt(JENIS, r.type).label} tone="neutral" small />
                <Badge label={`Prioritas ${opt(PRIORITAS, r.priority).label}`} tone={opt(PRIORITAS, r.priority).tone} small />
              </View>
              {[r.class_name ? `Kelas ${r.class_name}` : null, r.student_name, r.location].filter(Boolean).length ? (
                <T variant="caption" tone="secondary">{[r.class_name ? `Kelas ${r.class_name}` : null, r.student_name, r.location].filter(Boolean).join(' · ')}</T>
              ) : null}
              {isOpen ? (
                <>
                  <T selectable>{r.description}</T>
                  {r.response ? (
                    <View style={[styles.response, { backgroundColor: colors.surfaceSecondary }]}>
                      <T variant="label" tone="muted">TANGGAPAN</T>
                      <T selectable>{r.response}</T>
                    </View>
                  ) : <T variant="caption" tone="muted">Belum ada tanggapan.</T>}
                  {r.status === 'baru' ? <Button title="Hapus laporan" icon="trash-outline" variant="ghost" size="sm" disabled={!online} onPress={() => remove(r)} /> : null}
                </>
              ) : r.response ? (
                <View style={styles.row}><Icon name="chatbubble-ellipses-outline" size={14} color={colors.success} /><T variant="caption" color={colors.success}>Ada tanggapan</T></View>
              ) : null}
            </Card>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={res.loading ? <CardSkeleton lines={3} /> : res.error && !res.data
          ? <ErrorState message={errorMessage(res.error, 'Laporan belum bisa dimuat.')} onRetry={res.refresh} />
          : <Card><EmptyState icon="document-text-outline" title="Belum ada laporan" message="Laporkan kerusakan sarana, siswa bermasalah, atau catatan umum lewat “Buat laporan”." compact /></Card>}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  response: { borderRadius: radius.md, padding: spacing.sm, gap: 2 },
});
