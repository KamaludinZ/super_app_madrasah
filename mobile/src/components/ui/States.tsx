import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { spacing, useTheme } from '@/theme';
import { T } from './Text';
import { Icon, IconName } from './Icon';
import { Button } from './Button';

type StateProps = { title: string; message?: string; icon?: IconName; actionLabel?: string; onAction?: () => void; compact?: boolean };

export function EmptyState({ title, message, icon = 'file-tray-outline', actionLabel, onAction, compact }: StateProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.brandTertiary }]}>
        <Icon name={icon} size={34} color={colors.onBrandTertiary} />
      </View>
      <T variant="subtitle" center style={styles.title}>{title}</T>
      {message ? <T tone="muted" center>{message}</T> : null}
      {actionLabel && onAction ? <Button title={actionLabel} variant="secondary" size="sm" onPress={onAction} style={styles.btn} /> : null}
    </View>
  );
}

export function ErrorState({ title = 'Gagal memuat data', message, onRetry, compact }: { title?: string; message?: string; onRetry?: () => void; compact?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, compact && styles.compact]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.errorSoft }]}>
        <Icon name="cloud-offline-outline" size={34} color={colors.error} />
      </View>
      <T variant="subtitle" center style={styles.title}>{title}</T>
      {message ? <T tone="muted" center>{message}</T> : null}
      {onRetry ? <Button title="Coba Lagi" icon="refresh" size="sm" onPress={onRetry} style={styles.btn} /> : null}
    </View>
  );
}

export function LoadingState({ message = 'Memuat…' }: { message?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={colors.brandPrimary} />
      <T tone="muted" style={styles.title}>{message}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, minHeight: 220 },
  compact: { minHeight: 140, padding: spacing.lg },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  title: { marginTop: spacing.xs },
  btn: { marginTop: spacing.md },
});
