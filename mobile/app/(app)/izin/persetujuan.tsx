/**
 * Persetujuan Izin Kamad (sama dengan /izin/persetujuan di web), khusus kepala madrasah: pengajuan
 * menunggu (setujui dengan konfirmasi / tolak dengan alasan wajib), izin disetujui hari ini, dan riwayat
 * keputusan. Izin yang disetujui langsung tampil di papan pantau satpam.
 */
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/api/client';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { radius, spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { formatDateShort, formatDateTime, todayISO } from '@/utils/time';
import { roleLabel } from '@/utils/roles';
import {
  DaftarIzin, Izin, PapanIzin, PERAN_PEMUTUS_IZIN, STATUS_IZIN, bolehPutuskanIzin, izinApi, jamSekarangWIB, teksDurasi,
} from '@/izin/api';
import { DetailIzinSheet } from '@/izin/DetailIzinSheet';
import { TolakIzinSheet } from '@/izin/TolakIzinSheet';
import { AksesDitolak } from '@/izin/AksesDitolak';

type Segmen = 'menunggu' | 'hari-ini' | 'riwayat';
const waktuMs = (v?: string | null) => (v ? Date.parse(v) || 0 : 0);

function KartuKeputusan({ izin, onPress, aksi }: { izin: Izin; onPress: () => void; aksi?: React.ReactNode }) {
  const { colors } = useTheme();
  const s = STATUS_IZIN[izin.status] ?? STATUS_IZIN.menunggu;
  const durasi = teksDurasi(izin.jam_mulai, izin.jam_selesai);
  return (
    <Card onPress={onPress} accessibilityLabel={`Detail izin ${izin.pengaju_nama}`} style={{ gap: 4 }}>
      <View style={styles.row}>
        <T weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{izin.pengaju_nama}</T>
        {izin.status !== 'menunggu' ? <Badge label={s.label} tone={s.tone} small /> : null}
      </View>
      <T variant="small" tone="muted">
        {roleLabel(izin.pengaju_peran)} · {formatDateShort(izin.tanggal)} · {izin.jam_mulai}–{izin.jam_selesai}{durasi ? ` (${durasi})` : ''}
      </T>
      <T variant="caption">{izin.keperluan}</T>
      {izin.status === 'ditolak' && izin.alasan_penolakan ? (
        <View style={[styles.alasan, { backgroundColor: colors.errorSoft }]}>
          <T variant="caption" color={colors.error}>Alasan ditolak: {izin.alasan_penolakan}</T>
        </View>
      ) : null}
      {izin.status !== 'menunggu' && izin.diputuskan_pada ? (
        <T variant="small" tone="muted">Diputuskan {formatDateTime(izin.diputuskan_pada)}</T>
      ) : null}
      {aksi}
    </Card>
  );
}

