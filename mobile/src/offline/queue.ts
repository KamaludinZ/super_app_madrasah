/**
 * Antrean jurnal offline: pending → syncing → synced | failed. Satu item diproses sekali
 * (kunci per item), retry dengan backoff 1/5/15/60 menit, maksimal 10 kali.
 */
import * as Crypto from 'expo-crypto';
import { api } from '@/api/endpoints';
import { ApiError } from '@/api/client';
import { QUEUE_BACKOFF_MINUTES, QUEUE_MAX_ATTEMPTS } from '@/config';
import { getDb } from '@/db/sqlite';
import { usePrefs } from '@/store/prefs';

export type QueueStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type QueueMeta = {
  schedule_id: string;
  date: string;
  class_name?: string | null;
  subject_name?: string | null;
  room_name?: string | null;
  start_time?: string;
  end_time?: string;
  is_substitute?: boolean;
  original_teacher_name?: string | null;
  attendance_summary?: { hadir: number; sakit: number; izin: number; alpa: number };
};

export type QueueItem = {
  id: string;
  user_id: string;
  created_at: string;
  status: QueueStatus;
  attempts: number;
  next_retry_at: string | null;
  last_error: string | null;
  error_type: string | null;
  payload: Record<string, unknown>;
  meta: QueueMeta;
  synced_at: string | null;
};

const parse = (r: any): QueueItem => ({
  ...r,
  payload: JSON.parse(r.payload),
  meta: JSON.parse(r.meta),
});

export async function enqueueJournal(userId: string, payload: Record<string, unknown>, meta: QueueMeta): Promise<QueueItem> {
  const db = await getDb();
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  const body = { ...payload, client_id: id };
  await db.run(
    'INSERT INTO journal_queue (id, user_id, created_at, status, attempts, next_retry_at, last_error, error_type, payload, meta, synced_at, lock_until) VALUES (?, ?, ?, ?, 0, ?, NULL, NULL, ?, ?, NULL, NULL)',
    [id, userId, now, 'pending', now, JSON.stringify(body), JSON.stringify(meta)],
  );
  await refreshQueueCounts(userId);
  return { id, user_id: userId, created_at: now, status: 'pending', attempts: 0, next_retry_at: now, last_error: null, error_type: null, payload: body, meta, synced_at: null };
}

