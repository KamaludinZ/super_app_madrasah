import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Check, Clock, MapPin, Loader2 } from 'lucide-react';
import { DAY_LABELS } from '@/lib/api';
import { shiftDatesToDay } from '@/lib/guruPengganti';
import { apiErrorMessage, getActivePeriod, listTeacherSlots } from '@/lib/guruPenggantiSchedule';
import { toast } from 'sonner';

const DAY_ORDER = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

/** Langkah 2: pilih satu slot jadwal (jam & kelas) milik guru yang digantikan. */
export default function StepPilihSlot({ draft, setDraft }) {
  const [slots, setSlots] = useState([]);
  const [period, setPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    Promise.all([listTeacherSlots(draft.originalTeacherId), getActivePeriod().catch(() => null)])
      .then(([list, p]) => { setSlots(list); setPeriod(p); })
      .catch((e) => setError(apiErrorMessage(e, 'Gagal memuat jadwal guru')))
      .finally(() => setLoading(false));
  }, [draft.originalTeacherId]);

  const byDay = useMemo(() => {
    return DAY_ORDER
      .map((day) => ({
        day,
        slots: slots.filter((s) => s.day === day).sort((a, b) => a.start_time.localeCompare(b.start_time)),
      }))
      .filter((g) => g.slots.length > 0);
  }, [slots]);

  const select = (s) => {
    if (draft.slot?.id === s.id) return;
    // Tanggal terikat pada hari slot: bila hari berubah, geser ke hari baru di minggu yang sama.
    const dayChanged = draft.slot && draft.slot.day !== s.day && draft.dates.length > 0;
    const adjusted = dayChanged
      ? shiftDatesToDay(draft.dates, s.day, period)
      : { dates: draft.dates, dropped: 0 };
    setDraft((d) => ({
      ...d,
      slot: {
        id: s.id, day: s.day, jam_ke: s.jam_ke || '-', start_time: s.start_time, end_time: s.end_time,
        class_name: s.class_name, subject_name: s.subject_name,
      },
      dates: adjusted.dates,
    }));
    if (dayChanged) {
      const parts = [`${adjusted.dates.length} tanggal digeser ke hari ${DAY_LABELS[s.day]}`];
      if (adjusted.dropped) parts.push(`${adjusted.dropped} dibuang karena sudah lewat/di luar periode`);
      toast.info(`${parts.join('; ')}. Periksa lagi di langkah Tanggal.`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat jadwal guru...
      </div>
    );
  }
  if (error) return <div className="text-center py-10 text-sm text-rose-600">{error}</div>;

  if (byDay.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-slate-400 italic" data-testid="gp-slot-empty">
        Guru ini belum memiliki jadwal mengajar pada semester aktif.
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="gp-step-slot">
      {byDay.map(({ day, slots }) => (
        <div key={day}>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{DAY_LABELS[day]}</div>
          <div role="radiogroup" aria-label={`Slot hari ${DAY_LABELS[day]}`} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {slots.map((s) => {
              const selected = draft.slot?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => select(s)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    selected ? 'border-[#006837] bg-[#006837]/5 ring-1 ring-[#006837]' : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                  data-testid={`gp-slot-${s.id}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900">{s.class_name}</div>
                    {selected ? (
                      <span className="h-5 w-5 rounded-full bg-[#006837] text-white flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Jam ke-{s.jam_ke || '-'}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.subject_name}</div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                    <span className="inline-flex items-center gap-1 font-mono"><Clock className="h-3 w-3" />{s.start_time}-{s.end_time}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{s.room_name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
