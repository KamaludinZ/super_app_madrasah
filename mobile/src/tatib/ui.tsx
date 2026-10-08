/**
 * Komponen bersama poin Tata Tertib (padanan RingkasanPoin, RiwayatPoin & RincianPoinDialog web):
 * kartu ringkasan (poin kebaikan, pelanggaran, saldo, penanda perlu perhatian) dan riwayat catatan
 * yang bisa dibuka untuk melihat aturan, kondisi, petugas, catatan dan tindak lanjut.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { CatatanPoin, RangkumanPoin } from './api';
import { nilaiPoin } from './api';
import { formatDateLong, formatDateShort } from '@/utils/time';
import { radius, spacing, useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/States';

export const fmtPoin = (n: number) => (n > 0 ? `+${n}` : String(n));

export function RingkasanPoinCard({ r, batas }: { r: RangkumanPoin; batas?: number }) {
  const { colors } = useTheme();
  const kotak = [
    { label: 'Kebaikan', value: fmtPoin(r.total_plus), sub: `${r.jumlah_kebaikan} catatan`, color: colors.success },
    { label: 'Pelanggaran', value: String(r.total_minus), sub: `${r.jumlah_pelanggaran} catatan`, color: colors.error },
    { label: 'Saldo', value: fmtPoin(r.saldo), sub: 'kebaikan + pelanggaran', color: r.saldo < 0 ? colors.error : colors.onSurface },
  ];
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={styles.row}>
        {kotak.map((k) => (
          <View key={k.label} style={[styles.box, { backgroundColor: colors.surfaceSecondary }]}>
            <T variant="title" color={k.color}>{k.value}</T>
            <T variant="small" weight="semibold">{k.label}</T>
            <T variant="small" tone="muted" center>{k.sub}</T>
          </View>
        ))}
      </View>
      {r.perlu_perhatian ? (
        <View style={[styles.alert, { backgroundColor: colors.errorSoft }]}>
          <Icon name="alert-circle" size={18} color={colors.error} />
          <T variant="caption" color={colors.error} style={{ flex: 1 }}>
            Perlu perhatian: akumulasi pelanggaran mencapai batas{batas != null ? ` (${batas})` : ''}.
          </T>
        </View>
      ) : null}
    </Card>
  );
}

type Saring = 'semua' | 'kebaikan' | 'pelanggaran';

export function RiwayatPoinList({ records, tampilSiswa, onSiswa }: { records: CatatanPoin[]; tampilSiswa?: boolean; onSiswa?: (c: CatatanPoin) => void }) {
  const { colors } = useTheme();
  const [saring, setSaring] = useState<Saring>('semua');
  const [buka, setBuka] = useState<string | null>(null);
  const list = records.filter((c) => saring === 'semua' || (saring === 'kebaikan' ? nilaiPoin(c) > 0 : nilaiPoin(c) < 0));
  return (
    <View style={{ gap: spacing.md }}>
      <SegmentedControl<Saring> small value={saring} onChange={setSaring}
        segments={[{ value: 'semua', label: 'Semua' }, { value: 'kebaikan', label: 'Kebaikan' }, { value: 'pelanggaran', label: 'Pelanggaran' }]} />
      {list.length === 0 ? <Card><EmptyState icon="shield-checkmark-outline" title="Belum ada catatan" compact /></Card> : list.map((c) => {
        const n = nilaiPoin(c);
        const terbuka = buka === c.id;
        return (
          <Card key={c.id} style={{ gap: spacing.sm }}>
            <Pressable onPress={() => setBuka(terbuka ? null : c.id)} accessibilityRole="button" accessibilityState={{ expanded: terbuka }} style={styles.row}>
              <View style={[styles.poin, { backgroundColor: n > 0 ? colors.brandTertiary : colors.errorSoft }]}>
                <T weight="bold" color={n > 0 ? colors.success : colors.error}>{fmtPoin(n)}</T>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T weight="medium" numberOfLines={terbuka ? undefined : 2}>{c.tatib_nama ?? '-'}</T>
                <T variant="caption" tone="muted" numberOfLines={1}>
                  {[c.tanggal ? formatDateShort(c.tanggal) : null, tampilSiswa ? c.siswa_nama : null, tampilSiswa ? c.siswa_kelas : c.kategori_nama].filter(Boolean).join(' · ')}
                </T>
              </View>
              {c.tindak_lanjut?.length ? <Badge label={`${c.tindak_lanjut.length} TL`} tone="brand" small /> : null}
              <Icon name={terbuka ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
            </Pressable>
            {terbuka ? (
              <View style={[styles.detail, { borderTopColor: colors.divider }]}>
                <Baris label="Tanggal" value={c.tanggal ? formatDateLong(c.tanggal) : null} />
                <Baris label="Jenis" value={n > 0 ? 'Kebaikan' : 'Pelanggaran'} />
                <Baris label="Kategori" value={c.kategori_nama} />
                <Baris label="Kode" value={c.tatib_kode} />
                <Baris label="Kondisi" value={c.kondisi} />
                <Baris label="Dicatat oleh" value={c.petugas_nama} />
                <Baris label="Catatan" value={c.catatan} />
                {c.tindak_lanjut?.length ? (
                  <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                    <T variant="caption" weight="semibold">Tindak lanjut</T>
                    {c.tindak_lanjut.map((t, i) => (
                      <View key={t.id ?? i} style={{ gap: 2 }}>
                        <T variant="caption">{t.uraian}</T>
                        <T variant="small" tone="muted">{[t.tanggal ? formatDateShort(t.tanggal) : null, t.petugas_nama].filter(Boolean).join(' · ')}</T>
                      </View>
                    ))}
                  </View>
                ) : null}
                {tampilSiswa && onSiswa && c.siswa_id ? (
                  <T variant="label" tone="brand" onPress={() => onSiswa(c)}>Lihat semua poin {c.siswa_nama ?? 'siswa'} →</T>
                ) : null}
              </View>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

function Baris({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.baris}>
      <T variant="caption" tone="muted" style={{ width: 96 }}>{label}</T>
      <T variant="caption" style={{ flex: 1 }}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  box: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: 4, borderRadius: radius.md, gap: 2 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md },
  poin: { minWidth: 48, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  detail: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm, gap: 4 },
  baris: { flexDirection: 'row', gap: spacing.sm },
});
