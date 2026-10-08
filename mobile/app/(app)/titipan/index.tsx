/**
 * Titipkan Tugas (guru pengampu) — native, pengganti /piket/tugas untuk guru. Daftar titipan saya
 * (GET /teacher-tasks, server menyaring milik sendiri): jadwal, tanggal, materi, jenis izin, status
 * (menunggu → diterima guru piket → selesai/jurnal terisi). Ubah/hapus selama belum selesai; titip baru lewat form.
 */
import React, { useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { TeacherTask } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { formatDateLong } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

export const IZIN: Record<string, string> = { sakit: 'Izin Sakit', cuti: 'Izin Cuti', dinas_luar: 'Dinas Luar', lainnya: 'Izin Lainnya' };
const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Menunggu piket', tone: 'warning' }, accepted: { label: 'Diterima piket', tone: 'brand' },
  completed: { label: 'Selesai', tone: 'success' }, cancelled: { label: 'Dibatalkan', tone: 'neutral' },
};
type Filter = 'aktif' | 'selesai';

export default function TitipanSaya() {
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const res = useCached<TeacherTask[]>('titipan.list', () => api.piket.tasks());
  const [filter, setFilter] = useState<Filter>('aktif');

  const list = (res.data ?? []).filter((t) => (filter === 'selesai') === (t.status === 'completed' || t.status === 'cancelled'))
    .sort((a, b) => (filter === 'aktif' ? 1 : -1) * a.date.localeCompare(b.date));

  const remove = (t: TeacherTask) => Alert.alert('Hapus titipan?', `${t.class_name ?? ''} · ${formatDateLong(t.date)}`, [
    { text: 'Batal', style: 'cancel' },
    {
      text: 'Hapus', style: 'destructive', onPress: async () => {
        try {
          await api.piket.deleteTask(t.id);
          toast.success('Titipan dihapus');
          await qc.invalidateQueries({ queryKey: ['titipan.list'] });
        } catch (e) { toast.error(errorMessage(e, 'Gagal menghapus titipan.')); }
      },
    },
  ]);

  return (
    <Screen title="Titipkan Tugas" subtitle="Saat berhalangan, guru piket mengisi jurnal kelas Anda" back scroll={false}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}
      footer={<Button title="Titip tugas" icon="add-circle-outline" size="lg" fullWidth disabled={!online} onPress={() => router.push('/titipan/form')} />}>
      <FlatList
        data={list}
        keyExtractor={(t) => t.id}
        ListHeaderComponent={<SegmentedControl<Filter> small style={{ marginBottom: spacing.md }} value={filter} onChange={setFilter}
          segments={[{ value: 'aktif', label: 'Belum selesai' }, { value: 'selesai', label: 'Selesai' }]} />}
        renderItem={({ item: t }) => {
          const st = STATUS[t.status] ?? { label: t.status, tone: 'neutral' as BadgeTone };
          const editable = t.status !== 'completed' && t.status !== 'cancelled';
          return (
            <Card style={{ gap: spacing.sm }}>
              <View style={styles.row}>
                <View style={{ flex: 1, gap: 2 }}>
                  <T weight="semibold">{[t.class_name, t.subject_name].filter(Boolean).join(' · ') || 'Jadwal'}</T>
                  <T variant="caption" tone="muted">{formatDateLong(t.date)}{t.start_time ? ` · ${t.start_time}–${t.end_time ?? ''}` : ''}</T>
                </View>
                <Badge label={st.label} tone={st.tone} small />
              </View>
              <T selectable>{t.task_content}</T>
              {t.notes ? <T variant="caption" tone="secondary">Catatan: {t.notes}</T> : null}
              <View style={styles.row}>
                {t.leave_type ? <Badge label={IZIN[t.leave_type] ?? t.leave_type} tone="neutral" small /> : null}
                {t.accepted_by_name ? <T variant="caption" tone="muted" style={{ flex: 1 }}>oleh {t.accepted_by_name}</T> : <View style={{ flex: 1 }} />}
                {editable ? (
                  <>
                    <Button title="Ubah" icon="create-outline" variant="ghost" size="sm" disabled={!online}
                      onPress={() => router.push({ pathname: '/titipan/form', params: { id: t.id } })} />
                    <Button title="Hapus" icon="trash-outline" variant="ghost" size="sm" disabled={!online} onPress={() => remove(t)} />
                  </>
                ) : null}
              </View>
            </Card>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={res.loading ? <CardSkeleton lines={3} /> : res.error && !res.data
          ? <ErrorState message={errorMessage(res.error, 'Titipan belum bisa dimuat.')} onRetry={res.refresh} />
          : <Card><EmptyState icon="clipboard-outline" title={filter === 'aktif' ? 'Tidak ada titipan berjalan' : 'Belum ada titipan selesai'}
              message="Titipkan materi/tugas kelas saat Anda berhalangan; guru piket akan mengisi jurnalnya." compact /></Card>}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
