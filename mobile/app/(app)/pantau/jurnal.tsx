/**
 * Data Jurnal (Kepala Madrasah) — native, pengganti /admin/jurnal. Tab "Per tanggal": jurnal mengajar pada
 * tanggal terpilih (GET /admin/jurnal, saring kelas) dengan ringkasan kehadiran; ketuk untuk detail jurnal.
 * Tab "Per guru": jumlah jurnal, JTM dan kehadiran per guru semester aktif (GET /admin/jurnal/stats-by-teacher).
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import type { ClassItem, Journal } from '@/api/types';
import { pantau, JurnalStatGuru } from '@/pantau/api';
import { cocok, Counts, PctRow, SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { formatDateLong, todayISO } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { DateField } from '@/components/ui/DateField';
import { SelectField } from '@/components/ui/SelectField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { JournalCard } from '@/components/JournalCard';

type Tab = 'tanggal' | 'guru';

export default function PantauJurnal() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('tanggal');
  const [tgl, setTgl] = useState(todayISO());
  const [kelas, setKelas] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const kelasRes = useCached<ClassItem[]>('kebersihan.classes.all', async () => {
    const ay = await api.kebersihan.activeYear().catch(() => null);
    return api.kebersihan.classes(ay?.id);
  }, { staleTime: 30 * 60_000 });
  const list = useCached<{ items: Journal[] }>(`pantau.jurnal.${tgl}.${kelas ?? 'semua'}`,
    () => api.jurnal.admin({ start_date: tgl, end_date: tgl, class_id: kelas ?? undefined, limit: 300 }), { enabled: tab === 'tanggal' });
  const guru = useCached<JurnalStatGuru[]>('pantau.jurnal.guru', pantau.jurnalStatGuru, { enabled: tab === 'guru' });
  const res = tab === 'tanggal' ? list : guru;

  const items = [...(list.data?.items ?? [])].filter((j) => cocok(`${j.teacher_name} ${j.subject_name} ${j.class_name}`, q))
    .sort((a, b) => (a.started_at ?? '').localeCompare(b.started_at ?? ''));
  const jml = (k: 'siswa_hadir' | 'siswa_sakit' | 'siswa_izin' | 'siswa_tidak_hadir') => items.reduce((n, j) => n + (j[k] || 0), 0);
  const guruList = [...(guru.data ?? [])].filter((g) => cocok(g.teacher_name, q));

  return (
    <Screen title="Data Jurnal" subtitle="Jurnal mengajar guru" back refreshing={res.refreshing} onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <SegmentedControl<Tab> segments={[{ value: 'tanggal', label: 'Per tanggal' }, { value: 'guru', label: 'Per guru' }]} value={tab} onChange={setTab} />
        {tab === 'tanggal' ? (
          <View style={styles.two}>
            <DateField label="Tanggal" value={tgl} max={todayISO()} onChange={(v) => v && setTgl(v)} style={{ flex: 1 }} />
            <View style={{ flex: 1 }}><SelectField label="Kelas" value={kelas} placeholder="Semua kelas" noneLabel="Semua kelas" icon="school-outline"
              options={[...(kelasRes.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true })).map((c) => ({ value: c.id, label: c.name }))}
              onChange={setKelas} /></View>
          </View>
        ) : (
          <T variant="caption" tone="muted">Akumulasi semester aktif. Keterisian = jumlah jurnal dibanding jam mengajar per minggu (indikator kasar).</T>
        )}
        <SearchBox value={q} onChange={setQ} placeholder={tab === 'tanggal' ? 'Cari guru, mapel, kelas…' : 'Cari guru…'} />

        {res.loading ? <CardSkeleton lines={5} /> : res.error && !res.data ? (
          <ErrorState message="Data jurnal belum tersimpan di perangkat." onRetry={res.refresh} compact />
        ) : tab === 'tanggal' ? (
          <>
            <Card style={{ gap: spacing.sm }}>
              <T weight="semibold">{formatDateLong(tgl)} · {items.length} jurnal</T>
              <Counts items={[
                { label: 'Hadir', value: jml('siswa_hadir'), color: colors.success }, { label: 'Sakit', value: jml('siswa_sakit'), color: colors.warning },
                { label: 'Izin', value: jml('siswa_izin'), color: colors.brandPrimary }, { label: 'Alpa', value: jml('siswa_tidak_hadir'), color: colors.error },
              ]} />
            </Card>
            {items.length === 0 ? (
              <Card><EmptyState icon="book-outline" title="Belum ada jurnal" message="Tidak ada jurnal mengajar pada tanggal ini." compact /></Card>
            ) : items.map((j) => <JournalCard key={j.id} j={j} onPress={() => router.push(`/jurnal/${j.id}` as never)} />)}
          </>
        ) : guruList.length === 0 ? (
          <Card><EmptyState icon="people-outline" title="Belum ada data" compact /></Card>
        ) : (
          <Card style={{ gap: spacing.md }}>
            {guruList.map((g, i) => (
              <View key={g.teacher_id} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.md } : undefined}>
                <PctRow title={g.teacher_name} pct={g.fill_rate_pct} ada={g.fill_rate_pct != null}
                  subtitle={`${g.total_jurnal} jurnal · ${g.total_jtm} JTM · ${g.weekly_slots} jam/minggu · A ${g.total_alpa}`} />
              </View>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ two: { flexDirection: 'row', gap: spacing.sm } });
