/**
 * Laporan Absensi Saya (guru & tendik) — native, pengganti /gtk/absensi-saya. Tab Rekap: rentang tanggal,
 * ringkasan hadir/sakit/cuti/dinas luar/lainnya/alpha & persentase, status per hari kerja (GET /gtk/absensi/my,
 * dihitung server dari keterisian jurnal & izin). Tab Perizinan: daftar izin milik sendiri (GET /gtk/izin/my),
 * ajukan/ubah lewat form, hapus dengan konfirmasi.
 */
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { GTKAbsensiMy, GTKIzin } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { formatDateLong, formatDateShort, monthOf, todayISO } from '@/utils/time';
import { openUrl } from '@/components/RichText';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

export const IZIN_LABELS: Record<string, string> = { sakit: 'Sakit', cuti: 'Cuti', dinas_luar: 'Dinas Luar', lainnya: 'Lainnya' };
const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  hadir: { label: 'Hadir', tone: 'success' }, alpha: { label: 'Alpha', tone: 'error' }, libur: { label: 'Libur', tone: 'neutral' },
  belum: { label: 'Hari ini · belum ada jurnal', tone: 'neutral' },
  sakit: { label: 'Sakit', tone: 'warning' }, cuti: { label: 'Cuti', tone: 'brand' }, dinas_luar: { label: 'Dinas Luar', tone: 'brand' }, lainnya: { label: 'Lainnya', tone: 'neutral' },
};
type Tab = 'rekap' | 'izin';

export default function AbsensiSaya() {
  const [tab, setTab] = useState<Tab>('rekap');
  return (
    <Screen title="Laporan Absensi Saya" subtitle="Rekap dari keterisian jurnal & perizinan" back>
      <View style={{ gap: spacing.md }}>
        <SegmentedControl<Tab> segments={[{ value: 'rekap', label: 'Rekap absensi' }, { value: 'izin', label: 'Perizinan' }]} value={tab} onChange={setTab} />
        {tab === 'rekap' ? <Rekap /> : <Perizinan />}
      </View>
    </Screen>
  );
}

