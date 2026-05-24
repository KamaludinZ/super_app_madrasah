import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from './api';
import { useIdleTimeout } from './useIdleTimeout';
import { toast } from 'sonner';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('matsa_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [activeRole, setActiveRole] = useState(() => localStorage.getItem('matsa_active_role') || null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const logoutFnRef = useRef(null);

  const refreshMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      setActiveRole(data.active_role);
      localStorage.setItem('matsa_user', JSON.stringify(data));
      localStorage.setItem('matsa_active_role', data.active_role);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/settings');
        setSettings(data);
      } catch (e) { /* */ }
      if (localStorage.getItem('matsa_token')) {
        await refreshMe();
      }
      setLoading(false);
    })();
  }, [refreshMe]);

  // Poll /settings every 60s to detect maintenance mode changes globally
  useEffect(() => {
    const id = setInterval(() => {
      api.get('/settings').then(({ data }) => setSettings(data)).catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const login = async (token, userObj, role, sessionInfo) => {
    localStorage.setItem('matsa_token', token);
    localStorage.setItem('matsa_user', JSON.stringify(userObj));
    localStorage.setItem('matsa_active_role', role);
    if (sessionInfo) {
      localStorage.setItem('matsa_session_info', JSON.stringify({
        ...sessionInfo,
        login_at: Date.now(),
      }));
    }
    setUser(userObj);
    setActiveRole(role);
  };

  const logout = useCallback(async (reason) => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('matsa_token');
    localStorage.removeItem('matsa_user');
    localStorage.removeItem('matsa_active_role');
    localStorage.removeItem('matsa_session_info');
    setUser(null);
    setActiveRole(null);
    if (reason === 'idle') {
      toast.info('Anda telah keluar otomatis karena tidak aktif. Silakan login kembali.');
    } else if (reason === 'session') {
      toast.info('Sesi Anda telah berakhir. Silakan login kembali.');
    }
  }, []);

  logoutFnRef.current = logout;

  const switchRole = async (newRole) => {
    const { data } = await api.post('/auth/switch-role', { new_role: newRole });
    localStorage.setItem('matsa_token', data.access_token);
    localStorage.setItem('matsa_active_role', data.active_role);
    localStorage.setItem('matsa_user', JSON.stringify(data.user));
    setUser(data.user);
    setActiveRole(data.active_role);
    return data;
  };

  const impersonate = async (targetUserId) => {
    const { data } = await api.post('/auth/impersonate', { target_user_id: targetUserId });
    localStorage.setItem('matsa_token', data.access_token);
    localStorage.setItem('matsa_active_role', data.active_role);
    localStorage.setItem('matsa_user', JSON.stringify(data.user));
    if (data.expires_in_minutes) {
      localStorage.setItem('matsa_session_info', JSON.stringify({
        expires_in_minutes: data.expires_in_minutes,
        login_at: Date.now(),
      }));
    }
    setUser(data.user);
    setActiveRole(data.active_role);
    // Redirect to dashboard after impersonating
    window.location.href = '/dashboard';
    return data;
  };

  const stopImpersonate = async () => {
    const { data } = await api.post('/auth/stop-impersonate');
    localStorage.setItem('matsa_token', data.access_token);
    localStorage.setItem('matsa_active_role', data.active_role);
    localStorage.setItem('matsa_user', JSON.stringify(data.user));
    if (data.expires_in_minutes) {
      localStorage.setItem('matsa_session_info', JSON.stringify({
        expires_in_minutes: data.expires_in_minutes,
        login_at: Date.now(),
      }));
    }
    setUser(data.user);
    setActiveRole(data.active_role);
    // Redirect to dashboard after stopping impersonation
    window.location.href = '/dashboard';
    return data;
  };

  // Idle timeout (default 30 min, configurable from settings)
  const idleTimeoutMinutes = user ? (settings?.idle_timeout_minutes || 30) : 0;
  useIdleTimeout(idleTimeoutMinutes, () => {
    if (user) logoutFnRef.current?.('idle');
  });

  // Session max age check (every minute)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      try {
        const raw = localStorage.getItem('matsa_session_info');
        if (!raw) return;
        const info = JSON.parse(raw);
        const maxMs = (info.expires_in_minutes || 720) * 60 * 1000;
        if (Date.now() - info.login_at > maxMs) {
          logoutFnRef.current?.('session');
        }
      } catch {}
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, activeRole, settings, setSettings, loading, login, logout, switchRole, impersonate, stopImpersonate, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