export default function PersetujuanIzinScreen() {
  const { colors } = useTheme();
  const { user, activeRole } = useAuth();
  const boleh = bolehPutuskanIzin(activeRole);
  const menunggu = useCached<DaftarIzin>('izin.menunggu', izinApi.menunggu, { enabled: boleh });
  const riwayat = useCached<DaftarIzin>('izin.riwayat-keputusan', izinApi.riwayatKeputusan, { enabled: boleh });
  const papan = useCached<PapanIzin>(`izin.papan.${todayISO()}`, izinApi.papanHariIni, { enabled: boleh });
  const [segmen, setSegmen] = useState<Segmen>('menunggu');
  const [keputusan, setKeputusan] = useState<Record<string, Izin>>({}); // keputusan sesi ini (mode contoh / sebelum muat ulang)
  const [dipilih, setDipilih] = useState<Izin | null>(null);
  const [akanDitolak, setAkanDitolak] = useState<Izin | null>(null);
  const [sibukId, setSibukId] = useState<string | null>(null);

  const daftarMenunggu = useMemo(() => (menunggu.data?.items ?? []).filter((i) => !keputusan[i.id])
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.jam_mulai.localeCompare(b.jam_mulai)), [menunggu.data, keputusan]);
  const daftarRiwayat = useMemo(() => {
    const baru = Object.values(keputusan);
    return [...baru, ...(riwayat.data?.items ?? []).filter((i) => !keputusan[i.id])]
      .sort((a, b) => waktuMs(b.diputuskan_pada) - waktuMs(a.diputuskan_pada));
  }, [riwayat.data, keputusan]);
  const daftarHariIni = useMemo(() => {
    const t = papan.data?.tanggal ?? todayISO();
    const disetujuiBaru = Object.values(keputusan).filter((i) => i.status === 'disetujui' && i.tanggal === t);
    return [...(papan.data?.items ?? []).filter((i) => !keputusan[i.id]), ...disetujuiBaru]
      .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai));
  }, [papan.data, keputusan]);

  if (!boleh) return <AksesDitolak judul="Persetujuan Izin" untuk="kepala madrasah" peranBerhak={PERAN_PEMUTUS_IZIN} />;

  const pemutus = user?.full_name || 'Kepala Madrasah';
  const tiruan = !!(menunggu.data?.tiruan || riwayat.data?.tiruan || papan.data?.tiruan);
  const simpan = (baru: Izin) => {
    setKeputusan((k) => ({ ...k, [baru.id]: baru }));
    setDipilih((d) => (d?.id === baru.id ? baru : d));
  };

  const setujui = (izin: Izin) => Alert.alert(
    'Setujui izin?',
    `${izin.pengaju_nama} · ${formatDateShort(izin.tanggal)}, ${izin.jam_mulai}–${izin.jam_selesai}\n${izin.keperluan}`,
    [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Ya, setujui', onPress: async () => {
          setSibukId(izin.id);
          try {
            const h = await izinApi.setujui(izin, pemutus);
            simpan(h.izin);
            toast.success(`Izin ${izin.pengaju_nama} disetujui`, h.tiruan ? 'Contoh — belum tersimpan di server.'
              : izin.tanggal === todayISO() ? 'Langsung tampil di papan pantau satpam.' : undefined);
          } catch (e) {
            toast.error(errorMessage(e, 'Gagal menyetujui izin.'));
          } finally {
            setSibukId(null);
          }
        },
      },
    ],
  );

  const tolak = async (izin: Izin, alasan: string) => {
    setSibukId(izin.id);
    try {
      const h = await izinApi.tolak(izin, alasan, pemutus);
      simpan(h.izin);
      toast.success(`Izin ${izin.pengaju_nama} ditolak`, h.tiruan ? 'Contoh — belum tersimpan di server.' : 'Alasan terlihat oleh pengaju.');
      return true;
    } catch (e) {
      toast.error(errorMessage(e, 'Gagal menolak izin.'));
      return false;
    } finally {
      setSibukId(null);
    }
  };
  const bukaTolak = (izin: Izin) => { setDipilih(null); setAkanDitolak(izin); };

  const refreshing = menunggu.refreshing || riwayat.refreshing || papan.refreshing;
  const onRefresh = () => { setKeputusan({}); void menunggu.refresh(); void riwayat.refresh(); void papan.refresh(); };
  const aktif = segmen === 'menunggu' ? menunggu : segmen === 'riwayat' ? riwayat : papan;
  const items = segmen === 'menunggu' ? daftarMenunggu : segmen === 'riwayat' ? daftarRiwayat : daftarHariIni;
  const kosong = segmen === 'menunggu' ? 'Tidak ada pengajuan yang menunggu' : segmen === 'riwayat' ? 'Belum ada keputusan izin' : 'Tidak ada izin hari ini';

  return (
    <Screen title="Persetujuan Izin" subtitle="Izin keluar GTK & satpam" back refreshing={refreshing} onRefresh={onRefresh}
      offline={{ fromCache: menunggu.fromCache, updatedAt: menunggu.updatedAt }}>
      {tiruan ? <Notice tone="warning" icon="flask-outline" text="Server belum menyediakan data izin — menampilkan data contoh untuk mencoba tampilan." /> : null}
      <SegmentedControl<Segmen>
        style={{ marginTop: tiruan ? spacing.md : 0 }}
        segments={[
          { value: 'menunggu', label: `Menunggu (${daftarMenunggu.length})`, tone: 'warning' },
          { value: 'hari-ini', label: `Hari ini (${daftarHariIni.length})`, tone: 'success' },
          { value: 'riwayat', label: 'Riwayat' },
        ]}
        value={segmen}
        onChange={setSegmen}
      />
      <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
        {aktif.loading ? (
          <><CardSkeleton lines={3} /><CardSkeleton lines={3} /></>
        ) : aktif.error && !aktif.data ? (
          <ErrorState message={errorMessage(aktif.error, 'Gagal memuat data izin.')} onRetry={aktif.refresh} compact />
        ) : items.length === 0 ? (
          <Card><EmptyState icon="file-tray-outline" title={kosong} compact /></Card>
        ) : items.map((i) => (
          <KartuKeputusan key={i.id} izin={i} onPress={() => setDipilih(i)} aksi={segmen === 'menunggu' ? (
            <View style={[styles.aksi, { borderTopColor: colors.border }]}>
              <Button title="Tolak" size="sm" variant="outline" textColor={colors.error} disabled={sibukId === i.id} onPress={() => bukaTolak(i)} style={{ flex: 1 }} />
              <Button title="Setujui" size="sm" icon="checkmark-circle-outline" loading={sibukId === i.id} onPress={() => setujui(i)} style={{ flex: 1 }} />
            </View>
          ) : undefined} />
        ))}
      </View>

      <DetailIzinSheet izin={dipilih} jam={jamSekarangWIB()} onTutup={() => setDipilih(null)} onSetujui={setujui} onTolak={bukaTolak}
        sibuk={!!dipilih && sibukId === dipilih.id} />
      <TolakIzinSheet izin={akanDitolak} onTutup={() => setAkanDitolak(null)} onTolak={tolak} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  alasan: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, marginTop: 2 },
  aksi: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
