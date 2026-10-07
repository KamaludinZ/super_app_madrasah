/**
 * Absensi siswa per jurnal: satu baris per siswa dengan pilihan H / S / I / A (default Hadir),
 * tombol "Semua hadir", dan ringkasan jumlah. Status memakai ejaan baku backend ('alpa').
 */
import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { AttendanceStatus, Student } from '@/api/types';
import { radius, spacing, useTheme } from '@/theme';
import { T } from './ui/Text';
import { Card } from './ui/Card';

export type AttendanceMap = Record<string, AttendanceStatus>;

const OPTIONS: { value: AttendanceStatus; short: string; label: string }[] = [
  { value: 'hadir', short: 'H', label: 'Hadir' },
  { value: 'sakit', short: 'S', label: 'Sakit' },
  { value: 'izin', short: 'I', label: 'Izin' },
  { value: 'alpa', short: 'A', label: 'Alpa' },
];

export function summarize(students: Student[], map: AttendanceMap) {
  const c = { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
  for (const s of students) c[map[s.id] ?? 'hadir'] += 1;
  return c;
}

export function AttendanceList({ students, value, onChange }: { students: Student[]; value: AttendanceMap; onChange: (m: AttendanceMap) => void }) {
  const { colors } = useTheme();
  const counts = useMemo(() => summarize(students, value), [students, value]);
  const setOne = (id: string, st: AttendanceStatus) => onChange({ ...value, [id]: st });

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={styles.summary}>
        {OPTIONS.map((o) => (
          <View key={o.value} style={[styles.sumItem, { backgroundColor: toneBg(colors, o.value) }]}>
            <T variant="subtitle" color={toneFg(colors, o.value)}>{counts[o.value]}</T>
            <T variant="small" color={toneFg(colors, o.value)}>{o.label}</T>
          </View>
        ))}
      </View>
      <View style={styles.bulk}>
        <T variant="caption" tone="muted" style={{ flex: 1 }}>{students.length} siswa · default hadir</T>
        <T variant="label" tone="brand" onPress={() => onChange({})} accessibilityRole="button">Semua hadir</T>
      </View>
      <Card padded={false}>
        {students.map((s, i) => (
          <Row key={s.id} index={i + 1} student={s} status={value[s.id] ?? 'hadir'} onSet={setOne} last={i === students.length - 1} />
        ))}
      </Card>
    </View>
  );
}

const Row = memo(function Row({ index, student, status, onSet, last }: {
  index: number; student: Student; status: AttendanceStatus; onSet: (id: string, s: AttendanceStatus) => void; last: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.divider }, last && { borderBottomWidth: 0 }]}>
      <T variant="caption" tone="muted" style={styles.no}>{index}</T>
      <T style={{ flex: 1 }} numberOfLines={2}>{student.full_name}</T>
      <View style={styles.opts} accessibilityRole="radiogroup" accessibilityLabel={`Kehadiran ${student.full_name}`}>
        {OPTIONS.map((o) => {
          const active = status === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={o.label}
              onPress={() => onSet(student.id, o.value)}
              hitSlop={4}
              style={[styles.opt, { backgroundColor: active ? toneFg(colors, o.value) : colors.surfaceSecondary, borderColor: active ? toneFg(colors, o.value) : colors.border }]}
            >
              <T variant="label" weight="bold" color={active ? '#FFFFFF' : colors.onSurfaceSecondary}>{o.short}</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

function toneFg(c: ReturnType<typeof useTheme>['colors'], s: AttendanceStatus) {
  return s === 'hadir' ? c.success : s === 'sakit' ? '#B7791F' : s === 'izin' ? '#2B6CB0' : c.error;
}
function toneBg(c: ReturnType<typeof useTheme>['colors'], s: AttendanceStatus) {
  return s === 'hadir' ? c.brandTertiary : s === 'alpa' ? c.errorSoft : c.surfaceTertiary;
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: spacing.sm },
  sumItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
  bulk: { flexDirection: 'row', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  no: { width: 22, textAlign: 'right' },
  opts: { flexDirection: 'row', gap: 6 },
  opt: { width: 36, height: 36, borderRadius: radius.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
