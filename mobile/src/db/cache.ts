/** Cache respons GET per pengguna (usia maksimal 14 hari). */
import { CACHE_MAX_AGE_DAYS } from '@/config';
import { getDb } from './sqlite';

export type CacheEntry<T> = { data: T; updatedAt: string };

export async function getCache<T>(key: string, userId: string): Promise<CacheEntry<T> | null> {
  const db = await getDb();
  const row = await db.first<{ json: string; updated_at: string }>(
    'SELECT json, updated_at FROM cache WHERE key = ? AND user_id = ?', [key, userId],
  );
  if (!row) return null;
  const age = Date.now() - new Date(row.updated_at).getTime();
  if (age > CACHE_MAX_AGE_DAYS * 86_400_000) {
    await db.run('DELETE FROM cache WHERE key = ? AND user_id = ?', [key, userId]);
    return null;
  }
  try {
    return { data: JSON.parse(row.json) as T, updatedAt: row.updated_at };
  } catch {
    return null;
  }
}

export async function setCache<T>(key: string, userId: string, data: T): Promise<string> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.run(
    'INSERT OR REPLACE INTO cache (key, user_id, json, updated_at) VALUES (?, ?, ?, ?)',
    [key, userId, JSON.stringify(data), now],
  );
  return now;
}

export async function pruneCache() {
  const db = await getDb();
  const cutoff = new Date(Date.now() - CACHE_MAX_AGE_DAYS * 86_400_000).toISOString();
  await db.run('DELETE FROM cache WHERE updated_at <= ?', [cutoff]);
}

/** Kunci cache yang dipakai aplikasi. */
export const CacheKeys = {
  myToday: 'schedules.my-today',
  weekly: 'schedules.weekly',
  myJournals: 'jurnal.my',
  announcements: 'announcements',
  notifications: 'notifications',
  unread: 'notifications.unread',
  students: (classId: string) => `students.${classId}`,
  gpConfig: 'gp.config',
  gpPeriod: 'gp.period',
  gpAssignments: 'gp.assignments',
  piketToday: 'piket.today',
  classSchedules: (classId: string) => `schedules.class.${classId}`,
  classJournals: (classId: string) => `jurnal.class.${classId}`,
  adminJournals: 'jurnal.admin',
};
