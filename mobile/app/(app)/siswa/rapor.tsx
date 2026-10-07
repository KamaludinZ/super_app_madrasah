/**
 * Rapor Saya (siswa) — native, pengganti /rapor. Nilai E-Rapor semester pada tahun pelajaran aktif
 * (GET /grades/rapor/{id}?semester): nilai pengetahuan, keterampilan, akhir, predikat & deskripsi per mapel,
 * rata-rata; ekstrakurikuler & predikatnya (GET /ekstrakurikuler/student/{id}). Pilih semester; offline.
 */
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { Rapor, RaporEkskul, RaporGrade } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { DAY_LABELS } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Sem = 'ganjil' | 'genap';
const fmt = (v?: number | null) => (v === null || v === undefined ? '–' : Number.isInteger(v) ? String(v) : v.toFixed(1));
const predTone = (p?: string | null): BadgeTone => {
  const x = (p || '').toUpperCase();
  return x.startsWith('A') || x.includes('SANGAT') ? 'success' : x.startsWith('B') || x === 'BAIK' ? 'brand' : x.startsWith('C') || x.includes('CUKUP') ? 'warning' : x ? 'error' : 'neutral';
};

export default function RaporScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const sid = user?.id ?? '';
  // Semester bawaan mengikuti kalender: Juli–Desember ganjil, Januari–Juni genap.
  const [sem, setSem] = useState<Sem>(new Date().getMonth() >= 6 ? 'ganjil' : 'genap');
  const rapor = useCached<Rapor>(`siswa.rapor.${sem}`, () => api.rapor.get(sid, sem), { enabled: !!sid });
  const ekskul = useCached<RaporEkskul[]>(`siswa.rapor.ekskul.${sem}`, () => api.rapor.ekskul(sid, sem), { enabled: !!sid });
  const r = rapor.data;
  const grades = [...(r?.grades ?? [])].sort((a, b) => (a.subject_name ?? '').localeCompare(b.subject_name ?? ''));

  return (
    <Screen title="Rapor Saya" subtitle={r?.academic_year?.name ? `Tahun Pelajaran ${r.academic_year.name}` : 'E-Rapor digital'} back scroll={false}
      offline={{ fromCache: rapor.fromCache, updatedAt: rapor.updatedAt }}>
      <ScrollView
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={rapor.refreshing || ekskul.refreshing} onRefresh={() => { void rapor.refresh(); void ekskul.refresh(); }} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      >
        <SegmentedControl<Sem> segments={[{ value: 'ganjil', label: 'Semester Ganjil' }, { value: 'genap', label: 'Semester Genap' }]} value={sem} onChange={setSem} />

        {rapor.loading ? <CardSkeleton lines={5} /> : rapor.error && !r ? (
          <ErrorState message={errorMessage(rapor.error, 'Rapor belum bisa dimuat.')} onRetry={rapor.refresh} />
        ) : r ? (
          <>
            <Card style={styles.head}>
              <View style={{ flex: 1, gap: 2 }}>
                <T weight="semibold">{r.student?.full_name ?? user?.full_name}</T>
                <T variant="caption" tone="muted">
                  {[r.class?.name ? `Kelas ${r.class.name}` : null, r.student?.nisn ? `NISN ${r.student.nisn}` : null].filter(Boolean).join(' · ')}
                </T>
              </View>
              <View style={[styles.avg, { backgroundColor: colors.brandTertiary }]}>
                <T variant="title" color={colors.onBrandTertiary}>{grades.length ? fmt(r.average) : '–'}</T>
                <T variant="small" color={colors.onBrandTertiary}>rata-rata</T>
              </View>
            </Card>

            <T variant="subtitle">Nilai mata pelajaran</T>
            {grades.length === 0 ? (
              <Card><EmptyState icon="document-text-outline" title="Nilai belum tersedia" message="Nilai semester ini belum diinput guru." compact /></Card>
            ) : grades.map((g) => <GradeCard key={g.id} g={g} />)}
          </>
        ) : null}

        <T variant="subtitle" style={{ marginTop: spacing.sm }}>Ekstrakurikuler</T>
        {ekskul.loading ? <CardSkeleton lines={2} /> : (ekskul.data ?? []).length === 0 ? (
          <Card><EmptyState icon="sparkles-outline" title="Belum ada ekstrakurikuler" message="Ekstrakurikuler yang Anda ikuti akan tampil di sini." compact /></Card>
        ) : (ekskul.data ?? []).map((e) => (
          <Card key={e.id} style={{ gap: 4 }}>
            <View style={styles.row}>
              <T weight="semibold" style={{ flex: 1 }}>{e.name ?? '-'}</T>
              <Badge label={e.predicate ? `Predikat ${e.predicate}` : 'Belum dinilai'} tone={predTone(e.predicate)} small />
            </View>
            {e.schedule_day ? <T variant="caption" tone="muted">{DAY_LABELS[e.schedule_day.toLowerCase()] ?? e.schedule_day}{e.schedule_start ? ` ${e.schedule_start}–${e.schedule_end ?? ''}` : ''}{e.location ? ` · ${e.location}` : ''}</T> : null}
            {e.description ? <T variant="caption" tone="secondary">{e.description}</T> : null}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

function GradeCard({ g }: { g: RaporGrade }) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <T weight="semibold">{g.subject_name ?? g.subject_code ?? 'Mapel'}</T>
          {g.teacher_name ? <T variant="caption" tone="muted">{g.teacher_name}</T> : null}
        </View>
        {g.predicate ? <Badge label={g.predicate} tone={predTone(g.predicate)} /> : null}
      </View>
      <View style={styles.nilai}>
        <Box label="Pengetahuan" value={fmt(g.nilai_pengetahuan)} />
        <Box label="Keterampilan" value={fmt(g.nilai_keterampilan)} />
        <Box label="Nilai akhir" value={fmt(g.nilai_akhir)} strong color={colors.brandPrimary} />
      </View>
      {g.description ? <T variant="caption" tone="secondary">{g.description}</T> : null}
    </Card>
  );
}

function Box({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.surfaceSecondary }]}>
      <T variant={strong ? 'title' : 'subtitle'} color={color}>{value}</T>
      <T variant="small" tone="muted">{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avg: { width: 84, height: 84, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nilai: { flexDirection: 'row', gap: spacing.sm },
  box: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
});
