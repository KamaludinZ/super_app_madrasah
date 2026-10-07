/**
 * Detail tugas (siswa): uraian guru (HTML → teks rapi), lampiran, tenggat, dan pengumpulan
 * (POST /kelas/tugas/{id}/submit: jawaban + tautan berkas). Pengumpulan bisa diperbarui sebelum tenggat;
 * jawaban yang sudah dikumpulkan tampil dari my_submission.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { KelasTugas } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { useNetwork } from '@/store/network';
import { dueInfo, formatDateTime } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon, IconName } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';
import { RichText, openUrl } from '@/components/RichText';

export default function SiswaTugasDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { online } = useNetwork();
  const res = useCached<KelasTugas>(`siswa.tugas.${id}`, () => api.kelas.tugasDetail(id));
  const t = res.data;
  const [editing, setEditing] = useState(false);
  const [jawaban, setJawaban] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = t?.my_submission ?? null;
  const due = dueInfo(t?.deadline);
  const canSubmit = !due?.overdue;

  useEffect(() => {
    if (mine) { setJawaban(mine.jawaban ?? ''); setFileUrl(mine.file_url ?? ''); }
  }, [mine?.id, mine?.jawaban, mine?.file_url]);

  const submit = async () => {
    if (!jawaban.trim()) { setError('Jawaban wajib diisi.'); return; }
    const url = fileUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) { setError('Tautan berkas harus diawali http:// atau https://'); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await api.kelas.submitTugas(id, { jawaban: jawaban.trim(), file_url: url || null });
      toast.success(r.message || 'Tugas dikumpulkan');
      setEditing(false);
      void qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith('siswa.tugas') });
    } catch (e) {
      setError(errorMessage(e, 'Gagal mengumpulkan tugas.'));
    } finally {
      setBusy(false);
    }
  };

  const showForm = canSubmit && (!mine || editing);

  return (
    <Screen
      title="Detail Tugas"
      back
      refreshing={res.refreshing}
      onRefresh={res.refresh}
      offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}
      footer={showForm ? (
        <Button title={mine ? 'Simpan perubahan' : 'Kumpulkan tugas'} icon="paper-plane-outline" size="lg" fullWidth loading={busy} disabled={!online} onPress={submit} />
      ) : undefined}
    >
      {res.loading ? <CardSkeleton lines={6} /> : !t ? (
        <ErrorState message={res.error ? errorMessage(res.error, 'Tugas tidak bisa dimuat.') : 'Tugas tidak ditemukan.'} onRetry={res.refresh} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Card style={{ gap: spacing.sm }}>
            <T variant="title">{t.judul}</T>
            <Row icon="book-outline" text={`${t.subject_name ?? 'Mapel'} · ${t.teacher_name ?? 'Guru'}`} />
            {t.deadline ? <Row icon="calendar-outline" text={`Tenggat ${formatDateTime(t.deadline)}`} /> : <Row icon="calendar-outline" text="Tanpa tenggat" />}
            <View style={styles.badges}>
              {mine ? <Badge label="Sudah dikumpulkan" icon="checkmark-circle-outline" tone="success" small />
                : <Badge label="Belum dikumpulkan" icon="time-outline" tone={due?.overdue ? 'error' : 'warning'} small />}
              {due ? <Badge label={due.label} tone={mine ? 'neutral' : due.tone} small /> : null}
            </View>
          </Card>

          <Card style={{ gap: spacing.sm }}>
            <T variant="label" tone="muted">URAIAN TUGAS</T>
            {t.deskripsi ? <T weight="medium">{t.deskripsi}</T> : null}
            <RichText html={t.konten} />
            {t.file_url ? (
              <Button title="Buka lampiran guru" icon="attach-outline" variant="outline" size="sm" onPress={() => openUrl(t.file_url!)} />
            ) : null}
          </Card>

          {mine && !editing ? (
            <Card style={{ gap: spacing.sm }}>
              <View style={styles.row}>
                <T variant="label" tone="muted" style={{ flex: 1 }}>JAWABAN SAYA</T>
                <T variant="small" tone="muted">{formatDateTime(mine.updated_at || mine.submitted_at || '')}</T>
              </View>
              <T selectable>{mine.jawaban}</T>
              {mine.file_url ? <Button title="Buka berkas saya" icon="document-attach-outline" variant="ghost" size="sm" onPress={() => openUrl(mine.file_url!)} /> : null}
              {canSubmit ? <Button title="Perbarui jawaban" icon="create-outline" variant="outline" size="sm" onPress={() => setEditing(true)} /> : null}
            </Card>
          ) : null}

          {!canSubmit && !mine ? (
            <Notice tone="error" icon="alert-circle-outline" text="Tenggat sudah lewat, tugas tidak bisa dikumpulkan lagi. Hubungi guru mapel bila perlu." />
          ) : null}

          {showForm ? (
            <Card style={{ gap: spacing.md }}>
              <T variant="label" tone="muted">{mine ? 'PERBARUI JAWABAN' : 'KUMPULKAN TUGAS'}</T>
              <Input label="Jawaban *" value={jawaban} onChangeText={setJawaban} multiline placeholder="Tulis jawaban atau ringkasan tugas Anda" />
              <Input
                label="Tautan berkas (opsional)"
                icon="link-outline"
                value={fileUrl}
                onChangeText={setFileUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="https://drive.google.com/…"
                hint="Unggah berkas ke Google Drive/OneDrive, atur akses “siapa saja yang memiliki link”, lalu tempel tautannya."
              />
              {editing ? <Button title="Batal" variant="ghost" size="sm" onPress={() => { setEditing(false); setJawaban(mine?.jawaban ?? ''); setFileUrl(mine?.file_url ?? ''); }} /> : null}
              {!online ? <Notice tone="warning" icon="cloud-offline-outline" text="Tidak ada koneksi. Mengumpulkan tugas memerlukan internet." /> : null}
              {error ? <Notice tone="error" icon="alert-circle-outline" text={error} /> : null}
            </Card>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function Row({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Icon name={icon} size={16} color={colors.muted} />
      <T tone="secondary" style={{ flex: 1 }}>{text}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
