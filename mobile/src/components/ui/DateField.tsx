/**
 * Isian tanggal (YYYY-MM-DD): ketuk → lembar bawah berisi kalender bulanan (MonthCalendar, minggu mulai
 * Senin, zona WIB). Batas `min`/`max` opsional menonaktifkan tanggal di luar rentang.
 */
import React, { useState } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addMonths, formatDateLong, monthOf, todayISO } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { MonthCalendar } from '../MonthCalendar';
import { Button } from './Button';
import { Icon } from './Icon';
import { T } from './Text';

export function DateField({ label, value, onChange, min, max, placeholder = 'Pilih tanggal', allowClear, style }: {
  label: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  allowClear?: boolean;
  style?: object;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(monthOf(value || todayISO()));

  const show = () => { Keyboard.dismiss(); setMonth(monthOf(value || todayISO())); setOpen(true); };
  const pick = (iso: string) => { onChange(iso); setOpen(false); };

  return (
    <View style={[{ gap: 6 }, style]}>
      <T variant="label" tone="secondary">{label}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatDateLong(value) : placeholder}`} onPress={show}
        style={({ pressed }) => [styles.field, { borderColor: colors.borderStrong, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 }]}>
        <Icon name="calendar-outline" size={18} color={colors.muted} />
        <T numberOfLines={1} style={{ flex: 1 }} tone={value ? 'default' : 'muted'}>{value ? formatDateLong(value) : placeholder}</T>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Tutup kalender" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <T variant="subtitle" style={{ marginBottom: spacing.sm }}>{label}</T>
          <MonthCalendar
            month={month}
            onMonthChange={(d) => setMonth(addMonths(month, d))}
            canPrev={!min || addMonths(month, -1) >= monthOf(min)}
            canNext={!max || addMonths(month, 1) <= monthOf(max)}
            dayProps={(iso) => {
              const out = (min && iso < min) || (max && iso > max);
              return { disabled: !!out, selectable: !out, selected: iso === value, dot: iso === todayISO() ? 'brand' : null };
            }}
            onPressDay={pick}
          />
          <View style={styles.actions}>
            <Button title="Hari ini" variant="ghost" size="sm" onPress={() => pick(todayISO())}
              disabled={!!((min && todayISO() < min) || (max && todayISO() > max))} />
            {allowClear && value ? <Button title="Kosongkan" variant="ghost" size="sm" onPress={() => { onChange(null); setOpen(false); }} /> : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.md },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
});
