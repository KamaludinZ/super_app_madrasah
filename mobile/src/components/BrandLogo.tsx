import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { T } from './ui/Text';

/** Logo aplikasi (lingkaran) + nama, dipakai di loading/onboarding/login/lock screen. */
export function BrandLogo({ size = 96, showName = true, light }: { size?: number; showName?: boolean; light?: boolean }) {
  const { colors } = useTheme();
  const fg = light ? colors.onBrand : colors.onSurface;
  return (
    <View style={styles.wrap}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: light ? 'rgba(255,255,255,0.14)' : colors.brandTertiary }]}>
        <Image source={require('../../assets/images/splash-icon.png')} style={{ width: size * 0.78, height: size * 0.78, tintColor: light ? undefined : colors.brandPrimary }} resizeMode="contain" accessibilityIgnoresInvertColors />
      </View>
      {showName ? (
        <View style={styles.name}>
          <T variant="small" weight="semibold" color={fg} style={{ letterSpacing: 2, opacity: 0.85 }}>SUPER APPS</T>
          <T variant="title" color={fg} center>MATSANDATAMA</T>
          <T variant="caption" color={fg} center style={{ opacity: 0.8 }}>MTsN 2 Kota Malang</T>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 16 },
  circle: { alignItems: 'center', justifyContent: 'center' },
  name: { alignItems: 'center', gap: 2 },
});
