/** Konten kaya dari editor web (HTML) ditampilkan native: teks rapi + daftar tautan yang bisa diketuk. */
import React, { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { htmlToText } from '@/utils/html';
import { spacing, useTheme } from '@/theme';
import { T } from './ui/Text';
import { Icon } from './ui/Icon';

export function openUrl(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url).catch(() => {}));
}

export function RichText({ html, empty = 'Tidak ada uraian.' }: { html?: string | null; empty?: string }) {
  const { colors } = useTheme();
  const { text, links } = useMemo(() => htmlToText(html), [html]);
  return (
    <View style={{ gap: spacing.sm }}>
      <T selectable tone={text ? 'default' : 'muted'} style={{ lineHeight: 22 }}>{text || empty}</T>
      {links.map((l, i) => (
        <Pressable key={`${l.url}-${i}`} onPress={() => openUrl(l.url)} accessibilityRole="link" style={styles.link}>
          <Icon name="link-outline" size={16} color={colors.brandPrimary} />
          <T tone="brand" numberOfLines={1} style={{ flex: 1 }}>{l.label}</T>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
});
