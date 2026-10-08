/**
 * Detail prestasi: identitas lomba, pemegang, penyelenggaraan, hadiah, status verifikasi & catatan peninjau,
 * serta foto/sertifikat (dimuat dengan sesi aplikasi). Pemilik dapat membatalkan ajuan yang masih menunggu
 * (DELETE /verval-requests/{id}).
 */
import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { Achievement } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { formatDateLong } from '@/utils/time';
import {
  caraLabel, categoryLabel, categoryTone, hadiahLabel, holderAccess, holderOf, HOLDERS, jenisLombaLabel, levelLabel, loadPrestasi,
  modeLabel, penyelenggaraLabel, prestasiKey, statusOf,
} from '@/prestasi/data';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Notice } from '@/components/ui/Notice';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { AuthedImage } from '@/components/AuthedImage';

export default function PrestasiDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const { activeRole } = useAuth();
  const { online } = useNetwork();
  const access = holderAccess(activeRole);
  const res = useCached<Achievement[]>(prestasiKey(activeRole), () => loadPrestasi(access.reviewer));
  const a = (res.data ?? []).find((x) => x.id === decodeURIComponent(String(id)));
  const [busy, setBusy] = useState(false);

  const cancel = () => {
    if (!a?._vervalRequestId) return;
    Alert.alert('Batalkan ajuan?', `Ajuan prestasi “${a.name}” akan dibatalkan.`, [
      { text: 'Tidak', style: 'cancel' },
      {
        text: 'Batalkan ajuan', style: 'destructive', onPress: async () => {
          setBusy(true);
          try {
            await api.verval.cancel(a._vervalRequestId!);
            toast.success('Ajuan prestasi dibatalkan');
            await qc.invalidateQueries({ predicate: (q) => /^(prestasi|verval)\./.test(String(q.queryKey[0])) });
            router.back();
          } catch (e) {
            toast.error(errorMessage(e, 'Gagal membatalkan ajuan.'));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (!a) {
    return (
      <Screen title="Detail Prestasi" back refreshing={res.refreshing} onRefresh={res.refresh}>
        {res.loading ? <CardSkeleton lines={6} /> : <ErrorState message="Prestasi tidak ditemukan atau sudah diperbarui." onRetry={res.refresh} />}
      </Screen>
    );
  }

  const st = statusOf(a);
  const holderLabel = HOLDERS.find((h) => h.value === holderOf(a))?.label ?? '-';
  const canCancel = a._vervalStatus === 'pending' && access.canAdd != null;

  return (
    <Screen title="Detail Prestasi" back refreshing={res.refreshing} onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}
      footer={canCancel ? <Button title="Batalkan ajuan" icon="close-circle-outline" variant="outline" fullWidth loading={busy} disabled={!online} onPress={cancel} /> : undefined}>
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.sm }}>
          <T variant="title">{a.name}</T>
          {a.rank || a.level ? <T tone="secondary" weight="medium">{[a.rank, `Tingkat ${levelLabel(a.level)}`].filter(Boolean).join(' · ')}</T> : null}
          <View style={styles.badges}>
            <Badge label={st.label} icon={st.icon} tone={st.tone} small />
            {a.category ? <Badge label={categoryLabel(a.category)} tone={categoryTone(a.category)} small /> : null}
          </View>
          {a.is_verified && a.verifier_name ? <T variant="caption" tone="muted">Diverifikasi oleh {a.verifier_name}</T> : null}
        </Card>

        {a._vervalStatus === 'rejected' ? (
          <Notice tone="error" icon="close-circle-outline" text={`Ajuan ditolak${a._adminNotes ? `: ${a._adminNotes}` : '.'} Ajukan kembali dengan data yang diperbaiki.`} />
        ) : a._vervalStatus === 'pending' ? (
          <Notice tone="warning" icon="time-outline" text="Ajuan sedang ditinjau. Anda akan menerima notifikasi saat disetujui atau ditolak." />
        ) : null}

        {a.photo_url || a.certificate_url ? (
          <View style={styles.files}>
            {a.photo_url ? <View style={{ flex: 1, gap: 4 }}><AuthedImage path={a.photo_url} label="Foto prestasi" /><T variant="small" tone="muted">Foto</T></View> : null}
            {a.certificate_url ? <View style={{ flex: 1, gap: 4 }}><AuthedImage path={a.certificate_url} label="Sertifikat" /><T variant="small" tone="muted">Sertifikat</T></View> : null}
          </View>
        ) : null}

        <Card style={{ gap: spacing.sm }}>
          <T variant="label" tone="muted">PEMEGANG</T>
          <Row label="Jenis" value={holderLabel} />
          <Row label="Nama" value={a.holder_full_name || a.holder_name || a.student_name} />
          <Row label="Kelas" value={a.class_name} />
          <Row label="Jenis lomba" value={a.jenis_lomba ? jenisLombaLabel(a.jenis_lomba) : null} />
        </Card>

        <Card style={{ gap: spacing.sm }}>
          <T variant="label" tone="muted">LOMBA</T>
          <Row label="Bidang" value={a.bidang_lomba} />
          <Row label="Tanggal" value={a.date ? formatDateLong(a.date) : a.year ? String(a.year) : null} />
          <Row label="Tahun pelajaran" value={a.academic_year_label} />
          <Row label="Penyelenggara" value={[a.organizer, a.jenis_penyelenggara ? penyelenggaraLabel(a.jenis_penyelenggara) : null].filter(Boolean).join(' · ') || null} />
          <Row label="Pelaksanaan" value={[a.mode_pelaksanaan ? modeLabel(a.mode_pelaksanaan) : null, a.tempat_pelaksanaan].filter(Boolean).join(' · ') || null} />
          <Row label="Diikuti secara" value={a.cara_mengikuti ? caraLabel(a.cara_mengikuti) : null} />
          <Row label="Pembina" value={a.nama_pembina} />
          <Row label="Hadiah" value={(a.jenis_hadiah ?? []).map(hadiahLabel).join(', ') || null} />
        </Card>

        {a.description ? (
          <Card style={{ gap: spacing.sm }}>
            <T variant="label" tone="muted">KETERANGAN</T>
            <T selectable>{a.description}</T>
          </Card>
        ) : null}
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <T variant="caption" tone="muted" style={styles.rowLabel}>{label}</T>
      <T style={{ flex: 1 }}>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  files: { flexDirection: 'row', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  rowLabel: { width: 112, paddingTop: 2 },
});
