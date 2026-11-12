/**
 * Pengajuan Izin Kamad (sama dengan /izin di web): formulir izin keluar (keperluan, tanggal, jam mulai,
 * jam selesai — semua wajib) dan daftar pengajuan sendiri beserta statusnya. Pengajuan yang masih
 * menunggu dapat dibatalkan (dengan konfirmasi). Untuk kepala TU, guru mapel, tendik, dan satpam.
 */
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/api/client';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { spacing } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { TimeField } from '@/components/ui/TimeField';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { formatDateShort, todayISO } from '@/utils/time';
import {
  DURASI_MIN_MENIT, DaftarIzin, GalatIzin, IsiIzin, Izin, KEPERLUAN_MAKS, PERAN_PENGAJU_IZIN, bolehAjukanIzin, izinApi, jamSekarangWIB,
  teksDurasi, urutTerbaru, validasiIzin,
} from '@/izin/api';
import { KartuPengajuan } from '@/izin/KartuPengajuan';
import { DetailIzinSheet } from '@/izin/DetailIzinSheet';
import { AksesDitolak } from '@/izin/AksesDitolak';

const kosong = (): IsiIzin => ({ keperluan: '', tanggal: todayISO(), jam_mulai: '', jam_selesai: '' });

export default function PengajuanIzinScreen() {
  const { user, activeRole } = useAuth();
  const { online } = useNetwork();
  const pengaju = { nama: user?.full_name || 'Anda', peran: activeRole ?? '' };
  const saya = useCached<DaftarIzin>('izin.saya', () => izinApi.saya(pengaju), { enabled: bolehAjukanIzin(activeRole) });
  const [isi, setIsi] = useState<IsiIzin>(kosong);
  const [galat, setGalat] = useState<GalatIzin>({});
  const [mengirim, setMengirim] = useState(false);
  const [tambahan, setTambahan] = useState<Izin[]>([]); // pengajuan contoh yang baru dikirim (mode tiruan)
  const [ubahan, setUbahan] = useState<Record<string, Izin>>({});
  const [dipilih, setDipilih] = useState<Izin | null>(null);
  const [sibukId, setSibukId] = useState<string | null>(null);

  if (!bolehAjukanIzin(activeRole)) {
    return <AksesDitolak judul="Pengajuan Izin" untuk="kepala TU, guru mata pelajaran, tendik, dan satpam" peranBerhak={PERAN_PENGAJU_IZIN} />;
  }

  const tiruan = !!saya.data?.tiruan;
  const daftar = [...tambahan, ...(saya.data?.items ?? [])].map((i) => ubahan[i.id] ?? i).sort(urutTerbaru);
  const ubahIsi = (k: keyof IsiIzin, v: string) => {
    const baru = { ...isi, [k]: v };
    setIsi(baru);
    // Galat yang sudah tampil diperiksa ulang saat isian berubah.
    if (Object.keys(galat).length) setGalat(validasiIzin(baru));
  };
  const durasi = !galat.jam_selesai ? teksDurasi(isi.jam_mulai, isi.jam_selesai) : '';

  const kirim = async () => {
    const g = validasiIzin(isi);
    setGalat(g);
    if (Object.keys(g).length) { toast.error('Periksa kembali isian izin.'); return; }
    setMengirim(true);
    try {
      const h = await izinApi.ajukan(isi, pengaju);
      toast.success('Pengajuan izin terkirim', h.tiruan ? 'Contoh — belum tersimpan di server.' : 'Menunggu keputusan kepala madrasah.');
      setIsi(kosong());
      if (h.tiruan) setTambahan((l) => [h.izin, ...l]); else await saya.refresh();
    } catch (e) {
      toast.error(errorMessage(e, 'Gagal mengirim pengajuan izin.'));
    } finally {
      setMengirim(false);
    }
  };

  const batalkan = (izin: Izin) => Alert.alert(
    'Batalkan pengajuan izin?',
    `"${izin.keperluan}" pada ${formatDateShort(izin.tanggal)}, ${izin.jam_mulai}–${izin.jam_selesai}. Pengajuan yang dibatalkan tidak dapat diaktifkan kembali.`,
    [
      { text: 'Tidak', style: 'cancel' },
      {
        text: 'Ya, batalkan', style: 'destructive', onPress: async () => {
          setSibukId(izin.id);
          try {
            const h = await izinApi.batalkan(izin);
            setUbahan((u) => ({ ...u, [izin.id]: h.izin }));
            setDipilih((d) => (d?.id === izin.id ? h.izin : d));
            toast.success('Pengajuan izin dibatalkan', h.tiruan ? 'Contoh — belum tersimpan di server.' : undefined);
          } catch (e) {
            toast.error(errorMessage(e, 'Gagal membatalkan pengajuan.'));
          } finally {
            setSibukId(null);
          }
        },
      },
    ],
  );

  return (
    <Screen title="Pengajuan Izin" subtitle="Izin keluar kepada kepala madrasah" back refreshing={saya.refreshing} onRefresh={saya.refresh}
      offline={{ fromCache: saya.fromCache, updatedAt: saya.updatedAt }}>
      {tiruan ? <Notice tone="warning" icon="flask-outline" text="Server belum menyediakan data izin — menampilkan data contoh untuk mencoba tampilan." /> : null}

      <Card style={[styles.form, tiruan && { marginTop: spacing.md }]}>
        <T variant="subtitle">Ajukan izin</T>
        <T variant="small" tone="muted">Isian bertanda * wajib diisi.</T>
        <Input label="Keperluan *" value={isi.keperluan} onChangeText={(v) => ubahIsi('keperluan', v)} multiline maxLength={KEPERLUAN_MAKS}
          placeholder="Mis. Mengurus berkas ke Kantor Kemenag" error={galat.keperluan} hint={`${isi.keperluan.length}/${KEPERLUAN_MAKS} karakter`} />
        <DateField label="Tanggal *" value={isi.tanggal} min={todayISO()} onChange={(v) => ubahIsi('tanggal', v ?? '')} />
        {galat.tanggal ? <T variant="small" tone="error">{galat.tanggal}</T> : null}
        <View style={styles.dua}>
          <View style={{ flex: 1, gap: 4 }}>
            <TimeField label="Jam mulai *" value={isi.jam_mulai} onChange={(v) => ubahIsi('jam_mulai', v)} placeholder="08:00" />
            {galat.jam_mulai ? <T variant="small" tone="error">{galat.jam_mulai}</T> : null}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <TimeField label="Jam selesai *" value={isi.jam_selesai} onChange={(v) => ubahIsi('jam_selesai', v)} placeholder="10:00" />
            {galat.jam_selesai ? <T variant="small" tone="error">{galat.jam_selesai}</T> : null}
          </View>
        </View>
        <T variant="small" tone="muted">
          {durasi ? `Lama izin ${durasi}.` : `Hanya hari ini atau ke depan; minimal ${DURASI_MIN_MENIT} menit.`}
        </T>
        <Button title="Kirim pengajuan" icon="send-outline" loading={mengirim} disabled={!online && !tiruan} onPress={kirim} />
        {!online ? <T variant="small" tone="warning">Tidak ada koneksi. Mengirim izin memerlukan internet.</T> : null}
      </Card>

      <View style={styles.head}>
        <T variant="subtitle">Pengajuan saya</T>
        <T variant="caption" tone="muted">{daftar.length ? `${daftar.length} pengajuan` : ''}</T>
      </View>
      {saya.loading ? (
        <View style={{ gap: spacing.sm }}><CardSkeleton lines={2} /><CardSkeleton lines={2} /></View>
      ) : saya.error && !saya.data ? (
        <ErrorState message={errorMessage(saya.error, 'Gagal memuat pengajuan.')} onRetry={saya.refresh} compact />
      ) : daftar.length === 0 ? (
        <Card><EmptyState icon="document-text-outline" title="Belum ada pengajuan izin" compact /></Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {daftar.map((i) => (
            <KartuPengajuan key={i.id} izin={i} onPress={() => setDipilih(i)} onBatalkan={() => batalkan(i)} sibuk={sibukId === i.id} />
          ))}
        </View>
      )}

      <DetailIzinSheet izin={dipilih} jam={jamSekarangWIB()} onTutup={() => setDipilih(null)} onBatalkan={batalkan}
        sibuk={!!dipilih && sibukId === dipilih.id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  dua: { flexDirection: 'row', gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.md },
});
