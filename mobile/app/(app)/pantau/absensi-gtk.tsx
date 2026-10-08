/**
 * Laporan Absensi GTK (Kepala Madrasah) — native, pengganti /admin/gtk/laporan-absensi.
 * Tab Rekap: persentase hadir & hitungan per GTK pada rentang tanggal (GET /gtk/absensi/rekap), ketuk untuk
 * rincian harian. Tab Perizinan: izin GTK yang beririsan dengan rentang (GET /gtk/izin).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { request } from '@/api/client';
import { pantau, GtkRekap } from '@/pantau/api';
import { cocok, PctRow, SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { formatDateShort, todayISO } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { DateField } from '@/components/ui/DateField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Tab = 'rekap' | 'izin';
type Izin = { id: string; gtk_name?: string; jenis: string; tanggal_mulai: string; tanggal_selesai: string; keterangan?: string | null };
const IZIN: Record<string, { label: string; tone: BadgeTone }> = {
  sakit: { label: 'Sakit', tone: 'warning' }, cuti: { label: 'Cuti', tone: 'brand' }, dinas_luar: { label: 'Dinas Luar', tone: 'brand' }, lainnya: { label: 'Lainnya', tone: 'neutral' },
};

export default function PantauAbsensiGtk() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('rekap');
  const [dari, setDari] = useState(`${todayISO().slice(0, 7)}-01`);
  const [sampai, setSampai] = useState(todayISO());
  const [q, setQ] = useState('');
  const rekap = useCached<GtkRekap[]>(`pantau.gtk.rekap.${dari}.${sampai}`, () => pantau.gtkRekap(dari, sampai), { enabled: tab === 'rekap' });
  const izin = useCached<Izin[]>(`pantau.gtk.izin.${dari}.${sampai}`, () => request<Izin[]>('/gtk/izin', { query: { date_from: dari, date_to: sampai } }), { enabled: tab === 'izin' });
  const res = tab === 'rekap' ? rekap : izin;
  const rows = (rekap.data ?? []).filter((r) => cocok(r.gtk_name, q));
  const izins = (izin.data ?? []).filter((r) => cocok(r.gtk_name, q));

  return (
    <Screen title="Laporan Absensi GTK" subtitle="Dari keterisian jurnal & perizinan" back refreshing={res.refreshing} onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <SegmentedControl<Tab> segments={[{ value: 'rekap', label: 'Rekap' }, { value: 'izin', label: 'Perizinan' }]} value={tab} onChange={setTab} />
        <View style={styles.two}>
          <DateField label="Dari" value={dari} max={sampai} onChange={(v) => v && setDari(v)} style={{ flex: 1 }} />
          <DateField label="Sampai" value={sampai} min={dari} max={todayISO()} onChange={(v) => v && setSampai(v)} style={{ flex: 1 }} />
        </View>
        <SearchBox value={q} onChange={setQ} placeholder="Cari GTK…" />
        {res.loading ? <CardSkeleton lines={6} /> : res.error && !res.data ? (
          <ErrorState message="Laporan belum tersimpan di perangkat." onRetry={res.refresh} compact />
        ) : tab === 'rekap' ? (
          rows.length === 0 ? <Card><EmptyState icon="people-outline" title="Tidak ada data" compact /></Card> : (
            <Card style={{ gap: spacing.md }}>
              {rows.map((r, i) => (
                <Pressable key={r.gtk_id} accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/pantau/absensi-gtk-detail', params: { id: r.gtk_id, name: r.gtk_name, dari, sampai } })}
                  style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.md } : undefined}>
                  <PctRow title={r.gtk_name} pct={r.persentase_hadir} ada={r.persentase_hadir != null}
                    subtitle={`Hadir ${r.hadir}/${r.total_hari_wajib} · izin ${r.total_izin} · alpha ${r.alpha}`} />
                </Pressable>
              ))}
            </Card>
          )
        ) : izins.length === 0 ? (
          <Card><EmptyState icon="document-text-outline" title="Tidak ada perizinan" message="Tidak ada izin GTK pada rentang ini." compact /></Card>
        ) : izins.map((r) => {
          const st = IZIN[r.jenis] ?? { label: r.jenis, tone: 'neutral' as BadgeTone };
          return (
            <Card key={r.id} style={{ gap: 4 }}>
              <View style={styles.row}>
                <T weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{r.gtk_name ?? '-'}</T>
                <Badge label={st.label} tone={st.tone} small />
              </View>
              <T variant="caption" tone="secondary">
                {formatDateShort(r.tanggal_mulai)}{r.tanggal_selesai !== r.tanggal_mulai ? ` – ${formatDateShort(r.tanggal_selesai)}` : ''}
              </T>
              {r.keterangan ? <T variant="caption" tone="muted">{r.keterangan}</T> : null}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
