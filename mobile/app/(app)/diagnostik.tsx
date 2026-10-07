/**
 * Tentang & Diagnostik: versi aplikasi, status server (GET /health), izin & token notifikasi,
 * pengingat terjadwal, antrean, sinkron terakhir, serta pintasan pengaturan baterai Android
 * (agar sinkron latar belakang & pengingat tidak dimatikan sistem).
 */
import React, { useCallback, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import * as IntentLauncher from 'expo-intent-launcher';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { ANDROID_PACKAGE, API_URL, APP_NAME, APP_VERSION, SCHOOL_NAME } from '@/config';
import { usePrefs } from '@/store/prefs';
import { useNetwork } from '@/store/network';
import { countScheduledReminders, getPermissionStatus, registerDevice, requestPermission } from '@/notifications';
import { isExpoGo, notificationsAvailable } from '@/notifications/native';
import { formatDateTime, formatRelative } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { BrandLogo } from '@/components/BrandLogo';
import { toast } from '@/components/ui/Toast';

type Health = { ok: boolean; text: string; ms?: number };

export default function DiagnostikScreen() {
  const { colors } = useTheme();
  const { online } = useNetwork();
  const { pushToken, lastSyncAt, pendingCount, failedCount } = usePrefs();
  const [health, setHealth] = useState<Health | null>(null);
  const [perm, setPerm] = useState<{ granted: boolean; canAskAgain: boolean; status: string } | null>(null);
  const [reminders, setReminders] = useState<number | null>(null);
  const [registering, setRegistering] = useState(false);
  const pushSupported = notificationsAvailable();

  const check = useCallback(async () => {
    setHealth(null);
    const t0 = Date.now();
    api.health()
      .then((h) => setHealth({ ok: h.status === 'ok' || h.status === 'healthy' || !!h.status, text: `Terhubung · ${h.time_wib ?? ''}`, ms: Date.now() - t0 }))
      .catch((e) => setHealth({ ok: false, text: errorMessage(e, 'Server tidak dapat dihubungi') }));
    getPermissionStatus().then(setPerm).catch(() => setPerm(null));
    countScheduledReminders().then(setReminders).catch(() => setReminders(null));
  }, []);

  useFocusEffect(useCallback(() => { void check(); }, [check]));

  const askPermission = async () => {
    await requestPermission();
    setPerm(await getPermissionStatus());
  };

  const reRegister = async () => {
    setRegistering(true);
    try {
      const r = await registerDevice();
      if (r.ok) toast.success(r.token ? 'Perangkat terdaftar untuk notifikasi' : 'Perangkat terdaftar (tanpa token push)');
      else toast.error('Gagal mendaftarkan perangkat');
    } catch (e) {
      toast.error(errorMessage(e, 'Gagal mendaftarkan perangkat'));
    } finally {
      setRegistering(false);
    }
  };

  const copyToken = async () => {
    if (!pushToken) return;
    await Clipboard.setStringAsync(pushToken);
    toast.success('Token push disalin');
  };

  const openBattery = async () => {
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
    } catch {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, { data: `package:${ANDROID_PACKAGE}` }).catch(() => {});
    }
  };

  return (
    <Screen title="Tentang & Diagnostik" back refreshing={false} onRefresh={check}>
      <View style={{ gap: spacing.md }}>
        <Card style={styles.about}>
          <BrandLogo size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="subtitle">{APP_NAME}</T>
            <T variant="caption" tone="muted">{SCHOOL_NAME}</T>
            <T variant="caption" tone="muted">Versi {APP_VERSION}{isExpoGo ? ' · Expo Go (uji coba)' : ''}</T>
          </View>
        </Card>

        <Section title="KONEKSI">
          <Line label="Internet" value={online ? 'Online' : 'Offline'} ok={online} />
          <Line
            label="Server"
            value={health ? `${health.text}${health.ms ? ` · ${health.ms} ms` : ''}` : 'Memeriksa…'}
            ok={health ? health.ok : undefined}
          />
          <T variant="caption" tone="muted" selectable>{API_URL}</T>
        </Section>

        <Section title="NOTIFIKASI">
          {!pushSupported ? (
            <T variant="caption" tone="warning">
              Notifikasi push & pengingat tidak tersedia di Expo Go. Fitur ini aktif pada APK resmi.
            </T>
          ) : null}
          <Line label="Izin notifikasi" value={perm ? (perm.granted ? 'Diizinkan' : 'Belum diizinkan') : '-'} ok={perm?.granted} />
          <Line label="Pengingat terjadwal" value={reminders === null ? '-' : `${reminders} pengingat`} />
          <Line label="Token push" value={pushToken ? `${pushToken.slice(0, 26)}…` : 'Belum ada'} ok={!!pushToken} />
          <View style={styles.actions}>
            {pushSupported && perm && !perm.granted ? <Button title="Izinkan" size="sm" icon="notifications-outline" onPress={askPermission} style={{ flex: 1 }} /> : null}
            {pushSupported ? <Button title="Daftar ulang" size="sm" variant="outline" icon="refresh" loading={registering} disabled={!online} onPress={reRegister} style={{ flex: 1 }} /> : null}
            {pushToken ? <Button title="Salin token" size="sm" variant="ghost" icon="copy-outline" onPress={copyToken} style={{ flex: 1 }} /> : null}
          </View>
        </Section>

        <Section title="SINKRON & ANTREAN">
          <Line label="Sinkron terakhir" value={lastSyncAt ? `${formatRelative(lastSyncAt)}` : 'Belum pernah'} />
          {lastSyncAt ? <T variant="caption" tone="muted">{formatDateTime(lastSyncAt)}</T> : null}
          <Line label="Jurnal menunggu" value={String(pendingCount)} ok={pendingCount === 0} />
          <Line label="Jurnal gagal" value={String(failedCount)} ok={failedCount === 0} />
        </Section>

        {Platform.OS === 'android' ? (
          <Section title="BATERAI">
            <T variant="caption" tone="secondary">
              Beberapa HP (Xiaomi, Oppo, Vivo, Samsung) menghentikan aplikasi di latar belakang. Pilih “Tidak dibatasi / Jangan optimalkan”
              untuk aplikasi ini agar pengingat mengajar dan sinkron jurnal tetap berjalan.
            </T>
            <Button title="Buka pengaturan baterai" size="sm" variant="outline" icon="battery-half-outline" onPress={openBattery} />
          </Section>
        ) : null}

        <Section title="PERANGKAT">
          <Line label="Model" value={[Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || '-'} />
          <Line label="Sistem" value={`${Device.osName ?? Platform.OS} ${Device.osVersion ?? ''}`} />
        </Section>
        <View style={{ height: spacing.lg }} />
        <T variant="caption" tone="muted" center style={{ color: colors.muted }}>© {new Date().getFullYear()} {SCHOOL_NAME}</T>
      </View>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card style={{ gap: spacing.sm }}>
      <T variant="label" tone="muted">{title}</T>
      {children}
    </Card>
  );
}

function Line({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <View style={styles.line}>
      <T tone="secondary" style={{ flexShrink: 0 }}>{label}</T>
      <View style={styles.value}>
        {ok === undefined ? <T weight="semibold" numberOfLines={2} style={{ textAlign: 'right' }}>{value}</T>
          : <Badge label={value} tone={ok ? 'success' : 'error'} small />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  about: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  value: { flex: 1, alignItems: 'flex-end' },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
