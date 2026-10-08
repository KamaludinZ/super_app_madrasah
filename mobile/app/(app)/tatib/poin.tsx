/**
 * Poin Tata Tertib satu siswa — native, pengganti /siswa/poin (Poin Saya). Tanpa parameter: poin siswa
 * yang login (GET /tatib/poin-saya). Dengan `id`: siswa lain — `sumber=wali` lewat pantauan wali kelas
 * (GET /tatib/walikelas/siswa/{id}), selain itu GET /tatib/poin/siswa/{id} (pimpinan/pengelola tatib).
 * Ringkasan kebaikan/pelanggaran/saldo + penanda perlu perhatian, lalu riwayat catatan dengan rinciannya.
 */
import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { tatib, PaketPoin } from '@/tatib/api';
import { RingkasanPoinCard, RiwayatPoinList } from '@/tatib/ui';
import { useCached } from '@/hooks/useCached';
import { errorMessage } from '@/api/client';
import { spacing } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { T } from '@/components/ui/Text';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';

export default function PoinTatib() {
  const p = useLocalSearchParams<{ id?: string; sumber?: string; nama?: string }>();
  const key = p.id ? `tatib.poin.${p.sumber === 'wali' ? 'wali' : 'umum'}.${p.id}` : 'tatib.poin.saya';
  const res = useCached<PaketPoin>(key, () => (!p.id ? tatib.poinSaya() : p.sumber === 'wali' ? tatib.siswaWali(p.id) : tatib.siswa(p.id)));
  const d = res.data;
  const judul = p.id ? (d?.siswa.nama ?? p.nama ?? 'Poin Siswa') : 'Poin Saya';

  return (
    <Screen title={judul} subtitle={d ? [d.siswa.kelas ? `Kelas ${d.siswa.kelas}` : null, d.siswa.nisn ? `NISN ${d.siswa.nisn}` : null].filter(Boolean).join(' · ') || 'Poin tata tertib' : 'Poin tata tertib'}
      back refreshing={res.refreshing} onRefresh={res.refresh} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      {res.loading ? <CardSkeleton lines={5} /> : !d ? (
        <ErrorState message={errorMessage(res.error, 'Poin tata tertib belum bisa dimuat.')} onRetry={res.refresh} compact />
      ) : (
        <View style={{ gap: spacing.md }}>
          <RingkasanPoinCard r={d} batas={d.batas_minus_perhatian} />
          <T variant="subtitle" style={{ marginTop: spacing.sm }}>Riwayat catatan</T>
          <RiwayatPoinList records={d.records} />
        </View>
      )}
    </Screen>
  );
}
