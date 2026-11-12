/** Kartu satu pengajuan izin milik sendiri (status, jam, alasan penolakan); `onBatalkan` saat masih menunggu. */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { formatDateShort } from '@/utils/time';
import { Izin, STATUS_IZIN } from './api';

export function KartuPengajuan({ izin, onPress, onBatalkan, sibuk }: { izin: Izin; onPress: () => void; onBatalkan?: () => void; sibuk?: boolean }) {
  const { colors } = useTheme();
  const s = STATUS_IZIN[izin.status] ?? STATUS_IZIN.menunggu;
  return (
    <Card onPress={onPress} accessibilityLabel={`Detail pengajuan ${izin.keperluan}`} style={{ gap: 4 }}>
      <View style={styles.row}>
        <T variant="small" tone="muted" style={{ flex: 1 }}>{formatDateShort(izin.tanggal)} · {izin.jam_mulai}–{izin.jam_selesai}</T>
        <Badge label={s.label} tone={s.tone} small />
      </View>
      <T weight="medium">{izin.keperluan}</T>
      {izin.status === 'ditolak' && izin.alasan_penolakan ? (
        <View style={[styles.alasan, { backgroundColor: colors.errorSoft }]}>
          <T variant="caption" color={colors.error}>Alasan ditolak: {izin.alasan_penolakan}</T>
        </View>
      ) : null}
      {izin.status === 'menunggu' ? (
        <View style={styles.row}>
          <T variant="small" tone="muted" style={{ flex: 1 }}>Menunggu keputusan kepala madrasah</T>
          {onBatalkan ? (
            <Pressable onPress={onBatalkan} disabled={sibuk} hitSlop={8} accessibilityRole="button"
              accessibilityLabel={`Batalkan pengajuan ${izin.keperluan}`} style={({ pressed }) => [styles.batal, { opacity: pressed || sibuk ? 0.6 : 1 }]}>
              <Icon name="close-circle-outline" size={16} color={colors.error} />
              <T variant="small" weight="semibold" color={colors.error}>{sibuk ? 'Membatalkan…' : 'Batalkan'}</T>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  alasan: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, marginTop: 2 },
  batal: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