export async function listQueue(userId: string): Promise<QueueItem[]> {
  const db = await getDb();
  const rows = await db.all<any>('SELECT * FROM journal_queue WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  return rows.map(parse);
}

export async function removeQueueItem(userId: string, id: string) {
  const db = await getDb();
  await db.run('DELETE FROM journal_queue WHERE id = ? AND user_id = ?', [id, userId]);
  await refreshQueueCounts(userId);
}

/** Antrekan ulang item gagal (reset percobaan). */
export async function retryQueueItem(userId: string, id: string) {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.run('UPDATE journal_queue SET status = ?, attempts = ?, next_retry_at = ?, last_error = NULL, error_type = NULL WHERE id = ? AND user_id = ?', ['pending', 0, now, id, userId]);
  await refreshQueueCounts(userId);
}

/** Apakah sudah ada antrean untuk slot+tanggal (mencegah isi ganda). */
export async function hasQueuedFor(userId: string, scheduleId: string, date: string): Promise<boolean> {
  const items = await listQueue(userId);
  return items.some((i) => i.meta.schedule_id === scheduleId && i.meta.date === date && i.status !== 'failed');
}

export async function refreshQueueCounts(userId: string) {
  const db = await getDb();
  const p = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM journal_queue WHERE user_id = ? AND status IN (?,?)', [userId, 'pending', 'syncing']);
  const f = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM journal_queue WHERE user_id = ? AND status = ?', [userId, 'failed']);
  usePrefs.getState().setQueueCounts(p?.n ?? 0, f?.n ?? 0);
}

const backoffMs = (attempt: number) => (QUEUE_BACKOFF_MINUTES[Math.min(attempt - 1, QUEUE_BACKOFF_MINUTES.length - 1)]) * 60_000;

export type SyncResult = { sent: number; failed: number; retried: number; skipped: number; messages: string[] };

let syncing = false;

/**
 * Proses semua item pending yang sudah waktunya. Dipanggil saat online kembali, aplikasi dibuka,
 * tombol "Sinkronkan sekarang", dan background task.
 */
export async function processQueue(userId: string, opts: { force?: boolean } = {}): Promise<SyncResult> {
  const result: SyncResult = { sent: 0, failed: 0, retried: 0, skipped: 0, messages: [] };
  if (syncing) { result.skipped++; return result; }
  syncing = true;
  const db = await getDb();
  try {
    const nowIso = new Date().toISOString();
    const items = (await listQueue(userId)).filter((i) => i.status === 'pending' || (i.status === 'syncing' && (!(i as any).lock_until || (i as any).lock_until < nowIso)));
    for (const item of items) {
      if (!opts.force && item.next_retry_at && item.next_retry_at > nowIso) { result.skipped++; continue; }
      // Kunci item (5 menit) agar tidak diproses ganda oleh background task.
      const lockUntil = new Date(Date.now() + 5 * 60_000).toISOString();
      await db.run('UPDATE journal_queue SET status = ?, lock_until = ? WHERE id = ? AND user_id = ?', ['syncing', lockUntil, item.id, userId]);
      try {
        await api.mobile.submitOffline(item.payload);
        await db.run('UPDATE journal_queue SET status = ?, synced_at = ?, last_error = NULL, error_type = NULL, lock_until = NULL WHERE id = ?', ['synced', new Date().toISOString(), item.id]);
        result.sent++;
      } catch (e) {
        const err = e instanceof ApiError ? e : null;
        if (err && err.status === 409) {
          // Duplikat = sudah tersimpan di server → anggap sukses.
          await db.run('UPDATE journal_queue SET status = ?, synced_at = ?, last_error = ?, error_type = ?, lock_until = NULL WHERE id = ?', ['synced', new Date().toISOString(), 'Sudah tersimpan di server', 'duplicate', item.id]);
          result.sent++;
        } else if (err && err.status === 400) {
          const type = err.errorType ?? 'rejected';
          const msg = typeof err.detail === 'object' && err.detail?.message ? String(err.detail.message) : err.message;
          await db.run('UPDATE journal_queue SET status = ?, last_error = ?, error_type = ?, attempts = attempts + 1, lock_until = NULL WHERE id = ?', ['failed', msg, type, item.id]);
          result.failed++;
          result.messages.push(msg);
        } else if (err && err.status === 401) {
          // Minta login ulang; antrean dipertahankan.
          await db.run('UPDATE journal_queue SET status = ?, last_error = ?, lock_until = NULL WHERE id = ?', ['pending', 'Sesi berakhir — login ulang untuk melanjutkan', item.id]);
          result.skipped++;
          break;
        } else {
          // Jaringan / 5xx → retry dengan backoff.
          const attempts = item.attempts + 1;
          if (attempts >= QUEUE_MAX_ATTEMPTS) {
            await db.run('UPDATE journal_queue SET status = ?, last_error = ?, error_type = ?, attempts = ?, lock_until = NULL WHERE id = ?', ['failed', 'Gagal setelah 10 percobaan. ' + (err?.message ?? ''), 'max_attempts', attempts, item.id]);
            result.failed++;
          } else {
            const next = new Date(Date.now() + backoffMs(attempts)).toISOString();
            await db.run('UPDATE journal_queue SET status = ?, last_error = ?, attempts = ?, next_retry_at = ?, lock_until = NULL WHERE id = ?', ['pending', err?.message ?? 'Gagal mengirim', attempts, next, item.id]);
            result.retried++;
          }
        }
      }
    }
  } finally {
    syncing = false;
    await refreshQueueCounts(userId);
  }
  return result;
}
