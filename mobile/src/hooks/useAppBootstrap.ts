/**
 * Bootstrap area aplikasi (setelah login): sinkron saat dibuka/online kembali, registrasi
 * perangkat push, pengingat lokal, badge belum dibaca, dan penanganan ketukan notifikasi.
 */
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/endpoints';
import { useAuth } from '@/store/auth';
import { useNetwork } from '@/store/network';
import { usePrefs } from '@/store/prefs';
import { registerBackgroundSync, runSync } from '@/offline/sync';
import { refreshQueueCounts } from '@/offline/queue';
import { registerDevice, routeForNotification, setBadge } from '@/notifications';
import { toast } from '@/components/ui/Toast';

export function useAppBootstrap() {
  const { user, token, activeRole, locked } = useAuth();
  const { online } = useNetwork();
  const router = useRouter();
  const qc = useQueryClient();
  const lastSyncRef = useRef(0);
  const reminderMinutes = usePrefs((s) => s.reminderMinutes);

  const userId = user?.id;

  // Sinkron saat dibuka & saat online kembali (maks. sekali per 2 menit, kecuali online kembali).
  useEffect(() => {
    if (!userId || !token || locked || !online) return;
    const since = Date.now() - lastSyncRef.current;
    if (since < 120_000) return;
    lastSyncRef.current = Date.now();
    runSync(userId, { notify: true }).then((r) => {
      if (r.queue.sent) {
        toast.success(`Sinkron berhasil: ${r.queue.sent} jurnal terkirim`);
        qc.invalidateQueries();
      }
      if (r.queue.failed) toast.error('Sinkron gagal', r.queue.messages[0] ?? `${r.queue.failed} jurnal ditolak server`);
    }).catch(() => {});
    void registerBackgroundSync();
  }, [userId, token, locked, online, qc]);

  // Sinkron ulang saat aplikasi kembali aktif setelah lama.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && userId && online && Date.now() - lastSyncRef.current > 120_000) {
        lastSyncRef.current = Date.now();
        runSync(userId, { notify: true }).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [userId, online]);

  // Hitung antrean saat login.
  useEffect(() => { if (userId) void refreshQueueCounts(userId); }, [userId]);

  // Registrasi perangkat push: saat login, ganti peran, dan online kembali.
  useEffect(() => {
    if (!userId || !token || !online || Platform.OS === 'web') return;
    registerDevice().catch(() => {});
  }, [userId, token, activeRole, online]);

  // Jadwal ulang pengingat bila menit pengingat diubah.
  const firstReminder = useRef(true);
  useEffect(() => {
    if (firstReminder.current) { firstReminder.current = false; return; }
    if (!userId) return;
    import('@/notifications').then((m) => m.scheduleReminders(userId, reminderMinutes)).catch(() => {});
  }, [reminderMinutes, userId]);

  // Badge ikon aplikasi = jumlah belum dibaca.
  useEffect(() => {
    if (!userId || !online || Platform.OS === 'web') return;
    api.notifications.unreadCount().then((r) => setBadge(r.unread)).catch(() => {});
  }, [userId, online]);

  // Ketukan notifikasi (aplikasi terbuka / cold start) → navigasi.
  useEffect(() => {
    if (Platform.OS === 'web' || !token) return;
    const go = (data: Record<string, any> | undefined) => {
      const route = routeForNotification(data);
      if (route) setTimeout(() => router.push(route as any), 50);
      if (data?.type === 'announcement' && data.announcement_id) api.notifications.markRead('announcement', data.announcement_id).catch(() => {});
    };
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => go(resp.notification.request.content.data as any));
    const recv = Notifications.addNotificationReceivedListener((n) => {
      const c = n.request.content;
      const type = (c.data as any)?.type;
      if (type === 'teaching_reminder') return; // pengingat lokal sudah menangani
      toast.info(c.title ?? 'Notifikasi', c.body ?? undefined, { onPress: () => go(c.data as any) });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });
    Notifications.getLastNotificationResponseAsync().then((resp) => {
      if (resp) go(resp.notification.request.content.data as any);
    }).catch(() => {});
    return () => { sub.remove(); recv.remove(); };
  }, [token, router, qc]);
}
