/**
 * Sesi & autentikasi: token HANYA di expo-secure-store (web pratinjau: memori), kunci aplikasi
 * biometrik/PIN setelah tidak aktif > idle_timeout_minutes, pembersihan data lokal saat logout.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { api } from '@/api/endpoints';
import { setAuthToken, setUnauthorizedHandler } from '@/api/client';
import type { LoginResponse, User } from '@/api/types';
import { wipeUserData } from '@/db/sqlite';

const SESSION_KEY = 'session_v1';
const ACTIVE_KEY = 'last_active_v1';

type Session = {
  token: string;
  user: User;
  activeRole: string;
  expiresAt: number;
  idleTimeoutMinutes: number;
};

type State = {
  loading: boolean;
  session: Session | null;
  locked: boolean;
  /** Login ulang diperlukan (401) — antrean jurnal TIDAK dihapus. */
  reauthRequired: boolean;
};

type Ctx = State & {
  token: string | null;
  user: User | null;
  activeRole: string | null;
  login: (p: { username: string; password: string; captcha_id: string; captcha_answer: string; remember: boolean }) => Promise<LoginResponse>;
  logout: (opts?: { beforeClear?: (s: Session) => Promise<void> }) => Promise<void>;
  switchRole: (role: string) => Promise<void>;
  refreshMe: () => Promise<void>;
  unlock: () => Promise<{ ok: boolean; reason?: string }>;
  lockNow: () => void;
  biometricAvailable: boolean;
};

const AuthContext = createContext<Ctx | null>(null);

