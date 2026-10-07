/** Status koneksi: NetInfo + ping GET /health. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { api } from '@/api/endpoints';

type NetCtx = {
  /** Perangkat punya koneksi (menurut OS). */
  connected: boolean;
  /** API madrasah bisa dihubungi (ping /health berhasil). */
  apiReachable: boolean;
  /** Ringkasan: online = connected && apiReachable. */
  online: boolean;
  lastCheckAt: number | null;
  serverTime: string | null;
  checkNow: () => Promise<boolean>;
};

const NetworkContext = createContext<NetCtx>({
  connected: true, apiReachable: true, online: true, lastCheckAt: null, serverTime: null, checkNow: async () => true,
});

const PING_INTERVAL_MS = 60_000;

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(true);
  const [apiReachable, setApiReachable] = useState(true);
  const [lastCheckAt, setLastCheckAt] = useState<number | null>(null);
  const [serverTime, setServerTime] = useState<string | null>(null);
  const checking = useRef(false);

  const checkNow = useCallback(async () => {
    if (checking.current) return apiReachable;
    checking.current = true;
    try {
      const h = await api.health();
      setApiReachable(true);
      setServerTime(h.time_wib);
      setLastCheckAt(Date.now());
      return true;
    } catch {
      setApiReachable(false);
      setLastCheckAt(Date.now());
      return false;
    } finally {
      checking.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const isConn = Platform.OS === 'web' ? state.isConnected !== false : !!state.isConnected && state.isInternetReachable !== false;
      setConnected(isConn);
      if (isConn) void checkNow();
      else setApiReachable(false);
    });
    void checkNow();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void checkNow();
    }, PING_INTERVAL_MS);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void checkNow(); });
    return () => { unsub(); clearInterval(timer); sub.remove(); };
  }, [checkNow]);

  const value = useMemo(
    () => ({ connected, apiReachable, online: connected && apiReachable, lastCheckAt, serverTime, checkNow }),
    [connected, apiReachable, lastCheckAt, serverTime, checkNow],
  );
  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export const useNetwork = () => useContext(NetworkContext);
