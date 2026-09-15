import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from './api';
import { useIdleTimeout } from './useIdleTimeout';
import { isStandalone } from './pwa';
import { toast } from 'sonner';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('matsa_user');
      if (!raw) return null;

      const userData = JSON.parse(raw);

      // CRITICAL: Restore impersonation state on initial load
      const impersonationRaw = localStorage.getItem('matsa_impersonation');
      if (impersonationRaw) {
        try {
          const impersonationState = JSON.parse(impersonationRaw);
          userData.is_impersonating = impersonationState.is_impersonating;
          userData.impersonator_id = impersonationState.impersonator_id;
          userData.impersonator_username = impersonationState.impersonator_username;
        } catch (e) {
          console.error('Failed to restore impersonation state on init:', e);
          localStorage.removeItem('matsa_impersonation');
        }
      }

      return userData;
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

      // CRITICAL: Restore impersonation state from localStorage after refresh
      const impersonationRaw = localStorage.getItem('matsa_impersonation');
      if (impersonationRaw) {
        try {
          const impersonationState = JSON.parse(impersonationRaw);
          // Merge impersonation flags back into user object
          data.is_impersonating = impersonationState.is_impersonating;
          data.impersonator_id = impersonationState.impersonator_id;
          data.impersonator_username = impersonationState.impersonator_username;
        } catch (e) {
          console.error('Failed to restore impersonation state:', e);
          localStorage.removeItem('matsa_impersonation');
        }
      }

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

        // CRITICAL: Validate impersonation state after refresh
        const impersonationRaw = localStorage.getItem('matsa_impersonation');
        if (impersonationRaw) {
          try {
            const { data: status } = await api.get('/auth/impersonate-status');

            // If impersonation is invalid, clean up and force logout
            if (status.is_invalid || !status.is_impersonating) {
              console.warn('Invalid impersonation state detected, cleaning up...');
              localStorage.removeItem('matsa_impersonation');

              // Force logout if impersonation is invalid
              if (status.is_invalid) {
                toast.error('Sesi impersonation tidak valid. Silakan login kembali.');
                logoutFnRef.current?.('invalid_impersonation');
              } else {
                // Just clean up the flag if no longer impersonating
                await refreshMe();
              }
            }
          } catch (e) {
            console.error('Failed to validate impersonation:', e);
            // On error, assume impersonation is invalid and clean up
            localStorage.removeItem('matsa_impersonation');
          }
        }
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
    localStorage.removeItem('matsa_impersonation'); // Clear impersonation state on logout
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

    // CRITICAL: Preserve impersonation state when switching roles
    const impersonationRaw = localStorage.getItem('matsa_impersonation');
    if (impersonationRaw) {
      try {
        const impersonationState = JSON.parse(impersonationRaw);
        // Merge impersonation flags back into user object
        data.user.is_impersonating = impersonationState.is_impersonating;
        data.user.impersonator_id = impersonationState.impersonator_id;
        data.user.impersonator_username = impersonationState.impersonator_username;
      } catch (e) {
        console.error('Failed to preserve impersonation state during role switch:', e);
      }
    }

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

    // CRITICAL: Store impersonation state persistently to survive refreshes
    localStorage.setItem('matsa_impersonation', JSON.stringify({
      is_impersonating: true,
      impersonator_id: data.user.impersonator_id,
      impersonator_username: data.user.impersonator_username,
      target_user_id: data.user.id,
      target_username: data.user.username,
      started_at: Date.now(),
    }));

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

    // CRITICAL: Clear impersonation state
    localStorage.removeItem('matsa_impersonation');

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

  // Idle timeout (default 30 min, configurable from settings).
  // Disabled when running as an installed PWA (standalone) so users stay logged in
  // and can just open the app without re-authenticating.
  const idleTimeoutMinutes = (user && !isStandalone()) ? (settings?.idle_timeout_minutes || 30) : 0;
  useIdleTimeout(idleTimeoutMinutes, () => {
    if (user) logoutFnRef.current?.('idle');
  });

  // Session max age check (every minute). Skipped in standalone PWA so the app
  // stays open until the backend token itself expires.
  useEffect(() => {
    if (!user || isStandalone()) return;
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
