/**
 * Layar masuk: username, password, captcha (GET /auth/captcha) dan "ingat saya".
 * Saat sesi berakhir (401), tampilkan penjelasan bahwa antrean jurnal offline tetap aman.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { Captcha } from '@/api/types';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { radius, spacing, useTheme } from '@/theme';
import { BrandLogo } from '@/components/BrandLogo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { T } from '@/components/ui/Text';
import { WEB_URL } from '@/config';
import * as WebBrowser from 'expo-web-browser';

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, login, reauthRequired } = useAuth();
  const { online } = useNetwork();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [remember, setRemember] = useState(true);
  const [captcha, setCaptcha] = useState<Captcha | null>(null);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string; captcha?: string }>({});

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setCaptchaAnswer('');
    try {
      setCaptcha(await api.auth.captcha());
    } catch (e) {
      setCaptcha(null);
      setError(errorMessage(e, 'Tidak dapat memuat captcha. Periksa koneksi internet.'));
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => { void loadCaptcha(); }, [loadCaptcha]);

  if (session) return <Redirect href="/(app)/(tabs)" />;

  const submit = async () => {
    const fe: typeof fieldErrors = {};
    if (!username.trim()) fe.username = 'Username wajib diisi';
    if (!password) fe.password = 'Password wajib diisi';
    if (!captchaAnswer.trim()) fe.captcha = 'Isi angka pada gambar';
    setFieldErrors(fe);
    if (Object.keys(fe).length || !captcha) return;
    setBusy(true);
    setError(null);
    try {
      await login({
        username: username.trim(),
        password,
        captcha_id: captcha.challenge_id,
        captcha_answer: captchaAnswer.trim(),
        remember,
      });
      router.replace('/(app)/(tabs)');
    } catch (e) {
      setError(errorMessage(e, 'Gagal masuk. Periksa username, password, dan captcha.'));
      void loadCaptcha(); // captcha sekali pakai
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.brand }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <BrandLogo light size={104} />

        <Card style={styles.card}>
          <T variant="heading">Masuk</T>
          <T variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>
            Gunakan akun yang sama dengan aplikasi web madrasah.
          </T>

          {reauthRequired ? (
            <Card tone="warning" padded style={styles.notice}>
              <Icon name="time-outline" size={18} color={colors.onWarning} />
              <T variant="caption" color={colors.onWarning} style={{ flex: 1 }}>
                Sesi Anda berakhir. Masuk lagi untuk melanjutkan — jurnal yang tersimpan offline tetap aman dan akan dikirim setelah masuk.
              </T>
            </Card>
          ) : null}

          {!online ? (
            <Card tone="warning" padded style={styles.notice}>
              <Icon name="cloud-offline-outline" size={18} color={colors.onWarning} />
              <T variant="caption" color={colors.onWarning} style={{ flex: 1 }}>
                Tidak ada koneksi ke server. Masuk memerlukan internet; setelah masuk, aplikasi tetap bisa dipakai offline.
              </T>
            </Card>
          ) : null}

          <Input
            label="Username"
            icon="person-outline"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            returnKeyType="next"
            error={fieldErrors.username}
            containerStyle={styles.field}
          />
          <Input
            label="Password"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            textContentType="password"
            error={fieldErrors.password}
            containerStyle={styles.field}
          />

          <T variant="label" tone="secondary" style={{ marginTop: spacing.md, marginBottom: 6 }}>Captcha</T>
          <View style={styles.captchaRow}>
            <View style={[styles.captchaBox, { borderColor: colors.borderStrong, backgroundColor: colors.surfaceTertiary }]}>
              {captchaLoading ? (
                <ActivityIndicator color={colors.brandPrimary} />
              ) : captcha ? (
                <Image source={{ uri: captcha.image }} style={styles.captchaImg} resizeMode="contain" accessibilityLabel="Gambar captcha berisi angka" />
              ) : (
                <T variant="caption" tone="muted">Captcha gagal dimuat</T>
              )}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Muat ulang captcha"
              onPress={loadCaptcha}
              style={({ pressed }) => [styles.refresh, { backgroundColor: colors.brandTertiary, opacity: pressed ? 0.7 : 1 }]}
            >
              <Icon name="refresh" size={22} color={colors.onBrandTertiary} />
            </Pressable>
          </View>
          <Input
            placeholder="Ketik angka pada gambar"
            value={captchaAnswer}
            onChangeText={setCaptchaAnswer}
            keyboardType="number-pad"
            maxLength={captcha?.length ?? 8}
            returnKeyType="go"
            onSubmitEditing={submit}
            error={fieldErrors.captcha}
            containerStyle={{ marginTop: spacing.sm }}
          />

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: remember }}
            onPress={() => setRemember((r) => !r)}
            style={styles.remember}
          >
            <Icon name={remember ? 'checkbox' : 'square-outline'} size={22} color={remember ? colors.brandPrimary : colors.muted} />
            <T>Ingat saya di perangkat ini</T>
          </Pressable>

          {error ? (
            <Card tone="error" padded style={styles.notice}>
              <Icon name="alert-circle-outline" size={18} color={colors.error} />
              <T variant="caption" tone="error" style={{ flex: 1 }}>{error}</T>
            </Card>
          ) : null}

          <Button title="Masuk" icon="log-in-outline" size="lg" fullWidth loading={busy} disabled={!online || !captcha} onPress={submit} style={{ marginTop: spacing.md }} />
          <Button
            title="Lupa password? Buka versi web"
            variant="ghost"
            size="sm"
            fullWidth
            onPress={() => WebBrowser.openBrowserAsync(`${WEB_URL}/forgot-password`).catch(() => {})}
            style={{ marginTop: spacing.xs }}
          />
        </Card>

        <T variant="small" center color={colors.onBrand} style={{ opacity: 0.75 }}>
          Data Anda dilindungi: token login disimpan terenkripsi di perangkat.
        </T>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, gap: spacing.xl, justifyContent: 'center' },
  card: { borderRadius: radius.lg, padding: spacing.xl },
  field: { marginTop: spacing.md },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm, padding: spacing.md },
  captchaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  captchaBox: { flex: 1, height: 56, borderRadius: radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  captchaImg: { width: '100%', height: '100%' },
  refresh: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  remember: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, minHeight: 44 },
});
