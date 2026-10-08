/**
 * Pantauan Walikelas — native, pengganti /wali-kelas/poin-tatib (hanya lihat). Siswa kelas yang diampu
 * dengan poin kebaikan, pelanggaran & saldo (GET /tatib/walikelas/siswa); siswa yang mencapai batas
 * pelanggaran ditandai "perlu perhatian" dan bisa ditampilkan saja. Ketuk siswa untuk riwayat poinnya.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { errorMessage } from '@/api/client';
import { tatib, PoinKelasWali } from '@/tatib/api';
import { fmtPoin } from '@/tatib/ui';
import { cocok, SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Saring = 'semua' | 'perhatian';

export default function PantauanWalikelas() {
  const { colors } = useTheme();
  const router = useRouter();
  const res = useCached<PoinKelasWali>('tatib.walikelas', tatib.kelasWali);
  const [q, setQ] = useState('');
  const [saring, setSaring] = useState<Saring>('semua');
  const all = res.data?.siswa ?? [];
  const nPerhatian = all.filter((s) => s.perlu_perhatian).length;
  const rows = all.filter((s) => (saring === 'semua' || s.perlu_perhatian) && cocok(`${s.full_name} ${s.nisn ?? ''}`, q))
    .sort((a, b) => Number(b.perlu_perhatian) - Number(a.perlu_perhatian) || a.full_name.localeCompare(b.full_name));

  return (
    <Screen title="Pantauan Walikelas" subtitle={res.data?.kelas ? `Poin tata tertib kelas ${res.data.kelas.name}` : 'Poin tata tertib kelas'} back
      refreshing={res.refreshing} onRefresh={res.refresh} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        {res.loading ? <CardSkeleton lines={6} /> : !res.data ? (
          <ErrorState message={errorMessage(res.error, 'Data kelas belum bisa dimuat.')} onRetry={res.refresh} compact />
        ) : !res.data.kelas ? (
          <Card><EmptyState icon="school-outline" title="Belum ada kelas wali" message="Akun Anda belum ditetapkan sebagai wali kelas pada tahun pelajaran aktif." compact /></Card>
        ) : (
          <>
            {nPerhatian ? (
              <Card tone="error" style={styles.row}>
                <Icon name="alert-circle" size={20} color={colors.error} />
                <T variant="caption" color={colors.error} style={{ flex: 1 }}>
                  {nPerhatian} siswa perlu perhatian (akumulasi pelanggaran ≤ {res.data.batas_minus_perhatian ?? -20}).
                </T>
              </Card>
            ) : null}
            <SearchBox value={q} onChange={setQ} placeholder="Cari siswa…" />
            <SegmentedControl<Saring> small value={saring} onChange={setSaring}
              segments={[{ value: 'semua', label: `Semua (${all.length})` }, { value: 'perhatian', label: `Perlu perhatian (${nPerhatian})` }]} />
            {rows.length === 0 ? <Card><EmptyState icon="people-outline" title="Tidak ada siswa" compact /></Card> : (
              <Card style={{ gap: spacing.md }}>
                {rows.map((s, i) => (
                  <Pressable key={s.id} accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/tatib/poin', params: { id: s.id, sumber: 'wali', nama: s.full_name } })}
                    style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.md }]}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T weight="medium" numberOfLines={1}>{s.full_name}</T>
                      <T variant="caption" tone="muted">Kebaikan {fmtPoin(s.total_plus)} · Pelanggaran {s.total_minus}</T>
                    </View>
                    {s.perlu_perhatian ? <Badge label="Perhatian" tone="error" small /> : null}
                    <T weight="bold" color={s.saldo < 0 ? colors.error : s.saldo > 0 ? colors.success : undefined}>{fmtPoin(s.saldo)}</T>
                    <Icon name="chevron-forward" size={18} color={colors.muted} />
                  </Pressable>
                ))}
              </Card>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm } });
