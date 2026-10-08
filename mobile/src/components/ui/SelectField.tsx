/**
 * Kolom pilihan tunggal: tampil seperti Input; ketuk → lembar bawah (Modal) berisi pencarian,
 * opsi "Tidak memilih" (bila allowNone), dan daftar pilihan dengan keterangan.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, useTheme } from '@/theme';
import { T } from './Text';
import { Icon, IconName } from './Icon';
import { Input } from './Input';

export type SelectOption = { value: string; label: string; description?: string | null };

export function SelectField({ label, value, options, onChange, placeholder = 'Pilih…', allowNone = true, noneLabel = 'Tidak memilih', icon, hint }: {
  label: string;
  value: string | null;
  options: SelectOption[];
  onChange: (v: string | null) => void;
  placeholder?: string;
  allowNone?: boolean;
  noneLabel?: string;
  icon?: IconName;
  hint?: string | null;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.value === value) ?? null;
  const list = useMemo(() => {
    const n = q.trim().toLowerCase();
    return n ? options.filter((o) => `${o.label} ${o.description ?? ''}`.toLowerCase().includes(n)) : options;
  }, [options, q]);

  const pick = (v: string | null) => { onChange(v); setOpen(false); setQ(''); };

  return (
    <View style={{ gap: 6 }}>
      <T variant="label" tone="secondary">{label}</T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}`}
        onPress={() => { Keyboard.dismiss(); setOpen(true); }}
        style={({ pressed }) => [styles.field, { borderColor: colors.borderStrong, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 }]}
      >
        {icon ? <Icon name={icon} size={18} color={colors.muted} /> : null}
        <T numberOfLines={2} style={{ flex: 1 }} tone={selected ? 'default' : 'muted'}>{selected?.label ?? placeholder}</T>
        <Icon name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      {hint ? <T variant="caption" tone="muted">{hint}</T> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Tutup pilihan" />
        <View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.md }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <T variant="subtitle" style={{ marginBottom: spacing.sm }}>{label}</T>
          {options.length > 6 ? <Input icon="search" placeholder="Cari…" value={q} onChangeText={setQ} containerStyle={{ marginBottom: spacing.sm }} /> : null}
          <FlatList
            data={list}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={allowNone ? (
              <Row label={noneLabel} selected={!value} onPress={() => pick(null)} muted />
            ) : null}
            renderItem={({ item }) => <Row label={item.label} description={item.description} selected={item.value === value} onPress={() => pick(item.value)} />}
            ListEmptyComponent={<T tone="muted" center style={{ padding: spacing.lg }}>Tidak ada pilihan yang cocok.</T>}
            style={{ maxHeight: 420 }}
          />
        </View>
      </Modal>
    </View>
  );
}

function Row({ label, description, selected, onPress, muted }: { label: string; description?: string | null; selected: boolean; onPress: () => void; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.divider, backgroundColor: selected ? colors.brandTertiary : 'transparent', opacity: pressed ? 0.7 : 1 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T weight={selected ? 'semibold' : 'regular'} tone={muted ? 'muted' : 'default'}>{label}</T>
        {description ? <T variant="caption" tone="muted" numberOfLines={2}>{description}</T> : null}
      </View>
      {selected ? <Icon name="checkmark" size={20} color={colors.brandPrimary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm },
});
