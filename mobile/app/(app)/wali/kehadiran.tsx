/**
 * Kehadiran Siswa kelas wali — native, pengganti /wali-kelas/kehadiran. Rekap bulanan per siswa
 * (GET /wali-kelas/attendance-report: hadir/sakit/izin/alpa) dengan total kelas; ketuk siswa untuk
 * catatan per pertemuan (GET /wali-kelas/attendance-details: tanggal, mapel, guru, status).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { request, errorMessage } from '@/api/client';
import { useAuth } from '@/store/auth';
import { bulanIni, cocok, Counts, MonthBar, PctRow, SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { formatDateShort, formatTime } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Baris = { student_id: string; student_name: string; nisn?: string | null; hadir: number; sakit: number; izin: number; alpa: number };
type Nama = string | { name?: string; full_name?: string } | null | undefined;
type Detail = { daily_records: { date?: string; status: string; subject?: Nama; teacher?: Nama }[] };
const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  hadir: { label: 'Hadir', tone: 'success' }, sakit: { label: 'Sakit', tone: 'warning' }, izin: { label: 'Izin', tone: 'brand' },
  alpa: { label: 'Alpa', tone: 'error' }, alpha: { label: 'Alpa', tone: 'error' },
};
const nama = (v: Nama) => (typeof v === 'string' ? v : v?.name ?? v?.full_name ?? null);

function Rincian({ id, month }: { id: string; month: string }) {
  const { colors } = useTheme();
  const res = useCached<Detail>(`wali.kehadiran.detail.${id}.${month}`, () => request('/wali-kelas/attendance-details', { query: { student_id: id, month } }));
  if (res.loading) return <CardSkeleton lines={2} />;
  const recs = [...(res.data?.daily_records ?? [])].reverse();
  if (!recs.length) return <T variant="caption" tone="muted">{res.error ? errorMessage(res.error, 'Rincian belum bisa dimuat.') : 'Belum ada catatan.'}</T>;
  return (
    <View style={{ gap: spacing.xs, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border }}>
      {recs.map((r, i) => {
        const st = STATUS[r.status] ?? { label: r.status, tone: 'neutral' as BadgeTone };
        return (
          <View key={i} style={styles.row}>
            <View style={{ flex: 1 }}>
              <T variant="caption" weight="medium">{nama(r.subject) ?? '-'}</T>
              <T variant="small" tone="muted">{[r.date ? `${formatDateShort(r.date)} ${formatTime(r.date)}` : null, nama(r.teacher)].filter(Boolean).join(' · ')}</T>
            </View>
            <Badge label={st.label} tone={st.tone} small />
          </View>
        );
      })}
    </View>
  );
}

export default function WaliKehadiran() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const kelas = user?.homeroom_class_id ?? '';
  const [month, setMonth] = useState(bulanIni());
  const [q, setQ] = useState('');
  const [buka, setBuka] = useState<string | null>(null);
  const res = useCached<Baris[]>(`wali.kehadiran.${kelas}.${month}`, () => request('/wali-kelas/attendance-report', { query: { class_id: kelas, month } }), { enabled: !!kelas });
  const all = res.data ?? [];
  const sum = all.reduce((t, s) => ({ h: t.h + s.hadir, s: t.s + s.sakit, i: t.i + s.izin, a: t.a + s.alpa }), { h: 0, s: 0, i: 0, a: 0 });
  const total = sum.h + sum.s + sum.i + sum.a;
  const rows = all.filter((s) => cocok(`${s.student_name} ${s.nisn ?? ''}`, q)).sort((a, b) => a.student_name.localeCompare(b.student_name));

  return (
    <Screen title="Kehadiran Siswa" subtitle="Kelas wali · per bulan" back refreshing={res.refreshing} onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <MonthBar month={month} onChange={(m) => { setMonth(m); setBuka(null); }} />
        {!kelas ? <Card><EmptyState icon="school-outline" title="Belum ada kelas wali" compact /></Card>
          : res.loading ? <CardSkeleton lines={6} /> : !res.data ? (
            <ErrorState message={errorMessage(res.error, 'Rekap kehadiran belum bisa dimuat.')} onRetry={res.refresh} compact />
          ) : (
            <>
              <Card style={{ gap: spacing.md }}>
                <PctRow title="Kehadiran kelas" subtitle={total ? `${sum.h} hadir dari ${total} catatan` : 'Belum ada catatan bulan ini'} pct={total ? (sum.h / total) * 100 : null} ada={!!total} />
                <Counts items={[
                  { label: 'Hadir', value: sum.h, color: colors.success }, { label: 'Sakit', value: sum.s, color: colors.warning },
                  { label: 'Izin', value: sum.i, color: colors.brandPrimary }, { label: 'Alpa', value: sum.a, color: colors.error },
                ]} />
              </Card>
              <SearchBox value={q} onChange={setQ} placeholder="Cari siswa…" />
              {rows.length === 0 ? <Card><EmptyState icon="people-outline" title="Tidak ada siswa" compact /></Card> : (
                <Card style={{ gap: spacing.md }}>
                  {rows.map((s, i) => {
                    const n = s.hadir + s.sakit + s.izin + s.alpa;
                    const terbuka = buka === s.student_id;
                    return (
                      <View key={s.student_id} style={[{ gap: spacing.sm }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.md }]}>
                        <Pressable onPress={() => setBuka(terbuka ? null : s.student_id)} accessibilityRole="button" accessibilityState={{ expanded: terbuka }}>
                          <PctRow title={s.student_name} pct={n ? (s.hadir / n) * 100 : null} ada={!!n}
                            subtitle={n ? `H ${s.hadir} · S ${s.sakit} · I ${s.izin} · A ${s.alpa}` : 'Belum ada catatan'} />
                        </Pressable>
                        {terbuka ? <Rincian id={s.student_id} month={month} /> : null}
                      </View>
                    );
                  })}
                </Card>
              )}
            </>
          )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm } });
