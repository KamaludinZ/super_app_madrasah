import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { radius, spacing, useTheme } from '@/theme';
import { T } from './Text';
import { Icon, IconName } from './Icon';

export type BadgeTone = 'brand' | 'warning' | 'success' | 'error' | 'neutral' | 'inverse';

export function Badge({ label, tone = 'neutral', icon, style, small }: { label: string; tone?: BadgeTone; icon?: IconName; style?: ViewStyle; small?: boolean }) {
  const { colors } = useTheme();
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    brand: { bg: colors.brandTertiary, fg: colors.onBrandTertiary },
    warning: { bg: colors.warning, fg: colors.onWarning },
    success: { bg: colors.success, fg: colors.onSuccess },
    error: { bg: colors.errorSoft, fg: colors.error },
    neutral: { bg: colors.surfaceTertiary, fg: colors.onSurfaceTertiary },
    inverse: { bg: colors.surfaceInverse, fg: colors.onSurfaceInverse },
  };
  const c = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }, small && styles.small, style]}>
      {icon ? <Icon name={icon} size={small ? 11 : 13} color={c.fg} /> : null}
      <T variant={small ? 'small' : 'label'} weight="semibold" color={c.fg} numberOfLines={1}>{label}</T>
    </View>
  );
}

/** Titik angka untuk badge belum dibaca pada ikon tab. */
export function CountDot({ count }: { count: number }) {
  const { colors } = useTheme();
  if (!count) return null;
  return (
    <View style={[styles.dot, { backgroundColor: colors.error, borderColor: colors.surface }]}>
      <T variant="small" weight="bold" color={colors.onError}>{count > 99 ? '99+' : String(count)}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start',
  },
  small: { paddingHorizontal: 6, paddingVertical: 2 },
  dot: {
    position: 'absolute', top: -4, right: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2,
  },
});
