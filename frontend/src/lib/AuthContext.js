import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

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
      } catch (e) {
        // ignore
      }
      if (localStorage.getItem('matsa_token')) {
        await refreshMe();
      }
      setLoading(false);
    })();
  }, [refreshMe]);

  const login = async (token, userObj, role) => {
    localStorage.setItem('matsa_token', token);
    localStorage.setItem('matsa_user', JSON.stringify(userObj));
    localStorage.setItem('matsa_active_role', role);
    setUser(userObj);
    setActiveRole(role);
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('matsa_token');
    localStorage.removeItem('matsa_user');
    localStorage.removeItem('matsa_active_role');
    setUser(null);
    setActiveRole(null);
  };

  const switchRole = async (newRole) => {
    const { data } = await api.post('/auth/switch-role', { new_role: newRole });
    localStorage.setItem('matsa_token', data.access_token);
    localStorage.setItem('matsa_active_role', data.active_role);
    localStorage.setItem('matsa_user', JSON.stringify(data.user));
    setUser(data.user);
    setActiveRole(data.active_role);
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, activeRole, settings, setSettings, loading, login, logout, switchRole, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
