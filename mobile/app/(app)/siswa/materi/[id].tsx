/** Detail materi (siswa): GET /kelas/materi/{id} — uraian guru (HTML → teks rapi), lampiran, tersimpan offline. */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { api } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import type { KelasMateri } from '@/api/types';
import { useCached } from '@/hooks/useCached';
import { formatDateTime } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { RichText, openUrl } from '@/components/RichText';

export default function SiswaMateriDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const res = useCached<KelasMateri>(`siswa.materi.${id}`, () => api.kelas.materiDetail(id));
  const m = res.data;

  return (
    <Screen title="Materi" back refreshing={res.refreshing} onRefresh={res.refresh} offline={{ fromCache: res.fromCache, updatedAt: res.updatedAt }}>
      {res.loading ? <CardSkeleton lines={6} /> : !m ? (
        <ErrorState message={res.error ? errorMessage(res.error, 'Materi tidak bisa dimuat.') : 'Materi tidak ditemukan.'} onRetry={res.refresh} />
      ) : (
        <View style={{ gap: spacing.md }}>
          <Card style={{ gap: spacing.sm }}>
            <T variant="title">{m.judul}</T>
            <View style={styles.row}>
              <Icon name="book-outline" size={16} color={colors.muted} />
              <T tone="secondary" style={{ flex: 1 }}>{m.subject_name ?? 'Mapel'} · {m.teacher_name ?? 'Guru'}</T>
            </View>
            {m.created_at ? <T variant="small" tone="muted">Dibagikan {formatDateTime(m.created_at)}</T> : null}
          </Card>
          <Card style={{ gap: spacing.sm }}>
            {m.deskripsi ? <T weight="medium">{m.deskripsi}</T> : null}
            <RichText html={m.konten} empty="Tidak ada uraian materi." />
            {m.file_url ? <Button title="Buka lampiran materi" icon="attach-outline" variant="outline" onPress={() => openUrl(m.file_url!)} /> : null}
          </Card>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
