import React from 'react';
import { StyleSheet, Text, TextProps, TextStyle } from 'react-native';
import { fonts, fontSize, useTheme } from '@/theme';

type Variant = 'hero' | 'title' | 'heading' | 'subtitle' | 'body' | 'caption' | 'label' | 'small';
type Weight = 'regular' | 'medium' | 'semibold' | 'bold';
type Tone = 'default' | 'secondary' | 'muted' | 'brand' | 'inverse' | 'error' | 'success' | 'warning' | 'onBrand';

export type TProps = TextProps & {
  variant?: Variant;
  weight?: Weight;
  tone?: Tone;
  center?: boolean;
  color?: string;
};

const variants: Record<Variant, { size: number; weight: Weight; line: number }> = {
  hero: { size: fontSize.hero, weight: 'bold', line: 36 },
  title: { size: fontSize.xxl, weight: 'bold', line: 30 },
  heading: { size: fontSize.xl, weight: 'semibold', line: 26 },
  subtitle: { size: fontSize.lg, weight: 'semibold', line: 22 },
  body: { size: fontSize.base, weight: 'regular', line: 20 },
  label: { size: fontSize.sm, weight: 'medium', line: 16 },
  caption: { size: fontSize.sm, weight: 'regular', line: 16 },
  small: { size: fontSize.xs, weight: 'regular', line: 14 },
};

/** Komponen teks standar aplikasi (font Plus Jakarta Sans, warna dari tema). */
export function T({ variant = 'body', weight, tone = 'default', center, color, style, ...rest }: TProps) {
  const { colors } = useTheme();
  const v = variants[variant];
  const w = weight ?? v.weight;
  const toneColor: Record<Tone, string> = {
    default: colors.onSurface,
    secondary: colors.onSurfaceSecondary,
    muted: colors.muted,
    brand: colors.brandPrimary,
    inverse: colors.onSurfaceInverse,
    error: colors.error,
    success: colors.success,
    warning: colors.onWarning,
    onBrand: colors.onBrand,
  };
  const s: TextStyle = {
    fontFamily: fonts[w],
    fontSize: v.size,
    lineHeight: v.line,
    color: color ?? toneColor[tone],
    textAlign: center ? 'center' : undefined,
  };
  return <Text maxFontSizeMultiplier={1.4} {...rest} style={[styles.base, s, style]} />;
}

const styles = StyleSheet.create({ base: { includeFontPadding: false } });
