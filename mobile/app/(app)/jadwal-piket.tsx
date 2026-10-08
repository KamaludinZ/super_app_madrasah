/**
 * Jadwal Piket (guru, tendik, guru piket) — native, tampilan baca dari /admin/jadwal-piket (pengelolaan tetap
 * oleh admin di web). Piket guru per hari & shift (GET /piket-schedules) dan piket ibadah: salaman putra/putri,
 * keputrian, imam shalat (GET /ibadah-schedules). Tab hari (bawaan hari ini), jadwal milik sendiri ditandai.
 */
import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '@/api/endpoints';
import type { IbadahSchedule, PiketGuru } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { DAY_LABELS, dayKeyOf, todayISO } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

const DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'] as const;
type Day = (typeof DAYS)[number];
const SHIFT: Record<string, { label: string; tone: BadgeTone }> = {
  pagi: { label: 'Pagi', tone: 'warning' }, siang: { label: 'Siang', tone: 'brand' }, sore: { label: 'Sore', tone: 'neutral' }, fullday: { label: 'Fullday', tone: 'success' },
};
const KATEGORI: Record<string, string> = {
  salaman_putri: 'Salaman & Pendampingan Ibadah Putri', salaman_putra: 'Salaman & Pendampingan Ibadah Putra',
  keputrian: 'Piket Keputrian', imam_shalat: 'Imam Shalat',
};
const IMAM: Record<string, string> = { dhuha: 'Imam Shalat Dhuha', dhuhur: 'Imam Shalat Dhuhur', jumat: 'Khotib Shalat Jumat', ashar: 'Imam Shalat Ashar' };
const SETIAP_HARI = ['dhuha', 'dhuhur', 'ashar'];

/** Petugas ibadah untuk hari d: sesuai hari, ditambah imam Dhuha/Dhuhur/Ashar yang berlaku setiap hari (sama dengan server). */
const ibadahHari = (list: IbadahSchedule[], d: string) => list.filter((s) => s.is_active !== false
  && (s.hari === d || (s.kategori === 'imam_shalat' && SETIAP_HARI.includes(s.jenis_ibadah ?? ''))));

export default function JadwalPiket() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const today = dayKeyOf(todayISO());
  const [day, setDay] = useState<Day>((DAYS as readonly string[]).includes(today) ? (today as Day) : 'senin');
  const piket = useCached<PiketGuru[]>('jadwal-piket.piket', api.jadwalPiket.piket, { staleTime: 10 * 60_000 });
  const ibadah = useCached<IbadahSchedule[]>('jadwal-piket.ibadah', api.jadwalPiket.ibadah, { staleTime: 10 * 60_000 });

  const piketHari = useMemo(() => (piket.data ?? []).filter((p) => p.day === day && p.is_active !== false)
    .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')), [piket.data, day]);
  const ibadahH = useMemo(() => ibadahHari(ibadah.data ?? [], day), [ibadah.data, day]);
  const mine = useMemo(() => DAYS.filter((d) => (piket.data ?? []).some((p) => p.day === d && p.teacher_id === user?.id)
    || ibadahHari(ibadah.data ?? [], d).some((s) => s.petugas_id === user?.id && s.hari === d)), [piket.data, ibadah.data, user?.id]);

  return (
    <Screen title="Jadwal Piket" subtitle={mine.length ? `Piket Anda: ${mine.map((d) => DAY_LABELS[d]).join(', ')}` : 'Piket guru & piket ibadah'} back scroll={false}
      offline={{ fromCache: piket.fromCache, updatedAt: piket.updatedAt }}>
      <ScrollView
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={piket.refreshing || ibadah.refreshing} onRefresh={() => { void piket.refresh(); void ibadah.refresh(); }}
          tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      >
        <SegmentedControl<Day> small value={day} onChange={setDay}
          segments={DAYS.map((d) => ({ value: d, label: `${DAY_LABELS[d].slice(0, 3)}${mine.includes(d) ? ' •' : ''}` }))} />
        <T variant="subtitle">{DAY_LABELS[day]}{day === today ? ' · Hari ini' : ''}</T>

        <T variant="label" tone="muted">PIKET GURU</T>
        {piket.loading ? <CardSkeleton lines={2} /> : piket.error && !piket.data ? (
          <ErrorState message="Jadwal piket belum tersimpan di perangkat." onRetry={piket.refresh} compact />
        ) : piketHari.length === 0 ? (
          <Card><EmptyState icon="shield-outline" title="Tidak ada piket guru" message={`Belum ada jadwal piket hari ${DAY_LABELS[day]}.`} compact /></Card>
        ) : piketHari.map((p) => {
          const sh = SHIFT[p.shift ?? ''] ?? { label: p.shift ?? '-', tone: 'neutral' as BadgeTone };
          const me = p.teacher_id === user?.id;
          return (
            <Card key={p.id} style={[styles.card, me ? { borderColor: colors.brandPrimary, borderWidth: 1.5 } : null]}>
              <View style={[styles.time, { backgroundColor: colors.surfaceSecondary }]}>
                <T weight="bold">{p.start_time ?? '-'}</T>
                <T variant="small" tone="muted">{p.end_time ?? ''}</T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T weight="semibold" numberOfLines={1}>{p.teacher_name ?? '-'}</T>
                {p.notes ? <T variant="caption" tone="secondary" numberOfLines={2}>{p.notes}</T> : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Badge label={sh.label} tone={sh.tone} small />
                {me ? <Badge label="Anda" tone="brand" small /> : null}
              </View>
            </Card>
          );
        })}

        <T variant="label" tone="muted" style={{ marginTop: spacing.sm }}>PIKET IBADAH & KEPUTRIAN</T>
        {ibadah.loading ? <CardSkeleton lines={2} /> : ibadahH.length === 0 ? (
          <Card><EmptyState icon="moon-outline" title="Tidak ada piket ibadah" message={`Belum ada jadwal ibadah hari ${DAY_LABELS[day]}.`} compact /></Card>
        ) : ibadahH.map((s) => {
          const me = s.petugas_id === user?.id;
          return (
            <Card key={s.id} style={[styles.card, me ? { borderColor: colors.brandPrimary, borderWidth: 1.5 } : null]}>
              <View style={[styles.icon, { backgroundColor: colors.brandTertiary }]}>
                <Icon name={s.kategori === 'imam_shalat' ? 'moon-outline' : 'hand-left-outline'} size={20} color={colors.onBrandTertiary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="caption" tone="muted">{s.kategori === 'imam_shalat' ? IMAM[s.jenis_ibadah ?? ''] ?? 'Imam Shalat' : KATEGORI[s.kategori] ?? s.kategori}</T>
                <T weight="semibold" numberOfLines={1}>{s.petugas_name ?? '-'}</T>
                {s.waktu || s.notes ? <T variant="caption" tone="secondary" numberOfLines={2}>{[s.waktu, s.notes].filter(Boolean).join(' · ')}</T> : null}
              </View>
              {me ? <Badge label="Anda" tone="brand" small /> : null}
            </Card>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  time: { width: 64, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
