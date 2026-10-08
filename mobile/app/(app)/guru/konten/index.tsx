/**
 * Materi / Tugas saya (guru) — native, pengganti /guru/materi & /guru/tugas (?jenis=materi|tugas).
 * Daftar konten buatan sendiri (GET /kelas/{jenis}) dengan mapel, sasaran, tenggat (tugas) & pencarian;
 * ketuk untuk detail (tugas: daftar pengumpulan). Buat baru lewat form.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { GuruKonten, ScheduleItem } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { dueInfo, formatDateShort, formatDateTime } from '@/utils/time';
import { JENIS_LABEL, ajaran, asJenis, kontenKey, ringkasSasaran } from '@/kelas/guru';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

export default function KontenGuru() {
  const params = useLocalSearchParams<{ jenis?: string }>();
  const jenis = asJenis(params.jenis);
  const { colors } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { online } = useNetwork();
  const res = useCached<GuruKonten[]>(kontenKey(jenis), () => api.kelas.guruList(jenis));
  const jadwal = useCached<ScheduleItem[]>(`jadwal.t.${user?.id}`, () => api.schedules.grouped({ teacher_id: user?.id }), { enabled: !!user?.id, staleTime: 10 * 60_000 });
  const { namaKelas } = useMemo(() => ajaran(jadwal.data), [jadwal.data]);
  const [search, setSearch] = useState('');

  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return [...(res.data ?? [])]
      .filter((k) => !s || [k.judul, k.deskripsi, k.subject_name].some((x) => (x ?? '').toLowerCase().includes(s)))
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  }, [res.data, search]);

  return (
    <Screen title={`${JENIS_LABEL[jenis]} Saya`} subtitle={`${res.data?.length ?? 0} ${jenis} · Kelas Digital`} back scroll={false}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}
      footer={<Button title={`Buat ${jenis}`} icon="add-circle-outline" size="lg" fullWidth disabled={!online}
        onPress={() => router.push({ pathname: '/guru/konten/form', params: { jenis } })} />}>
      <FlatList
        data={list}
        keyExtractor={(k) => k.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={<Input icon="search-outline" placeholder={`Cari ${jenis}…`} value={search} onChangeText={setSearch} containerStyle={{ marginBottom: spacing.md }} />}
        renderItem={({ item: k }) => {
          const due = jenis === 'tugas' ? dueInfo(k.deadline) : null;
          return (
            <Card onPress={() => router.push({ pathname: '/guru/konten/[id]', params: { id: k.id, jenis } })} style={{ gap: spacing.sm }}>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: colors.brandTertiary }]}>
                  <Icon name={jenis === 'tugas' ? 'clipboard-outline' : 'book-outline'} size={20} color={colors.onBrandTertiary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T weight="semibold" numberOfLines={2}>{k.judul}</T>
                  <T variant="caption" tone="muted">{k.subject_name ?? '-'} · {formatDateShort(k.created_at ?? '')}</T>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </View>
              <T variant="caption" tone="secondary" numberOfLines={2}>{ringkasSasaran(k, namaKelas)}</T>
              {due ? (
                <View style={styles.row}>
                  <Badge label={due.label} tone={due.tone} small />
                  <T variant="small" tone="muted">Tenggat {formatDateTime(k.deadline!)}</T>
                </View>
              ) : null}
            </Card>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={res.loading ? <CardSkeleton lines={3} /> : res.error && !res.data
          ? <ErrorState message={errorMessage(res.error, `${JENIS_LABEL[jenis]} belum bisa dimuat.`)} onRetry={res.refresh} />
          : <Card><EmptyState icon={jenis === 'tugas' ? 'clipboard-outline' : 'library-outline'} title={search ? 'Tidak ada yang cocok' : `Belum ada ${jenis}`}
              message={`Bagikan ${jenis} ke kelas atau siswa tertentu lewat “Buat ${jenis}”; siswa menerima notifikasi.`} compact /></Card>}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
