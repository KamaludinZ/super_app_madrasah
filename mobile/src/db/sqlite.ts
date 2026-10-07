/**
 * Penyimpanan lokal: expo-sqlite di Android/iOS. Di web (pratinjau) memakai penyimpanan sederhana
 * berbasis AsyncStorage agar alur aplikasi tetap bisa dicoba.
 */
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Row = Record<string, any>;

export interface KV {
  /** Jalankan DDL/SQL tanpa hasil. */
  exec(sql: string): Promise<void>;
  run(sql: string, params?: any[]): Promise<void>;
  all<T = Row>(sql: string, params?: any[]): Promise<T[]>;
  first<T = Row>(sql: string, params?: any[]): Promise<T | null>;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cache (
  key TEXT NOT NULL, user_id TEXT NOT NULL, json TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (key, user_id)
);
CREATE TABLE IF NOT EXISTS journal_queue (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0, next_retry_at TEXT, last_error TEXT, error_type TEXT,
  payload TEXT NOT NULL, meta TEXT NOT NULL, synced_at TEXT, lock_until TEXT
);
CREATE TABLE IF NOT EXISTS permits (
  schedule_id TEXT NOT NULL, date TEXT NOT NULL, user_id TEXT NOT NULL, json TEXT NOT NULL,
  server_time TEXT NOT NULL, monotonic_ms REAL NOT NULL, wall_clock TEXT NOT NULL, fetched_at TEXT NOT NULL,
  PRIMARY KEY (schedule_id, date, user_id)
);
CREATE INDEX IF NOT EXISTS idx_queue_user_status ON journal_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_permits_user_date ON permits(user_id, date);
`;

// ---------------------------------------------------------------------------
// Implementasi SQLite (native)
// ---------------------------------------------------------------------------
async function openSqlite(): Promise<KV> {
  const SQLite = await import('expo-sqlite');
  const db = await SQLite.openDatabaseAsync('matsandatama.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync(SCHEMA);
  return {
    exec: (sql) => db.execAsync(sql),
    run: async (sql, params = []) => { await db.runAsync(sql, params); },
    all: (sql, params = []) => db.getAllAsync(sql, params) as Promise<any[]>,
    first: async (sql, params = []) => ((await db.getFirstAsync(sql, params)) as any) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Implementasi web (pratinjau): tabel disimpan sebagai array JSON di AsyncStorage.
// Hanya mendukung pola kueri yang dipakai modul db/* (lihat webQuery).
// ---------------------------------------------------------------------------
type Tables = { cache: Row[]; journal_queue: Row[]; permits: Row[] };
const WEB_KEY = 'matsandatama.webdb.v1';

async function openWeb(): Promise<KV> {
  let tables: Tables = { cache: [], journal_queue: [], permits: [] };
  try {
    const raw = await AsyncStorage.getItem(WEB_KEY);
    if (raw) tables = { ...tables, ...JSON.parse(raw) };
  } catch { /* abaikan */ }
  const persist = () => AsyncStorage.setItem(WEB_KEY, JSON.stringify(tables)).catch(() => {});
  const pk: Record<keyof Tables, string[]> = {
    cache: ['key', 'user_id'], journal_queue: ['id'], permits: ['schedule_id', 'date', 'user_id'],
  };

  // Parser mini untuk WHERE "a = ? AND b = ?" / "a IN (?,?)" / "a <= ?" yang dipakai aplikasi.
  const matches = (row: Row, where: string | undefined, params: any[]) => {
    if (!where) return true;
    let i = 0;
    const conds = where.split(/\s+AND\s+/i);
    return conds.every((c) => {
      const inM = c.match(/^\s*(\w+)\s+IN\s*\(([^)]*)\)\s*$/i);
      if (inM) {
        const n = inM[2].split(',').length;
        const vals = params.slice(i, i + n); i += n;
        return vals.includes(row[inM[1]]);
      }
      const m = c.match(/^\s*(\w+)\s*(=|<=|>=|<|>|!=|IS NOT|IS)\s*(\?|NULL)\s*$/i);
      if (!m) return true;
      const [, col, op, val] = m;
      const v = val === '?' ? params[i++] : null;
      const r = row[col];
      switch (op.toUpperCase()) {
        case '=': return r === v;
        case '!=': return r !== v;
        case '<=': return r <= v;
        case '>=': return r >= v;
        case '<': return r < v;
        case '>': return r > v;
        case 'IS': return r === null || r === undefined;
        case 'IS NOT': return r !== null && r !== undefined;
        default: return true;
      }
    });
  };
  const parse = (sql: string) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    const table = (s.match(/(?:FROM|INTO|UPDATE)\s+(\w+)/i)?.[1] ?? '') as keyof Tables;
    const where = s.match(/WHERE\s+(.*?)(?:\s+ORDER BY|\s+LIMIT|$)/i)?.[1];
    const order = s.match(/ORDER BY\s+(\w+)\s*(ASC|DESC)?/i);
    const limit = s.match(/LIMIT\s+(\d+)/i);
    return { s, table, where, order, limit };
  };

  const kv: KV = {
    exec: async () => {},
    run: async (sql, params = []) => {
      const { s, table, where } = parse(sql);
      const rows = tables[table] ?? [];
      if (/^INSERT/i.test(s)) {
        const cols = s.match(/\(([^)]*)\)\s*VALUES/i)?.[1].split(',').map((c) => c.trim()) ?? [];
        const row: Row = {};
        cols.forEach((c, idx) => { row[c] = params[idx] ?? null; });
        const keys = pk[table];
        const idx = rows.findIndex((r) => keys.every((k) => r[k] === row[k]));
        if (idx >= 0) {
          if (/INSERT OR REPLACE/i.test(s)) rows[idx] = row;
          else if (!/INSERT OR IGNORE/i.test(s)) rows[idx] = { ...rows[idx], ...row };
        } else rows.push(row);
      } else if (/^UPDATE/i.test(s)) {
        const setPart = s.match(/SET\s+(.*?)\s+WHERE/i)?.[1] ?? s.match(/SET\s+(.*)$/i)?.[1] ?? '';
        const assigns = setPart.split(',').map((a) => a.trim());
        const nSet = assigns.filter((a) => a.includes('?')).length;
        const setParams = params.slice(0, nSet);
        const whereParams = params.slice(nSet);
        let pi = 0;
        rows.forEach((r) => {
          if (!matches(r, where, whereParams)) return;
          pi = 0;
          assigns.forEach((a) => {
            const [col, expr] = a.split('=').map((x) => x.trim());
            if (expr === '?') r[col] = setParams[pi++];
            else if (/^\w+\s*\+\s*1$/.test(expr)) r[col] = (r[col] ?? 0) + 1;
            else if (expr.toUpperCase() === 'NULL') r[col] = null;
          });
        });
      } else if (/^DELETE/i.test(s)) {
        tables[table] = rows.filter((r) => !matches(r, where, params));
      }
      await persist();
    },
    all: async (sql, params = []) => {
      const { table, where, order, limit } = parse(sql);
      let rows = (tables[table] ?? []).filter((r) => matches(r, where, params));
      if (order) {
        const col = order[1]; const desc = (order[2] || '').toUpperCase() === 'DESC';
        rows = [...rows].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (desc ? -1 : 1));
      }
      if (/COUNT\(\*\)/i.test(sql)) return [{ n: rows.length }] as any[];
      if (limit) rows = rows.slice(0, parseInt(limit[1], 10));
      return rows.map((r) => ({ ...r })) as any[];
    },
    first: async (sql, params = []) => ((await kv.all(sql, params))[0] ?? null) as any,
  };
  return kv;
}

let dbPromise: Promise<KV> | null = null;

/** Koneksi tunggal (lazy). */
export function getDb(): Promise<KV> {
  if (!dbPromise) dbPromise = Platform.OS === 'web' ? openWeb() : openSqlite();
  return dbPromise;
}

/** Hapus SEMUA data lokal milik seorang pengguna (dipanggil saat logout). */
export async function wipeUserData(userId: string) {
  const db = await getDb();
  await db.run('DELETE FROM cache WHERE user_id = ?', [userId]);
  await db.run('DELETE FROM journal_queue WHERE user_id = ?', [userId]);
  await db.run('DELETE FROM permits WHERE user_id = ?', [userId]);
}
