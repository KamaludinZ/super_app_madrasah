/**
 * Dashboard satpam di Beranda aplikasi (sama isinya dengan /satpam di web): ringkasan, papan izin
 * disetujui hari ini, dan pengajuan izin sendiri. Hanya-lihat — satpam tidak menandai jam keluar/kembali;
 * mengetuk kartu membuka DetailIzinSheet.
 */
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useCached } from '@/hooks/useCached';
import { radius, spacing, useTheme } from '@/theme';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Icon, IconName } from '@/components/ui/Icon';
import { Notice } from '@/components/ui/Notice';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { errorMessage } from '@/api/client';
import { todayISO } from '@/utils/time';
import { DetailIzinSheet } from './DetailIzinSheet';
import { KartuPengajuan } from './KartuPengajuan';
import { PapanIzin, useJam } from './PapanIzin';
import {
  DaftarIzin, Izin, PapanIzin as DataPapanIzin, RingkasanSatpam, izinApi, kelompokkanWaktu, urutTerbaru,
} from './api';

/** Data dashboard satpam; `refresh` dipanggil tarik-untuk-menyegarkan di Beranda. */
export function useIzinSatpam(enabled: boolean) {
  const papan = useCached<DataPapanIzin>(`izin.papan.${todayISO()}`, izinApi.papanHariIni, { enabled });
  const saya = useCached<DaftarIzin>('izin.saya', izinApi.saya, { enabled });
  const ringkasan = useCached<RingkasanSatpam>(`izin.ringkasan-satpam.${todayISO()}`, izinApi.ringkasanSatpam, { enabled });
  return {
    papan, saya, ringkasan,
    refreshing: papan.refreshing || saya.refreshing || ringkasan.refreshing,
    refresh: () => { void papan.refresh(); void saya.refresh(); void ringkasan.refresh(); },
  };
}

function Tile({ icon, label, value, hint, color }: { icon: IconName; label: string; value: number; hint: string; color?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityLabel={`${label} ${value}`}>
      <View style={styles.tileHead}>
        <Icon name={icon} size={18} color={color ?? colors.brandPrimary} />
        <T variant="small" tone="secondary" numberOfLines={1} style={{ flex: 1 }}>{label}</T>
      </View>
      <T variant="title" color={color}>{value}</T>
      <T variant="small" tone="muted" numberOfLines={1}>{hint}</T>
    </View>
  );
}

export function DashboardSatpam({ data }: { data: ReturnType<typeof useIzinSatpam> }) {
  const { colors } = useTheme();
  const router = useRouter();
  const jam = useJam();
  // Catatan satpam hanya untuk izin di papan (milik orang lain), bukan pengajuan sendiri.
  const [dipilih, setDipilih] = useState<{ izin: Izin; bolehCatat: boolean; fokusCatatan?: boolean } | null>(null);
  const { papan, saya } = data;

  const items = papan.data?.items ?? [];
  const g = kelompokkanWaktu(items, jam);
  const milikSaya = [...(saya.data?.items ?? [])].sort(urutTerbaru);
  const menunggu = milikSaya.filter((i) => i.status === 'menunggu').length;
  const tiruan = papan.data?.tiruan || saya.data?.tiruan;
  // Angka ringkasan dari server (jam server WIB); data contoh / belum termuat dihitung dari daftar.
  const rs = data.ringkasan.data && !data.ringkasan.data.tiruan ? data.ringkasan.data : null;
  const r = rs ?? { izin_hari_ini: items.length, berlangsung: g.berlangsung.length, akan_datang: g.akan_datang.length, saya_menunggu: menunggu, jam };

  return (
    <View style={{ gap: spacing.sm }}>
      {tiruan ? <Notice tone="warning" icon="flask-outline" text="Server belum menyediakan data izin — menampilkan data contoh untuk mencoba tampilan." /> : null}

      <T variant="subtitle" style={{ marginTop: spacing.sm }}>Ringkasan</T>
      <View style={styles.grid}>
        <Tile icon="exit-outline" label="Izin hari ini" value={r.izin_hari_ini} hint="Disetujui kepala madrasah" />
        <Tile icon="time-outline" label="Sedang izin" value={r.berlangsung} hint={`Per pukul ${r.jam} WIB`} color={colors.success} />
        <Tile icon="hourglass-outline" label="Belum mulai" value={r.akan_datang} hint="Izin nanti hari ini" />
        <Tile icon="document-text-outline" label="Pengajuan saya" value={r.saya_menunggu} hint="Menunggu keputusan" color={r.saya_menunggu ? colors.onWarning : undefined} />
      </View>

      <View style={styles.sectionHead}>
        <T variant="subtitle">Papan izin hari ini</T>
        <T variant="caption" tone="muted">{items.length} izin</T>
      </View>
      <PapanIzin
        items={items}
        jam={jam}
        loading={papan.loading}
        error={papan.error}
        onRetry={papan.refresh}
        onPilih={(i) => setDipilih({ izin: i, bolehCatat: true })}
        onCatat={(i) => setDipilih({ izin: i, bolehCatat: true, fokusCatatan: true })}
      />

      <View style={styles.sectionHead}>
        <T variant="subtitle">Pengajuan saya</T>
        <T variant="label" tone="brand" onPress={() => router.push('/izin' as any)} accessibilityRole="link">Ajukan / kelola</T>
      </View>
      {saya.loading ? (
        <CardSkeleton lines={2} />
      ) : saya.error && !saya.data ? (
        <ErrorState message={errorMessage(saya.error, 'Gagal memuat pengajuan.')} onRetry={saya.refresh} compact />
      ) : milikSaya.length === 0 ? (
        <Card><EmptyState icon="document-text-outline" title="Belum ada pengajuan izin" compact /></Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {milikSaya.map((i) => <KartuPengajuan key={i.id} izin={i} onPress={() => setDipilih({ izin: i, bolehCatat: false })} />)}
        </View>
      )}

      <DetailIzinSheet izin={dipilih?.izin ?? null} bolehCatat={!!dipilih?.bolehCatat} fokusCatatan={!!dipilih?.fokusCatatan}
        jam={jam} onTutup={() => setDipilih(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '48%', flexGrow: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.md, gap: 4 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.xs },
});
