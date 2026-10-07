import React, { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, Check, User, Loader2 } from 'lucide-react';
import { DAY_LABELS } from '@/lib/api';
import { apiErrorMessage, listReplaceableTeachers } from '@/lib/guruPenggantiSchedule';

const REASONS = ['Sakit', 'Izin', 'Dinas luar', 'Cuti', 'Pelatihan', 'Lainnya'];

/** Langkah 1: pilih guru yang berhalangan + alasan (opsional). */
export default function StepPilihGuruDigantikan({ draft, setDraft }) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    listReplaceableTeachers()
      .then(setAll)
      .catch((e) => setError(apiErrorMessage(e, 'Gagal memuat daftar guru')))
      .finally(() => setLoading(false));
  }, []);

  const teachers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((t) => !q || `${t.name} ${t.subject} ${t.nip_nuptk || ''}`.toLowerCase().includes(q));
  }, [all, query]);

  const select = (t) => {
    const id = t.id;
    if (id === draft.originalTeacherId) return;
    // Ganti guru → slot, tanggal & pengganti sebelumnya tidak berlaku lagi.
    setDraft((d) => ({
      ...d,
      originalTeacherId: id,
      originalTeacherName: t.name,
      slot: null,
      dates: [],
      substituteTeacherId: '',
      substituteTeacherName: '',
      substituteSubject: '',
    }));
  };

  return (
    <div className="space-y-4" data-testid="gp-step-original">
      <div className="relative">
        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama guru atau mapel..."
          className="pl-9"
          data-testid="gp-original-search"
        />
      </div>

      <div role="radiogroup" aria-label="Guru yang digantikan" className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto pr-1">
        {loading && (
          <div className="col-span-full flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat guru...
          </div>
        )}
        {!loading && error && (
          <div className="col-span-full text-center py-6 text-sm text-rose-600">{error}</div>
        )}
        {!loading && !error && teachers.length === 0 && (
          <div className="col-span-full text-center py-6 text-sm text-slate-400 italic">
            {all.length === 0 ? 'Belum ada guru dengan jadwal mengajar di semester aktif.' : 'Guru tidak ditemukan.'}
          </div>
        )}
        {teachers.map((t) => {
          const selected = t.id === draft.originalTeacherId;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => select(t)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                selected ? 'border-[#006837] bg-[#006837]/5 ring-1 ring-[#006837]' : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
              data-testid={`gp-original-${t.id}`}
            >
              <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${selected ? 'bg-[#006837] text-white' : 'bg-slate-100 text-slate-500'}`}>
                {selected ? <Check className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">{t.name}</div>
                <div className="text-xs text-slate-500 truncate">
                  {t.subject || '-'}{t.days?.length ? ` · ${t.days.map((d) => DAY_LABELS[d] || d).join(', ')}` : ''}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-slate-600">Alasan berhalangan (opsional)</Label>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => {
            const active = draft.reason === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, reason: active ? '' : r }))}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active ? 'bg-[#006837] border-[#006837] text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
                data-testid={`gp-reason-${r}`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
