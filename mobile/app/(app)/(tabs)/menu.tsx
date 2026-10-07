/**
 * Menu: semua fitur peran aktif, sama persis dengan menu web (dikelompokkan seperti sidebar web).
 * Item bertanda "Aplikasi" dibuka sebagai layar native; lainnya di modul web (sudah masuk).
 * Pencarian menyaring seluruh menu; grup bisa dilipat.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { MenuItem, useRoleMenu, webHref } from '@/menu';
import { roleLabel } from '@/utils/roles';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/States';

export default function MenuScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { activeRole } = useAuth();
  const { online } = useNetwork();
  const groups = useRoleMenu();
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => `${i.label} ${g.title ?? ''}`.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length);
  }, [groups, query]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  const open = (i: MenuItem) => router.push(i.href as any);

  return (
    <Screen title="Menu" subtitle={`${roleLabel(activeRole)} · ${total} fitur`} headerTone="brand">
      <Input icon="search" placeholder="Cari fitur…" value={query} onChangeText={setQuery} />
      {!online ? (
        <Card tone="warning" style={[styles.row, { marginTop: spacing.md }]}>
          <Icon name="cloud-offline-outline" size={18} color={colors.onWarning} />
          <T variant="caption" color={colors.onWarning} style={{ flex: 1 }}>Offline — menu bertanda “Web” memerlukan internet. Menu “Aplikasi” tetap bisa dipakai.</T>
        </Card>
      ) : null}

      {filtered.length === 0 ? (
        <Card style={{ marginTop: spacing.md }}><EmptyState icon="search-outline" title="Fitur tidak ditemukan" message="Coba kata kunci lain." compact /></Card>
      ) : filtered.map((g, gi) => {
        const key = g.title ?? `utama-${gi}`;
        const isCollapsed = !query && collapsed[key];
        return (
          <View key={key} style={{ marginTop: spacing.lg }}>
            {g.title ? (
              <Pressable onPress={() => setCollapsed((c) => ({ ...c, [key]: !c[key] }))} style={styles.groupHead} accessibilityRole="button" accessibilityState={{ expanded: !isCollapsed }}>
                <T variant="label" weight="semibold" tone="muted" style={{ flex: 1 }}>{g.title.toUpperCase()}</T>
                <T variant="small" tone="muted">{g.items.length}</T>
                <Icon name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={16} color={colors.muted} />
              </Pressable>
            ) : null}
            {!isCollapsed ? (
              <View style={styles.grid}>
                {g.items.map((i) => (
                  <Pressable
                    key={i.key}
                    onPress={() => open(i)}
                    accessibilityRole="button"
                    accessibilityLabel={i.label}
                    style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: i.highlight ? colors.brandPrimary : colors.border, opacity: pressed ? 0.75 : 1 }]}
                  >
                    <View style={[styles.tileIcon, { backgroundColor: i.highlight ? colors.brandPrimary : colors.brandTertiary }]}>
                      <Icon name={i.icon} size={22} color={i.highlight ? colors.onBrandPrimary : colors.onBrandTertiary} />
                    </View>
                    <T variant="caption" weight="medium" center numberOfLines={2} style={{ minHeight: 32 }}>{i.label}</T>
                    {i.native ? <Badge label="Aplikasi" tone="brand" small /> : null}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}

      <Card onPress={() => router.push(webHref('/dashboard', 'Dashboard Web') as any)} style={[styles.row, { marginTop: spacing.xl }]}>
        <Icon name="desktop-outline" size={20} color={colors.brandPrimary} />
        <View style={{ flex: 1 }}>
          <T weight="semibold">Dashboard lengkap</T>
          <T variant="caption" tone="muted">Ringkasan & grafik seperti di versi web</T>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, minHeight: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '31.5%', alignItems: 'center', gap: 6, paddingVertical: spacing.md, paddingHorizontal: 6, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  tileIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
