/**
 * Catatan satpam pada satu izin — HANYA untuk kepala madrasah & kepala TU (dan admin). Peran lain tidak
 * merender bagian ini dan tidak meminta datanya (server juga menolak dengan 403).
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/store/auth';
import { useCached } from '@/hooks/useCached';
import { errorMessage } from '@/api/client';
import { radius, spacing, useTheme } from '@/theme';
import { T } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { formatDateTime } from '@/utils/time';
import { Catatan, bolehBacaCatatan, izinApi } from './api';

export function CatatanIzinTerbatas({ izinId }: { izinId: string }) {
  const { colors } = useTheme();
  const { activeRole } = useAuth();
  const boleh = bolehBacaCatatan(activeRole);
  const res = useCached<{ items: Catatan[]; tiruan: boolean }>(`izin.catatan.${izinId}`, () => izinApi.catatan(izinId), { enabled: boleh });
  if (!boleh) return null;
  const items = res.data?.items ?? [];
  return (
    <View style={[styles.box, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]} accessibilityLabel="Catatan satpam">
      <View style={styles.head}>
        <Icon name="create-outline" size={16} color={colors.brandPrimary} />
        <T weight="semibold" style={{ flex: 1 }}>Catatan satpam</T>
        <Icon name="lock-closed-outline" size={12} color={colors.muted} />
        <T variant="small" tone="muted">Kamad & Kepala TU</T>
      </View>
      {res.loading ? <T variant="small" tone="muted">Memuat catatan…</T>
        : res.error && !res.data ? <T variant="small" tone="error">{errorMessage(res.error, 'Gagal memuat catatan satpam.')}</T>
          : items.length === 0 ? <T variant="small" tone="muted">Belum ada catatan satpam untuk izin ini.</T>
            : items.map((c) => (
              <View key={c.id} style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <T variant="caption">{c.isi}</T>
                <T variant="small" tone="muted">{c.penulis_nama || 'Satpam'} · {formatDateTime(c.dibuat_pada)}</T>
              </View>
            ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  item: { gap: 2, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, padding: spacing.sm },
});
