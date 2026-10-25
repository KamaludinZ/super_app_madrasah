import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { spacing } from '@/theme';
import { T } from './Text';

/**
 * Baris label–nilai untuk layar data (profil siswa/GTK). Label selebar 128 di samping nilai; bila ukuran
 * teks HP diperbesar (skala font ≥ 1,15) atau layar sempit (< 360 dp), label ditaruh di atas nilai agar
 * kolom nilai tidak terjepit dan baris tidak bertumpuk.
 */
export function InfoRow({ label, value }: { label: string; value: string }) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = fontScale >= 1.15 || width < 360;
  return (
    <View style={stacked ? styles.stacked : styles.row}>
      <T variant="caption" tone="muted" style={stacked ? undefined : styles.label}>{label}</T>
      <T style={stacked ? undefined : styles.value} selectable>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stacked: { gap: 2 },
  label: { width: 128, paddingTop: 2 },
  value: { flex: 1, minWidth: 0 },
});
