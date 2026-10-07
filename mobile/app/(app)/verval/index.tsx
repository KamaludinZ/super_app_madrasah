/**
 * Ajuan Verval Saya — native, pengganti /verval/ajuan-saya (guru, tendik, siswa). Daftar ajuan perubahan
 * data & prestasi milik sendiri (GET /verval-requests) dengan status, catatan peninjau, dan perbandingan
 * data lama → baru; lampiran (sertifikat/foto) dibuka dengan sesi aplikasi.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { api } from '@/api/endpoints';
import type { VervalRequest } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { formatDateTime } from '@/utils/time';
import { openAuthedFile } from '@/utils/files';
import { HIDDEN_PRESTASI_FIELDS, PRESTASI_FIELD_LABELS, PROFILE_FIELD_LABELS, requestTypeLabel } from '@/verval/labels';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

const STATUS: Record<string, { label: string; tone: BadgeTone; icon: React.ComponentProps<typeof Icon>['name'] }> = {
  pending: { label: 'Menunggu review', tone: 'warning', icon: 'time-outline' },
  approved: { label: 'Disetujui', tone: 'success', icon: 'checkmark-circle-outline' },
  rejected: { label: 'Ditolak', tone: 'error', icon: 'close-circle-outline' },
};
type Filter = 'semua' | 'pending' | 'selesai';

const isFile = (field: string, v: unknown) =>
  field === 'certificate_url' || field === 'photo_url' || (typeof v === 'string' && v.startsWith('/api/'));
const pretty = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 'Tidak ada data';
  if (Array.isArray(v)) return v.length ? v.join(', ') : 'Tidak ada data';
  if (typeof v === 'object') return Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== null && x !== '').map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : x}`).join('\n') || 'Tidak ada data';
  return String(v);
};

export default function VervalScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const res = useCached<VervalRequest[]>('verval.mine', api.verval.mine);
  const [filter, setFilter] = useState<Filter>('semua');
  const [openId, setOpenId] = useState<string | null>(null);

  // Admin menerima semua ajuan dari endpoint ini; layar "Ajuan Saya" hanya menampilkan milik sendiri.
  const mine = useMemo(() => (res.data ?? []).filter((r) => r.user_id === user?.id)
    .sort((a, b) => (b.submitted_at ?? b.created_at ?? '').localeCompare(a.submitted_at ?? a.created_at ?? '')), [res.data, user?.id]);
  const list = mine.filter((r) => filter === 'semua' || (filter === 'pending' ? r.status === 'pending' : r.status !== 'pending'));
  const pending = mine.filter((r) => r.status === 'pending').length;

  return (
    <Screen title="Ajuan Verval Saya" subtitle={pending ? `${pending} menunggu review` : 'Status pengajuan perubahan data'} back scroll={false}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={(
          <SegmentedControl<Filter> small style={{ marginBottom: spacing.md }}
            segments={[{ value: 'semua', label: `Semua (${mine.length})` }, { value: 'pending', label: `Menunggu (${pending})` }, { value: 'selesai', label: 'Selesai' }]}
            value={filter} onChange={setFilter} />
        )}
        renderItem={({ item }) => <Ajuan r={item} open={openId === item.id} onToggle={() => setOpenId(openId === item.id ? null : item.id)} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={res.loading ? <CardSkeleton lines={3} /> : res.error && !res.data
          ? <ErrorState message="Ajuan belum tersimpan di perangkat. Sambungkan ke internet lalu coba lagi." onRetry={res.refresh} />
          : <Card><EmptyState icon="document-text-outline" title="Belum ada ajuan" message="Ajuan perubahan data profil atau prestasi Anda akan tampil di sini." compact /></Card>}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      />
    </Screen>
  );
}

function Ajuan({ r, open, onToggle }: { r: VervalRequest; open: boolean; onToggle: () => void }) {
  const { colors } = useTheme();
  const st = STATUS[r.status] ?? { label: r.status, tone: 'neutral' as BadgeTone, icon: 'help-circle-outline' as const };
  const prestasi = r.request_type === 'prestasi_create';
  const fields = prestasi
    ? Object.keys(r.new_data ?? {}).filter((f) => !HIDDEN_PRESTASI_FIELDS.has(f))
    : Object.keys(r.new_data ?? {}).filter((k) => JSON.stringify((r.old_data ?? {})[k]) !== JSON.stringify((r.new_data ?? {})[k]));
  const label = (f: string) => (prestasi ? PRESTASI_FIELD_LABELS[f] : PROFILE_FIELD_LABELS[f]) ?? f.replace(/_/g, ' ');

  return (
    <Card onPress={onToggle} style={{ gap: spacing.sm }}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 2 }}>
          <T weight="semibold">{requestTypeLabel(r.request_type)}</T>
          <T variant="caption" tone="muted">{formatDateTime(r.submitted_at ?? r.created_at ?? '')} · {fields.length} isian</T>
        </View>
        <Badge label={st.label} icon={st.icon} tone={st.tone} small />
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </View>
      {r.admin_notes ? (
        <View style={[styles.note, { backgroundColor: r.status === 'rejected' ? colors.errorSoft : colors.surfaceSecondary }]}>
          <T variant="caption" weight="semibold" tone={r.status === 'rejected' ? 'error' : 'secondary'}>Catatan peninjau{r.reviewed_by_name ? ` (${r.reviewed_by_name})` : ''}</T>
          <T variant="caption" tone="secondary">{r.admin_notes}</T>
        </View>
      ) : null}
      {open ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
          {fields.length === 0 ? <T variant="caption" tone="muted">Tidak ada perubahan data.</T> : fields.map((f) => {
            const nv = (r.new_data ?? {})[f];
            const ov = (r.old_data ?? {})[f];
            return (
              <View key={f} style={[styles.field, { borderColor: colors.divider }]}>
                <T variant="small" tone="muted">{label(f)}</T>
                {!prestasi ? <T variant="caption" tone="muted" style={styles.strike}>{isFile(f, ov) ? 'Berkas lama' : pretty(ov)}</T> : null}
                {isFile(f, nv) && nv ? (
                  <Button title="Lihat berkas" icon="document-attach-outline" variant="ghost" size="sm" onPress={() => openAuthedFile(String(nv))} style={{ alignSelf: 'flex-start' }} />
                ) : <T weight={prestasi ? 'regular' : 'semibold'}>{pretty(nv)}</T>}
              </View>
            );
          })}
          {r.status === 'pending' ? <T variant="caption" tone="warning">Ajuan sedang diproses peninjau. Anda akan menerima notifikasi saat disetujui atau ditolak.</T> : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  note: { borderRadius: 10, padding: spacing.sm, gap: 2 },
  field: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: 2 },
  strike: { textDecorationLine: 'line-through' },
});
