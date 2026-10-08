/**
 * Komponen bersama layar pemantauan Kepala Madrasah: pemilih bulan, kotak hitungan status,
 * baris persentase dengan bilah, dan kolom pencarian sederhana.
 */
import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { addMonths, monthLabel, monthOf, todayISO } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { T } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { IconButton } from '@/components/ui/Button';

/** Bulan berjalan (YYYY-MM, WIB) dan pemecahnya. */
export const bulanIni = () => monthOf(todayISO());
export const pecahBulan = (month: string) => {
  const [y, m] = month.split('-').map((x) => parseInt(x, 10));
  return { y, m };
};

export function MonthBar({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const { colors } = useTheme();
  const max = bulanIni();
  return (
    <View style={styles.monthBar}>
      <IconButton name="chevron-back" accessibilityLabel="Bulan sebelumnya" onPress={() => onChange(addMonths(month, -1))} color={colors.onSurface} />
      <T variant="subtitle">{monthLabel(month)}</T>
      <IconButton name="chevron-forward" accessibilityLabel="Bulan berikutnya" onPress={() => month < max && onChange(addMonths(month, 1))}
        color={month < max ? colors.onSurface : colors.border} />
    </View>
  );
}

/** Warna persentase kehadiran: belum ada data → netral. */
export function usePctColor() {
  const { colors } = useTheme();
  return (pct: number | null | undefined, ada = true) =>
    !ada || pct == null ? colors.muted : pct >= 90 ? colors.success : pct >= 75 ? colors.warning : colors.error;
}

export type Hitung = { label: string; value: number; color?: string };
export function Counts({ items }: { items: Hitung[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.counts}>
      {items.map((c) => (
        <View key={c.label} style={[styles.count, { backgroundColor: colors.surfaceSecondary }]}>
          <T variant="subtitle" color={c.color}>{c.value}</T>
          <T variant="small" tone="muted" numberOfLines={1}>{c.label}</T>
        </View>
      ))}
    </View>
  );
}

/** Baris nama + persentase + bilah; dipakai untuk rekap kelas, guru, GTK. */
export function PctRow({ title, subtitle, pct, ada = true, right }: { title: string; subtitle?: string | null; pct: number | null | undefined; ada?: boolean; right?: React.ReactNode }) {
  const { colors } = useTheme();
  const warna = usePctColor()(pct, ada);
  const lebar = ada && pct != null ? Math.max(0, Math.min(100, pct)) : 0;
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <T weight="medium" numberOfLines={1}>{title}</T>
          {subtitle ? <T variant="caption" tone="muted" numberOfLines={1}>{subtitle}</T> : null}
        </View>
        <T weight="bold" color={warna}>{ada && pct != null ? `${Math.round(pct)}%` : '—'}</T>
        {right}
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceSecondary }]}>
        <View style={[styles.fill, { width: `${lebar}%`, backgroundColor: warna }]} />
      </View>
    </View>
  );
}

/** Rincian hitungan per kategori sebagai bilah mendatar, urut terbanyak. */
export function Bars({ data, max = 8, label }: { data: Record<string, number> | { label: string; value: number }[]; max?: number; label?: (k: string) => string }) {
  const { colors } = useTheme();
  const rows = (Array.isArray(data) ? data : Object.entries(data).map(([k, v]) => ({ label: label ? label(k) : k, value: v })))
    .filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, max);
  if (!rows.length) return <T variant="caption" tone="muted">Belum ada data.</T>;
  const top = rows[0].value || 1;
  return (
    <View style={{ gap: spacing.sm }}>
      {rows.map((r) => (
        <View key={r.label} style={{ gap: 4 }}>
          <View style={styles.row}>
            <T variant="caption" style={{ flex: 1 }} numberOfLines={1}>{r.label}</T>
            <T variant="caption" weight="semibold">{r.value}</T>
          </View>
          <View style={[styles.track, { backgroundColor: colors.surfaceSecondary }]}>
            <View style={[styles.fill, { width: `${(r.value / top) * 100}%`, backgroundColor: colors.brandPrimary }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Cari nama…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.search, { borderColor: colors.borderStrong, backgroundColor: colors.surface }]}>
      <Icon name="search-outline" size={18} color={colors.muted} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted}
        style={[styles.searchInput, { color: colors.onSurface }]} returnKeyType="search" autoCorrect={false} />
      {value ? <IconButton name="close-circle" accessibilityLabel="Hapus pencarian" onPress={() => onChange('')} color={colors.muted} /> : null}
    </View>
  );
}

export const cocok = (teks: string | null | undefined, q: string) => !q.trim() || (teks ?? '').toLowerCase().includes(q.trim().toLowerCase());

const styles = StyleSheet.create({
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counts: { flexDirection: 'row', gap: spacing.sm },
  count: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, paddingLeft: spacing.md, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: spacing.sm },
});
