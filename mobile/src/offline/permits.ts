/**
 * Izin jurnal offline bertanda tangan server + bukti waktu jam monoton.
 * Disimpan per (schedule_id, date, user_id) bersama server_time & jam monoton saat sinkron.
 */
import { api } from '@/api/endpoints';
import type { OfflinePermit } from '@/api/types';
import { getDb } from '@/db/sqlite';
import { monotonicNow } from '../../modules/elapsed-realtime';
import { addDays, todayISO } from '@/utils/time';

export type StoredPermit = OfflinePermit & {
  server_time: string;
  monotonic_ms: number;
  wall_clock: string;
  fetched_at: string;
  holiday?: string | null;
};

/** Ambil izin untuk hari ini s.d. +7 hari dan simpan. Mengembalikan jumlah izin tersimpan. */
export async function refreshPermits(userId: string, daysAhead = 7): Promise<{ count: number; holidays: Record<string, string> }> {
  const db = await getDb();
  const today = todayISO();
  let count = 0;
  const holidays: Record<string, string> = {};
  // Hapus izin tanggal lampau (sebelum kemarin).
  await db.run('DELETE FROM permits WHERE user_id = ? AND date < ?', [userId, addDays(today, -1)]);
  for (let i = 0; i <= daysAhead; i++) {
    const date = addDays(today, i);
    const res = await api.mobile.offlinePermits(date);
    const mono = monotonicNow();
    const wall = new Date().toISOString();
    if (res.holiday) holidays[date] = res.holiday;
    // Ganti seluruh izin untuk tanggal itu agar perubahan jadwal/penugasan tercermin.
    await db.run('DELETE FROM permits WHERE user_id = ? AND date = ?', [userId, date]);
    for (const p of res.permits) {
      await db.run(
        'INSERT OR REPLACE INTO permits (schedule_id, date, user_id, json, server_time, monotonic_ms, wall_clock, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [p.schedule_id, date, userId, JSON.stringify({ ...p, holiday: res.holiday }), res.server_time, mono.ms, wall, wall],
      );
      count++;
    }
  }
  return { count, holidays };
}

export async function getPermit(userId: string, scheduleId: string, date: string): Promise<StoredPermit | null> {
  const db = await getDb();
  const row = await db.first<any>('SELECT * FROM permits WHERE user_id = ? AND schedule_id = ? AND date = ?', [userId, scheduleId, date]);
  if (!row) return null;
  return { ...(JSON.parse(row.json) as OfflinePermit), server_time: row.server_time, monotonic_ms: row.monotonic_ms, wall_clock: row.wall_clock, fetched_at: row.fetched_at };
}

export async function listPermits(userId: string, date: string): Promise<StoredPermit[]> {
  const db = await getDb();
  const rows = await db.all<any>('SELECT * FROM permits WHERE user_id = ? AND date = ? ORDER BY schedule_id ASC', [userId, date]);
  return rows
    .map((row) => ({ ...(JSON.parse(row.json) as OfflinePermit), server_time: row.server_time, monotonic_ms: row.monotonic_ms, wall_clock: row.wall_clock, fetched_at: row.fetched_at }))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
}

/** Semua izin tersimpan (untuk penjadwalan pengingat lokal 7 hari). */
export async function listAllPermits(userId: string): Promise<StoredPermit[]> {
  const db = await getDb();
  const rows = await db.all<any>('SELECT * FROM permits WHERE user_id = ? ORDER BY date ASC', [userId]);
  return rows.map((row) => ({ ...(JSON.parse(row.json) as OfflinePermit), server_time: row.server_time, monotonic_ms: row.monotonic_ms, wall_clock: row.wall_clock, fetched_at: row.fetched_at }));
}

export type TimeEvidence = {
  captured_server_estimate: string;
  device_wall_clock: string;
  monotonic_elapsed_ms: number;
  clock_unverified: boolean;
};

/**
 * Waktu tepercaya = server_time saat sinkron + (monoton sekarang − monoton saat sinkron).
 * Bila monoton sekarang lebih kecil (perangkat reboot / aplikasi dimulai ulang tanpa modul native),
 * pakai selisih jam dinding dan tandai clock_unverified.
 */
export function computeTimeEvidence(permit: StoredPermit): TimeEvidence {
  const mono = monotonicNow();
  const wallNow = Date.now();
  const serverAtSync = new Date(permit.server_time).getTime();
  const elapsed = mono.ms - permit.monotonic_ms;
  let unverified = mono.source === 'js' && elapsed < 0;
  let estimate: number;
  if (elapsed >= 0 && mono.source === 'native') {
    estimate = serverAtSync + elapsed;
  } else if (elapsed >= 0) {
    // JS monotonic (Expo Go/web): berlaku selama aplikasi belum dimulai ulang.
    estimate = serverAtSync + elapsed;
  } else {
    unverified = true;
    estimate = serverAtSync + (wallNow - new Date(permit.wall_clock).getTime());
  }
  return {
    captured_server_estimate: new Date(estimate).toISOString(),
    device_wall_clock: new Date(wallNow).toISOString(),
    monotonic_elapsed_ms: Math.round(Math.max(0, elapsed)),
    clock_unverified: unverified,
  };
}
