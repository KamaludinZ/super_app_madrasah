/**
 * Gambar dari path API yang dilindungi login (mis. /api/achievements/upload/photo/file/…): dimuat dengan
 * header Authorization sesi aplikasi. Ketuk untuk membuka/berbagi berkas aslinya.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { API_URL } from '@/config';
import { getAuthToken } from '@/api/client';
import { openAuthedFile } from '@/utils/files';
import { radius, useTheme } from '@/theme';
import { Icon } from '@/components/ui/Icon';
import { T } from '@/components/ui/Text';

const API_ORIGIN = API_URL.replace(/\/api$/, '');
export const apiFileUrl = (p: string) => (p.startsWith('/') ? `${API_ORIGIN}${p}` : p);

export function AuthedImage({ path, style, label }: { path: string; style?: ViewStyle; label?: string }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const isPdf = /\.pdf($|\?)/i.test(path);
  return (
    <Pressable onPress={() => openAuthedFile(path)} accessibilityRole="imagebutton" accessibilityLabel={label ?? 'Buka berkas'}
      style={[styles.box, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }, style]}>
      {isPdf || failed ? (
        <View style={styles.fallback}>
          <Icon name={isPdf ? 'document-text-outline' : 'image-outline'} size={28} color={colors.muted} />
          <T variant="caption" tone="muted">{isPdf ? 'Buka PDF' : 'Ketuk untuk membuka'}</T>
        </View>
      ) : (
        <Image source={{ uri: apiFileUrl(path), headers: { Authorization: `Bearer ${getAuthToken() ?? ''}` } }}
          style={StyleSheet.absoluteFill} contentFit="cover" transition={150} onError={() => setFailed(true)} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', aspectRatio: 4 / 3 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
