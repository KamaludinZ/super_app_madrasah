import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck, Check, X, Info } from 'lucide-react';
import { DAY_LABELS } from '@/lib/api';
import { DAY_KEYS, toLocalIso, parseLocalIso, dateBlockReason } from '@/lib/guruPengganti';
import { apiErrorMessage, getSlotDates } from '@/lib/guruPenggantiSchedule';
import MonthCalendar from '@/components/guru-pengganti/MonthCalendar';
import { toast } from 'sonner';

/**
 * Langkah 3: kalender satu bulan penuh, klik untuk memilih/membatalkan banyak tanggal.
 * Hanya tanggal yang jatuh pada hari slot (mis. setiap Senin) dan dinyatakan bisa dipilih oleh
 * server (belum lewat, dalam semester aktif, bukan libur, belum punya guru pengganti).
 */
export default function StepPilihTanggal({ draft, setDraft }) {
  const [month, setMonth] = useState(() =>
    (draft.dates.length ? parseLocalIso(draft.dates[0]) : new Date()));
  const monthKey = toLocalIso(new Date(month.getFullYear(), month.getMonth(), 1)).slice(0, 7);

  // Status tanggal bulan ini dari server: { 'YYYY-MM-DD': { selectable, reason } }.
  const [serverDates, setServerDates] = useState({});
  const [period, setPeriod] = useState(null);
  const [loadingMonth, setLoadingMonth] = useState(true);
  useEffect(() => {
    if (!draft.slot?.id) return;
    let alive = true;
    setLoadingMonth(true);
    getSlotDates(draft.slot.id, monthKey)
      .then((res) => {
        if (!alive) return;
        setServerDates(Object.fromEntries((res.dates || []).map((x) => [x.date, x])));
        if (res.period?.start_date) setPeriod(res.period);
      })
      .catch((e) => alive && toast.error(apiErrorMessage(e, 'Gagal memuat tanggal slot')))
      .finally(() => alive && setLoadingMonth(false));
    return () => { alive = false; };
  }, [draft.slot?.id, monthKey]);

  const dayIndex = DAY_KEYS.indexOf(draft.slot?.day);
  const dayLabel = DAY_LABELS[draft.slot?.day] || '-';
  const selectedSet = useMemo(() => new Set(draft.dates), [draft.dates]);

  const blockReason = (date) => {
    if (date.getDay() !== dayIndex) return `Bukan hari ${dayLabel}`;
    const info = serverDates[toLocalIso(date)];
    if (info) return info.selectable ? null : info.reason;
    return loadingMonth ? 'Memuat...' : dateBlockReason(date, period);
  };

  // Penjelasan untuk tanggal nonaktif yang diklik.
  const [blockedInfo, setBlockedInfo] = useState(null); // { iso, message }
  const teacherName = draft.originalTeacherName || 'Guru ini';
  const explainBlocked = (date, iso, reason) => {
    const when = date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
    let detail = reason;
    if (date.getDay() !== dayIndex) {
      const slot = draft.slot;
      detail = `${teacherName} mengajar ${slot.class_name} jam ke-${slot.jam_ke} hanya setiap hari ${dayLabel}, `
        + `bukan ${DAY_LABELS[DAY_KEYS[date.getDay()]] || 'hari ini'}.`;
    } else if (reason) {
      detail = `Alasan: ${reason}.`;
    }
    setBlockedInfo({ iso, message: `${when} tidak bisa dipilih. ${detail}` });
  };

  // Tanggal yang bisa dipilih pada bulan yang sedang ditampilkan.
  const eligibleInMonth = useMemo(
    () => Object.values(serverDates).filter((x) => x.selectable && x.date.startsWith(monthKey)).map((x) => x.date),
    [serverDates, monthKey],
  );

  const selectedInMonth = eligibleInMonth.filter((iso) => selectedSet.has(iso)).length;
  const allMonthSelected = eligibleInMonth.length > 0 && selectedInMonth === eligibleInMonth.length;

  const setDates = (isos) => setDraft((d) => ({ ...d, dates: [...new Set(isos)].sort() }));
  const toggle = (_date, iso) => {
    setBlockedInfo(null);
    setDates(selectedSet.has(iso) ? draft.dates.filter((x) => x !== iso) : [...draft.dates, iso]);
  };
  const toggleMonth = () =>
    setDates(allMonthSelected
      ? draft.dates.filter((x) => !eligibleInMonth.includes(x))
      : [...draft.dates, ...eligibleInMonth]);

  const removeDate = (iso) => setDates(draft.dates.filter((x) => x !== iso));
  const clearAll = () => {
    const previous = draft.dates;
    setDates([]);
    toast(`${previous.length} tanggal dibatalkan`, {
      action: { label: 'Urungkan', onClick: () => setDates(previous) },
    });
  };

  const monthLabel = month.toLocaleDateString('id-ID', { month: 'long' });

  return (
    <div className="space-y-4" data-testid="gp-step-dates">
      <div className="rounded-lg bg-[#006837]/5 border border-[#006837]/15 px-3 py-2 text-xs text-slate-700">
        Slot ini terjadwal setiap hari <span className="font-semibold text-[#006837]">{dayLabel}</span>.
        Klik tanggal {dayLabel} untuk memilih; tanggal lewat, libur, di luar periode{period?.name ? ` ${period.name}` : ''},
        atau yang sudah punya guru pengganti tidak bisa dipilih.
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2" aria-live="polite" data-testid="gp-date-counter">
          <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full bg-[#006837] px-2 text-sm font-bold text-white">
            {draft.dates.length}
          </span>
          <span className="text-sm text-slate-700">
            tanggal dipilih
            {draft.dates.length > 0 && (
              <span className="text-slate-500"> · {selectedInMonth} dari {eligibleInMonth.length} di {monthLabel}</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleMonth}
            disabled={eligibleInMonth.length === 0}
            className="gap-2"
            data-testid="gp-select-all-month"
          >
            <CalendarCheck className="h-4 w-4" />
            {allMonthSelected ? `Batalkan semua ${dayLabel}` : `Pilih semua ${dayLabel}`}
          </Button>
          {draft.dates.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              data-testid="gp-clear-dates"
            >
              Batalkan semua tanggal
            </Button>
          )}
        </div>
      </div>

      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        minDate={period?.start_date}
        maxDate={period?.end_date}
        isDayDisabled={blockReason}
        onDayClick={toggle}
        onDisabledDayClick={explainBlocked}
        getDayClassName={(date, iso) => {
          if (selectedSet.has(iso)) return '!bg-[#006837] !border-[#006837] text-white';
          if (!blockReason(date)) return 'hover:border-[#006837] hover:bg-[#006837]/5 cursor-pointer';
          if (blockedInfo?.iso === iso) return 'cursor-not-allowed !border-amber-300';
          return 'cursor-not-allowed';
        }}
        renderDay={(date, iso) => (selectedSet.has(iso) ? (
          <span className="mt-auto self-end"><Check className="h-4 w-4" aria-label="Dipilih" /></span>
        ) : null)}
      />

      {blockedInfo && (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" data-testid="gp-date-blocked-reason">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{blockedInfo.message}</span>
          <button type="button" onClick={() => setBlockedInfo(null)} aria-label="Tutup" className="rounded p-0.5 hover:bg-amber-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {draft.dates.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" data-testid="gp-selected-dates">
          <span className="text-xs text-slate-500 mr-1">Klik × atau klik ulang tanggal di kalender untuk membatalkan:</span>
          {draft.dates.map((iso) => (
            <Badge key={iso} variant="outline" className="gap-1 pr-1 bg-white">
              {parseLocalIso(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              <button
                type="button"
                onClick={() => removeDate(iso)}
                aria-label={`Batalkan tanggal ${parseLocalIso(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}`}
                className="rounded-full p-0.5 hover:bg-slate-100"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
