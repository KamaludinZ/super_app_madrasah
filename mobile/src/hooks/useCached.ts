/**
 * useCached: ambil data dari API; simpan ke cache SQLite per pengguna; saat gagal (offline)
 * kembalikan data cache + penanda `fromCache` dan waktu pembaruan terakhir.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getCache, setCache } from '@/db/cache';
import { useAuth } from '@/store/auth';
import { isNetworkError } from '@/api/client';

export type CachedResult<T> = { data: T; fromCache: boolean; updatedAt: string | null };

export function useCached<T>(key: string, fetcher: () => Promise<T>, opts: { enabled?: boolean; staleTime?: number; cacheOnly?: boolean } = {}) {
  const { user, locked } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id ?? 'anon';
  const queryKey = [key, userId];

  const q = useQuery<CachedResult<T>, Error>({
    queryKey,
    enabled: (opts.enabled ?? true) && !!user && !locked,
    staleTime: opts.staleTime ?? 30_000,
    retry: (count, err) => !isNetworkError(err) && count < 1,
    queryFn: async () => {
      if (opts.cacheOnly) {
        const c = await getCache<T>(key, userId);
        if (c) return { data: c.data, fromCache: true, updatedAt: c.updatedAt };
      }
      try {
        const data = await fetcher();
        const updatedAt = await setCache(key, userId, data);
        return { data, fromCache: false, updatedAt };
      } catch (e) {
        const c = await getCache<T>(key, userId);
        if (c) return { data: c.data, fromCache: true, updatedAt: c.updatedAt };
        throw e;
      }
    },
  });

  const refresh = useCallback(async () => { await q.refetch(); }, [q]);
  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey }), [qc, queryKey]);

  return {
    data: q.data?.data,
    fromCache: q.data?.fromCache ?? false,
    updatedAt: q.data?.updatedAt ?? null,
    loading: q.isLoading,
    refreshing: q.isFetching && !q.isLoading,
    error: q.error ?? null,
    refresh,
    invalidate,
  };
}
