/**
 * Profil: identitas & peran aktif (ganti peran), pengaturan pengingat mengajar, antrean jurnal,
 * Tentang & Diagnostik, versi web, dan keluar (bersihkan data lokal, notifikasi, & perangkat push).
 */
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useQueryClient } from '@tanstack/react-query';
import { errorMessage } from '@/api/client';
import { useAuth } from '@/store/auth';
import { usePrefs } from '@/store/prefs';
import { radius, spacing, useTheme, type ThemeMode } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { ListItem } from '@/components/ui/ListItem';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { canPiket, initials, roleLabel } from '@/utils/roles';
import { APP_VERSION, WEB_URL } from '@/config';
import { cancelAllReminders, unregisterDevice } from '@/notifications';
import { unregisterBackgroundSync } from '@/offline/sync';

export default function ProfilScreen() {
  const { colors, mode, setMode } = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { user, activeRole, switchRole, logout } = useAuth();
  const reminderMinutes = usePrefs((s) => s.reminderMinutes);
  const setReminderMinutes = usePrefs((s) => s.setReminderMinutes);
  const pendingCount = usePrefs((s) => s.pendingCount);
  const failedCount = usePrefs((s) => s.failedCount);
  const [switching, setSwitching] = useState<string | null>(null);

  const roles = user?.roles ?? [];

  const onSwitch = async (role: string) => {
    if (role === activeRole) return;
    setSwitching(role);
    try {
      await switchRole(role);
      qc.clear();
      toast.success(`Peran aktif: ${roleLabel(role)}`);
      router.replace('/(app)/(tabs)');
    } catch (e) {
      toast.error('Gagal mengganti peran', errorMessage(e));
    } finally {
      setSwitching(null);
    }
  };

  const confirmLogout = () => {
    const warn = pendingCount + failedCount > 0
      ? `\n\nPerhatian: ada ${pendingCount + failedCount} jurnal di antrean yang belum terkirim dan akan DIHAPUS dari perangkat ini.`
      : '';
    Alert.alert('Keluar dari akun?', `Data tersimpan di perangkat ini akan dihapus dan pengingat dibatalkan.${warn}`, [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: async () => {
          await logout({
            beforeClear: async () => {
              await unregisterDevice().catch(() => {});
              await cancelAllReminders().catch(() => {});
              await unregisterBackgroundSync().catch(() => {});
            },
          });
          qc.clear();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <Screen title="Profil" headerTone="brand">
      <Card style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: colors.brandTertiary }]}>
          <T variant="title" color={colors.onBrandTertiary}>{initials(user?.full_name || user?.username)}</T>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="subtitle" numberOfLines={2}>{user?.full_name || user?.username}</T>
          <T variant="caption" tone="muted">{user?.nip_nuptk ? `NIP/NUPTK ${user.nip_nuptk}` : `@${user?.username}`}</T>
          <Badge label={roleLabel(activeRole)} tone="brand" small style={{ alignSelf: 'flex-start', marginTop: 4 }} />
        </View>
      </Card>

      {roles.length > 1 ? (
        <Section title="Ganti peran">
          {roles.map((r, i) => (
            <ListItem
              key={r}
              icon={r === activeRole ? 'radio-button-on' : 'radio-button-off'}
              title={roleLabel(r)}
              subtitle={r === activeRole ? 'Peran aktif' : switching === r ? 'Mengganti…' : undefined}
              onPress={r === activeRole || switching ? undefined : () => onSwitch(r)}
              right={r === activeRole ? <Badge label="Aktif" tone="success" small /> : undefined}
              last={i === roles.length - 1}
            />
          ))}
        </Section>
      ) : null}

      <Section title="Pengingat mengajar">
        <T variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>
          Notifikasi sebelum jam mengajar — tetap berbunyi walau HP sedang offline.
        </T>
        <SegmentedControl
          segments={[{ value: '5', label: '5 menit' }, { value: '10', label: '10 menit' }, { value: '15', label: '15 menit' }]}
          value={String(reminderMinutes)}
          onChange={(v) => { setReminderMinutes(Number(v) as 5 | 10 | 15); toast.success(`Pengingat diatur ${v} menit sebelum mengajar`); }}
        />
      </Section>

      <Section title="Tampilan">
        <SegmentedControl<ThemeMode>
          segments={[{ value: 'system', label: 'Ikuti HP' }, { value: 'light', label: 'Terang' }, { value: 'dark', label: 'Gelap' }]}
          value={mode}
          onChange={setMode}
        />
      </Section>

      <Section title="Lainnya">
        {activeRole === 'siswa' ? (
          <ListItem icon="id-card-outline" title="Data diri lengkap" subtitle="Data siswa, orang tua, alamat, berkas & kelengkapan" onPress={() => router.push('/profil-siswa')} />
        ) : null}
        {canPiket(activeRole, user?.roles) ? (
          <ListItem icon="shield-checkmark-outline" title="Tugas Piket" subtitle="Jadwal tanpa jurnal & tugas titipan hari ini" onPress={() => router.push('/piket' as any)} />
        ) : null}
        <ListItem
          icon="cloud-upload-outline"
          title="Antrean jurnal offline"
          subtitle={pendingCount + failedCount > 0 ? `${pendingCount} menunggu · ${failedCount} gagal` : 'Semua jurnal sudah terkirim'}
          onPress={() => router.push('/antrean')}
          right={failedCount > 0 ? <Badge label={`${failedCount} gagal`} tone="error" small /> : undefined}
        />
        <ListItem icon="pulse-outline" title="Tentang & Diagnostik" subtitle="Status notifikasi, koneksi, sinkron" onPress={() => router.push('/diagnostik')} />
        <ListItem icon="globe-outline" title="Buka versi web" subtitle={WEB_URL.replace('https://', '')} onPress={() => WebBrowser.openBrowserAsync(WEB_URL).catch(() => {})} last />
      </Section>

      <Card padded={false} style={{ marginTop: spacing.lg, paddingHorizontal: spacing.lg }}>
        <ListItem icon="log-out-outline" title="Keluar" danger onPress={confirmLogout} last />
      </Card>

      <T variant="small" tone="muted" center style={{ marginTop: spacing.lg }}>
        Super Apps MATSANDATAMA · versi {APP_VERSION}
      </T>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <T variant="label" tone="muted" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs }}>{title.toUpperCase()}</T>
      <Card padded style={{ paddingVertical: spacing.sm }}>{children}</Card>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: { width: 64, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
