/**
 * Kartu penugasan guru pengganti: tanggal & jam, kelas/mapel, guru digantikan → guru pengganti,
 * status jurnal (terisi / belum / terlewat) dan status batal.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { GPAssignment, GPJournalStatus } from '@/api/types';
import { formatDayShort } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Card } from './ui/Card';
import { T } from './ui/Text';
import { Badge, BadgeTone } from './ui/Badge';
import { Icon } from './ui/Icon';

export const JOURNAL_STATUS: Record<GPJournalStatus, { label: string; tone: BadgeTone; icon: React.ComponentProps<typeof Icon>['name'] }> = {
  filled: { label: 'Jurnal terisi', tone: 'success', icon: 'checkmark-circle-outline' },
  pending: { label: 'Belum diisi', tone: 'warning', icon: 'time-outline' },
  missing: { label: 'Jurnal terlewat', tone: 'error', icon: 'alert-circle-outline' },
};

export function AssignmentCard({ a, onPress, showDate = true }: { a: GPAssignment; onPress?: () => void; showDate?: boolean }) {
  const { colors } = useTheme();
  const cancelled = a.status === 'cancelled';
  const js = JOURNAL_STATUS[a.journal_status ?? 'pending'];
  return (
    <Card onPress={onPress} style={[styles.card, cancelled && { opacity: 0.6 }]}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <T variant="subtitle" numberOfLines={1}>{a.class_name} · {a.subject_name}</T>
          <T variant="caption" tone="muted">
            {showDate ? `${formatDayShort(a.date)} · ` : ''}{a.start_time ?? '--:--'}–{a.end_time ?? '--:--'}{a.jam_ke ? ` · Jam ke ${a.jam_ke}` : ''}
          </T>
        </View>
        {onPress ? <Icon name="chevron-forward" size={18} color={colors.muted} /> : null}
      </View>
      <View style={styles.people}>
        <View style={{ flex: 1 }}>
          <T variant="small" tone="muted">Digantikan</T>
          <T weight="medium" numberOfLines={1}>{a.original_teacher_name}</T>
        </View>
        <Icon name="arrow-forward" size={16} color={colors.muted} />
        <View style={{ flex: 1 }}>
          <T variant="small" color={colors.brandPrimary}>Guru pengganti</T>
          <T weight="semibold" numberOfLines={1}>{a.substitute_teacher_name}</T>
        </View>
      </View>
      <View style={styles.badges}>
        {cancelled ? <Badge label="Dibatalkan" icon="close-circle-outline" tone="neutral" small />
          : <Badge label={js.label} icon={js.icon} tone={js.tone} small />}
        {a.reason ? <Badge label={a.reason} icon="information-circle-outline" tone="neutral" small /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  people: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
