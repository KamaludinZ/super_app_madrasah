import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { T } from './ui/Text';

/** Logo madrasah + nama aplikasi, dipakai di loading/login/lock screen. */
export function BrandLogo({ size = 96, showName = true, light }: { size?: number; showName?: boolean; light?: boolean }) {
  const { colors } = useTheme();
  const fg = light ? colors.onBrand : colors.onSurface;
  return (
    <View style={styles.wrap}>
      {/* Logo resmi MTsN 2 Kota Malang (sama dengan logo aplikasi web), warna asli tanpa tint. */}
      <Image
        source={require('../../assets/images/logo.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="Logo MTsN 2 Kota Malang"
        accessibilityIgnoresInvertColors
      />
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
  name: { alignItems: 'center', gap: 2 },
});
