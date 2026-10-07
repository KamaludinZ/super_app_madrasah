/** Kotak pemberitahuan ringkas (peringatan/galat/sukses) dengan ikon. */
import React from 'react';
import { StyleSheet } from 'react-native';
import { spacing, useTheme } from '@/theme';
import { Card } from './Card';
import { Icon, IconName } from './Icon';
import { T } from './Text';

export function Notice({ tone, icon, text }: { tone: 'warning' | 'error' | 'success'; icon: IconName; text: string }) {
  const { colors } = useTheme();
  const fg = tone === 'warning' ? colors.onWarning : tone === 'error' ? colors.error : colors.success;
  return (
    <Card tone={tone === 'success' ? 'surface' : tone} padded style={styles.notice}>
      <Icon name={icon} size={18} color={fg} />
      <T variant="caption" color={fg} style={{ flex: 1 }}>{text}</T>
    </Card>
  );
}

const styles = StyleSheet.create({
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md },
});
