import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { spacing, useTheme } from '@/theme';
import { T } from './Text';
import { Icon, IconName } from './Icon';

/** Baris menu (pengaturan/profil): ikon, judul, keterangan, panah/aksesori kanan. */
export function ListItem({ icon, title, subtitle, onPress, right, danger, last, iconBg }: {
  icon?: IconName; title: string; subtitle?: string | null; onPress?: () => void; right?: React.ReactNode; danger?: boolean; last?: boolean; iconBg?: string;
}) {
  const { colors } = useTheme();
  const fg = danger ? colors.error : colors.onSurface;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: colors.divider, opacity: pressed ? 0.7 : 1 }, last && { borderBottomWidth: 0 }]}
    >
      {icon ? (
        <View style={[styles.icon, { backgroundColor: iconBg ?? (danger ? colors.errorSoft : colors.brandTertiary) }]}>
          <Icon name={icon} size={20} color={danger ? colors.error : colors.onBrandTertiary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T weight="medium" color={fg}>{title}</T>
        {subtitle ? <T variant="caption" tone="muted" numberOfLines={2}>{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-forward" size={18} color={colors.muted} /> : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
