/**
 * Kartu satu slot jadwal hari ini: jam, kelas, mapel, ruang, status (akan/sedang/selesai), status
 * jurnal, dan penanda Guru Pengganti / "Digantikan". Tombol aksi menyesuaikan jenis slot.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ScheduleItem } from '@/api/types';
import { radius, spacing, useTheme } from '@/theme';
import { Card } from './ui/Card';
import { T } from './ui/Text';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';
import type { SlotStatus } from '@/utils/time';

export type SlotAction = { label: string; icon: React.ComponentProps<typeof Button>['icon']; onPress: () => void; variant?: 'primary' | 'secondary' | 'outline' };

const STATUS_LABEL: Record<SlotStatus, string> = { upcoming: 'Akan datang', ongoing: 'Sedang berlangsung', done: 'Selesai' };

export function SlotCard({ slot, status, queued, action }: { slot: ScheduleItem; status: SlotStatus; queued?: boolean; action?: SlotAction | null }) {
  const { colors } = useTheme();
  const filled = !!slot.journal_filled;
  const accent = slot.is_substitute ? colors.warning : status === 'ongoing' ? colors.brandPrimary : colors.border;

  return (
    <Card style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.row}>
        <View style={[styles.time, { backgroundColor: status === 'ongoing' ? colors.brandTertiary : colors.surfaceSecondary }]}>
          <T variant="subtitle" color={status === 'ongoing' ? colors.onBrandTertiary : colors.onSurface}>{slot.start_time}</T>
          <T variant="small" tone="muted">{slot.end_time}</T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.titleRow}>
            <T variant="subtitle" numberOfLines={1} style={{ flexShrink: 1 }}>{slot.class_name || 'Kelas'}</T>
            {slot.jam_ke ? <T variant="small" tone="muted">· Jam ke-{slot.jam_ke}</T> : null}
          </View>
          <T tone="secondary" numberOfLines={1}>{slot.subject_name || '-'}</T>
          {slot.room_name ? (
            <View style={styles.meta}>
              <Icon name="location-outline" size={14} color={colors.muted} />
              <T variant="caption" tone="muted">Ruang {slot.room_name}</T>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.badges}>
        {slot.is_substitute ? <Badge label="Guru Pengganti" icon="swap-horizontal" tone="warning" small /> : null}
        <Badge label={STATUS_LABEL[status]} tone={status === 'ongoing' ? 'brand' : 'neutral'} small />
        {filled ? <Badge label="Jurnal terisi" icon="checkmark-circle" tone="success" small />
          : queued ? <Badge label="Menunggu dikirim" icon="cloud-upload-outline" tone="warning" small />
          : status !== 'upcoming' ? <Badge label="Jurnal belum diisi" icon="alert-circle-outline" tone="error" small /> : null}
      </View>

      {slot.is_substitute ? (
        <T variant="caption" tone="secondary" style={styles.note}>
          Menggantikan <T variant="caption" weight="semibold">{slot.original_teacher_name || 'guru'}</T>
          {slot.reason ? ` · ${slot.reason}` : ''}
        </T>
      ) : null}
      {slot.substitute ? (
        <View style={[styles.replaced, { backgroundColor: colors.warningSoft }]}>
          <Icon name="swap-horizontal" size={16} color={colors.onWarning} />
          <T variant="caption" color={colors.onWarning} style={{ flex: 1 }}>
            Digantikan {slot.substitute.substitute_teacher_name || 'guru pengganti'} · jurnal pengganti {slot.substitute.journal_filled ? 'terisi' : 'belum diisi'}
          </T>
        </View>
      ) : null}

      {action && !filled ? (
        <Button title={action.label} icon={action.icon} variant={action.variant ?? 'primary'} size="sm" onPress={action.onPress} style={{ marginTop: spacing.md }} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderLeftWidth: 4, gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  time: { width: 64, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  note: { marginTop: 2 },
  replaced: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.sm },
});
