import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { radius, spacing, useTheme } from '@/theme';
import { T } from './Text';

export type Segment<V extends string> = { value: V; label: string; tone?: 'brand' | 'warning' | 'success' | 'error' };

export function SegmentedControl<V extends string>({ segments, value, onChange, style, small }: {
  segments: Segment<V>[]; value: V; onChange: (v: V) => void; style?: ViewStyle; small?: boolean;
}) {
  const { colors } = useTheme();
  const toneBg = (t?: Segment<V>['tone']) =>
    t === 'warning' ? colors.warning : t === 'error' ? colors.error : t === 'success' ? colors.success : colors.brandPrimary;
  const toneFg = (t?: Segment<V>['tone']) => (t === 'warning' ? colors.onWarning : colors.onBrandPrimary);
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surfaceTertiary }, small && styles.small, style]} accessibilityRole="tablist">
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <Pressable
            key={s.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(s.value)}
            style={[styles.seg, small && styles.segSmall, active && { backgroundColor: toneBg(s.tone) }]}
          >
            <T variant={small ? 'small' : 'label'} weight="semibold" color={active ? toneFg(s.tone) : colors.onSurfaceSecondary} numberOfLines={1}>
              {s.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3 },
  small: { borderRadius: radius.sm, padding: 2, gap: 2 },
  seg: { flex: 1, minHeight: 40, borderRadius: radius.md - 3, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  segSmall: { minHeight: 32, borderRadius: radius.sm - 1, paddingHorizontal: 6 },
});
