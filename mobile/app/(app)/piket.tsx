/**
 * Tugas Piket (guru piket / admin):
 *  - Tugas titipan hari ini (GET /teacher-tasks?date=) → Terima (PUT /teacher-tasks/{id}/accept) → Isi jurnal.
 *  - Jadwal mengajar hari ini semua guru (GET /piket/schedules/today) dengan status jurnal;
 *    slot tanpa jurnal bisa diisi atas nama guru pengajar (Isi Jurnal mode piket → POST /piket/fill-journal).
 */
import React, { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { PiketSchedule, TeacherTask } from '@/api/types';
import { CacheKeys } from '@/db/cache';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { formatDateLong, slotStatus, todayISO } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

const LEAVE_LABELS: Record<string, string> = { sakit: 'Izin sakit', cuti: 'Izin cuti', dinas_luar: 'Dinas luar', lainnya: 'Izin lainnya' };
const TASK_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Menunggu diterima', tone: 'warning' },
  accepted: { label: 'Diterima', tone: 'brand' },
  completed: { label: 'Jurnal terisi', tone: 'success' },
  cancelled: { label: 'Dibatalkan', tone: 'neutral' },
};

type Filter = 'belum' | 'sudah' | 'semua';

export default function PiketScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const today = todayISO();
  const sched = useCached<PiketSchedule[]>(CacheKeys.piketToday, api.piket.today);
  const tasks = useCached<TeacherTask[]>(`piket.tasks.${today}`, () => api.piket.tasks({ date: today }));
  const [filter, setFilter] = useState<Filter>('belum');
  const [query, setQuery] = useState('');
  const [accepting, setAccepting] = useState<string | null>(null);

  const all = useMemo(() => [...(sched.data ?? [])].sort((a, b) => (a.start_time || '').localeCompare(b.start_time || '')), [sched.data]);
  const withJournal = all.filter((s) => s.has_journal).length;
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((s) => (filter === 'semua' ? true : filter === 'sudah' ? s.has_journal : !s.has_journal))
      .filter((s) => !q || [s.teacher_name, s.class_name, s.subject_name, s.room_name].some((v) => (v || '').toLowerCase().includes(q)));
  }, [all, filter, query]);
  const openTasks = (tasks.data ?? []).filter((t) => t.status !== 'cancelled');

  const fill = (s: Pick<PiketSchedule, 'id'>, taskId?: string | null) =>
    router.push(`/jurnal/isi?mode=piket&schedule_id=${encodeURIComponent(s.id)}${taskId ? `&task_id=${encodeURIComponent(taskId)}` : ''}` as any);

  const accept = (t: TeacherTask) => {
    Alert.alert('Terima tugas titipan?', `Dari ${t.teacher_name ?? 'guru pengajar'} untuk ${t.class_name ?? 'kelas'} ${t.start_time ?? ''}.`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Terima', onPress: async () => {
          setAccepting(t.id);
          try {
            await api.piket.acceptTask(t.id);
            toast.success('Tugas titipan diterima');
            void qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('piket.') });
          } catch (e) {
            toast.error(errorMessage(e, 'Gagal menerima tugas.'));
          } finally {
            setAccepting(null);
          }
        },
      },
    ]);
  };

  const refreshing = sched.refreshing || tasks.refreshing;
  const onRefresh = () => { void sched.refresh(); void tasks.refresh(); };

  return (
    <Screen title="Tugas Piket" subtitle={formatDateLong(today)} back scroll={false} offline={{ fromCache: sched.fromCache, updatedAt: sched.updatedAt }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.stats}>
          <Stat label="Jadwal hari ini" value={all.length} color={colors.onSurface} />
          <Stat label="Sudah berjurnal" value={withJournal} color={colors.success} />
          <Stat label="Belum" value={all.length - withJournal} color={all.length - withJournal ? colors.error : colors.muted} />
        </View>

        {!online ? (
          <Card tone="warning" style={styles.row}>
            <Icon name="cloud-offline-outline" size={18} color={colors.onWarning} />
            <T variant="caption" color={colors.onWarning} style={{ flex: 1 }}>Offline — data terakhir ditampilkan. Mengisi jurnal piket memerlukan internet.</T>
          </Card>
        ) : null}

        <T variant="subtitle">Tugas titipan hari ini</T>
        {tasks.loading ? <CardSkeleton lines={2} /> : openTasks.length === 0 ? (
          <Card><EmptyState icon="briefcase-outline" title="Tidak ada tugas titipan" message="Titipan dari guru yang berhalangan akan muncul di sini." compact /></Card>
        ) : openTasks.map((t) => {
          const st = TASK_STATUS[t.status] ?? TASK_STATUS.pending;
          return (
            <Card key={t.id} style={{ gap: spacing.sm }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <T weight="semibold">{t.class_name ?? 'Kelas'} · {t.subject_name ?? '-'}</T>
                  <T variant="caption" tone="muted">{t.start_time ?? '--:--'}–{t.end_time ?? '--:--'} · {t.teacher_name ?? 'Guru pengajar'}</T>
                </View>
                <Badge label={st.label} tone={st.tone} small />
              </View>
              {t.leave_type ? <Badge label={LEAVE_LABELS[t.leave_type] ?? t.leave_type} icon="medkit-outline" tone="neutral" small style={{ alignSelf: 'flex-start' }} /> : null}
              <T tone="secondary">{t.task_content}</T>
              {t.notes ? <T variant="caption" tone="muted">Catatan: {t.notes}</T> : null}
              {t.status === 'accepted' && t.accepted_by_name ? <T variant="small" tone="muted">Diterima oleh {t.accepted_by_name}</T> : null}
              {t.status === 'pending' ? (
                <Button title="Terima tugas" icon="checkmark" size="sm" loading={accepting === t.id} disabled={!online} onPress={() => accept(t)} />
              ) : t.status === 'accepted' ? (
                <Button title="Isi jurnal titipan" icon="create-outline" size="sm" disabled={!online} onPress={() => fill({ id: t.schedule_id }, t.id)} />
              ) : null}
            </Card>
          );
        })}

        <T variant="subtitle" style={{ marginTop: spacing.sm }}>Jadwal mengajar hari ini</T>
        <SegmentedControl<Filter>
          small
          segments={[{ value: 'belum', label: `Belum (${all.length - withJournal})` }, { value: 'sudah', label: `Sudah (${withJournal})` }, { value: 'semua', label: 'Semua' }]}
          value={filter}
          onChange={setFilter}
        />
        <Input icon="search" placeholder="Cari guru, kelas, mapel, ruang…" value={query} onChangeText={setQuery} />

        {sched.loading ? <CardSkeleton lines={3} /> : sched.error && !sched.data ? (
          <ErrorState message={errorMessage(sched.error, 'Jadwal piket belum bisa dimuat.')} onRetry={sched.refresh} compact />
        ) : list.length === 0 ? (
          <Card><EmptyState icon="checkmark-done-circle-outline" title={filter === 'belum' && !query ? 'Semua jadwal sudah berjurnal' : 'Tidak ada jadwal'} compact /></Card>
        ) : list.map((s) => <PiketSlot key={s.id} s={s} online={online} onFill={() => fill(s, s.task?.status === 'accepted' ? s.task.id : null)} />)}
      </ScrollView>
    </Screen>
  );
}

