import React from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing, useTheme } from '@/theme';
import { useNetwork } from '@/store/network';
import { formatDateTime } from '@/utils/time';
import { T } from './ui/Text';
import { Icon } from './ui/Icon';

/** Banner "Mode offline — data terakhir diperbarui …" (di bawah header, mendorong konten). */
export function OfflineBanner({ updatedAt, fromCache }: { updatedAt?: string | null; fromCache?: boolean }) {
  const { colors } = useTheme();
  const { online } = useNetwork();
  if (online && !fromCache) return null;
  const label = updatedAt ? `data terakhir diperbarui ${formatDateTime(updatedAt)}` : 'belum ada data tersimpan';
  return (
    <View style={[styles.banner, { backgroundColor: colors.warning }]} accessibilityLiveRegion="polite">
      <Icon name="cloud-offline" size={16} color={colors.onWarning} />
      <T variant="caption" weight="semibold" color={colors.onWarning} style={{ flex: 1 }} numberOfLines={2}>
        {online ? `Menampilkan data tersimpan — ${label}` : `Mode offline — ${label}`}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
