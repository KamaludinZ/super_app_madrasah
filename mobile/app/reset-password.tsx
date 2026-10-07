/**
 * Reset password di aplikasi. Token diambil dari:
 *  - parameter rute (?token=…, mis. tautan matsandatama://reset-password?token=…), atau
 *  - tautan email yang ditempel (tombol "Tempel" membaca papan klip; token diambil dari ?token=).
 * Token dicek ke GET /auth/reset-password/validate/{token}, lalu password baru dikirim ke
 * POST /auth/reset-password (aturan sama dengan server: minimal 8 karakter, tidak mudah ditebak).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
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
import { toast } from '@/components/ui/Toast';

const MIN_LENGTH = 8;

/** Ambil token dari tautan reset (…/reset-password?token=XYZ) atau anggap teks itu tokennya. */
function extractResetToken(text: string): string {
  const t = (text || '').trim();
  const m = t.match(/[?&]token=([^&#\s]+)/);
  if (m) {
    try { return decodeURIComponent(m[1]); } catch { return m[1]; }
  }
  return /^[A-Za-z0-9_\-.~%]+$/.test(t) ? t : '';
}

type Check = { state: 'idle' | 'checking' | 'valid' | 'invalid'; username?: string | null; message?: string };

export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { online } = useNetwork();
  const params = useLocalSearchParams<{ token?: string }>();
  const [link, setLink] = useState(params.token ?? '');
  const [token, setToken] = useState('');
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ pwd?: string; confirm?: string }>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(async (raw: string) => {
    const tk = extractResetToken(raw);
    setToken(tk);
    setError(null);
    if (!tk) { setCheck({ state: 'invalid', message: 'Tautan tidak dikenali. Salin tombol/tautan “Reset Password” dari email.' }); return; }
    setCheck({ state: 'checking' });
    try {
      const r = await api.auth.resetValidate(tk);
      setCheck({ state: 'valid', username: r.username });
    } catch (e) {
      setCheck({ state: 'invalid', message: errorMessage(e, 'Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru.') });
    }
  }, []);

  useEffect(() => { if (params.token) void validate(params.token); }, [params.token, validate]);

  const paste = async () => {
    const text = await Clipboard.getStringAsync().catch(() => '');
    if (!text) { toast.info('Papan klip kosong. Salin dulu tautan dari email.'); return; }
    setLink(text);
    void validate(text);
  };

  const submit = async () => {
    const fe: typeof errors = {};
    if (pwd.length < MIN_LENGTH) fe.pwd = `Minimal ${MIN_LENGTH} karakter`;
    else if (check.username && pwd.toLowerCase() === check.username.toLowerCase()) fe.pwd = 'Password tidak boleh sama dengan username';
    if (confirm !== pwd) fe.confirm = 'Konfirmasi password tidak cocok';
    setErrors(fe);
    if (Object.keys(fe).length) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.auth.resetPassword(token, pwd);
      toast.success(r.message || 'Password berhasil diperbarui. Silakan masuk.');
      router.replace('/login');
    } catch (e) {
      setError(errorMessage(e, 'Gagal menyimpan password baru.'));
    } finally {
      setBusy(false);
    }
  };

  const valid = check.state === 'valid';

  return (
    <AuthLayout back logoSize={84}>
      <T variant="heading">Buat Password Baru</T>
      <T variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>
        Tempel tautan “Reset Password” dari email, lalu buat password baru untuk akun Anda.
      </T>

      {!valid ? (
        <>
          <Input
            label="Tautan dari email"
            icon="link-outline"
            value={link}
            onChangeText={(t) => { setLink(t); if (check.state !== 'idle') setCheck({ state: 'idle' }); }}
            placeholder="https://…/reset-password?token=…"
            autoCapitalize="none"
            autoCorrect={false}
            containerStyle={{ marginTop: spacing.md }}
          />
          <View style={styles.row}>
            <Button title="Tempel" icon="clipboard-outline" variant="outline" onPress={paste} style={{ flex: 1 }} />
            <Button title="Periksa" icon="shield-checkmark-outline" loading={check.state === 'checking'} disabled={!online || !link.trim()} onPress={() => validate(link)} style={{ flex: 1 }} />
          </View>
          {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi internet. Reset password memerlukan internet." /> : null}
          {check.state === 'invalid' && check.message ? <Notice tone="error" icon="alert-circle-outline" text={check.message} /> : null}
          {check.state === 'invalid' ? (
            <Button title="Minta tautan baru" variant="ghost" size="sm" fullWidth onPress={() => router.replace('/lupa-password')} style={{ marginTop: spacing.xs }} />
          ) : null}
        </>
      ) : (
        <>
          <View style={[styles.account, { backgroundColor: colors.brandTertiary }]}>
            <Icon name="checkmark-circle" size={20} color={colors.onBrandTertiary} />
            <T variant="caption" weight="semibold" color={colors.onBrandTertiary} style={{ flex: 1 }}>
              Tautan valid{check.username ? ` · akun ${check.username}` : ''}
            </T>
          </View>
          <Input
            label="Password baru"
            icon="lock-closed-outline"
            value={pwd}
            onChangeText={setPwd}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            hint={`Minimal ${MIN_LENGTH} karakter, kombinasi huruf & angka, bukan username.`}
            error={errors.pwd}
            containerStyle={{ marginTop: spacing.md }}
          />
          <Input
            label="Ulangi password baru"
            icon="lock-closed-outline"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={submit}
            error={errors.confirm}
            containerStyle={{ marginTop: spacing.md }}
          />
          {error ? <Notice tone="error" icon="alert-circle-outline" text={error} /> : null}
          <Button title="Simpan password baru" icon="save-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={submit} style={{ marginTop: spacing.lg }} />
        </>
      )}
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  account: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 12, marginTop: spacing.sm },
});
