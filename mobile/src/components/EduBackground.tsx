/**
 * Latar khas aplikasi: gradasi hijau madrasah + motif "pendidikan modern" (buku, toga, atom,
 * laptop, rumus, roket… — assets/images/edu-pattern.png, dibuat scripts/generate-edu-pattern.py)
 * + dua cahaya lembut. Dipakai di layar pembuka, login, lupa password, dan layar kunci.
 */
import React from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const EDU_GREEN = '#006837';
const GRADIENT = ['#00843F', EDU_GREEN, '#004A27'] as const;

type Props = {
  children?: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Opasitas motif (0–1). Bisa Animated.Value untuk efek muncul perlahan. */
  patternOpacity?: number | Animated.Value | Animated.AnimatedInterpolation<number>;
};

export function EduBackground({ children, style, patternOpacity = 0.13 }: Props) {
  return (
    <View style={[styles.root, style]}>
      <LinearGradient colors={GRADIENT} locations={[0, 0.5, 1]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.glow, styles.glowTop]} pointerEvents="none" />
      <View style={[styles.glow, styles.glowBottom]} pointerEvents="none" />
      <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.Image
          source={require('../../assets/images/edu-pattern.png')}
          style={[styles.pattern, { opacity: patternOpacity }]}
          resizeMode="cover"
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: EDU_GREEN, overflow: 'hidden' },
  pattern: { width: '100%', height: '100%' },
  glow: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  glowTop: { width: 420, height: 420, top: -160, right: -140 },
  glowBottom: { width: 360, height: 360, bottom: -150, left: -130, backgroundColor: 'rgba(255,214,0,0.05)' },
});