function Rekap() {
  const { colors } = useTheme();
  const today = todayISO();
  const [from, setFrom] = useState(`${monthOf(today)}-01`);
  const [to, setTo] = useState(today);
  const res = useCached<GTKAbsensiMy>(`gtk.absensi.${from}.${to}`, () => api.gtk.absensiMy(from, to));
  const s = res.data?.summary;
  const days = [...(res.data?.days ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <View style={styles.two}>
        <DateField label="Dari" value={from} max={to} onChange={(v) => v && setFrom(v)} style={{ flex: 1 }} />
        <DateField label="Sampai" value={to} min={from} max={today} onChange={(v) => v && setTo(v)} style={{ flex: 1 }} />
      </View>
      {res.loading ? <CardSkeleton lines={4} /> : res.error && !res.data ? (
        <ErrorState message={errorMessage(res.error, 'Rekap absensi belum bisa dimuat.')} onRetry={res.refresh} />
      ) : s ? (
        <>
          <Card style={{ gap: spacing.md }}>
            {s.persentase_hadir !== null && s.persentase_hadir !== undefined ? (
              <View style={styles.row}>
                <T weight="semibold" style={{ flex: 1 }}>Persentase kehadiran</T>
                <T variant="title" color={s.persentase_hadir >= 90 ? colors.success : s.persentase_hadir >= 75 ? colors.warning : colors.error}>{s.persentase_hadir}%</T>
              </View>
            ) : null}
            <View style={styles.grid}>
              {([['Hadir', s.hadir, colors.success], ['Sakit', s.sakit, colors.warning], ['Cuti', s.cuti, colors.brandPrimary],
                ['Dinas Luar', s.dinas_luar, colors.brandPrimary], ['Lainnya', s.lainnya, colors.onSurface], ['Alpha', s.alpha, colors.error]] as const).map(([l, v, c]) => (
                <View key={l} style={[styles.cell, { backgroundColor: colors.surfaceSecondary }]}>
                  <T variant="subtitle" color={c}>{v}</T>
                  <T variant="small" tone="muted">{l}</T>
                </View>
              ))}
            </View>
          </Card>
          <T variant="subtitle">Per hari kerja</T>
          {days.length === 0 ? (
            <Card><EmptyState icon="calendar-clear-outline" title="Tidak ada hari kerja" message="Tidak ada hari kerja pada rentang ini." compact /></Card>
          ) : (
            <Card padded={false}>
              {days.map((d, i) => {
                const st = STATUS[d.status] ?? { label: d.status, tone: 'neutral' as BadgeTone };
                return (
                  <View key={d.date} style={[styles.day, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}>
                    <T style={{ flex: 1 }}>{formatDateLong(d.date)}</T>
                    <Badge label={st.label} tone={st.tone} small />
                  </View>
                );
              })}
            </Card>
          )}
        </>
      ) : null}
    </>
  );
}

function Perizinan() {
  const router = useRouter();
  const { online } = useNetwork();
  const res = useCached<GTKIzin[]>('gtk.izin', api.gtk.izinMy);
  const [busy, setBusy] = useState<string | null>(null);

  const remove = (i: GTKIzin) => Alert.alert('Hapus data izin?', `${IZIN_LABELS[i.jenis] ?? i.jenis} ${formatDateShort(i.tanggal_mulai)}`, [
    { text: 'Batal', style: 'cancel' },
    {
      text: 'Hapus', style: 'destructive', onPress: async () => {
        setBusy(i.id);
        try { await api.gtk.izinDelete(i.id); toast.success('Data izin dihapus'); await res.refresh(); }
        catch (e) { toast.error(errorMessage(e, 'Gagal menghapus data izin.')); }
        finally { setBusy(null); }
      },
    },
  ]);

  return (
    <>
      <T variant="caption" tone="muted">Ajukan izin tidak hadir (sakit/cuti/dinas luar/lainnya) dengan rentang tanggal. Dokumen bukti boleh menyusul.</T>
      <Button title="Ajukan izin" icon="add-circle-outline" disabled={!online} onPress={() => router.push('/absensi-saya/izin')} />
      {res.loading ? <CardSkeleton lines={3} /> : res.error && !res.data ? (
        <ErrorState message="Data perizinan belum tersimpan di perangkat." onRetry={res.refresh} />
      ) : (res.data ?? []).length === 0 ? (
        <Card><EmptyState icon="document-text-outline" title="Belum ada perizinan" message="Izin yang Anda ajukan tampil di sini." compact /></Card>
      ) : (res.data ?? []).map((i) => (
        <Card key={i.id} style={{ gap: spacing.sm }}>
          <View style={styles.row}>
            <Badge label={IZIN_LABELS[i.jenis] ?? i.jenis} tone={STATUS[i.jenis]?.tone ?? 'neutral'} small />
            <T weight="semibold" style={{ flex: 1 }}>
              {formatDateShort(i.tanggal_mulai)}{i.tanggal_selesai !== i.tanggal_mulai ? ` – ${formatDateShort(i.tanggal_selesai)}` : ''}
            </T>
          </View>
          {i.keterangan ? <T variant="caption" tone="secondary">{i.keterangan}</T> : null}
          <View style={styles.row}>
            {i.dokumen_url ? <Button title="Dokumen" icon="link-outline" variant="ghost" size="sm" onPress={() => openUrl(i.dokumen_url!)} />
              : <Badge label="Dokumen belum diunggah" tone="warning" small />}
            <View style={{ flex: 1 }} />
            <Button title="Ubah" icon="create-outline" variant="ghost" size="sm" disabled={!online}
              onPress={() => router.push({ pathname: '/absensi-saya/izin', params: { id: i.id } })} />
            <Button title="Hapus" icon="trash-outline" variant="ghost" size="sm" loading={busy === i.id} disabled={!online} onPress={() => remove(i)} />
          </View>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: '31%', flexGrow: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
  day: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2 },
});
