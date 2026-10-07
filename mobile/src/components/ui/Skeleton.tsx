import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { radius, spacing, useTheme } from '@/theme';

export function Skeleton({ width = '100%', height = 16, style, round }: { width?: number | `${number}%`; height?: number; style?: ViewStyle; round?: boolean }) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  }, [opacity]);
  const anim = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width, height, borderRadius: round ? height / 2 : radius.sm, backgroundColor: colors.skeleton }, anim, style]} />;
}

/** Kerangka kartu jadwal (dipakai saat memuat). */
export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Skeleton width={56} height={40} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="70%" height={14} />
          {Array.from({ length: lines - 1 }).map((_, i) => <Skeleton key={i} width="45%" height={12} />)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
});
