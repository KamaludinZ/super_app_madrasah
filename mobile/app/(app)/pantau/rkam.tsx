/**
 * DANA RKAM (Kepala Madrasah) — native, pengganti /admin/dana-rkam (hanya lihat). Per tahun anggaran
 * (bawaan sama dengan web: Juli ke atas = tahun/tahun+1): total anggaran & realisasi BOS dan Komite,
 * serapan per bidang, dan daftar mata anggaran (GET /rkam/budget-items).
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { pantau, RkamItem } from '@/pantau/api';
import { cocok, PctRow, SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { wibParts } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { IconButton } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

const BIDANG: Record<string, string> = {
  sarana_prasarana: 'Sarana & Prasarana', humas: 'Humas', kesiswaan: 'Kesiswaan', kurikulum: 'Kurikulum', tata_usaha: 'Tata Usaha',
};
const rp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;
const tahunBawaan = () => { const { year, month } = wibParts(Date.now()); return month >= 6 ? year : year - 1; }; // month 0-11: Juli = 6
const pagu = (i: RkamItem) => (i.allocated_bos ?? 0) + (i.allocated_komite ?? 0);
const real = (i: RkamItem) => (i.realized_bos ?? 0) + (i.realized_komite ?? 0);
const pct = (r: number, a: number) => (a > 0 ? (r / a) * 100 : null);

export default function PantauRkam() {
  const { colors } = useTheme();
  const [th, setTh] = useState(tahunBawaan());
  const fy = `${th}/${th + 1}`;
  const res = useCached<RkamItem[]>(`pantau.rkam.${fy}`, () => pantau.rkam(fy));
  const [q, setQ] = useState('');
  const items = res.data ?? [];

  const tot = useMemo(() => items.reduce((t, i) => ({
    ab: t.ab + (i.allocated_bos ?? 0), ak: t.ak + (i.allocated_komite ?? 0), rb: t.rb + (i.realized_bos ?? 0), rk: t.rk + (i.realized_komite ?? 0),
  }), { ab: 0, ak: 0, rb: 0, rk: 0 }), [items]);
  const perBidang = useMemo(() => {
    const m = new Map<string, { a: number; r: number }>();
    items.forEach((i) => { const k = i.bidang || 'lainnya'; const v = m.get(k) ?? { a: 0, r: 0 }; m.set(k, { a: v.a + pagu(i), r: v.r + real(i) }); });
    return [...m.entries()].sort((a, b) => b[1].a - a[1].a);
  }, [items]);
  const rows = items.filter((i) => cocok(`${i.code ?? ''} ${i.name} ${i.category ?? ''}`, q));

  return (
    <Screen title="DANA RKAM" subtitle="Rencana kegiatan & anggaran · hanya lihat" back refreshing={res.refreshing} onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <View style={styles.yearBar}>
          <IconButton name="chevron-back" accessibilityLabel="Tahun anggaran sebelumnya" onPress={() => setTh(th - 1)} color={colors.onSurface} />
          <T variant="subtitle">Tahun anggaran {fy}</T>
          <IconButton name="chevron-forward" accessibilityLabel="Tahun anggaran berikutnya" onPress={() => setTh(th + 1)} color={colors.onSurface} />
        </View>
        {res.loading ? <CardSkeleton lines={6} /> : res.error && !res.data ? (
          <ErrorState message="Data RKAM belum tersimpan di perangkat." onRetry={res.refresh} compact />
        ) : items.length === 0 ? (
          <Card><EmptyState icon="wallet-outline" title="Belum ada anggaran" message={`Belum ada mata anggaran untuk ${fy}.`} compact /></Card>
        ) : (
          <>
            <Card style={{ gap: spacing.md }}>
              <PctRow netral title={`Total ${rp(tot.ab + tot.ak)}`} subtitle={`Realisasi ${rp(tot.rb + tot.rk)}`} pct={pct(tot.rb + tot.rk, tot.ab + tot.ak)} ada={tot.ab + tot.ak > 0} />
              <PctRow netral title={`BOS ${rp(tot.ab)}`} subtitle={`Realisasi ${rp(tot.rb)} · sisa ${rp(tot.ab - tot.rb)}`} pct={pct(tot.rb, tot.ab)} ada={tot.ab > 0} />
              <PctRow netral title={`Komite ${rp(tot.ak)}`} subtitle={`Realisasi ${rp(tot.rk)} · sisa ${rp(tot.ak - tot.rk)}`} pct={pct(tot.rk, tot.ak)} ada={tot.ak > 0} />
            </Card>
            <Card style={{ gap: spacing.md }}>
              <T weight="semibold">Serapan per bidang</T>
              {perBidang.map(([b, v]) => (
                <PctRow netral key={b} title={BIDANG[b] ?? (b === 'lainnya' ? 'Lainnya' : b)} subtitle={`${rp(v.r)} dari ${rp(v.a)}`} pct={pct(v.r, v.a)} ada={v.a > 0} />
              ))}
            </Card>
            <SearchBox value={q} onChange={setQ} placeholder="Cari mata anggaran…" />
            <Card style={{ gap: spacing.md }}>
              {rows.length === 0 ? <T variant="caption" tone="muted">Tidak ditemukan.</T> : rows.map((i, n) => (
                <View key={i.id} style={n > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.md } : undefined}>
                  <PctRow netral title={`${i.code ? `${i.code} ` : ''}${i.name}`} pct={pct(real(i), pagu(i))} ada={pagu(i) > 0}
                    subtitle={`${rp(real(i))} dari ${rp(pagu(i))}${i.bidang ? ` · ${BIDANG[i.bidang] ?? i.bidang}` : ''}`} />
                </View>
              ))}
            </Card>
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ yearBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } });
