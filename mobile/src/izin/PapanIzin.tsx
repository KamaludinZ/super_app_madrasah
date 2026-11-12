/**
 * Papan izin disetujui hari ini (aplikasi): dikelompokkan sedang izin / belum mulai, lalu selesai
 * (disembunyikan dulu). Dipakai dashboard satpam (dengan tombol Catat) dan layar pemantau kepala TU.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { errorMessage } from '@/api/client';
import { roleLabel } from '@/utils/roles';
import { Izin, WAKTU_IZIN, WaktuIzin, jamSekarangWIB, kelompokkanWaktu } from './api';

/** Jam WIB berjalan (diperbarui tiap menit). */
export function useJam() {
  const [jam, setJam] = useState(jamSekarangWIB);
  useEffect(() => {
    const t = setInterval(() => setJam(jamSekarangWIB()), 60_000);
    return () => clearInterval(t);
  }, []);
  return jam;
}

function KartuIzin({ izin, waktu, onPress, onCatat }: { izin: Izin; waktu: WaktuIzin; onPress: () => void; onCatat?: () => void }) {
  const { colors } = useTheme();
  const w = WAKTU_IZIN[waktu];
  return (
    <Card onPress={onPress} accessibilityLabel={`Detail izin ${izin.pengaju_nama}`} style={[styles.izin, waktu === 'selesai' && { opacity: 0.6 }]}>
      <View style={[styles.jam, { backgroundColor: waktu === 'berlangsung' ? colors.brandTertiary : colors.surfaceSecondary }]}>
        <T weight="bold">{izin.jam_mulai}</T>
        <T variant="small" tone="muted">s.d. {izin.jam_selesai}</T>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T weight="semibold" numberOfLines={1}>{izin.pengaju_nama}</T>
        <T variant="small" tone="muted">{roleLabel(izin.pengaju_peran)}</T>
        <T variant="caption" tone="secondary">{izin.keperluan}</T>
      </View>
      <View style={styles.aksi}>
        <Badge label={w.label} tone={w.tone} small />
        {onCatat ? (
          <Pressable onPress={onCatat} accessibilityRole="button" accessibilityLabel={`Tulis catatan untuk izin ${izin.pengaju_nama}`}
            hitSlop={8} style={({ pressed }) => [styles.catat, { opacity: pressed ? 0.6 : 1 }]}>
            <Icon name="create-outline" size={16} color={colors.brandPrimary} />
            <T variant="small" weight="semibold" tone="brand">Catat</T>
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

export function PapanIzin({ items, jam, loading, error, onRetry, onPilih, onCatat }: {
  items: Izin[]; jam: string; loading?: boolean; error?: unknown; onRetry?: () => void;
  onPilih: (izin: Izin) => void; onCatat?: (izin: Izin) => void;
}) {
  const { colors } = useTheme();
  const [tampilSelesai, setTampilSelesai] = useState(false);
  if (loading) return <View style={{ gap: spacing.sm }}><CardSkeleton lines={2} /><CardSkeleton lines={2} /></View>;
  if (error && !items.length) return <ErrorState message={errorMessage(error, 'Gagal memuat papan izin.')} onRetry={onRetry} compact />;
  if (!items.length) {
    return <Card><EmptyState icon="exit-outline" title="Tidak ada izin hari ini" message="Izin yang disetujui kepala madrasah untuk hari ini akan tampil di sini." compact /></Card>;
  }
  const g = kelompokkanWaktu(items, jam);
  const aktif: [Izin, WaktuIzin][] = [
    ...g.berlangsung.map((i) => [i, 'berlangsung'] as [Izin, WaktuIzin]),
    ...g.akan_datang.map((i) => [i, 'akan_datang'] as [Izin, WaktuIzin]),
  ];
  const kartu = (i: Izin, w: WaktuIzin) => (
    <KartuIzin key={i.id} izin={i} waktu={w} onPress={() => onPilih(i)} onCatat={onCatat ? () => onCatat(i) : undefined} />
  );
  return (
    <View style={{ gap: spacing.sm }}>
      {aktif.length ? aktif.map(([i, w]) => kartu(i, w)) : <T variant="caption" tone="muted" center>Semua izin hari ini sudah selesai.</T>}
      {g.selesai.length ? (
        <Pressable onPress={() => setTampilSelesai((v) => !v)} accessibilityRole="button" style={styles.toggle}>
          <Icon name={tampilSelesai ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
          <T variant="caption" tone="muted">{tampilSelesai ? 'Sembunyikan' : 'Tampilkan'} izin yang sudah selesai ({g.selesai.length})</T>
        </Pressable>
      ) : null}
      {tampilSelesai ? g.selesai.map((i) => kartu(i, 'selesai')) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  izin: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  jam: { width: 72, alignItems: 'center', borderRadius: radius.md, paddingVertical: spacing.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: spacing.sm },
  aksi: { alignItems: 'flex-end', gap: spacing.sm },
  catat: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 2 },
});
