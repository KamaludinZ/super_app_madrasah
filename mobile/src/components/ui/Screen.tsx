import React, { useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { spacing, useTheme } from '@/theme';
import { T } from './Text';
import { IconButton } from './Button';
import { OfflineBanner } from '../OfflineBanner';
import { useKeyboardAwareScroll } from '@/hooks/useKeyboardAwareScroll';

type Props = {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
  /** Gunakan ScrollView dengan tarik-untuk-segarkan. Bila false, children mengisi flex (mis. FlatList). */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  /** Banner offline/cache di bawah header. */
  offline?: { fromCache?: boolean; updatedAt?: string | null } | false;
  footer?: React.ReactNode;
  headerTone?: 'surface' | 'brand';
  contentStyle?: ViewStyle;
};

/** Kerangka layar: area aman, header, banner offline, konten, footer lengket. */
export function Screen({ title, subtitle, back, right, children, scroll = true, refreshing, onRefresh, padded = true, offline, footer, headerTone = 'surface', contentStyle }: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const brandHeader = headerTone === 'brand';
  const headerBg = brandHeader ? colors.brand : colors.surface;
  const headerFg = brandHeader ? colors.onBrand : colors.onSurface;
  const scrollRef = useRef<ScrollView>(null);
  const kb = useKeyboardAwareScroll(scrollRef);

  const content = scroll ? (
    <ScrollView
      ref={scrollRef}
      onScroll={kb.onScroll}
      scrollEventThrottle={32}
      style={{ flex: 1 }}
      contentContainerStyle={[padded && styles.padded, { paddingBottom: kb.keyboardHeight ? kb.keyboardHeight + spacing.xl : footer ? spacing.md : insets.bottom + spacing.xl }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && styles.padded, contentStyle]}>{children}</View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.surfaceSecondary }]}>
      <StatusBar style={brandHeader || isDark ? 'light' : 'dark'} />
      {(title || back || right) ? (
        <View style={[styles.header, { paddingTop: insets.top + spacing.sm, backgroundColor: headerBg, borderBottomColor: brandHeader ? headerBg : colors.border }]}>
          {back ? <IconButton name="arrow-back" accessibilityLabel="Kembali" color={headerFg} onPress={() => (router.canGoBack() ? router.back() : router.replace('/(app)/(tabs)' as any))} /> : <View style={{ width: spacing.xs }} />}
          <View style={styles.titleWrap}>
            {title ? <T variant="heading" color={headerFg} numberOfLines={1}>{title}</T> : null}
            {subtitle ? <T variant="caption" color={brandHeader ? headerFg : colors.muted} numberOfLines={1}>{subtitle}</T> : null}
          </View>
          <View style={styles.right}>{right}</View>
        </View>
      ) : (
        <View style={{ height: insets.top, backgroundColor: headerBg }} />
      )}
      {offline ? <OfflineBanner fromCache={offline.fromCache} updatedAt={offline.updatedAt} /> : null}
      {content}
      {footer ? (
        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + spacing.md }]}>{footer}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56,
  },
  titleWrap: { flex: 1, paddingHorizontal: spacing.xs },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minWidth: 44, justifyContent: 'flex-end' },
  padded: { padding: spacing.lg },
  footer: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
});
