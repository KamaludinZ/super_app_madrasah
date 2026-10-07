import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toLocalIso } from '@/lib/guruPengganti';

// Senin di kiri, sesuai kebiasaan jadwal madrasah.
const WEEKDAY_HEADERS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

/** Sel-sel tanggal satu bulan, termasuk tanggal null untuk pengisi minggu awal/akhir. */
function monthCells(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Senin = 0
  const cells = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(month.getFullYear(), month.getMonth(), d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/**
 * Kalender satu bulan penuh (grid besar) untuk modul Guru Pengganti.
 * `renderDay(date, iso)` mengisi konten tiap sel; `getDayClassName` memberi gaya tambahan.
 * `isDayDisabled(date, iso)` boleh mengembalikan string alasan (dipakai sebagai tooltip).
 * `onDisabledDayClick(date, iso, reason)` dipanggil saat tanggal nonaktif diklik (mis. untuk menjelaskan alasannya).
 * `minDate`/`maxDate` (YYYY-MM-DD) membatasi navigasi bulan.
 */
export default function MonthCalendar({
  month, onMonthChange, renderDay, getDayClassName, onDayClick, onDisabledDayClick, isDayDisabled, minDate, maxDate,
}) {
  const todayIso = toLocalIso();
  const cells = monthCells(month);
  const shift = (n) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + n, 1));
  const title = month.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  // Bandingkan bulan sebagai "YYYY-MM".
  const monthOf = (n) => toLocalIso(new Date(month.getFullYear(), month.getMonth() + n, 1)).slice(0, 7);
  const canPrev = !minDate || monthOf(-1) >= minDate.slice(0, 7);
  const canNext = !maxDate || monthOf(1) <= maxDate.slice(0, 7);
  const currentMonth = todayIso.slice(0, 7);
  const isCurrentMonth = monthOf(0) === currentMonth;
  const canGoToday = (!minDate || currentMonth >= minDate.slice(0, 7)) && (!maxDate || currentMonth <= maxDate.slice(0, 7));

  // PageUp/PageDown berpindah bulan saat fokus berada di dalam kalender.
  const handleKeyDown = (e) => {
    if (e.key === 'PageUp' && canPrev) { e.preventDefault(); shift(-1); }
    if (e.key === 'PageDown' && canNext) { e.preventDefault(); shift(1); }
  };

  return (
    <div className="space-y-3" data-testid="gp-month-calendar" onKeyDown={handleKeyDown}>
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Bulan sebelumnya" data-testid="gp-month-prev">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="text-base font-bold text-slate-900 capitalize" aria-live="polite">{title}</div>
          {!isCurrentMonth && canGoToday && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-[#006837]"
              onClick={() => onMonthChange(new Date())}
              data-testid="gp-month-today"
            >
              Bulan ini
            </Button>
          )}
        </div>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)} disabled={!canNext} aria-label="Bulan berikutnya" data-testid="gp-month-next">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {WEEKDAY_HEADERS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="min-h-[56px] sm:min-h-[92px]" aria-hidden />;
          const iso = toLocalIso(date);
          const disabledReason = isDayDisabled ? isDayDisabled(date, iso) : false;
          const disabled = !!disabledReason;
          const isToday = iso === todayIso;
          const Tag = onDayClick ? 'button' : 'div';
          return (
            <Tag
              key={iso}
              {...(onDayClick ? {
                type: 'button',
                // Tetap bisa diklik walau nonaktif agar alasannya bisa ditampilkan (tooltip tidak ada di layar sentuh).
                onClick: () => (disabled
                  ? onDisabledDayClick?.(date, iso, disabledReason)
                  : onDayClick(date, iso)),
              } : {})}
              role="gridcell"
              aria-disabled={disabled || undefined}
              title={typeof disabledReason === 'string' ? disabledReason : undefined}
              aria-label={date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              className={`min-h-[56px] sm:min-h-[92px] rounded-lg border p-1.5 text-left flex flex-col gap-1 transition-colors ${
                disabled ? 'bg-slate-50 border-slate-100 text-slate-300' : 'bg-white border-slate-200'
              } ${getDayClassName ? getDayClassName(date, iso) : ''}`}
              data-testid={`gp-day-${iso}`}
            >
              <span className={`text-xs font-semibold leading-none ${
                isToday ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#006837] text-white' : ''
              }`}>
                {date.getDate()}
              </span>
              {renderDay && renderDay(date, iso)}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
