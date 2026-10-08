/**
 * Ekstrakurikuler — native, pengganti /ekstrakurikuler untuk peran non-pembina. Siswa melihat ekskul yang
 * diikutinya beserta predikat semester ini (GET /ekstrakurikuler/student/{id}); semua peran menjelajahi
 * katalog kegiatan (GET /extracurriculars): pembina, jadwal, lokasi, jumlah anggota. Tersimpan offline.
 */
import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { api } from '@/api/endpoints';
import type { Extracurricular, RaporEkskul } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { DAY_LABELS } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Icon, IconName } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

const jadwal = (e: { schedule_day?: string | null; schedule_start?: string | null; schedule_end?: string | null }) =>
  e.schedule_day ? `${DAY_LABELS[e.schedule_day.toLowerCase()] ?? e.schedule_day}${e.schedule_start ? `, ${e.schedule_start}–${e.schedule_end ?? ''}` : ''}` : null;

export default function EkskulScreen() {
  const { colors } = useTheme();
  const { user, activeRole } = useAuth();
  const isSiswa = activeRole === 'siswa';
  const sem = new Date().getMonth() >= 6 ? 'ganjil' : 'genap';
  const list = useCached<Extracurricular[]>('ekskul.list', api.ekskul.list, { staleTime: 10 * 60_000 });
  const mine = useCached<RaporEkskul[]>(`siswa.rapor.ekskul.${sem}`, () => api.rapor.ekskul(user?.id ?? '', sem), { enabled: isSiswa && !!user });
  const [search, setSearch] = useState('');

  const mineIds = useMemo(() => new Set((mine.data ?? []).map((m) => m.id)), [mine.data]);
  const katalog = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (list.data ?? []).filter((e) => !s || [e.name, e.description, e.coach_name, e.location].some((x) => (x ?? '').toLowerCase().includes(s)));
  }, [list.data, search]);

  return (
    <Screen title="Ekstrakurikuler" subtitle={`${list.data?.length ?? 0} kegiatan`} back scroll={false} offline={{ fromCache: list.fromCache, updatedAt: list.updatedAt }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={list.refreshing || mine.refreshing} onRefresh={() => { void list.refresh(); if (isSiswa) void mine.refresh(); }}
          tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      >
        {isSiswa ? (
          <>
            <T variant="subtitle">Ekskul saya</T>
            {mine.loading ? <CardSkeleton lines={2} /> : (mine.data ?? []).length === 0 ? (
              <Card><EmptyState icon="sparkles-outline" title="Belum terdaftar" message="Daftar ke pembina ekskul; setelah ditambahkan sebagai anggota, kegiatan Anda tampil di sini." compact /></Card>
            ) : (mine.data ?? []).map((m) => (
              <Card key={m.id} style={[{ gap: 4 }, { borderColor: colors.brandPrimary, borderWidth: 1.5 }]}>
                <View style={styles.row}>
                  <T weight="semibold" style={{ flex: 1 }}>{m.name ?? '-'}</T>
                  <Badge label={m.predicate ? `Predikat ${m.predicate}` : 'Belum dinilai'} tone={m.predicate ? 'success' : 'neutral'} small />
                </View>
                {jadwal(m) ? <Meta icon="calendar-outline" text={jadwal(m)!} /> : null}
                {m.location ? <Meta icon="location-outline" text={m.location} /> : null}
                {m.description ? <T variant="caption" tone="secondary">{m.description}</T> : null}
              </Card>
            ))}
            <T variant="subtitle" style={{ marginTop: spacing.sm }}>Semua kegiatan</T>
          </>
        ) : null}

        <Input icon="search-outline" placeholder="Cari kegiatan, pembina, lokasi…" value={search} onChangeText={setSearch} returnKeyType="search" />

        {list.loading ? <CardSkeleton lines={3} /> : list.error && !list.data ? (
          <ErrorState message="Daftar ekskul belum tersimpan di perangkat. Sambungkan ke internet lalu coba lagi." onRetry={list.refresh} />
        ) : katalog.length === 0 ? (
          <Card><EmptyState icon="sparkles-outline" title={search ? 'Tidak ada yang cocok' : 'Belum ada ekstrakurikuler'} message="Kegiatan ekstrakurikuler madrasah akan tampil di sini." compact /></Card>
        ) : katalog.map((e) => (
          <Card key={e.id} style={{ gap: spacing.sm }}>
            <View style={styles.row}>
              <View style={[styles.icon, { backgroundColor: colors.brandTertiary }]}>
                <Icon name="sparkles-outline" size={20} color={colors.onBrandTertiary} />
              </View>
              <View style={{ flex: 1 }}>
                <T weight="semibold">{e.name}</T>
                {e.coach_name ? <T variant="caption" tone="muted">Pembina: {e.coach_name}</T> : null}
              </View>
              {mineIds.has(e.id) ? <Badge label="Diikuti" icon="checkmark-circle-outline" tone="success" small /> : null}
            </View>
            {e.description ? <T variant="caption" tone="secondary" numberOfLines={3}>{e.description}</T> : null}
            <View style={{ gap: 2 }}>
              {jadwal(e) ? <Meta icon="calendar-outline" text={jadwal(e)!} /> : null}
              {e.location ? <Meta icon="location-outline" text={e.location} /> : null}
              <Meta icon="people-outline" text={`${e.member_count ?? 0} anggota`} />
            </View>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={14} color={colors.muted} />
      <T variant="caption" tone="secondary" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
