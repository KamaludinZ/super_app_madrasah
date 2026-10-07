/**
 * Lupa password di aplikasi: kirim permintaan reset (POST /auth/forgot-password) dengan username
 * atau email. Server mengirim email berisi tautan reset; tautan itu ditempel di layar
 * Reset Password (/reset-password) sehingga tidak perlu membuka versi web.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useNetwork } from '@/store/network';
import { spacing, useTheme } from '@/theme';
import { AuthLayout } from '@/components/AuthLayout';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { T } from '@/components/ui/Text';

export default function LupaPasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { online } = useNetwork();
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ message: string; unavailable: boolean } | null>(null);

  const submit = async () => {
    if (!identifier.trim()) { setFieldError('Isi username atau email Anda'); return; }
    setFieldError(null);
    setError(null);
    setBusy(true);
    try {
      const r = await api.auth.forgotPassword(identifier.trim());
      // Server menjawab sama untuk akun ada/tidak ada (anti-enumerasi); "belum tersedia" = SMTP belum diatur.
      setResult({ message: r.message, unavailable: /belum tersedia/i.test(r.message) });
    } catch (e) {
      setError(errorMessage(e, 'Gagal mengirim permintaan. Coba lagi.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout back logoSize={84}>
      <T variant="heading">Lupa Password</T>

      {!result ? (
        <>
          <T variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>
            Masukkan username atau email akun Anda. Kami akan mengirim tautan untuk membuat password baru ke email yang terdaftar.
          </T>
          <Input
            label="Username atau email"
            icon="person-outline"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            keyboardType="email-address"
            returnKeyType="send"
            onSubmitEditing={submit}
            error={fieldError ?? undefined}
            containerStyle={{ marginTop: spacing.md }}
          />
          {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi internet. Permintaan reset memerlukan internet." /> : null}
          {error ? <Notice tone="error" icon="alert-circle-outline" text={error} /> : null}
          <Button title="Kirim tautan reset" icon="mail-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={submit} style={{ marginTop: spacing.lg }} />
          <Button title="Sudah punya tautan dari email?" variant="ghost" size="sm" fullWidth onPress={() => router.push('/reset-password')} style={{ marginTop: spacing.xs }} />
        </>
      ) : result.unavailable ? (
        <>
          <Notice tone="warning" icon="information-circle-outline" text={result.message} />
          <T variant="caption" tone="secondary" style={{ marginTop: spacing.md }}>
            Admin madrasah dapat mengatur ulang password Anda dari menu Manajemen Pengguna.
          </T>
          <Button title="Kembali ke halaman masuk" icon="log-in-outline" size="lg" fullWidth onPress={() => router.replace('/login')} style={{ marginTop: spacing.lg }} />
        </>
      ) : (
        <>
          <View style={[styles.sent, { backgroundColor: colors.brandTertiary }]}>
            <Icon name="mail-unread-outline" size={36} color={colors.onBrandTertiary} />
          </View>
          <T weight="semibold" center>Periksa email Anda</T>
          <T variant="caption" tone="secondary" center>{result.message}</T>

          <View style={[styles.steps, { borderColor: colors.divider }]}>
            <Step n={1} text="Buka email dari Super Apps MATSANDATAMA (cek juga folder Spam)." />
            <Step n={2} text="Tekan lama tombol/tautan “Reset Password”, lalu pilih Salin alamat link." />
            <Step n={3} text="Kembali ke aplikasi, ketuk tombol di bawah, lalu tempel tautannya." />
          </View>

          <Button title="Tempel tautan & buat password baru" icon="key-outline" size="lg" fullWidth onPress={() => router.push('/reset-password')} style={{ marginTop: spacing.md }} />
          <Button title="Kirim ulang" variant="ghost" size="sm" fullWidth onPress={() => setResult(null)} style={{ marginTop: spacing.xs }} />
        </>
      )}
    </AuthLayout>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.step}>
      <View style={[styles.stepNum, { backgroundColor: colors.brandPrimary }]}>
        <T variant="small" weight="bold" color={colors.onBrandPrimary}>{n}</T>
      </View>
      <T variant="caption" tone="secondary" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  sent: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginVertical: spacing.md },
  steps: { gap: spacing.sm, marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  step: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  stepNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
