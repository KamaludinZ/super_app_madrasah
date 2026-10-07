/**
 * Orkestrasi sinkronisasi: izin offline → antrean jurnal → cache data penting (termasuk KD/Indikator &
 * Materi mapel hari ini untuk jurnal offline) → pengingat lokal.
 * Juga mendaftarkan background task (expo-background-task, min. 15 menit).
 */
import { Platform } from 'react-native';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { api } from '@/api/endpoints';
import { setAuthToken, getAuthToken } from '@/api/client';
import { BACKGROUND_SYNC_MINUTES } from '@/config';
import { CacheKeys, pruneCache, setCache } from '@/db/cache';
import { usePrefs } from '@/store/prefs';
import { refreshPermits } from './permits';
import { processQueue, SyncResult } from './queue';
import { notifySync, scheduleReminders } from '@/notifications';

export const BACKGROUND_TASK = 'matsandatama-sync';

export type FullSyncResult = { permits: number; queue: SyncResult; reminders: number; ok: boolean; error?: string };

let running: Promise<FullSyncResult> | null = null;

/** Sinkron penuh (sekali jalan pada satu waktu). */
export function runSync(userId: string, opts: { force?: boolean; notify?: boolean; refreshCaches?: boolean } = {}): Promise<FullSyncResult> {
  if (running) return running;
  running = (async () => {
    const result: FullSyncResult = { permits: 0, queue: { sent: 0, failed: 0, retried: 0, skipped: 0, messages: [] }, reminders: 0, ok: true };
    try {
      try {
        const p = await refreshPermits(userId);
        result.permits = p.count;
      } catch (e: any) {
        result.ok = false; result.error = e?.message;
      }
      result.queue = await processQueue(userId, { force: opts.force });
      if (opts.notify && (result.queue.sent || result.queue.failed)) {
        if (result.queue.sent) await notifySync('Sinkron berhasil', `${result.queue.sent} jurnal terkirim`);
        if (result.queue.failed) await notifySync('Sinkron gagal', result.queue.messages[0] ?? `${result.queue.failed} jurnal ditolak server`);
      }
      if (opts.refreshCaches !== false) {
        await Promise.allSettled([
          api.schedules.myToday().then(async (d) => {
            await setCache(CacheKeys.myToday, userId, d);
            // KD/Indikator & Materi mapel hari ini → tersedia saat mengisi jurnal offline.
            const pairs = new Map<string, { mapel: string; sem: string | null }>();
            d.forEach((x) => { if (x.subject_id) pairs.set(`${x.subject_id}|${x.semester_id ?? ''}`, { mapel: x.subject_id, sem: (x.semester_id as string) || null }); });
            await Promise.allSettled([...pairs.values()].flatMap(({ mapel, sem }) => [
              api.akademik.indikator({ mapel_id: mapel, semester_id: sem }).then((r) => setCache(CacheKeys.indikator(mapel, sem), userId, r)),
              api.akademik.materi({ mapel_id: mapel, semester_id: sem }).then((r) => setCache(CacheKeys.materi(mapel, sem), userId, r)),
            ]));
          }),
          api.jurnal.my().then((d) => setCache(CacheKeys.myJournals, userId, d.slice(0, 50))),
          api.announcements.list().then((d) => setCache(CacheKeys.announcements, userId, d)),
          api.notifications.list().then((d) => setCache(CacheKeys.notifications, userId, d)),
        ]);
      }
      try {
        result.reminders = await scheduleReminders(userId, usePrefs.getState().reminderMinutes);
      } catch { /* abaikan */ }
      await pruneCache().catch(() => {});
      if (result.ok) usePrefs.getState().setLastSyncAt(new Date().toISOString());
    } finally {
      running = null;
    }
    return result;
  })();
  return running;
}

// ---------------------------------------------------------------------------
// Background task (hanya APK/dev build; tidak tersedia di web)
// ---------------------------------------------------------------------------
if (Platform.OS !== 'web') {
  TaskManager.defineTask(BACKGROUND_TASK, async () => {
    try {
      // Pulihkan token dari SecureStore (task bisa berjalan tanpa UI).
      if (!getAuthToken()) {
        const raw = await SecureStore.getItemAsync('session_v1');
        if (!raw) return BackgroundTask.BackgroundTaskResult.Success;
        const s = JSON.parse(raw);
        if (!s?.token) return BackgroundTask.BackgroundTaskResult.Success;
        setAuthToken(s.token);
        await runSync(s.user.id, { notify: true, refreshCaches: false });
      } else {
        const raw = await SecureStore.getItemAsync('session_v1');
        const s = raw ? JSON.parse(raw) : null;
        if (s?.user?.id) await runSync(s.user.id, { notify: true, refreshCaches: false });
      }
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

export async function registerBackgroundSync() {
  if (Platform.OS === 'web') return;
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
    const already = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK);
    if (!already) await BackgroundTask.registerTaskAsync(BACKGROUND_TASK, { minimumInterval: BACKGROUND_SYNC_MINUTES });
  } catch { /* Expo Go: tidak tersedia */ }
}

export async function unregisterBackgroundSync() {
  if (Platform.OS === 'web') return;
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK)) await BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK);
  } catch { /* abaikan */ }
}
