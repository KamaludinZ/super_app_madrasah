/**
 * Kartu ringkas satu jurnal untuk riwayat: tanggal & jam, kelas/mapel, materi, kehadiran,
 * kolom "diisi oleh" (mis. "pengganti: nama"), penanda berdampingan & perlu verifikasi.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { Journal } from '@/api/types';
import { spacing, useTheme } from '@/theme';
import { Card } from './ui/Card';
import { T } from './ui/Text';
import { Badge } from './ui/Badge';
import { Icon } from './ui/Icon';
import { formatDateShort, formatTime } from '@/utils/time';

export function JournalCard({ j, onPress }: { j: Journal; onPress?: () => void }) {
  const { colors } = useTheme();
  const total = (j.siswa_hadir || 0) + (j.siswa_sakit || 0) + (j.siswa_izin || 0) + (j.siswa_tidak_hadir || 0);
  const substitute = j.fill_mode === 'substitute';
  const paired = !!j.pair_position;

  return (
    <Card onPress={onPress} style={[styles.card, paired && { borderLeftWidth: 4, borderLeftColor: colors.warning }]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <T variant="subtitle" numberOfLines={1}>{j.class_name || 'Kelas'} · {j.subject_name || '-'}</T>
          <T variant="caption" tone="muted">
            {formatDateShort(j.started_at)} · {formatTime(j.started_at)}{j.jam_ke && j.jam_ke !== '-' ? ` · ${j.jam_ke}` : ''}
          </T>
        </View>
        {onPress ? <Icon name="chevron-forward" size={18} color={colors.muted} /> : null}
      </View>

      <T numberOfLines={2} tone="secondary">{j.materi || '-'}</T>

      <View style={styles.badges}>
        <Badge
          label={j.diisi_oleh || j.filled_by_name || 'Pengajar'}
          icon={substitute ? 'swap-horizontal' : j.fill_mode === 'piket' ? 'hand-left-outline' : 'person-outline'}
          tone={substitute ? 'warning' : j.fill_mode === 'piket' ? 'neutral' : 'brand'}
          small
        />
        {total > 0 ? <Badge label={`H ${j.siswa_hadir} · S ${j.siswa_sakit} · I ${j.siswa_izin} · A ${j.siswa_tidak_hadir}`} tone="neutral" small /> : null}
        {paired && j.pair_position === 'second' ? <Badge label="Berdampingan" icon="git-compare-outline" tone="warning" small /> : null}
        {j.offline_submission?.needs_verification ? <Badge label="Perlu verifikasi" icon="alert-circle-outline" tone="error" small /> : null}
        {j.offline_submission?.was_offline ? <Badge label="Diisi offline" icon="cloud-offline-outline" tone="neutral" small /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