const secure = {
  get: async (k: string) => (Platform.OS === 'web' ? memory.get(k) ?? null : SecureStore.getItemAsync(k)),
  set: async (k: string, v: string) => (Platform.OS === 'web' ? void memory.set(k, v) : SecureStore.setItemAsync(k, v)),
  del: async (k: string) => (Platform.OS === 'web' ? void memory.delete(k) : SecureStore.deleteItemAsync(k)),
};
const memory = new Map<string, string>();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ loading: true, session: null, locked: false, reauthRequired: false });
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const sessionRef = useRef<Session | null>(null);
  const backgroundAt = useRef<number | null>(null);

  const applySession = useCallback(async (s: Session | null, persist = true) => {
    sessionRef.current = s;
    setAuthToken(s?.token ?? null);
    if (persist) {
      if (s) await secure.set(SESSION_KEY, JSON.stringify(s));
      else await secure.del(SESSION_KEY);
    }
    setState((x) => ({ ...x, session: s, loading: false, locked: false, reauthRequired: false }));
  }, []);

  // Pulihkan sesi saat aplikasi dibuka.
  useEffect(() => {
    (async () => {
      try {
        if (Platform.OS !== 'web') {
          const [hw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
          setBiometricAvailable(hw && enrolled);
        }
      } catch { /* abaikan */ }
      try {
        const raw = await secure.get(SESSION_KEY);
        if (!raw) { setState((x) => ({ ...x, loading: false })); return; }
        const s = JSON.parse(raw) as Session;
        if (!s?.token || (s.expiresAt && Date.now() > s.expiresAt)) {
          await secure.del(SESSION_KEY);
          setState((x) => ({ ...x, loading: false }));
          return;
        }
        // Kunci bila terakhir aktif sudah lewat batas idle (berlaku juga saat offline).
        const lastActive = Number(await secure.get(ACTIVE_KEY)) || 0;
        const idleMs = (s.idleTimeoutMinutes || 30) * 60_000;
        const shouldLock = lastActive > 0 && Date.now() - lastActive > idleMs;
        sessionRef.current = s;
        setAuthToken(s.token);
        setState({ loading: false, session: s, locked: shouldLock, reauthRequired: false });
        // Segarkan profil di latar (tanpa memblokir); 401 ditangani handler.
        api.auth.me().then((me) => {
          const next = { ...s, user: { ...me, active_role: s.activeRole } };
          sessionRef.current = next;
          secure.set(SESSION_KEY, JSON.stringify(next)).catch(() => {});
          setState((x) => (x.session ? { ...x, session: next } : x));
        }).catch(() => {});
      } catch {
        setState((x) => ({ ...x, loading: false }));
      }
    })();
  }, []);

  // 401 → minta login ulang; antrean jurnal offline tetap tersimpan.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!sessionRef.current) return;
      setAuthToken(null);
      secure.del(SESSION_KEY).catch(() => {});
      const prev = sessionRef.current;
      sessionRef.current = null;
      setState({ loading: false, session: null, locked: false, reauthRequired: true });
      // simpan user_id terakhir supaya antrean bisa dilanjutkan setelah login ulang
      secure.set('last_user_v1', prev.user.id).catch(() => {});
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Kunci aplikasi setelah tidak aktif > idle timeout.
  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const s = sessionRef.current;
      if (!s) return;
      if (next !== 'active') {
        backgroundAt.current = Date.now();
        secure.set(ACTIVE_KEY, String(Date.now())).catch(() => {});
        return;
      }
      const idleMs = (s.idleTimeoutMinutes || 30) * 60_000;
      if (backgroundAt.current && Date.now() - backgroundAt.current > idleMs) {
        setState((x) => (x.session ? { ...x, locked: true } : x));
      }
      backgroundAt.current = null;
    };
    const sub = AppState.addEventListener('change', onChange);
    const tick = setInterval(() => {
      if (sessionRef.current && AppState.currentState === 'active') secure.set(ACTIVE_KEY, String(Date.now())).catch(() => {});
    }, 60_000);
    return () => { sub.remove(); clearInterval(tick); };
  }, []);

  // Logout otomatis saat token kedaluwarsa.
  useEffect(() => {
    const s = state.session;
    if (!s?.expiresAt) return;
    const ms = s.expiresAt - Date.now();
    if (ms <= 0) return;
    const t = setTimeout(() => { void applySession(null); setState((x) => ({ ...x, reauthRequired: true })); }, Math.min(ms, 2_147_000_000));
    return () => clearTimeout(t);
  }, [state.session, applySession]);

  const login = useCallback<Ctx['login']>(async (p) => {
    const r = await api.auth.login(p);
    const s: Session = {
      token: r.access_token,
      user: { ...r.user, active_role: r.active_role },
      activeRole: r.active_role,
      expiresAt: Date.now() + (r.expires_in_minutes || 720) * 60_000,
      idleTimeoutMinutes: r.idle_timeout_minutes || 30,
    };
    await secure.set(ACTIVE_KEY, String(Date.now()));
    await applySession(s);
    return r;
  }, [applySession]);

  const logout = useCallback<Ctx['logout']>(async (opts) => {
    const s = sessionRef.current;
    try {
      if (s) await opts?.beforeClear?.(s);
    } catch { /* lanjutkan logout */ }
    try { if (s) await api.auth.logout(); } catch { /* offline: tetap keluar */ }
    try { if (s) await wipeUserData(s.user.id); } catch { /* abaikan */ }
    await secure.del(ACTIVE_KEY);
    await applySession(null);
  }, [applySession]);

  const switchRole = useCallback(async (role: string) => {
    const s = sessionRef.current;
    if (!s) return;
    const r = await api.auth.switchRole(role);
    await applySession({ ...s, token: r.access_token, activeRole: r.active_role, user: { ...r.user, active_role: r.active_role } });
  }, [applySession]);

  const refreshMe = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    const me = await api.auth.me();
    await applySession({ ...s, user: { ...me, active_role: s.activeRole } });
  }, [applySession]);

  const unlock = useCallback(async () => {
    if (Platform.OS === 'web' || !biometricAvailable) {
      // Tanpa biometrik/PIN perangkat: buka (perangkat tanpa kunci layar tidak bisa diverifikasi).
      setState((x) => ({ ...x, locked: false }));
      return { ok: true };
    }
    try {
      const r = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Buka kunci Super Apps MATSANDATAMA',
        cancelLabel: 'Batal',
        disableDeviceFallback: false,
      });
      if (r.success) {
        setState((x) => ({ ...x, locked: false }));
        await secure.set(ACTIVE_KEY, String(Date.now()));
        return { ok: true };
      }
      return { ok: false, reason: (r as any).error === 'user_cancel' ? 'Dibatalkan' : 'Verifikasi gagal. Coba lagi.' };
    } catch (e: any) {
      return { ok: false, reason: e?.message || 'Verifikasi gagal' };
    }
  }, [biometricAvailable]);

  const lockNow = useCallback(() => setState((x) => (x.session ? { ...x, locked: true } : x)), []);

  const value = useMemo<Ctx>(() => ({
    ...state,
    token: state.session?.token ?? null,
    user: state.session?.user ?? null,
    activeRole: state.session?.activeRole ?? null,
    login, logout, switchRole, refreshMe, unlock, lockNow, biometricAvailable,
  }), [state, login, logout, switchRole, refreshMe, unlock, lockNow, biometricAvailable]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const c = useContext(AuthContext);
  if (!c) throw new Error('AuthProvider belum dipasang');
  return c;
}
