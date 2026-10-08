/**
 * Data Prestasi — native, pengganti /prestasi. Tab pemegang sesuai peran (siswa: prestasinya; guru/tendik:
 * prestasi guru/tendik; guru BK: siswa & guru; kepala/waka: semua), ringkasan per tingkat, filter status &
 * pencarian. Ajuan yang menunggu/ditolak ikut tampil. Siswa/guru/tendik mengajukan prestasi baru lewat verval.
 */
import React, { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Achievement } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { formatDateLong } from '@/utils/time';
import { HOLDERS, Holder, categoryLabel, categoryTone, holderAccess, holderOf, levelLabel, loadPrestasi, prestasiKey, statusOf } from '@/prestasi/data';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Status = 'all' | 'pending' | 'rejected' | 'verified';
const isRejected = (a: Achievement) => a._vervalStatus === 'rejected';
const LEVEL_STATS = ['kab_kota', 'provinsi', 'nasional', 'internasional'];

export default function PrestasiScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { activeRole } = useAuth();
  const access = holderAccess(activeRole);
  const res = useCached<Achievement[]>(prestasiKey(activeRole), () => loadPrestasi(access.reviewer));
  const [holder, setHolder] = useState<Holder>(access.tabs[0]);
  const [status, setStatus] = useState<Status>('all');
  const [search, setSearch] = useState('');

  const byHolder = useMemo(() => (res.data ?? []).filter((a) => holderOf(a) === holder), [res.data, holder]);
  const list = useMemo(() => {
    const s = search.trim().toLowerCase();
    return byHolder.filter((a) => {
      if (status === 'pending' && (a.is_verified || isRejected(a))) return false;
      if (status === 'rejected' && !isRejected(a)) return false;
      if (status === 'verified' && !a.is_verified) return false;
      if (!s) return true;
      return [a.name, a.holder_full_name, a.holder_name, a.organizer, a.bidang_lomba, a.class_name]
        .some((x) => (x ?? '').toLowerCase().includes(s));
    });
  }, [byHolder, status, search]);
  // Ajuan yang ditolak bukan prestasi: tidak dihitung di total/tingkat, punya filter sendiri.
  const counted = byHolder.filter((a) => !isRejected(a));
  const rejected = byHolder.length - counted.length;
  const pending = counted.filter((a) => !a.is_verified).length;
  const verified = counted.length - pending;
  const canAdd = access.canAdd === holder;

  const header = (
    <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
      {access.tabs.length > 1 ? (
        <SegmentedControl<Holder> small segments={HOLDERS.filter((h) => access.tabs.includes(h.value)).map((h) => ({ value: h.value, label: h.label }))}
          value={holder} onChange={setHolder} />
      ) : null}
      {access.canAdd ? (
        <Notice tone="success" icon="information-circle-outline"
          text="Prestasi yang Anda ajukan ditinjau Admin/Wali Kelas lebih dulu sebelum berstatus Terverifikasi. Ajuan yang menunggu atau ditolak tetap tampil di daftar." />
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        <Stat label="Total" value={counted.length} color={colors.brandPrimary} />
        {LEVEL_STATS.map((l) => <Stat key={l} label={levelLabel(l)} value={counted.filter((a) => a.level === l).length} color={colors.onSurface} />)}
      </ScrollView>
      <SegmentedControl<Status> small
        segments={[
          { value: 'all', label: `Semua (${byHolder.length})` }, { value: 'pending', label: `Menunggu (${pending})` },
          ...(rejected ? [{ value: 'rejected' as Status, label: `Ditolak (${rejected})` }] : []),
          { value: 'verified', label: `Terverifikasi (${verified})` },
        ]}
        value={status} onChange={setStatus} />
      <Input icon="search-outline" placeholder="Cari lomba, nama, penyelenggara…" value={search} onChangeText={setSearch} returnKeyType="search" />
    </View>
  );

  return (
    <Screen title="Data Prestasi" subtitle={`${counted.length} prestasi${pending ? ` · ${pending} menunggu` : ''}${rejected ? ` · ${rejected} ditolak` : ''}`} back scroll={false}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}
      footer={canAdd ? <Button title="Ajukan prestasi" icon="add-circle-outline" size="lg" fullWidth onPress={() => router.push('/prestasi/tambah')} /> : undefined}>
      <FlatList
        data={list}
        keyExtractor={(a) => a.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <PrestasiCard a={item} showHolder={holder !== 'madrasah' && access.canAdd !== holder} onPress={() => router.push(`/prestasi/${encodeURIComponent(item.id)}`)} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={res.loading ? <CardSkeleton lines={3} /> : res.error && !res.data
          ? <ErrorState message="Data prestasi belum tersimpan di perangkat. Sambungkan ke internet lalu coba lagi." onRetry={res.refresh} />
          : <Card><EmptyState icon="trophy-outline" title={search || status !== 'all' ? 'Tidak ada yang cocok' : 'Belum ada prestasi'}
              message={canAdd ? 'Ketuk “Ajukan prestasi” untuk menambahkan prestasi Anda.' : 'Prestasi yang tercatat akan tampil di sini.'} compact /></Card>}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={res.refreshing} onRefresh={res.refresh} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      />
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <T variant="title" color={color}>{value}</T>
      <T variant="small" tone="muted">{label}</T>
    </View>
  );
}

function PrestasiCard({ a, showHolder, onPress }: { a: Achievement; showHolder: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const st = statusOf(a);
  return (
    <Card onPress={onPress} style={{ gap: spacing.sm }}>
      <View style={styles.row}>
        <View style={[styles.trophy, { backgroundColor: colors.brandTertiary }]}>
          <Icon name="trophy-outline" size={20} color={colors.onBrandTertiary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T weight="semibold" numberOfLines={2}>{a.name}</T>
          <T variant="caption" tone="secondary" numberOfLines={1}>
            {[a.rank, levelLabel(a.level)].filter(Boolean).join(' · ')}
          </T>
        </View>
        <Icon name="chevron-forward" size={18} color={colors.muted} />
      </View>
      {showHolder && (a.holder_full_name || a.holder_name) ? (
        <T variant="caption" tone="muted" numberOfLines={1}>{a.holder_full_name || a.holder_name}{a.class_name ? ` · Kelas ${a.class_name}` : ''}</T>
      ) : null}
      <View style={styles.badges}>
        <Badge label={st.label} icon={st.icon} tone={st.tone} small />
        {a.category ? <Badge label={categoryLabel(a.category)} tone={categoryTone(a.category)} small /> : null}
        {a.date ? <Badge label={formatDateLong(a.date)} tone="neutral" small /> : a.year ? <Badge label={String(a.year)} tone="neutral" small /> : null}
      </View>
      {a._vervalStatus === 'rejected' && a._adminNotes ? <T variant="caption" tone="error">Catatan: {a._adminNotes}</T> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trophy: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stat: { minWidth: 92, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
});
