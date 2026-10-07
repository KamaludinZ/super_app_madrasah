/**
 * Detail jurnal: GET /jurnal/{id} (kelas, mapel, ruang, pengajar, materi, catatan, presensi per siswa).
 * Saat offline memakai ringkasan dari cache riwayat (tanpa daftar per siswa).
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import type { AttendanceDetail, Journal } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { formatDateLong, formatTime } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Icon, IconName } from '@/components/ui/Icon';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';

const STATUS: { key: string; label: string; tone: 'success' | 'warning' | 'brand' | 'error' }[] = [
  { key: 'sakit', label: 'Sakit', tone: 'warning' },
  { key: 'izin', label: 'Izin', tone: 'brand' },
  { key: 'alpa', label: 'Alpa', tone: 'error' },
];

const normStatus = (s: string) => (s === 'alpha' ? 'alpa' : s);

/** Cari ringkasan jurnal di cache riwayat mana pun (fallback offline). */
function useCachedSummary(id: string): Journal | undefined {
  const qc = useQueryClient();
  return useMemo(() => {
    for (const [, v] of qc.getQueriesData<{ data: Journal[] }>({ predicate: (q) => String(q.queryKey[0]).startsWith('jurnal.') })) {
      const hit = Array.isArray(v?.data) ? v!.data.find((j) => j.id === id) : undefined;
      if (hit) return hit;
    }
    return undefined;
  }, [qc, id]);
}

export default function JurnalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const summary = useCachedSummary(id);
  const res = useCached<Journal>(`jurnal.detail.${id}`, () => api.jurnal.detail(id));
  const j = res.data ?? summary;

  const groups = useMemo(() => {
    const out: Record<string, AttendanceDetail[]> = { hadir: [], sakit: [], izin: [], alpa: [] };
    (res.data?.attendance_details ?? []).forEach((a) => { (out[normStatus(a.status)] ??= []).push(a); });
    return out;
  }, [res.data]);

  if (!j) {
    return (
      <Screen title="Detail Jurnal" back>
        {res.loading ? <CardSkeleton lines={6} /> : <ErrorState message="Jurnal tidak bisa dimuat. Periksa koneksi lalu coba lagi." onRetry={res.refresh} />}
      </Screen>
    );
  }

  const total = j.siswa_hadir + j.siswa_sakit + j.siswa_izin + j.siswa_tidak_hadir;
  const substitute = j.fill_mode === 'substitute';

  return (
    <Screen title="Detail Jurnal" back refreshing={res.refreshing} onRefresh={res.refresh} offline={{ fromCache: res.fromCache || !res.data, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.sm }}>
          <T variant="title">{j.class_name || 'Kelas'} · {j.subject_name || '-'}</T>
          <View style={styles.badges}>
            {substitute ? <Badge label="Guru pengganti" icon="swap-horizontal" tone="warning" small /> : null}
            {j.fill_mode === 'piket' ? <Badge label="Diisi guru piket" icon="hand-left-outline" tone="neutral" small /> : null}
            {j.pair_position ? <Badge label="Jurnal berdampingan" icon="git-compare-outline" tone="warning" small /> : null}
            {j.offline_submission?.was_offline ? <Badge label="Diisi offline" icon="cloud-offline-outline" tone="neutral" small /> : null}
            {j.offline_submission?.needs_verification ? <Badge label="Perlu verifikasi" icon="alert-circle-outline" tone="error" small /> : null}
          </View>
          <Row icon="calendar-outline" text={`${formatDateLong(j.started_at)} · ${formatTime(j.started_at)} WIB`} />
          {j.jam_ke && j.jam_ke !== '-' ? <Row icon="time-outline" text={`Jam ke ${j.jam_ke}`} /> : null}
          {j.room_name ? <Row icon="business-outline" text={j.room_name} /> : null}
          {j.teacher_name ? <Row icon="person-outline" text={`Guru: ${j.teacher_name}`} /> : null}
          {j.diisi_oleh || j.filled_by_name ? <Row icon="create-outline" text={`Diisi oleh: ${j.diisi_oleh || j.filled_by_name}`} /> : null}
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <T variant="label" tone="muted">MATERI</T>
          <T selectable>{j.materi || '-'}</T>
          {j.catatan ? (
            <>
              <T variant="label" tone="muted" style={{ marginTop: spacing.sm }}>CATATAN</T>
              <T selectable tone="secondary">{j.catatan}</T>
            </>
          ) : null}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <T variant="label" tone="muted">KEHADIRAN SISWA{total ? ` · ${total} SISWA` : ''}</T>
          <View style={styles.stats}>
            <Stat label="Hadir" value={j.siswa_hadir} color={colors.success} />
            <Stat label="Sakit" value={j.siswa_sakit} color={colors.warning} />
            <Stat label="Izin" value={j.siswa_izin} color={colors.brandPrimary} />
            <Stat label="Alpa" value={j.siswa_tidak_hadir} color={colors.error} />
          </View>
          {res.data ? (
            STATUS.some((s) => groups[s.key]?.length) ? (
              STATUS.filter((s) => groups[s.key]?.length).map((s) => (
                <View key={s.key} style={{ gap: 4 }}>
                  <Badge label={`${s.label} (${groups[s.key].length})`} tone={s.tone} small style={{ alignSelf: 'flex-start' }} />
                  {groups[s.key].map((a) => <T key={a.student_id} tone="secondary">• {a.student_name || a.student_id}</T>)}
                </View>
              ))
            ) : total ? <T tone="success" weight="semibold">Semua siswa hadir</T> : null
          ) : (
            <T variant="caption" tone="muted">Daftar nama siswa tampil saat online.</T>
          )}
        </Card>
      </View>
    </Screen>
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

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceSecondary }]}>
      <T variant="title" color={color}>{value ?? 0}</T>
      <T variant="caption" tone="muted">{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: 12 },
});
