import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// Create a simple event emitter for refresh notifications
const refreshListeners = new Set();

export function notifyPublicPagesVisibilityChanged() {
  refreshListeners.forEach(listener => listener());
}

export function usePublicPagesVisibility() {
  const [visibility, setVisibility] = useState({
    rkam_visibility: 'public',
    agenda_visibility: 'public',
    prestasi_visibility: 'public',
    monitoring_visibility: 'public',
  });
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchVisibility = useCallback(async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/settings/public-pages?_=${Date.now()}`);
      setVisibility(data);
    } catch (error) {
      console.error('Failed to fetch public pages visibility:', error);
      // Use default 'public' values on error
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
