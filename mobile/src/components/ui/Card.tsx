import React from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { radius, shadow, spacing, useTheme } from '@/theme';

type Props = ViewProps & { onPress?: () => void; padded?: boolean; tone?: 'surface' | 'secondary' | 'brand' | 'warning' | 'error'; style?: StyleProp<ViewStyle> };

/** Kartu dasar: sudut 12, bayangan tipis (tier 1), warna dari tema. */
export function Card({ onPress, padded = true, tone = 'surface', style, children, ...rest }: Props) {
  const { colors } = useTheme();
  const bg = {
    surface: colors.surface,
    secondary: colors.surfaceSecondary,
    brand: colors.brandTertiary,
    warning: colors.warningSoft,
    error: colors.errorSoft,
  }[tone];
  const base = [styles.card, { backgroundColor: bg, borderColor: colors.border }, padded && styles.padded, style];
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.9 }]} {...(rest as any)}>
        {children}
      </Pressable>
    );
  }
  return <View style={base} {...rest}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, ...shadow.card },
  padded: { padding: spacing.lg },
});
