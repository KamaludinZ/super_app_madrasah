import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

// Event yang dikirim setelah pengguna mengganti "konteks lihat" (tahun/semester yang dipilih
// lewat dialog di header). Halaman yang memakai useViewYear() langsung memuat ulang datanya.
export const VIEW_CONTEXT_CHANGED = 'matsa:view-context-changed';

export function notifyViewContextChanged(ctx) {
  try { window.dispatchEvent(new CustomEvent(VIEW_CONTEXT_CHANGED, { detail: ctx })); } catch { /* abaikan */ }
}

// Cadangan bila semester belum terhubung ke Tahun Takwim: TP '2025/2026' semester ganjil -> 2025, genap -> 2026.
function yearFromAcademicYear(yearName, semesterCode) {
  const m = String(yearName || '').match(/(\d{4})\s*\/\s*(\d{4})/);
  if (!m) return null;
  const genap = /genap|^(2|4|6)$/i.test(String(semesterCode || ''));
  return Number(genap ? m[2] : m[1]);
}

/**
 * Tahun Takwim (tahun kalender) yang sedang DILIHAT pengguna ini.
 *
 * - Bila pengguna memilih semester lain lewat "Konteks Lihat" (hanya berlaku untuk dirinya),
 *   tahun diambil dari Tahun Takwim semester tersebut — mis. Genap 2025/2026 -> 2026.
 * - Bila tidak, memakai Tahun Takwim aktif madrasah (global).
 */
export function useViewYear() {
  const [state, setState] = useState({ year: null, isOverride: false, label: null, loading: true });

  const load = useCallback(async () => {
    let year = null;
    let isOverride = false;
    let label = null;
    try {
      const { data } = await api.get('/auth/view-context');
      const tt = (data?.tahun_takwim_info || [])[0];
      if (data?.is_override) {
        year = tt?.year ? Number(tt.year) : yearFromAcademicYear(data.year_name, data.semester_code);
        isOverride = !!year;
        label = [data.year_name, data.semester_name].filter(Boolean).join(' · ');
      }
    } catch { /* jatuh ke tahun aktif */ }
    if (!year) {
      try {
        const { data } = await api.get('/tahun-takwim/active');
        if (data?.year) year = Number(data.year);
      } catch { /* abaikan */ }
    }
    setState({ year: year || new Date().getFullYear(), isOverride, label, loading: false });
  }, []);

  useEffect(() => {
    load();
    window.addEventListener(VIEW_CONTEXT_CHANGED, load);
    return () => window.removeEventListener(VIEW_CONTEXT_CHANGED, load);
  }, [load]);

  return state;
}
