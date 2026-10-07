import React, { useEffect, useState } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, useTheme } from '@/theme';
import { useAuth } from '@/store/auth';
import { T } from './ui/Text';
import { Button } from './ui/Button';
import { BrandLogo } from './BrandLogo';
import { Icon } from './ui/Icon';

/** Layar kunci (biometrik/PIN) — menutupi seluruh aplikasi saat `locked`. */
export function LockScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { unlock, logout, user, biometricAvailable } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tryUnlock = async () => {
    setBusy(true); setError(null);
    const r = await unlock();
    setBusy(false);
    if (!r.ok) setError(r.reason ?? null);
  };

  useEffect(() => { void tryUnlock(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <ImageBackground source={require('../../assets/images/pattern-dark.png')} style={[styles.root, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]} resizeMode="cover">
      <View style={styles.center}>
        <BrandLogo light size={88} />
        <View style={[styles.lockBadge, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
          <Icon name="lock-closed" size={18} color={colors.onBrand} />
          <T weight="semibold" color={colors.onBrand}>Aplikasi terkunci</T>
        </View>
        <T center color={colors.onBrand} style={{ opacity: 0.85, paddingHorizontal: spacing.xl }}>
          {user?.full_name ? `${user.full_name}, ` : ''}verifikasi {biometricAvailable ? 'biometrik atau PIN perangkat' : 'untuk melanjutkan'} agar data tetap aman.
        </T>
        {error ? <T center color={colors.warning} weight="semibold">{error}</T> : null}
      </View>
      <View style={styles.actions}>
        <Button title={biometricAvailable ? 'Buka dengan Biometrik / PIN' : 'Lanjutkan'} icon="finger-print" size="lg" loading={busy} onPress={tryUnlock} style={{ backgroundColor: colors.surface }} fullWidth
          variant="primary" />
        <Button title="Keluar dari akun" variant="ghost" onPress={() => logout()} fullWidth style={{ marginTop: spacing.sm }} />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 999, justifyContent: 'space-between', paddingHorizontal: spacing.xl },
  center: { alignItems: 'center', gap: spacing.lg, marginTop: spacing.xxxl },
  lockBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 999 },
  actions: { gap: spacing.xs },
});
