/**
 * Kerangka halaman sebelum login (Masuk, Lupa Password, Reset Password): latar motif pendidikan
 * (EduBackground), logo, kartu isian, dan catatan kaki. Aman untuk keyboard dan area notch.
 */
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { radius, spacing, useTheme } from '@/theme';
import { BrandLogo } from './BrandLogo';
import { EduBackground } from './EduBackground';
import { Card } from './ui/Card';
import { IconButton } from './ui/Button';
import { T } from './ui/Text';

export function AuthLayout({ children, back, logoSize = 104, footer }: {
  children: React.ReactNode;
  back?: boolean;
  logoSize?: number;
  footer?: string;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <EduBackground>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (back ? 64 : spacing.xxl), paddingBottom: insets.bottom + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
        >
          <BrandLogo light size={logoSize} />
          <Card style={styles.card}>{children}</Card>
          {footer ? <T variant="small" center color={colors.onBrand} style={{ opacity: 0.8 }}>{footer}</T> : null}
        </ScrollView>
      </KeyboardAvoidingView>
      {back ? (
        <View style={[styles.back, { top: insets.top + spacing.sm }]}>
          <IconButton name="arrow-back" color="#FFFFFF" bg="rgba(0,0,0,0.18)" accessibilityLabel="Kembali"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/login'))} />
        </View>
      ) : null}
    </EduBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.xl, justifyContent: 'center' },
  back: { position: 'absolute', left: spacing.lg },
  card: { borderRadius: radius.lg, padding: spacing.xl },
});
