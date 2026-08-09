import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const IS_DEV = process.env.NODE_ENV === 'development';

// Create a simple event emitter for refresh notifications
const refreshListeners = new Set();

export function notifyPublicPagesVisibilityChanged() {
  refreshListeners.forEach(listener => listener());
}

export function usePublicPagesVisibility() {
  const [visibility, setVisibility] = useState({
    rkam_visibility: 'hidden',
    agenda_visibility: 'hidden',
    prestasi_visibility: 'hidden',
    monitoring_visibility: 'hidden',
  });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchVisibility = useCallback(async () => {
    setLoading(true); // Set loading true on every fetch
    try {
      // Force cache bust with timestamp + random
      const cacheBust = `${Date.now()}_${Math.random()}`;
      const { data } = await axios.get(`${BACKEND_URL}/api/settings/public-pages?_=${cacheBust}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      // Only log in development mode
      if (IS_DEV) {
        console.log('[Visibility] Fetched:', data);
      }
      setVisibility(data);
    } catch (error) {
      if (IS_DEV) {
        console.error('Failed to fetch public pages visibility:', error);
      }
      // On error, keep current state (default to hidden for safety)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisibility();

    // Listen for refresh events
    const refreshListener = () => {
      setRefreshKey(prev => prev + 1);
      fetchVisibility();
    };

    refreshListeners.add(refreshListener);

    return () => {
      refreshListeners.delete(refreshListener);
    };
  }, [fetchVisibility, refreshKey]);

  return { visibility, loading, refetch: fetchVisibility };
}