function PiketSlot({ s, online, onFill }: { s: PiketSchedule; online: boolean; onFill: () => void }) {
  const { colors } = useTheme();
  const st = slotStatus(s.start_time, s.end_time);
  const statusBadge = s.has_journal
    ? { label: s.journal_info?.fill_mode === 'piket' ? 'Diisi piket' : s.journal_info?.fill_mode === 'substitute' ? 'Diisi pengganti' : 'Jurnal terisi', tone: 'success' as BadgeTone }
    : st === 'upcoming' ? { label: 'Belum mulai', tone: 'neutral' as BadgeTone }
      : st === 'ongoing' ? { label: 'Berlangsung', tone: 'brand' as BadgeTone } : { label: 'Belum ada jurnal', tone: 'error' as BadgeTone };
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={styles.row}>
        <View style={[styles.time, { backgroundColor: colors.surfaceSecondary }]}>
          <T weight="bold">{s.start_time}</T>
          <T variant="small" tone="muted">{s.end_time}</T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T weight="semibold" numberOfLines={1}>{s.class_name ?? 'Kelas'} · {s.subject_name ?? '-'}</T>
          <T variant="caption" tone="secondary" numberOfLines={1}>{s.teacher_name ?? '-'}</T>
          {s.room_name ? <T variant="small" tone="muted">Ruang {s.room_name}</T> : null}
        </View>
      </View>
      <View style={styles.badges}>
        <Badge label={statusBadge.label} tone={statusBadge.tone} small />
        {s.task ? <Badge label={`Titipan · ${TASK_STATUS[s.task.status]?.label ?? s.task.status}`} icon="briefcase-outline" tone="warning" small /> : null}
      </View>
      {!s.has_journal ? (
        <Button title="Isi jurnal atas nama guru" icon="create-outline" size="sm" variant={st === 'upcoming' ? 'outline' : 'primary'} disabled={!online} onPress={onFill} />
      ) : null}
    </Card>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card style={styles.stat}>
      <T variant="title" color={color}>{value}</T>
      <T variant="caption" tone="muted" numberOfLines={1}>{label}</T>
    </Card>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, paddingVertical: spacing.md, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  time: { width: 64, paddingVertical: spacing.sm, borderRadius: 12, alignItems: 'center' },
});
