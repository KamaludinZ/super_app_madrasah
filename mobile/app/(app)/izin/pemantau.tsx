/**
 * Pemantau Izin Hari Ini (sama dengan /izin/pemantau di web) untuk kepala TU: izin yang sudah disetujui
 * kepala madrasah untuk hari ini — data & papan yang sama dengan dashboard satpam. Hanya-lihat;
 * diperbarui tiap menit selama layar terbuka.
 */
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Text';
import { Notice } from '@/components/ui/Notice';
import { formatDateLong, todayISO } from '@/utils/time';
import { Izin, PERAN_PEMANTAU_IZIN, PapanIzin as DataPapanIzin, bolehPantauIzin, izinApi, kelompokkanWaktu } from '@/izin/api';
import { PapanIzin, useJam } from '@/izin/PapanIzin';
import { DetailIzinSheet } from '@/izin/DetailIzinSheet';
import { AksesDitolak } from '@/izin/AksesDitolak';

export default function PemantauIzinScreen() {
  const { colors } = useTheme();
  const { activeRole } = useAuth();
  const boleh = bolehPantauIzin(activeRole);
  const papan = useCached<DataPapanIzin>(`izin.papan.${todayISO()}`, izinApi.papanHariIni, { enabled: boleh });
  const jam = useJam();
  const [dipilih, setDipilih] = useState<Izin | null>(null);

  // Izin yang baru disetujui kepala madrasah ikut muncul tanpa menarik layar. Fungsi refresh berganti
  // identitas tiap render, jadi disimpan di ref agar interval tidak terus diulang dari awal.
  const segarkan = useRef(papan.refresh);
  segarkan.current = papan.refresh;
  useEffect(() => {
    if (!boleh) return undefined;
    const t = setInterval(() => { void segarkan.current(); }, 60_000);
    return () => clearInterval(t);
  }, [boleh]);

  if (!boleh) {
    return <AksesDitolak judul="Pemantau Izin" untuk="kepala tata usaha dan kepala madrasah" peranBerhak={[...PERAN_PEMANTAU_IZIN, 'kepala_sekolah']} />;
  }

  const items = papan.data?.items ?? [];
  const g = kelompokkanWaktu(items, jam);
  const kotak = [
    { label: 'Izin hari ini', nilai: items.length, warna: colors.brandPrimary },
    { label: 'Sedang izin', nilai: g.berlangsung.length, warna: colors.success },
    { label: 'Belum mulai', nilai: g.akan_datang.length, warna: undefined },
    { label: 'Selesai', nilai: g.selesai.length, warna: colors.muted },
  ];

  return (
    <Screen title="Pemantau Izin" subtitle={`${formatDateLong(papan.data?.tanggal ?? todayISO())} · pukul ${jam} WIB`} back
      refreshing={papan.refreshing} onRefresh={papan.refresh} offline={{ fromCache: papan.fromCache, updatedAt: papan.updatedAt }}>
      {papan.data?.tiruan ? <Notice tone="warning" icon="flask-outline" text="Server belum menyediakan data izin — menampilkan data contoh untuk mencoba tampilan." /> : null}
      <View style={[styles.grid, { marginTop: papan.data?.tiruan ? spacing.md : 0 }]}>
        {kotak.map((k) => (
          <View key={k.label} style={[styles.kotak, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityLabel={`${k.label} ${k.nilai}`}>
            <T variant="small" tone="secondary">{k.label}</T>
            <T variant="title" color={k.warna}>{papan.loading ? '–' : k.nilai}</T>
          </View>
        ))}
      </View>
      <T variant="subtitle" style={styles.judul}>Izin disetujui hari ini</T>
      <PapanIzin items={items} jam={jam} loading={papan.loading} error={papan.error} onRetry={papan.refresh} onPilih={setDipilih} />
      <DetailIzinSheet izin={dipilih} jam={jam} onTutup={() => setDipilih(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kotak: { flexBasis: '48%', flexGrow: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.md, gap: 2 },
  judul: { marginTop: spacing.xl, marginBottom: spacing.md },
});
