/**
 * Data GTK (Kepala Madrasah) — native, pengganti /admin/gtk (hanya lihat). Guru & tendik aktif (GET /users,
 * tanpa mutasi keluar) dipilah seperti web (guru didahulukan bila punya kedua peran), dengan pencarian
 * nama/NIP/PegID, ringkasan L/P & status kepegawaian; ketuk untuk data EMIS lengkap (profil-gtk?id).
 */
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { request } from '@/api/client';
import { cocok, SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Gtk = { id: string; full_name?: string; username?: string; roles?: string[]; gender?: string | null; nip_nuptk?: string | null; peg_id?: string | null; status_kepegawaian?: string | null; employee_status?: string | null; jabatan?: string | null };
type Tab = 'guru' | 'tendik';
// Sama dengan GURU_ROLES/TENDIK_ROLES web (frontend/src/lib/dataGtkKolom.js).
const GURU_ROLES = ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'];
const TENDIK_ROLES = ['tenaga_kependidikan'];

/** Status kepegawaian ternormalisasi (sama dengan labelKepegawaian web). */
function labelKepegawaian(u: Gtk): string | null {
  const raw = String(u.status_kepegawaian || u.employee_status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!raw) return null;
  if (raw === 'pns') return 'PNS';
  if (raw === 'pppk' || raw === 'p3k') return 'PPPK';
  if (['non_asn', 'nonasn', 'honorer', 'gtt', 'ptt', 'gty', 'pty'].includes(raw)) return 'Non ASN';
  return null;
}

export default function PantauGtk() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('guru');
  const [q, setQ] = useState('');
  const res = useCached<Gtk[]>('pantau.gtk.semua', () => request<Gtk[]>('/users', { query: { exclude_mutation: true } }), { staleTime: 30 * 60_000 });

  const { guru, tendik } = useMemo(() => {
    const all = (res.data ?? []).filter((u) => u.full_name);
    const isGuru = (u: Gtk) => (u.roles ?? []).some((r) => GURU_ROLES.includes(r));
    const g = all.filter(isGuru);
    const t = all.filter((u) => !isGuru(u) && (u.roles ?? []).some((r) => TENDIK_ROLES.includes(r)));
    const urut = (a: Gtk, b: Gtk) => (a.full_name ?? '').localeCompare(b.full_name ?? '');
    return { guru: g.sort(urut), tendik: t.sort(urut) };
  }, [res.data]);
  const src = tab === 'guru' ? guru : tendik;
  const rows = src.filter((u) => cocok(`${u.full_name} ${u.nip_nuptk ?? ''} ${u.peg_id ?? ''}`, q));
  const hitung = (s: string) => src.filter((u) => (labelKepegawaian(u) ?? 'Belum diisi') === s).length;

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
      <SegmentedControl<Tab> segments={[{ value: 'guru', label: `Guru (${guru.length})` }, { value: 'tendik', label: `Tendik (${tendik.length})` }]} value={tab} onChange={setTab} />
      <SearchBox value={q} onChange={setQ} placeholder="Cari nama, NIP/NUPTK, PegID…" />
      {res.data ? (
        <T variant="caption" tone="muted">
          L {src.filter((u) => u.gender === 'L').length} · P {src.filter((u) => u.gender === 'P').length} · PNS {hitung('PNS')} · PPPK {hitung('PPPK')} · Non ASN {hitung('Non ASN')} · belum diisi {hitung('Belum diisi')}
        </T>
      ) : null}
    </View>
  );

  return (
    <Screen title="Data GTK" subtitle="Guru & tenaga kependidikan · hanya lihat" back scroll={false} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      {res.loading ? <>{header}<CardSkeleton lines={6} /></> : res.error && !res.data ? (
        <>{header}<ErrorState message="Data GTK belum tersimpan di perangkat." onRetry={res.refresh} compact /></>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(u) => u.id}
          ListHeaderComponent={header}
          ListEmptyComponent={<Card><EmptyState icon="people-outline" title="Tidak ada data" compact /></Card>}
          refreshing={res.refreshing}
          onRefresh={res.refresh}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          renderItem={({ item: u }) => (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/profil-gtk', params: { id: u.id } })}
              style={({ pressed }) => [styles.item, { borderBottomColor: colors.divider, opacity: pressed ? 0.7 : 1 }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <T weight="medium" numberOfLines={1}>{u.full_name}</T>
                <T variant="caption" tone="muted" numberOfLines={1}>
                  {[u.nip_nuptk ? `NIP/NUPTK ${u.nip_nuptk}` : null, labelKepegawaian(u), u.gender === 'L' ? 'L' : u.gender === 'P' ? 'P' : null].filter(Boolean).join(' · ') || '-'}
                </T>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
