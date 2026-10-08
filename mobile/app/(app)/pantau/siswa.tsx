/**
 * Data Siswa (Kepala Madrasah & peran pemantau) — native, pengganti /admin/siswa (hanya lihat).
 * Siswa aktif (GET /students, saring kelas) dengan pencarian nama/NISN, jumlah L/P dan kelengkapan data;
 * ketuk siswa untuk data EMIS lengkapnya (profil-siswa?id).
 */
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import { request } from '@/api/client';
import type { ClassItem } from '@/api/types';
import { cocok, SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { SelectField } from '@/components/ui/SelectField';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type SiswaRow = { id: string; full_name: string; nisn?: string | null; nism?: string | null; gender?: string | null; class_name?: string | null; student_class_id?: string | null; completeness_percentage?: number | null; santri_mahad?: boolean };

export default function PantauSiswa() {
  const { colors } = useTheme();
  const router = useRouter();
  const [kelas, setKelas] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const kelasRes = useCached<ClassItem[]>('kebersihan.classes.all', async () => {
    const ay = await api.kebersihan.activeYear().catch(() => null);
    return api.kebersihan.classes(ay?.id);
  }, { staleTime: 30 * 60_000 });
  const res = useCached<SiswaRow[]>(`pantau.siswa.${kelas ?? 'semua'}`, () => request<SiswaRow[]>('/students', { query: { class_id: kelas ?? undefined } }), { staleTime: 30 * 60_000 });

  const rows = useMemo(() => (res.data ?? []).filter((s) => cocok(`${s.full_name} ${s.nisn ?? ''} ${s.nism ?? ''}`, q)), [res.data, q]);
  const l = rows.filter((s) => s.gender === 'L').length;
  const p = rows.filter((s) => s.gender === 'P').length;

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <SelectField label="Kelas" value={kelas} placeholder="Semua kelas" noneLabel="Semua kelas" icon="school-outline"
        options={[...(kelasRes.data ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true })).map((c) => ({ value: c.id, label: c.name }))}
        onChange={setKelas} />
      <SearchBox value={q} onChange={setQ} placeholder="Cari nama atau NISN…" />
      {res.data ? <T variant="caption" tone="muted">{rows.length} siswa · L {l} · P {p}</T> : null}
    </View>
  );

  return (
    <Screen title="Data Siswa" subtitle="Siswa aktif · hanya lihat" back scroll={false} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      {res.loading ? <>{header}<CardSkeleton lines={6} /></> : res.error && !res.data ? (
        <>{header}<ErrorState message="Data siswa belum tersimpan di perangkat." onRetry={res.refresh} compact /></>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(s) => s.id}
          ListHeaderComponent={header}
          ListEmptyComponent={<Card><EmptyState icon="people-outline" title="Tidak ada siswa" compact /></Card>}
          refreshing={res.refreshing}
          onRefresh={res.refresh}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          initialNumToRender={20}
          renderItem={({ item: s }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/profil-siswa', params: { id: s.id } })}
              style={({ pressed }) => [styles.item, { borderBottomColor: colors.divider, opacity: pressed ? 0.7 : 1 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <T weight="medium" numberOfLines={1}>{s.full_name}</T>
                <T variant="caption" tone="muted" numberOfLines={1}>
                  {[s.class_name ? `Kelas ${s.class_name}` : null, s.nisn ? `NISN ${s.nisn}` : null, s.gender === 'L' ? 'Laki-laki' : s.gender === 'P' ? 'Perempuan' : null, s.santri_mahad ? "Santri ma'had" : null].filter(Boolean).join(' · ')}
                </T>
              </View>
              {s.completeness_percentage != null ? (
                <T variant="caption" weight="semibold" color={s.completeness_percentage >= 100 ? colors.success : s.completeness_percentage >= 60 ? colors.warning : colors.error}>
                  {Math.round(s.completeness_percentage)}%
                </T>
              ) : null}
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
