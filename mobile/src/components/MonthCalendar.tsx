/**
 * Kalender bulanan (minggu dimulai Senin). Tampilan tiap tanggal ditentukan `dayProps`:
 * dapat dipilih/terpilih/nonaktif, titik penanda, dan angka kecil (mis. jumlah penugasan).
 * Dipakai di langkah pilih tanggal penugasan guru pengganti dan kalender penugasan.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, spacing, useTheme } from '@/theme';
import { monthLabel, monthRange, todayISO, wibParts } from '@/utils/time';
import { IconButton } from './ui/Button';
import { T } from './ui/Text';

export type DayProps = {
  /** Tidak bisa diketuk (tampil pudar). */
  disabled?: boolean;
  /** Tampil terisi warna utama. */
  selected?: boolean;
  /** Bisa dipilih (diberi garis tepi). */
  selectable?: boolean;
  /** Titik penanda di bawah angka. */
  dot?: 'brand' | 'warning' | 'error' | 'success' | null;
  /** Angka kecil di pojok (mis. jumlah penugasan). */
  count?: number;
  /** Label aksesibilitas tambahan (mis. alasan tidak bisa dipilih). */
  hint?: string | null;
};

const WEEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

export function MonthCalendar({ month, onMonthChange, canPrev = true, canNext = true, dayProps, onPressDay, loading }: {
  month: string;
  onMonthChange: (delta: -1 | 1) => void;
  canPrev?: boolean;
  canNext?: boolean;
  dayProps: (iso: string) => DayProps;
  onPressDay?: (iso: string) => void;
  loading?: boolean;
}) {
  const { colors } = useTheme();
  const { days } = monthRange(month);
  const firstWeekday = wibParts(`${month}-01`).weekday; // 0 = Minggu
  const lead = (firstWeekday + 6) % 7; // kolom kosong sebelum tanggal 1 (Senin = 0)
  const today = todayISO();

  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`),
  ];
  while (cells.length % 7) cells.push(null);

  const dotColor = (d: DayProps['dot']) =>
    d === 'warning' ? colors.warning : d === 'error' ? colors.error : d === 'success' ? colors.success : colors.brandPrimary;

  return (
    <View>
      <View style={styles.head}>
        <IconButton name="chevron-back" accessibilityLabel="Bulan sebelumnya" onPress={() => canPrev && onMonthChange(-1)}
          color={canPrev ? colors.onSurface : colors.border} />
        <T variant="subtitle" style={{ opacity: loading ? 0.5 : 1 }}>{monthLabel(month)}</T>
        <IconButton name="chevron-forward" accessibilityLabel="Bulan berikutnya" onPress={() => canNext && onMonthChange(1)}
          color={canNext ? colors.onSurface : colors.border} />
      </View>
      <View style={styles.row}>
        {WEEK.map((w, i) => (
          <View key={w} style={styles.cell}>
            <T variant="small" weight="semibold" color={i === 6 ? colors.error : colors.muted}>{w}</T>
          </View>
        ))}
      </View>
      {Array.from({ length: cells.length / 7 }, (_, r) => (
        <View key={r} style={styles.row}>
          {cells.slice(r * 7, r * 7 + 7).map((iso, c) => {
            if (!iso) return <View key={`e${c}`} style={styles.cell} />;
            const p = dayProps(iso);
            const isToday = iso === today;
            const bg = p.selected ? colors.brandPrimary : 'transparent';
            const fg = p.selected ? colors.onBrandPrimary : p.disabled ? colors.border : c === 6 ? colors.error : colors.onSurface;
            return (
              <View key={iso} style={styles.cell}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !!p.disabled || !onPressDay, selected: !!p.selected }}
                  accessibilityLabel={`${parseInt(iso.slice(8), 10)}${p.hint ? `, ${p.hint}` : ''}`}
                  disabled={p.disabled || !onPressDay}
                  onPress={() => onPressDay?.(iso)}
                  style={({ pressed }) => [
                    styles.day,
                    { backgroundColor: bg, opacity: pressed ? 0.7 : 1 },
                    p.selectable && !p.selected && { borderWidth: 1.5, borderColor: colors.brandPrimary },
                    isToday && !p.selected && !p.selectable && { borderWidth: 1, borderColor: colors.borderStrong },
                  ]}
                >
                  <T weight={p.selected || isToday ? 'bold' : 'medium'} color={fg}>{parseInt(iso.slice(8), 10)}</T>
                  {p.dot ? <View style={[styles.dot, { backgroundColor: p.selected ? colors.onBrandPrimary : dotColor(p.dot) }]} /> : null}
                  {p.count ? (
                    <View style={[styles.count, { backgroundColor: p.selected ? colors.onBrandPrimary : colors.brandPrimary }]}>
                      <T variant="small" weight="bold" color={p.selected ? colors.brandPrimary : colors.onBrandPrimary} style={{ fontSize: 10, lineHeight: 13 }}>{p.count}</T>
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  day: { width: 42, height: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, position: 'absolute', bottom: 5 },
  count: { position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
});
