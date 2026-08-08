import { useState, useEffect } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export function usePublicPagesVisibility() {
  const [visibility, setVisibility] = useState({
    rkam_visibility: 'public',
    agenda_visibility: 'public',
    prestasi_visibility: 'public',
    monitoring_visibility: 'public',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVisibility = async () => {
      try {
        const { data } = await axios.get(`${BACKEND_URL}/api/settings/public-pages`);
        setVisibility(data);
      } catch (error) {
        console.error('Failed to fetch public pages visibility:', error);
        // Use default 'public' values on error
      } finally {
        setLoading(false);
      }
    };

    fetchVisibility();
  }, []);

  return { visibility, loading };
}
