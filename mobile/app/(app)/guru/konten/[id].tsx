/**
 * Detail materi/tugas guru: isi (HTML → teks rapi), lampiran, mapel, sasaran, tenggat; tugas menampilkan
 * daftar pengumpulan siswa (GET /kelas/tugas/{id}/submissions): jawaban, berkas, waktu kirim & tepat waktu.
 * Ubah & hapus (DELETE /kelas/{jenis}/{id}).
 */
import React, { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { GuruKonten, ScheduleItem, TugasSubmissionItem } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { dueInfo, formatDateTime, parseISO } from '@/utils/time';
import { JENIS_LABEL, ajaran, asJenis, kontenKey, ringkasSasaran } from '@/kelas/guru';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { RichText, openUrl } from '@/components/RichText';

export default function KontenDetail() {
  const params = useLocalSearchParams<{ jenis?: string; id: string }>();
  const jenis = asJenis(params.jenis);
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { online } = useNetwork();
  const res = useCached<GuruKonten[]>(kontenKey(jenis), () => api.kelas.guruList(jenis));
  const k = (res.data ?? []).find((x) => x.id === id);
  const jadwal = useCached<ScheduleItem[]>(`jadwal.t.${user?.id}`, () => api.schedules.grouped({ teacher_id: user?.id }), { enabled: !!user?.id, staleTime: 10 * 60_000 });
  const { namaKelas } = useMemo(() => ajaran(jadwal.data), [jadwal.data]);
  const subs = useCached<{ total_submissions: number; submissions: TugasSubmissionItem[] }>(`guru.tugas.subs.${id}`, () => api.kelas.submissions(id), { enabled: jenis === 'tugas' });
  const [busy, setBusy] = useState(false);

  const remove = () => Alert.alert(`Hapus ${jenis}?`, k?.judul, [
    { text: 'Batal', style: 'cancel' },
    {
      text: 'Hapus', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await api.kelas.guruDelete(jenis, id);
          toast.success(`${JENIS_LABEL[jenis]} dihapus`);
          await qc.invalidateQueries({ queryKey: [kontenKey(jenis)] });
          router.back();
        } catch (e) { toast.error(errorMessage(e, `Gagal menghapus ${jenis}.`)); } finally { setBusy(false); }
      },
    },
  ]);

  if (!k) {
    return (
      <Screen title={`Detail ${JENIS_LABEL[jenis]}`} back refreshing={res.refreshing} onRefresh={res.refresh}>
        {res.loading ? <CardSkeleton lines={5} /> : <ErrorState message={`${JENIS_LABEL[jenis]} tidak ditemukan.`} onRetry={res.refresh} />}
      </Screen>
    );
  }
  const due = jenis === 'tugas' ? dueInfo(k.deadline) : null;
  const tenggat = k.deadline ? parseISO(k.deadline).getTime() : null;

  return (
    <Screen title={`Detail ${JENIS_LABEL[jenis]}`} back refreshing={res.refreshing || subs.refreshing} onRefresh={() => { void res.refresh(); void subs.refresh(); }}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}
      footer={(
        <View style={styles.footer}>
          <Button title="Hapus" icon="trash-outline" variant="outline" loading={busy} disabled={!online} onPress={remove} style={{ flex: 1 }} />
          <Button title="Ubah" icon="create-outline" disabled={!online} style={{ flex: 2 }}
            onPress={() => router.push({ pathname: '/guru/konten/form', params: { jenis, id } })} />
        </View>
      )}>
      <View style={{ gap: spacing.md }}>
        <Card style={{ gap: spacing.sm }}>
          <T variant="title">{k.judul}</T>
          <T tone="secondary">{k.subject_name ?? '-'} · dibuat {formatDateTime(k.created_at ?? '')}</T>
          <T variant="caption" tone="secondary">Sasaran: {ringkasSasaran(k, namaKelas)}</T>
          {due ? <View style={styles.row}><Badge label={due.label} tone={due.tone} small /><T variant="small" tone="muted">Tenggat {formatDateTime(k.deadline!)}</T></View> : null}
        </Card>
        <Card style={{ gap: spacing.sm }}>
          {k.deskripsi ? <T weight="medium">{k.deskripsi}</T> : null}
          <RichText html={k.konten} />
          {k.file_url ? <Button title="Buka lampiran" icon="attach-outline" variant="outline" size="sm" onPress={() => openUrl(k.file_url!)} /> : null}
        </Card>

        {jenis === 'tugas' ? (
          <>
            <T variant="subtitle">Pengumpulan ({subs.data?.total_submissions ?? 0})</T>
            {subs.loading ? <CardSkeleton lines={3} /> : subs.error && !subs.data ? (
              <ErrorState message={errorMessage(subs.error, 'Pengumpulan belum bisa dimuat.')} onRetry={subs.refresh} compact />
            ) : (subs.data?.submissions ?? []).length === 0 ? (
              <Card><EmptyState icon="hourglass-outline" title="Belum ada yang mengumpulkan" message="Jawaban siswa akan tampil di sini." compact /></Card>
            ) : (subs.data?.submissions ?? []).map((s) => {
              const waktu = s.updated_at || s.submitted_at;
              const telat = tenggat && waktu ? parseISO(waktu).getTime() > tenggat : false;
              return (
                <Card key={s.id ?? s.student_id} style={{ gap: spacing.xs }}>
                  <View style={styles.row}>
                    <T weight="semibold" style={{ flex: 1 }}>{s.student_name ?? '-'}</T>
                    <Badge label={telat ? 'Terlambat' : 'Tepat waktu'} tone={telat ? 'warning' : 'success'} small />
                  </View>
                  <T variant="small" tone="muted">{s.student_nis ? `NIS ${s.student_nis} · ` : ''}{formatDateTime(waktu ?? '')}</T>
                  {s.jawaban ? <T selectable>{s.jawaban}</T> : null}
                  {s.file_url ? <Button title="Buka berkas siswa" icon="document-attach-outline" variant="ghost" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => openUrl(s.file_url!)} /> : null}
                </Card>
              );
            })}
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footer: { flexDirection: 'row', gap: spacing.sm },
});
