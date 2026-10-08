/**
 * Agenda GTK & Kegiatan Madrasah (Kepala Madrasah) — native, pengganti /admin/gtk/agenda-guru,
 * /admin/gtk/agenda-tendik dan /admin/kegiatan-madrasah (hanya lihat). Parameter `jenis` = guru | tendik |
 * madrasah. Agenda pegawai: GET /staff-events per bulan, dipilah menurut peran pegawai (GET /users?role);
 * kegiatan madrasah: GET /madrasah-events. Dikelompokkan per tanggal, dengan pencarian.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { User } from '@/api/types';
import { pantau, AgendaItem } from '@/pantau/api';
import { bulanIni, cocok, MonthBar, pecahBulan, SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { formatDateLong, formatDateShort } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Jenis = 'guru' | 'tendik' | 'madrasah';
const ROLE: Record<Exclude<Jenis, 'madrasah'>, string> = { guru: 'guru', tendik: 'tenaga_kependidikan' };

export default function PantauAgenda() {
  const { colors } = useTheme();
  const p = useLocalSearchParams<{ jenis?: string }>();
  const [jenis, setJenis] = useState<Jenis>(p.jenis === 'tendik' || p.jenis === 'madrasah' ? p.jenis : 'guru');
  const [month, setMonth] = useState(bulanIni());
  const { y, m } = pecahBulan(month);
  const [q, setQ] = useState('');
  const pegawai = jenis !== 'madrasah';
  const staff = useCached<AgendaItem[]>(`pantau.agenda.staff.${month}`, () => pantau.staffEvents(y, m), { enabled: pegawai });
  const madrasah = useCached<AgendaItem[]>(`pantau.agenda.madrasah.${month}`, () => pantau.madrasahEvents(y, m), { enabled: !pegawai });
  const users = useCached<User[]>(`pantau.users.${pegawai ? ROLE[jenis as 'guru'] : 'guru'}`, () => pantau.users(ROLE[jenis as 'guru']), { enabled: pegawai, staleTime: 60 * 60_000 });
  const res = pegawai ? staff : madrasah;

  const groups = useMemo(() => {
    const ids = new Set((users.data ?? []).map((u) => u.id));
    const src = pegawai ? (staff.data ?? []).filter((a) => a.user_id && ids.has(a.user_id)) : (madrasah.data ?? []);
    const map = new Map<string, AgendaItem[]>();
    src.filter((a) => cocok(`${a.event_name ?? a.name} ${a.user_name} ${a.location}`, q))
      .sort((a, b) => b.date.localeCompare(a.date) || (a.start_time ?? '').localeCompare(b.start_time ?? ''))
      .forEach((a) => map.set(a.date, [...(map.get(a.date) ?? []), a]));
    return [...map.entries()];
  }, [pegawai, staff.data, madrasah.data, users.data, q]);
  const total = groups.reduce((n, [, l]) => n + l.length, 0);
  const loading = res.loading || (pegawai && users.loading);

  return (
    <Screen title={jenis === 'madrasah' ? 'Kegiatan Madrasah' : `Agenda ${jenis === 'guru' ? 'Guru' : 'Tendik'}`} subtitle={`${total} kegiatan bulan ini`} back
      refreshing={res.refreshing} onRefresh={() => { void res.refresh(); if (pegawai) void users.refresh(); }} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <SegmentedControl<Jenis> segments={[{ value: 'guru', label: 'Guru' }, { value: 'tendik', label: 'Tendik' }, { value: 'madrasah', label: 'Madrasah' }]} value={jenis} onChange={setJenis} />
        <MonthBar month={month} onChange={setMonth} />
        <SearchBox value={q} onChange={setQ} placeholder={pegawai ? 'Cari kegiatan atau nama…' : 'Cari kegiatan atau tempat…'} />
        {loading ? <CardSkeleton lines={5} /> : res.error && !res.data ? (
          <ErrorState message="Agenda belum tersimpan di perangkat." onRetry={res.refresh} compact />
        ) : groups.length === 0 ? (
          <Card><EmptyState icon="calendar-outline" title="Belum ada kegiatan" message="Tidak ada kegiatan tercatat pada bulan ini." compact /></Card>
        ) : groups.map(([tgl, list]) => (
          <Card key={tgl} style={{ gap: spacing.sm }}>
            <T variant="label" weight="semibold" tone="secondary">{formatDateLong(tgl)}</T>
            {list.map((a, i) => (
              <View key={a.id} style={[{ gap: 2 }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
                <View style={styles.row}>
                  <T weight="semibold" style={{ flex: 1 }}>{a.event_name ?? a.name ?? '-'}</T>
                  {a.category ? <Badge label={a.category} tone="neutral" small /> : null}
                </View>
                {pegawai && a.user_name ? <T variant="caption" tone="brand">{a.user_name}</T> : null}
                <T variant="caption" tone="muted">
                  {[a.start_time && a.end_time ? `${a.start_time}–${a.end_time}` : null, a.end_date && a.end_date !== a.date ? `s.d. ${formatDateShort(a.end_date)}` : null, a.location].filter(Boolean).join(' · ')}
                </T>
                {a.description ? <T variant="caption" tone="secondary" numberOfLines={3}>{a.description}</T> : null}
              </View>
            ))}
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm } });
