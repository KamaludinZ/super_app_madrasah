/** Toast/banner dalam aplikasi (zustand). Pakai: toast.success('Tersimpan'). */
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { radius, shadow, spacing, useTheme } from '@/theme';
import { T } from './Text';
import { Icon, IconName } from './Icon';

type Kind = 'success' | 'error' | 'info' | 'warning';
type Item = { id: number; kind: Kind; title: string; message?: string; onPress?: () => void; duration: number };

type ToastStore = { items: Item[]; push: (i: Omit<Item, 'id'>) => void; remove: (id: number) => void };
let seq = 1;
export const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (i) => set((s) => ({ items: [...s.items.slice(-2), { ...i, id: seq++ }] })),
  remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
}));

const show = (kind: Kind) => (title: string, message?: string, opts: { duration?: number; onPress?: () => void } = {}) =>
  useToastStore.getState().push({ kind, title, message, duration: opts.duration ?? (kind === 'error' ? 5000 : 3200), onPress: opts.onPress });

export const toast = { success: show('success'), error: show('error'), info: show('info'), warning: show('warning') };

function ToastItem({ item }: { item: Item }) {
  const { colors } = useTheme();
  const remove = useToastStore((s) => s.remove);
  useEffect(() => {
    const t = setTimeout(() => remove(item.id), item.duration);
    return () => clearTimeout(t);
  }, [item, remove]);
  const map: Record<Kind, { bg: string; fg: string; icon: IconName }> = {
    success: { bg: colors.success, fg: colors.onSuccess, icon: 'checkmark-circle' },
    error: { bg: colors.error, fg: colors.onError, icon: 'alert-circle' },
    info: { bg: colors.surfaceInverse, fg: colors.onSurfaceInverse, icon: 'information-circle' },
    warning: { bg: colors.warning, fg: colors.onWarning, icon: 'warning' },
  };
  const c = map[item.kind];
  return (
    <Animated.View entering={FadeInUp.duration(220)} exiting={FadeOutUp.duration(180)}>
      <Pressable
        accessibilityRole="alert"
        onPress={() => { item.onPress?.(); remove(item.id); }}
        style={[styles.toast, { backgroundColor: c.bg }]}
      >
        <Icon name={c.icon} size={22} color={c.fg} />
        <View style={{ flex: 1 }}>
          <T weight="semibold" color={c.fg} numberOfLines={2}>{item.title}</T>
          {item.message ? <T variant="caption" color={c.fg} numberOfLines={3}>{item.message}</T> : null}
        </View>
        <Icon name="close" size={18} color={c.fg} />
      </Pressable>
    </Animated.View>
  );
}

export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const insets = useSafeAreaInsets();
  if (!items.length) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + spacing.sm }]}>
      {items.map((i) => <ToastItem key={i.id} item={i} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.lg, right: spacing.lg, gap: spacing.sm, zIndex: 1000 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, ...shadow.card, elevation: 4 },
});
