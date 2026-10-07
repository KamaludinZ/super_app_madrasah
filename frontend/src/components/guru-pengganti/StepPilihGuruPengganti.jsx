import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Check, User, Ban, Loader2 } from 'lucide-react';
import { apiErrorMessage, listSubstituteCandidates } from '@/lib/guruPenggantiSchedule';

/**
 * Langkah 4: pilih guru pengganti. Server menandai guru yang bentrok (mengajar sendiri atau sudah
 * menggantikan di jam yang sama pada tanggal terpilih) sebagai tidak tersedia beserta alasannya.
 */
export default function StepPilihGuruPengganti({ draft, setDraft }) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const scheduleId = draft.slot?.id;
  const datesKey = draft.dates.join(',');
  useEffect(() => {
    if (!scheduleId) return undefined;
    let alive = true;
    setLoading(true);
    setError('');
    listSubstituteCandidates(scheduleId, datesKey ? datesKey.split(',') : [])
      .then((list) => { if (alive) setCandidates(list); })
      .catch((e) => { if (alive) setError(apiErrorMessage(e, 'Gagal memuat calon guru pengganti')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [scheduleId, datesKey]);

  // Pilihan sebelumnya gugur bila slot/tanggal berubah dan guru jadi bentrok.
  const { substituteTeacherId } = draft;
  useEffect(() => {
    if (!substituteTeacherId || loading || error) return;
    const current = candidates.find((c) => c.id === substituteTeacherId);
    if (!current || !current.available) {
      setDraft((d) => ({ ...d, substituteTeacherId: '', substituteTeacherName: '', substituteSubject: '' }));
    }
  }, [substituteTeacherId, candidates, loading, error, setDraft]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.filter((t) => !q || `${t.name} ${t.subject} ${t.nip_nuptk || ''}`.toLowerCase().includes(q));
  }, [candidates, query]);

  const availableCount = candidates.filter((t) => t.available).length;

  return (
    <div className="space-y-4" data-testid="gp-step-substitute">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama guru atau mapel..."
            className="pl-9"
            data-testid="gp-substitute-search"
          />
        </div>
        {!loading && !error && (
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-[#006837]">{availableCount}</span> guru tersedia
          </div>
        )}
      </div>

      <div role="radiogroup" aria-label="Guru pengganti" className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
        {loading && (
          <div className="col-span-full flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa ketersediaan guru...
          </div>
        )}
        {!loading && error && <div className="col-span-full text-center py-6 text-sm text-rose-600">{error}</div>}
        {!loading && !error && visible.length === 0 && (
          <div className="col-span-full text-center py-6 text-sm text-slate-400 italic">Guru tidak ditemukan.</div>
        )}
        {!loading && !error && visible.map((t) => {
          const selected = t.id === draft.substituteTeacherId;
          const disabled = !t.available;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={disabled}
              disabled={disabled}
              onClick={() => setDraft((d) => ({
                ...d, substituteTeacherId: t.id, substituteTeacherName: t.name, substituteSubject: t.subject,
              }))}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                disabled
                  ? 'border-slate-200 bg-slate-50 cursor-not-allowed'
                  : selected
                    ? 'border-[#006837] bg-[#006837]/5 ring-1 ring-[#006837]'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
              data-testid={`gp-substitute-${t.id}`}
            >
              <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${
                disabled ? 'bg-slate-200 text-slate-400' : selected ? 'bg-[#006837] text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {disabled ? <Ban className="h-4 w-4" /> : selected ? <Check className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-semibold truncate ${disabled ? 'text-slate-400' : 'text-slate-900'}`}>{t.name}</div>
                {disabled ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 shrink-0">Tidak tersedia</Badge>
                    <span className="text-[11px] text-slate-500 truncate" title={t.unavailable}>{t.unavailable}</span>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 truncate">{t.subject || '-'}</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
