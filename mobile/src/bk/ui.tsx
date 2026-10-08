/**
 * Komponen bersama layar BK siswa (CLKB & PCL): baris centang, petunjuk + jadwal pengisian, kartu tanggapan
 * Guru BK, dan format waktu kirim (submitted_at disimpan server sebagai UTC tanpa zona).
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatDateTime } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/States';

/** submitted_at = ISO UTC tanpa zona → tampil sebagai WIB. */
export const formatSubmitted = (s?: string | null) => (s ? formatDateTime(/([zZ]|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s}Z`) : '-');
/** open_start/open_end sudah jam dinding WIB tanpa zona. */
const formatWindow = (s?: string | null) => (s ? formatDateTime(s) : null);

export function CheckRow({ checked, onPress, children, no }: { checked: boolean; onPress: () => void; children: string; no?: number }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }}
      style={[styles.check, { borderColor: checked ? colors.brandPrimary : colors.border, backgroundColor: checked ? colors.brandTertiary : colors.surface }]}>
      <Icon name={checked ? 'checkbox' : 'square-outline'} size={22} color={checked ? colors.brandPrimary : colors.muted} />
      <T style={{ flex: 1 }} color={checked ? colors.onBrandTertiary : undefined}>
        {no !== undefined ? <T tone="muted">{no}. </T> : null}{children}
      </T>
    </Pressable>
  );
}

export function ClosedCard({ name }: { name: string }) {
  return (
    <Card>
      <EmptyState icon="lock-closed-outline" title={`Pengisian ${name} sedang ditutup`} message="Guru BK akan membuka jadwal pengisian saat waktunya tiba. Riwayat pengisianmu tetap bisa dilihat." compact />
    </Card>
  );
}

export function Petunjuk({ petunjuk, info, start, end }: { petunjuk: string[]; info?: string | null; start?: string | null; end?: string | null }) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: spacing.sm }}>
      {start || end ? (
        <View style={styles.row}>
          <Icon name="calendar-outline" size={16} color={colors.success} />
          <T variant="caption" weight="semibold" color={colors.success} style={{ flex: 1 }}>
            Jadwal pengisian: {formatWindow(start) ?? 'kapan saja'}{end ? ` s.d. ${formatWindow(end)}` : ''}
          </T>
        </View>
      ) : null}
      <T variant="label" tone="muted">PETUNJUK</T>
      {petunjuk.map((p, i) => <T key={i} variant="caption" tone="secondary">{i + 1}. {p}</T>)}
      {info ? <T variant="caption" tone="secondary" style={{ fontStyle: 'italic' }}>{info}</T> : null}
    </Card>
  );
}

export function Progress({ value, total }: { value: number; total: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.row}>
        <T variant="caption" weight="semibold" style={{ flex: 1 }}>Dipilih</T>
        <T variant="caption" tone="muted">{value} / {total}</T>
      </View>
      <View style={[styles.bar, { backgroundColor: colors.surfaceSecondary }]}>
        <View style={{ width: `${total ? Math.min(100, (value / total) * 100) : 0}%`, height: '100%', backgroundColor: colors.brandPrimary, borderRadius: 4 }} />
      </View>
    </View>
  );
}

export function TanggapanCard({ s }: { s: { tanggapan_bk?: string | null; rekomendasi_bk?: string | null; ditanggapi_oleh?: string | null; ditanggapi_pada?: string | null } }) {
  const { colors } = useTheme();
  if (!s.tanggapan_bk) {
    return <Card><T variant="caption" tone="muted" style={{ textAlign: 'center' }}>Belum ada tanggapan dari Guru BK.</T></Card>;
  }
  return (
    <Card style={{ gap: spacing.xs, borderColor: colors.success, borderWidth: 1.5 }}>
      <T variant="label" color={colors.success}>TANGGAPAN GURU BK{s.ditanggapi_oleh ? ` · ${s.ditanggapi_oleh}` : ''}</T>
      <T selectable>{s.tanggapan_bk}</T>
      {s.rekomendasi_bk ? (
        <>
          <T variant="label" color={colors.success} style={{ marginTop: spacing.sm }}>REKOMENDASI</T>
          <T selectable>{s.rekomendasi_bk}</T>
        </>
      ) : null}
      {s.ditanggapi_pada ? <T variant="small" tone="muted">{formatSubmitted(s.ditanggapi_pada)}</T> : null}
    </Card>
  );
}

export function KV({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={{ gap: 2 }}>
      <T variant="caption" tone="muted">{label}</T>
      {value ? <T selectable>{value}</T> : <T tone="muted" style={{ fontStyle: 'italic' }}>tidak diisi</T>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
});
