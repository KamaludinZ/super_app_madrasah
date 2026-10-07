/**
 * Detail penugasan guru pengganti: info slot & guru, jurnal berdampingan
 * (GET /guru-pengganti/assignments/{id}/journals → jurnal guru asli & jurnal guru pengganti),
 * dan pembatalan (DELETE /guru-pengganti/assignments/{id}) untuk penugasan aktif (sama dengan web; diberi
 * peringatan bila tanggal sudah lewat atau jurnal pengganti sudah terisi).
 */
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { GPJournalView, GPSideBySide } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { formatDateLong, formatDateTime, todayISO } from '@/utils/time';
import { roleLabel } from '@/utils/roles';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon, IconName } from '@/components/ui/Icon';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

export default function PenugasanDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const { online } = useNetwork();
  const res = useCached<GPSideBySide>(`gp.assignment.${id}`, () => api.gp.assignmentJournals(id));
  const [cancelling, setCancelling] = useState(false);
  const today = todayISO();

  const a = res.data?.assignment;
  const cancelled = a?.status === 'cancelled';
  const canCancel = !!a && !cancelled;

  const cancel = () => {
    if (!a) return;
    const warn = res.data?.substitute_journal
      ? '\n\nPerhatian: jurnal guru pengganti sudah terisi. Jurnal tetap tersimpan, tetapi penugasannya tercatat batal.'
      : a.date < today ? '\n\nPerhatian: tanggal penugasan sudah lewat.' : '';
    Alert.alert(
      'Batalkan penugasan?',
      `${a.substitute_teacher_name} tidak lagi menggantikan ${a.original_teacher_name} pada ${formatDateLong(a.date)}. Guru pengganti akan menerima notifikasi pembatalan.${warn}`,
      [
        { text: 'Tidak', style: 'cancel' },
        {
          text: 'Batalkan penugasan', style: 'destructive', onPress: async () => {
            setCancelling(true);
            try {
              await api.gp.cancel(a.id);
              void qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('gp.') });
              toast.success('Penugasan dibatalkan');
              router.back();
            } catch (e) {
              toast.error(errorMessage(e, 'Gagal membatalkan penugasan.'));
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen
      title="Detail Penugasan"
      back
      refreshing={res.refreshing}
      onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}
      footer={canCancel ? (
        <Button title="Batalkan penugasan" icon="close-circle-outline" variant="outline" loading={cancelling} disabled={!online} onPress={cancel} fullWidth
          style={{ borderColor: colors.error }} textColor={colors.error} />
      ) : undefined}
    >
      {res.loading ? <CardSkeleton lines={6} /> : !a ? (
        <ErrorState message={res.error ? errorMessage(res.error, 'Penugasan tidak bisa dimuat.') : 'Penugasan tidak ditemukan.'} onRetry={res.refresh} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Card style={{ gap: spacing.sm }}>
            <View style={styles.headRow}>
              <T variant="title" style={{ flex: 1 }}>{a.class_name} · {a.subject_name}</T>
              {cancelled ? <Badge label="Dibatalkan" tone="neutral" small /> : a.date === today ? <Badge label="Hari ini" tone="brand" small /> : null}
            </View>
            <Row icon="calendar-outline" text={formatDateLong(a.date)} />
            <Row icon="time-outline" text={`${a.start_time ?? '--:--'}–${a.end_time ?? '--:--'}${a.jam_ke ? ` · Jam ke ${a.jam_ke}` : ''}`} />
            {a.room_name && a.room_name !== '-' ? <Row icon="business-outline" text={`Ruang ${a.room_name}`} /> : null}
            {a.reason ? <Row icon="information-circle-outline" text={`Alasan: ${a.reason}`} /> : null}
            {a.assigned_by_name ? <Row icon="person-circle-outline" text={`Ditugaskan oleh ${a.assigned_by_name}${a.assigned_by_role ? ` (${roleLabel(a.assigned_by_role)})` : ''}`} /> : null}
          </Card>

          <View style={styles.people}>
            <Card style={{ flex: 1, gap: 2 }}>
              <T variant="small" tone="muted">Digantikan</T>
              <T weight="semibold">{a.original_teacher_name}</T>
            </Card>
            <Icon name="arrow-forward" size={18} color={colors.muted} />
            <Card style={{ flex: 1, gap: 2, borderColor: colors.brandPrimary, borderWidth: 1.5 }}>
              <T variant="small" color={colors.brandPrimary}>Guru pengganti</T>
              <T weight="semibold">{a.substitute_teacher_name}</T>
            </Card>
          </View>

          <T variant="subtitle" style={{ marginTop: spacing.sm }}>Jurnal berdampingan</T>
          <JournalBox title="Jurnal guru pengganti" who={a.substitute_teacher_name} j={res.data?.substitute_journal ?? null}
            emptyText={a.date > today ? 'Diisi guru pengganti pada hari penugasan.' : a.date === today ? 'Belum diisi hari ini.' : 'Tidak diisi (terlewat).'}
            emptyTone={a.date < today ? 'error' : 'muted'} showAttendance />
          <JournalBox title="Jurnal guru yang digantikan" who={a.original_teacher_name} j={res.data?.original_journal ?? null}
            emptyText="Opsional — guru yang digantikan boleh menitipkan materi/tugas tanpa scan QR." emptyTone="muted" />

          {cancelled ? <T variant="caption" tone="muted">Penugasan ini sudah dibatalkan dan disimpan sebagai riwayat.</T> : null}
        </View>
      )}
    </Screen>
  );
}

function JournalBox({ title, who, j, emptyText, emptyTone, showAttendance }: {
  title: string; who: string; j: GPJournalView | null; emptyText: string; emptyTone: 'muted' | 'error'; showAttendance?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <T weight="semibold">{title}</T>
          <T variant="caption" tone="muted">{j?.filled_by_name || who}</T>
        </View>
        <Badge label={j ? 'Terisi' : 'Belum'} icon={j ? 'checkmark-circle-outline' : 'time-outline'} tone={j ? 'success' : emptyTone === 'error' ? 'error' : 'neutral'} small />
      </View>
      {j ? (
        <>
          <T selectable>{j.materi}</T>
          {j.catatan ? <T variant="caption" tone="secondary" selectable>Catatan: {j.catatan}</T> : null}
          {showAttendance ? (
            <T variant="caption" tone="secondary">
              Hadir {j.siswa_hadir} · Sakit {j.siswa_sakit} · Izin {j.siswa_izin} · Alpa {j.siswa_tidak_hadir}
            </T>
          ) : null}
          <T variant="small" tone="muted">Diisi {formatDateTime(j.started_at)}</T>
        </>
      ) : (
        <T variant="caption" color={emptyTone === 'error' ? colors.error : colors.muted}>{emptyText}</T>
      )}
    </Card>
  );
}

function Row({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={16} color={colors.muted} />
      <T tone="secondary" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  people: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
