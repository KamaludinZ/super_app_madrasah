import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';

const AcademicYearContext = createContext({});

export function AcademicYearProvider({ children }) {
  const [activeAY, setActiveAY] = useState(null);  // current active TP (global, from DB)
  const [viewAY, setViewAY] = useState(null);  // user-selected TP for viewing (defaults to activeAY)
  const [viewSemester, setViewSemester] = useState(null);
  const [allYears, setAllYears] = useState([]);
  const [activeCurriculum, setActiveCurriculum] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const [ay, all] = await Promise.all([
        api.get('/academic-years/active'),
        api.get('/academic-years'),
      ]);
      setActiveAY(ay.data);
      setAllYears(all.data || []);
      // Default view = active
      if (!viewAY) {
        setViewAY(ay.data);
        setViewSemester(ay.data?.active_semester || 'ganjil');
      }
      // Resolve active curriculum
      if (ay.data?.curriculum_id) {
        const c = await api.get('/curriculums').catch(() => ({ data: [] }));
        const found = (c.data || []).find((x) => x.id === ay.data.curriculum_id);
        setActiveCurriculum(found);
      }
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const switchView = (yearId, semester) => {
    const year = allYears.find((y) => y.id === yearId);
    if (year) {
      setViewAY(year);
      setViewSemester(semester || year.active_semester || 'ganjil');
      try { localStorage.setItem('matsa_view_ay', JSON.stringify({ id: yearId, semester })); } catch {}
    }
  };

  const isViewingPast = activeAY && viewAY && (viewAY.id !== activeAY.id || viewSemester !== activeAY.active_semester);

  const value = {
    activeAY, viewAY, viewSemester, allYears, activeCurriculum,
    switchView, refresh, isViewingPast, loading,
  };

  return <AcademicYearContext.Provider value={value}>{children}</AcademicYearContext.Provider>;
}

export const useAcademicYear = () => useContext(AcademicYearContext);
