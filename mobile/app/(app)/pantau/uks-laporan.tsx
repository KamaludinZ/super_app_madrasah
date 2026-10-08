/**
 * Laporan UKS Baru (Kepala Madrasah, hanya lihat) — native, pengganti /admin/uks/laporan-baru.
 * Per bulan: tab Diagnosa (GET /uks/laporan-baru/diagnosa — ringkasan & diagnosa terbanyak, dipisah siswa/GTK;
 * ketuk diagnosa untuk daftar kunjungannya, GET /uks/laporan-baru/diagnosa/{id}/kunjungan)
 * dan tab Opname (GET /uks/laporan-baru/opname — stok awal/masuk/keluar/akhir obat & BMHP, status menipis/habis).
 * Ekspor Excel/PDF tetap di web.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { request, errorMessage } from '@/api/client';
import { bulanIni, Counts, MonthBar, pecahBulan } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { formatDateShort } from '@/utils/time';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';

type RekapDx = {
  ringkasan: { total_kunjungan: number; dengan_diagnosa: number; tanpa_diagnosa: number; pasien_unik: number; jenis_diagnosa: number };
  items: { diagnosa_id: string; nama?: string | null; kode?: string | null; utama: number; tambahan: number; total: number; jumlah_pasien: number }[];
};
type RekapOpname = {
  ringkasan: { jumlah_item: number; total_masuk: number; total_keluar: number; item_menipis: number; item_habis: number };
  items: { id: string; nama?: string | null; satuan?: string | null; stok_awal: number; masuk: number; keluar: number; stok_akhir: number; status: string; tanggal_kadaluarsa_terdekat?: string | null }[];
};
type Tab = 'diagnosa' | 'opname';
const STATUS: Record<string, BadgeTone> = { Aman: 'success', Menipis: 'warning', Habis: 'error' };

type Periode = { periode: string; tahun: string; bulan: string };
type KunjunganDx = { id: string; tanggal?: string; waktu?: string | null; pasien_nama?: string | null; pasien_kelas?: string | null; keluhan?: string | null; peran: 'utama' | 'tambahan' };

function RincianDx({ id, tipe, per }: { id: string; tipe: 'siswa' | 'gtk'; per: Periode }) {
  const { colors } = useTheme();
  const res = useCached<{ items: KunjunganDx[] }>(`pantau.uks.dx.${per.tahun}-${per.bulan}.${tipe}.${id}`,
    () => request(`/uks/laporan-baru/diagnosa/${id}/kunjungan`, { query: { ...per, pasien_tipe: tipe } }));
  if (res.loading) return <CardSkeleton lines={2} />;
  if (!res.data) return <T variant="caption" tone="muted">{errorMessage(res.error, 'Rincian belum bisa dimuat.')}</T>;
  return (
    <View style={{ gap: spacing.xs, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border }}>
      {res.data.items.map((k) => (
        <View key={k.id} style={{ gap: 1 }}>
          <T variant="caption" weight="medium">{k.pasien_nama ?? '-'}{k.peran === 'tambahan' ? ' · tambahan' : ''}</T>
          <T variant="small" tone="muted">{[k.tanggal ? formatDateShort(k.tanggal) : null, k.waktu, k.pasien_kelas ? `Kelas ${k.pasien_kelas}` : null, k.keluhan].filter(Boolean).join(' · ')}</T>
        </View>
      ))}
    </View>
  );
}

function Diagnosa({ judul, d, tipe, per }: { judul: string; d: RekapDx; tipe: 'siswa' | 'gtk'; per: Periode }) {
  const { colors } = useTheme();
  const [buka, setBuka] = useState<string | null>(null);
  return (
    <Card style={{ gap: spacing.sm }}>
      <T weight="semibold">{judul}</T>
      <Counts items={[
        { label: 'Kunjungan', value: d.ringkasan.total_kunjungan, color: colors.brandPrimary }, { label: 'Pasien', value: d.ringkasan.pasien_unik },
        { label: 'Terdiagnosa', value: d.ringkasan.dengan_diagnosa }, { label: 'Tanpa dx', value: d.ringkasan.tanpa_diagnosa },
      ]} />
      {d.items.length === 0 ? <T variant="caption" tone="muted">Belum ada diagnosa.</T> : d.items.map((x, i) => {
        const terbuka = buka === x.diagnosa_id;
        return (
          <View key={x.diagnosa_id} style={[{ gap: spacing.xs }, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
            <Pressable onPress={() => setBuka(terbuka ? null : x.diagnosa_id)} accessibilityRole="button" accessibilityState={{ expanded: terbuka }} style={styles.row}>
              <View style={{ flex: 1 }}>
                <T variant="caption" weight="medium">{x.kode ? `${x.kode} · ` : ''}{x.nama ?? '-'}</T>
                <T variant="small" tone="muted">{x.utama} utama · {x.tambahan} tambahan · {x.jumlah_pasien} pasien</T>
              </View>
              <T weight="bold">{x.total}</T>
              <Icon name={terbuka ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
            </Pressable>
            {terbuka ? <RincianDx id={x.diagnosa_id} tipe={tipe} per={per} /> : null}
          </View>
        );
      })}
    </Card>
  );
}

function Opname({ judul, d }: { judul: string; d: RekapOpname }) {
  const { colors } = useTheme();
  const urut = [...d.items].sort((a, b) => ['Habis', 'Menipis', 'Aman'].indexOf(a.status) - ['Habis', 'Menipis', 'Aman'].indexOf(b.status));
  return (
    <Card style={{ gap: spacing.sm }}>
      <T weight="semibold">{judul}</T>
      <T variant="caption" tone="muted">{d.ringkasan.jumlah_item} item · masuk {d.ringkasan.total_masuk} · keluar {d.ringkasan.total_keluar} · menipis {d.ringkasan.item_menipis} · habis {d.ringkasan.item_habis}</T>
      {urut.length === 0 ? <T variant="caption" tone="muted">Belum ada data.</T> : urut.map((x, i) => (
        <View key={x.id} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider, paddingTop: spacing.sm }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <T variant="caption" weight="medium">{x.nama ?? '-'}</T>
            <T variant="small" tone="muted">Awal {x.stok_awal} · +{x.masuk} · −{x.keluar} · akhir {x.stok_akhir} {x.satuan ?? ''}</T>
          </View>
          <Badge label={x.status} tone={STATUS[x.status] ?? 'neutral'} small />
        </View>
      ))}
    </Card>
  );
}

export default function UksLaporanBaru() {
  const [tab, setTab] = useState<Tab>('diagnosa');
  const [month, setMonth] = useState(bulanIni());
  const { y, m } = pecahBulan(month);
  const q = { periode: 'bulanan', tahun: String(y), bulan: String(m).padStart(2, '0') };
  const dx = useCached<{ siswa: RekapDx; gtk: RekapDx }>(`pantau.uks.dx.${month}`, () => request('/uks/laporan-baru/diagnosa', { query: q }), { enabled: tab === 'diagnosa' });
  const op = useCached<{ obat: RekapOpname; bmhp: RekapOpname }>(`pantau.uks.opname.${month}`, () => request('/uks/laporan-baru/opname', { query: q }), { enabled: tab === 'opname' });
  const res = tab === 'diagnosa' ? dx : op;

  return (
    <Screen title="Laporan UKS" subtitle="Diagnosa & opname persediaan · hanya lihat" back refreshing={res.refreshing} onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      <View style={{ gap: spacing.md }}>
        <SegmentedControl<Tab> value={tab} onChange={setTab} segments={[{ value: 'diagnosa', label: 'Diagnosa' }, { value: 'opname', label: 'Opname' }]} />
        <MonthBar month={month} onChange={setMonth} />
        {res.loading ? <CardSkeleton lines={6} /> : !res.data ? (
          <ErrorState message={errorMessage(res.error, 'Laporan belum bisa dimuat.')} onRetry={res.refresh} compact />
        ) : tab === 'diagnosa' && dx.data ? (
          <>
            <Diagnosa judul="Siswa" d={dx.data.siswa} tipe="siswa" per={q} />
            <Diagnosa judul="Guru & tendik" d={dx.data.gtk} tipe="gtk" per={q} />
          </>
        ) : op.data ? (
          <>
            <Opname judul="Obat" d={op.data.obat} />
            <Opname judul="BMHP" d={op.data.bmhp} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm } });
