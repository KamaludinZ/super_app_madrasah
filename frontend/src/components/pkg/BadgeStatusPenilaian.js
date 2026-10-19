import React from 'react';
import { Badge } from '@/components/ui/badge';
import { CircleDashed, PencilLine, Lock } from 'lucide-react';

// Status lembar penilaian PKG yang dipakai di daftar tugas, lembar, dan rekap.
export const STATUS_PENILAIAN = {
  belum: { label: 'Belum dinilai', kelas: 'bg-slate-100 text-slate-700 border-slate-200', icon: CircleDashed },
  draf: { label: 'Draf', kelas: 'bg-amber-100 text-amber-700 border-amber-200', icon: PencilLine },
  terkunci: { label: 'Terkunci', kelas: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Lock },
};

// Badge status lembar: 'belum' | 'draf' | 'terkunci' (nilai lain dianggap 'belum').
export default function BadgeStatusPenilaian({ status, className = '' }) {
  const st = STATUS_PENILAIAN[status] || STATUS_PENILAIAN.belum;
  const Ikon = st.icon;
  return (
    <Badge className={`gap-1 ${st.kelas} ${className}`} aria-label={`Status penilaian: ${st.label}`} data-testid={`pkg-status-${status || 'belum'}`}>
      <Ikon className="h-3 w-3" aria-hidden="true" /> {st.label}
    </Badge>
  );
}
