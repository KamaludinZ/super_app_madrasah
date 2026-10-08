/**
 * Laporan unit layanan (Kepala Madrasah) — native, ringkasan dari /admin/bk/laporan, /admin/uks/laporan,
 * /admin/perpus/laporan dan /admin/sarpras/kerusakan (hanya lihat). Parameter `unit` = bk | uks | perpus | sarpras.
 * BK/UKS/Perpus memakai ringkasan rentang tanggal (…/laporan/summary); Sarpras menampilkan laporan kerusakan
 * dengan hitungan per status dan saringan status. Data rinci & pengelolaan tetap di modul web unit masing-masing.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { pantau, BkRingkasan, Kerusakan, PerpusRingkasan, UksRingkasan } from '@/pantau/api';
import { Bars, cocok, Counts, SearchBox } from '@/pantau/ui';
import { useCached } from '@/hooks/useCached';
import { formatDateShort, todayISO } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { DateField } from '@/components/ui/DateField';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';

type Unit = 'bk' | 'uks' | 'perpus' | 'sarpras';
const JUDUL: Record<Unit, string> = { bk: 'Laporan BK', uks: 'Laporan UKS', perpus: 'Laporan Perpustakaan', sarpras: 'Kerusakan Sarpras' };
const STATUS_RUSAK: Record<string, BadgeTone> = { Dilaporkan: 'warning', Diperbaiki: 'brand', Selesai: 'success', 'Tidak Dapat Diperbaiki': 'error' };
const TINGKAT: Record<string, BadgeTone> = { Ringan: 'neutral', Sedang: 'warning', Berat: 'error' };

function Bagian({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card style={{ gap: spacing.sm }}><T weight="semibold">{title}</T>{children}</Card>;
}

function Bk({ dari, sampai }: { dari: string; sampai: string }) {
  const { colors } = useTheme();
  const res = useCached<BkRingkasan>(`pantau.bk.${dari}.${sampai}`, () => pantau.bk(dari, sampai));
  const d = res.data;
  return (
    <Muat res={res}>
      {d ? (
        <>
          <Card><Counts items={[
            { label: 'Konseling', value: d.total_kunjungan, color: colors.brandPrimary }, { label: 'Home visit', value: d.total_home_visit },
            { label: 'CLKB', value: d.total_clkb }, { label: 'PCL', value: d.total_pcl },
          ]} /></Card>
          {d.clkb_belum_ditanggapi || d.pcl_belum_ditanggapi ? (
            <Card tone="warning"><T variant="caption">Belum ditanggapi Guru BK: CLKB {d.clkb_belum_ditanggapi} · PCL {d.pcl_belum_ditanggapi}</T></Card>
          ) : null}
          <Bagian title="Layanan konseling per jenis"><Bars data={d.kunjungan_by_jenis} /></Bagian>
        </>
      ) : null}
    </Muat>
  );
}

function Uks({ dari, sampai }: { dari: string; sampai: string }) {
  const { colors } = useTheme();
  const res = useCached<UksRingkasan>(`pantau.uks.${dari}.${sampai}`, () => pantau.uks(dari, sampai));
  const d = res.data;
  return (
    <Muat res={res}>
      {d ? (
        <>
          <Card><Counts items={[
            { label: 'Kunjungan', value: d.total_kunjungan, color: colors.brandPrimary }, { label: 'Obat keluar', value: d.total_obat_keluar_transaksi },
            { label: 'Jenis obat', value: d.total_jenis_obat }, { label: 'Stok menipis', value: d.obat_stok_menipis.length, color: d.obat_stok_menipis.length ? colors.error : undefined },
          ]} /></Card>
          <Bagian title="Penanganan"><Bars data={d.kunjungan_by_jenis_penanganan} /></Bagian>
          <Bagian title="Kondisi pulang"><Bars data={d.kunjungan_by_kondisi_pulang} /></Bagian>
          <Bagian title="Obat paling banyak dipakai"><Bars data={d.most_used_obat.map((o) => ({ label: o.nama_obat, value: o.jumlah }))} /></Bagian>
          {d.obat_stok_menipis.length ? (
            <Bagian title="Stok obat menipis">
              {d.obat_stok_menipis.map((o) => (
                <View key={o.id} style={styles.row}>
                  <T variant="caption" style={{ flex: 1 }}>{o.nama_obat}</T>
                  <T variant="caption" weight="semibold" color={colors.error}>{o.stok_tersisa ?? 0} {o.satuan ?? ''}</T>
                </View>
              ))}
            </Bagian>
          ) : null}
        </>
      ) : null}
    </Muat>
  );
}

function Perpus({ dari, sampai }: { dari: string; sampai: string }) {
  const { colors } = useTheme();
  const res = useCached<PerpusRingkasan>(`pantau.perpus.${dari}.${sampai}`, () => pantau.perpus(dari, sampai));
  const d = res.data;
  return (
    <Muat res={res}>
      {d ? (
        <>
          <Card><Counts items={[
            { label: 'Kunjungan', value: d.total_kunjungan, color: colors.brandPrimary }, { label: 'Peminjaman', value: d.total_peminjaman },
            { label: 'Dipinjam', value: d.peminjaman_aktif }, { label: 'Terlambat', value: d.peminjaman_terlambat, color: d.peminjaman_terlambat ? colors.error : undefined },
          ]} /></Card>
          <Card><T variant="caption" tone="secondary">Koleksi: {d.total_judul_koleksi} judul · {d.total_eksemplar} eksemplar ({d.total_eksemplar_tersedia} tersedia)</T></Card>
          <Bagian title="Kunjungan per tujuan"><Bars data={d.kunjungan_by_tujuan} /></Bagian>
          <Bagian title="Paling banyak dipinjam"><Bars data={d.most_borrowed.map((b) => ({ label: b.judul, value: b.jumlah }))} /></Bagian>
          <Bagian title="Koleksi per jenis"><Bars data={d.koleksi_by_jenis} /></Bagian>
        </>
      ) : null}
    </Muat>
  );
}

function Sarpras() {
  const { colors } = useTheme();
  const res = useCached<Kerusakan[]>('pantau.kerusakan', pantau.kerusakan);
  const [status, setStatus] = useState<string>('aktif');
  const [q, setQ] = useState('');
  const all = res.data ?? [];
  const aktif = (k: Kerusakan) => k.status === 'Dilaporkan' || k.status === 'Diperbaiki' || !k.status;
  const rows = all.filter((k) => (status === 'aktif' ? aktif(k) : status === 'semua' ? true : k.status === status))
    .filter((k) => cocok(`${k.aset_nama} ${k.deskripsi_kerusakan}`, q));
  const n = (s: string) => all.filter((k) => k.status === s).length;
  return (
    <Muat res={res}>
      <Card><Counts items={[
        { label: 'Dilaporkan', value: n('Dilaporkan'), color: colors.warning }, { label: 'Diperbaiki', value: n('Diperbaiki'), color: colors.brandPrimary },
        { label: 'Selesai', value: n('Selesai'), color: colors.success }, { label: 'Tak bisa', value: n('Tidak Dapat Diperbaiki'), color: colors.error },
      ]} /></Card>
      <SegmentedControl small segments={[{ value: 'aktif', label: 'Belum selesai' }, { value: 'Selesai', label: 'Selesai' }, { value: 'semua', label: 'Semua' }]} value={status} onChange={setStatus} />
      <SearchBox value={q} onChange={setQ} placeholder="Cari aset atau kerusakan…" />
      {rows.length === 0 ? <Card><EmptyState icon="construct-outline" title="Tidak ada laporan" compact /></Card> : rows.map((k) => (
        <Card key={k.id} style={{ gap: 4 }}>
          <View style={styles.row}>
            <T weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{k.aset_nama ?? 'Aset'}</T>
            {k.status ? <Badge label={k.status} tone={STATUS_RUSAK[k.status] ?? 'neutral'} small /> : null}
          </View>
          <T variant="caption" tone="secondary">{k.deskripsi_kerusakan}</T>
          <View style={styles.row}>
            <T variant="small" tone="muted" style={{ flex: 1 }}>
              Dilaporkan {formatDateShort(k.tanggal_lapor)}{k.tanggal_perbaikan ? ` · diperbaiki ${formatDateShort(k.tanggal_perbaikan)}` : ''}
              {k.biaya_perbaikan ? ` · Rp${Math.round(k.biaya_perbaikan).toLocaleString('id-ID')}` : ''}
            </T>
            {k.tingkat_kerusakan ? <Badge label={k.tingkat_kerusakan} tone={TINGKAT[k.tingkat_kerusakan] ?? 'neutral'} small /> : null}
          </View>
        </Card>
      ))}
    </Muat>
  );
}

function Muat({ res, children }: { res: { loading: boolean; error: unknown; data?: unknown; refresh: () => unknown }; children: React.ReactNode }) {
  if (res.loading) return <CardSkeleton lines={5} />;
  if (res.error && !res.data) return <ErrorState message="Laporan belum tersimpan di perangkat." onRetry={() => void res.refresh()} compact />;
  return <>{children}</>;
}

export default function PantauLayanan() {
  const p = useLocalSearchParams<{ unit?: string }>();
  const unit: Unit = p.unit === 'uks' || p.unit === 'perpus' || p.unit === 'sarpras' ? p.unit : 'bk';
  const [dari, setDari] = useState(`${todayISO().slice(0, 7)}-01`);
  const [sampai, setSampai] = useState(todayISO());
  const qc = useQueryClient();
  const [segar, setSegar] = useState(false);
  const muatUlang = async () => {
    setSegar(true);
    await qc.invalidateQueries({ predicate: (x) => /^pantau\.(bk|uks|perpus|kerusakan)/.test(String(x.queryKey[0])) });
    setSegar(false);
  };

  return (
    <Screen title={JUDUL[unit]} subtitle="Ringkasan · hanya lihat" back refreshing={segar} onRefresh={muatUlang}>
      <View style={{ gap: spacing.md }}>
        {unit !== 'sarpras' ? (
          <View style={styles.two}>
            <DateField label="Dari" value={dari} max={sampai} onChange={(v) => v && setDari(v)} style={{ flex: 1 }} />
            <DateField label="Sampai" value={sampai} min={dari} max={todayISO()} onChange={(v) => v && setSampai(v)} style={{ flex: 1 }} />
          </View>
        ) : null}
        {unit === 'bk' ? <Bk dari={dari} sampai={sampai} /> : unit === 'uks' ? <Uks dari={dari} sampai={sampai} /> : unit === 'perpus' ? <Perpus dari={dari} sampai={sampai} /> : <Sarpras />}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  two: { flexDirection: 'row', gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
