import React from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { radius, spacing, useTheme } from '@/theme';
import { T } from './Text';
import { Icon, IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'warning';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style'> & {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  style?: ViewStyle;
  /** Warna teks & ikon khusus (mis. tombol di atas latar gelap). */
  textColor?: string;
};

export function Button({ title, variant = 'primary', size = 'md', loading, icon, iconRight, fullWidth, style, textColor, disabled, onPress, ...rest }: ButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;
  const bg: Record<Variant, string> = {
    primary: colors.brandPrimary,
    secondary: colors.brandTertiary,
    outline: 'transparent',
    ghost: 'transparent',
    danger: colors.error,
    warning: colors.warning,
  };
  const fg: Record<Variant, string> = {
    primary: colors.onBrandPrimary,
    secondary: colors.onBrandTertiary,
    outline: colors.brandPrimary,
    ghost: colors.brandPrimary,
    danger: colors.onError,
    warning: colors.onWarning,
  };
  if (textColor) fg[variant] = textColor;
  const heights: Record<Size, number> = { sm: 40, md: 48, lg: 54 };
  const textVariant = size === 'sm' ? 'label' : 'subtitle';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      onPress={(e) => {
        if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        { height: heights[size], backgroundColor: bg[variant], borderColor: variant === 'outline' ? colors.brandPrimary : 'transparent', opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1 },
        variant === 'outline' && { borderWidth: 1.5 },
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={fg[variant]} /> : null}
          <T variant={textVariant} weight="semibold" color={fg[variant]} numberOfLines={1}>{title}</T>
          {iconRight ? <Icon name={iconRight} size={size === 'sm' ? 16 : 20} color={fg[variant]} /> : null}
        </View>
      )}
    </Pressable>
  );
}

/** Tombol ikon bulat (44x44) untuk header/aksi kecil. */
export function IconButton({ name, onPress, color, bg, size = 22, accessibilityLabel, style }: {
  name: IconName; onPress?: () => void; color?: string; bg?: string; size?: number; accessibilityLabel?: string; style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, { backgroundColor: bg ?? 'transparent', opacity: pressed ? 0.7 : 1 }, style]}
    >
      <Icon name={name} size={size} color={color ?? colors.onSurface} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
