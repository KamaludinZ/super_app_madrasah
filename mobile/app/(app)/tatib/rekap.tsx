/**
 * Tata Tertib untuk pimpinan & pengelola (hanya lihat) — native, pengganti /tatib/rekap (Rekap Pengawas),
 * /admin/tatib/data dan /admin/tatib/penanganan untuk peran baca. Rentang tanggal; tab Rekap: ringkasan,
 * per kelas (ketuk untuk catatan kelas itu), aturan pelanggaran & kebaikan terbanyak (GET /tatib/rekap);
 * tab Catatan: daftar catatan poin terbaru dengan pencarian (GET /tatib/penanganan). Pencatatan tetap di web.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { errorMessage } from '@/api/client';
import { tatib, CatatanPoin, RekapTatib } from '@/tatib/api';
import { fmtPoin, RiwayatPoinList } from '@/tatib/ui';
import { Bars, cocok, SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { todayISO } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { DateField } from '@/components/ui/DateField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Tab = 'rekap' | 'catatan';
/** Awal tahun pelajaran (1 Juli) sebagai rentang bawaan. */
const awalTp = () => { const t = todayISO(); const y = Number(t.slice(0, 4)); return Number(t.slice(5, 7)) >= 7 ? `${y}-07-01` : `${y - 1}-07-01`; };

export default function RekapTatibScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('rekap');
  const [dari, setDari] = useState(awalTp());
  const [sampai, setSampai] = useState(todayISO());
  const [q, setQ] = useState('');
  const [kelas, setKelas] = useState<string | null>(null);
  const rekap = useCached<RekapTatib>(`tatib.rekap.${dari}.${sampai}`, () => tatib.rekap({ start_date: dari, end_date: sampai }), { enabled: tab === 'rekap' });
  const catatan = useCached<CatatanPoin[]>(`tatib.catatan.${dari}.${sampai}`, () => tatib.catatan({ start_date: dari, end_date: `${sampai}T23:59:59` }), { enabled: tab === 'catatan' });
  const res = tab === 'rekap' ? rekap : catatan;
  const r = rekap.data;
  const rows = (catatan.data ?? []).filter((c) => (!kelas || c.siswa_kelas === kelas) && cocok(`${c.siswa_nama} ${c.tatib_nama} ${c.siswa_kelas}`, q));
  const keSiswa = (c: CatatanPoin) => router.push({ pathname: '/tatib/poin', params: { id: c.siswa_id!, nama: c.siswa_nama ?? '' } });

  return (
    <Screen title="Tata Tertib" subtitle="Poin kebaikan & pelanggaran · hanya lihat" back refreshing={res.refreshing} onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <SegmentedControl<Tab> value={tab} onChange={setTab} segments={[{ value: 'rekap', label: 'Rekap' }, { value: 'catatan', label: 'Catatan' }]} />
        <View style={styles.two}>
          <DateField label="Dari" value={dari} max={sampai} onChange={(v) => v && setDari(v)} style={{ flex: 1 }} />
          <DateField label="Sampai" value={sampai} min={dari} max={todayISO()} onChange={(v) => v && setSampai(v)} style={{ flex: 1 }} />
        </View>
        {res.loading ? <CardSkeleton lines={6} /> : !res.data ? (
          <ErrorState message={errorMessage(res.error, 'Data tata tertib belum bisa dimuat.')} onRetry={res.refresh} compact />
        ) : tab === 'rekap' && r ? (
          <>
            <Card style={{ gap: spacing.sm }}>
              <View style={styles.row}>
                <Kotak label="Kebaikan" value={fmtPoin(r.ringkasan.total_plus)} sub={`${r.ringkasan.jumlah_kebaikan} catatan`} color={colors.success} />
                <Kotak label="Pelanggaran" value={String(r.ringkasan.total_minus)} sub={`${r.ringkasan.jumlah_pelanggaran} catatan`} color={colors.error} />
                <Kotak label="Perlu perhatian" value={String(r.ringkasan.siswa_perlu_perhatian)} sub="siswa" color={r.ringkasan.siswa_perlu_perhatian ? colors.error : undefined} />
              </View>
            </Card>
            <Card style={{ gap: spacing.sm }}>
              <T weight="semibold">Pelanggaran terbanyak</T>
              <Bars data={r.teratas_pelanggaran.map((x) => ({ label: x.nama, value: x.jumlah }))} />
            </Card>
            <Card style={{ gap: spacing.sm }}>
              <T weight="semibold">Kebaikan terbanyak</T>
              <Bars data={r.teratas_kebaikan.map((x) => ({ label: x.nama, value: x.jumlah }))} />
            </Card>
            <T variant="subtitle" style={{ marginTop: spacing.sm }}>Per kelas</T>
            <Card style={{ gap: spacing.md }}>
              {r.per_kelas.length === 0 ? <T variant="caption" tone="muted">Belum ada kelas.</T> : r.per_kelas.map((k, i) => (
                <Pressable key={k.kelas} accessibilityRole="button" disabled={!k.jumlah_kebaikan && !k.jumlah_pelanggaran}
                  onPress={() => { setKelas(k.kelas); setTab('catatan'); }}
                  style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.md }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <T weight="medium">Kelas {k.kelas}</T>
                    <T variant="caption" tone="muted">{k.jumlah_siswa} siswa · +{k.total_plus} / {k.total_minus}</T>
                  </View>
                  {k.siswa_perlu_perhatian ? <Badge label={`${k.siswa_perlu_perhatian} perhatian`} tone="error" small /> : null}
                  <T weight="bold" color={k.saldo < 0 ? colors.error : undefined}>{fmtPoin(k.saldo)}</T>
                  {k.jumlah_kebaikan || k.jumlah_pelanggaran ? <Icon name="chevron-forward" size={18} color={colors.muted} /> : <View style={{ width: 18 }} />}
                </Pressable>
              ))}
            </Card>
          </>
        ) : (
          <>
            {kelas ? (
              <Card style={styles.row}>
                <T style={{ flex: 1 }}>Kelas {kelas}</T>
                <T variant="label" tone="brand" onPress={() => setKelas(null)}>Semua kelas</T>
              </Card>
            ) : null}
            <SearchBox value={q} onChange={setQ} placeholder="Cari siswa, aturan, kelas…" />
            {rows.length === 0 && !catatan.data?.length ? (
              <Card><EmptyState icon="shield-checkmark-outline" title="Belum ada catatan" message="Belum ada poin tata tertib pada rentang ini." compact /></Card>
            ) : <RiwayatPoinList records={rows.slice(0, 200)} tampilSiswa onSiswa={keSiswa} />}
          </>
        )}
      </View>
    </Screen>
  );
}

function Kotak({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.surfaceSecondary }]}>
      <T variant="title" color={color}>{value}</T>
      <T variant="small" weight="semibold" center>{label}</T>
      <T variant="small" tone="muted">{sub}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  box: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: 10, gap: 2 },
});
