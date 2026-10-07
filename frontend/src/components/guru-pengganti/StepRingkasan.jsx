import React from 'react';
import { ArrowRight, CalendarDays, Clock, AlertTriangle } from 'lucide-react';
import { DAY_LABELS } from '@/lib/api';
import { parseLocalIso } from '@/lib/guruPengganti';

/**
 * Masalah yang mencegah penyimpanan, atau null bila draft siap disimpan.
 * Ketersediaan guru & tanggal divalidasi ulang oleh server saat menyimpan.
 */
export function draftProblem(draft) {
  if (!draft.originalTeacherId || !draft.slot || !draft.dates.length || !draft.substituteTeacherId) {
    return 'Lengkapi semua langkah sebelum menyimpan.';
  }
  return null;
}

/** Langkah 5: ringkasan sementara penugasan sebelum disimpan. */
export default function StepRingkasan({ draft }) {
  const original = draft.originalTeacherId ? { name: draft.originalTeacherName } : null;
  const substitute = draft.substituteTeacherId
    ? { name: draft.substituteTeacherName, subject: draft.substituteSubject }
    : null;
  const problem = draftProblem(draft);

  return (
    <div className="space-y-5" data-testid="gp-step-review">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 rounded-lg border border-slate-200 p-3">
          <div className="text-xs text-slate-500">Guru digantikan</div>
          <div className="text-sm font-semibold text-slate-900">{original?.name || '-'}</div>
          <div className="text-xs text-slate-500">{draft.reason || 'Tanpa keterangan alasan'}</div>
        </div>
        <ArrowRight className="h-5 w-5 text-slate-400 self-center rotate-90 sm:rotate-0 shrink-0" />
        <div className="flex-1 rounded-lg border border-[#006837]/30 bg-[#006837]/5 p-3">
          <div className="text-xs text-[#006837]">Guru pengganti</div>
          <div className="text-sm font-semibold text-slate-900">{substitute?.name || '-'}</div>
          <div className="text-xs text-slate-500">{substitute?.subject}</div>
        </div>
      </div>

      {draft.slot && (
        <div className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Clock className="h-4 w-4 text-slate-400" />
            {DAY_LABELS[draft.slot.day]} · Jam ke-{draft.slot.jam_ke}
            <span className="font-mono text-xs text-slate-500">({draft.slot.start_time}-{draft.slot.end_time})</span>
          </div>
          <div className="text-xs text-slate-500 mt-1 ml-6">{draft.slot.class_name} · {draft.slot.subject_name}</div>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 mb-2">
          <CalendarDays className="h-4 w-4 text-slate-400" /> {draft.dates.length} tanggal
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {draft.dates.map((iso) => (
            <li key={iso} className="text-sm text-slate-700 rounded-md bg-slate-50 px-3 py-1.5">
              {parseLocalIso(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </li>
          ))}
        </ul>
      </div>

      {problem ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="gp-review-problem">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {problem}
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Setelah disimpan, slot ini langsung muncul di jadwal {substitute?.name} pada tanggal terpilih.
          {' '}{original?.name} tetap dapat mengisi jurnal slot-nya sendiri.
        </p>
      )}
    </div>
  );
}
