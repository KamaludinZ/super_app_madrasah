/**
 * Antrean jurnal offline: daftar jurnal yang menunggu/gagal/terkirim di perangkat ini.
 * "Kirim sekarang" menjalankan sinkron paksa; item gagal bisa dicoba ulang atau dihapus.
 */
import React, { useCallback, useState } from 'react';
import { Alert, FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { usePrefs } from '@/store/prefs';
import { listQueue, QueueItem, QueueStatus, removeQueueItem, retryQueueItem } from '@/offline/queue';
import { runSync } from '@/offline/sync';
import { formatDateShort, formatDateTime, formatRelative } from '@/utils/time';
import { spacing, useTheme } from '@/theme';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { T } from '@/components/ui/Text';
import { Badge, BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { toast } from '@/components/ui/Toast';

const STATUS: Record<QueueStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Menunggu', tone: 'warning' },
  syncing: { label: 'Mengirim…', tone: 'brand' },
  synced: { label: 'Terkirim', tone: 'success' },
  failed: { label: 'Gagal', tone: 'error' },
};

export default function AntreanScreen() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { user } = useAuth();
  const { online } = useNetwork();
  const lastSyncAt = usePrefs((s) => s.lastSyncAt);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try { setItems(await listQueue(user.id)); } finally { setLoading(false); }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const syncNow = async () => {
    if (!user) return;
    setSyncing(true);
    try {
      const r = await runSync(user.id, { force: true });
      const { sent, failed, messages } = r.queue;
      if (sent) toast.success(`${sent} jurnal terkirim`);
      if (failed) toast.error(messages[0] ?? `${failed} jurnal ditolak server`);
      if (!sent && !failed) toast.info(r.ok ? 'Tidak ada jurnal yang perlu dikirim' : 'Server belum bisa dihubungi');
      void qc.invalidateQueries();
    } finally {
      setSyncing(false);
      await load();
    }
  };

  const retry = async (it: QueueItem) => {
    if (!user) return;
    await retryQueueItem(user.id, it.id);
    await load();
    if (online) void syncNow();
  };

  const remove = (it: QueueItem) => {
    if (!user) return;
    Alert.alert(
      'Hapus dari antrean?',
      'Jurnal ini belum tercatat di server. Jika dihapus, Anda perlu mengisinya ulang lewat web atau meminta admin.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Hapus', style: 'destructive', onPress: async () => { await removeQueueItem(user.id, it.id); await load(); } },
      ],
    );
  };

  const waiting = items.filter((i) => i.status !== 'synced').length;

  return (
    <Screen title="Antrean Jurnal" subtitle={waiting ? `${waiting} belum terkirim` : 'Semua jurnal sudah terkirim'} back scroll={false}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={
          <Card style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            <T variant="caption" tone="muted">
              Sinkron terakhir: {lastSyncAt ? `${formatRelative(lastSyncAt)} (${formatDateTime(lastSyncAt)})` : 'belum pernah'}
            </T>
            <T variant="caption" tone="muted">Aplikasi mengirim otomatis saat online dan di latar belakang (±15 menit sekali).</T>
            <Button title={online ? 'Kirim sekarang' : 'Menunggu koneksi internet'} icon="cloud-upload-outline" loading={syncing} disabled={!online || !waiting} onPress={syncNow} />
          </Card>
        }
        renderItem={({ item }) => <QueueRow it={item} onRetry={() => retry(item)} onRemove={() => remove(item)} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={loading ? null : <Card><EmptyState icon="checkmark-done-circle-outline" title="Antrean kosong" message="Jurnal yang diisi saat offline akan menunggu di sini sampai terkirim." compact /></Card>}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      />
    </Screen>
  );
}

function QueueRow({ it, onRetry, onRemove }: { it: QueueItem; onRetry: () => void; onRemove: () => void }) {
  const st = STATUS[it.status];
  const m = it.meta;
  const sum = m.attendance_summary;
  return (
    <Card style={{ gap: spacing.sm }}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <T variant="subtitle" numberOfLines={1}>{m.class_name || 'Kelas'} · {m.subject_name || '-'}</T>
          <T variant="caption" tone="muted">
            {formatDateShort(m.date)}{m.start_time ? ` · ${m.start_time}–${m.end_time ?? ''}` : ''}{m.room_name ? ` · ${m.room_name}` : ''}
          </T>
        </View>
        <Badge label={st.label} tone={st.tone} small />
      </View>
      <View style={styles.badges}>
        {m.is_substitute ? <Badge label={`Pengganti${m.original_teacher_name ? ` untuk ${m.original_teacher_name}` : ''}`} icon="swap-horizontal" tone="warning" small /> : null}
        {sum ? <Badge label={`H ${sum.hadir} · S ${sum.sakit} · I ${sum.izin} · A ${sum.alpa}`} tone="neutral" small /> : null}
      </View>
      <T variant="caption" tone="muted">
        Disimpan {formatRelative(it.created_at)}
        {it.status === 'synced' && it.synced_at ? ` · terkirim ${formatRelative(it.synced_at)}` : ''}
        {it.attempts ? ` · percobaan ${it.attempts}×` : ''}
      </T>
      {it.last_error && it.status !== 'synced' ? <T variant="caption" tone="error">{it.last_error}</T> : null}
      {it.status === 'failed' ? (
        <View style={styles.actions}>
          <Button title="Coba lagi" icon="refresh" size="sm" variant="outline" onPress={onRetry} style={{ flex: 1 }} />
          <Button title="Hapus" icon="trash-outline" size="sm" variant="ghost" onPress={onRemove} style={{ flex: 1 }} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
