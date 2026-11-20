import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { muatImpor, persenProgres } from '@/lib/ujianNilai';
import { BadgeStatusImpor } from '@/components/ujian/nilai/MonitoringImpor';

function Batang({ diproses, total, gagal, label, kecil }) {
  const persen = persenProgres(diproses, total);
  const persenGagal = total ? Math.min(persen, Math.round((gagal / total) * 100)) : 0;
  return (
    <div>
      <div className={`mb-1 flex items-center justify-between ${kecil ? 'text-xs' : 'text-sm'}`}>
        <span className="font-medium text-slate-800">{label}</span>
        <span className="tabular-nums text-slate-500">{diproses}/{total} baris · {persen}%</span>
      </div>
      <div className={`flex overflow-hidden rounded-full bg-slate-100 ${kecil ? 'h-1.5' : 'h-2.5'}`} role="progressbar" aria-valuenow={persen} aria-valuemin={0} aria-valuemax={100} aria-label={`Progres ${label}`}>
        <div className="h-full bg-[#006837] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${persen - persenGagal}%` }} />
        <div className="h-full bg-rose-500 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${persenGagal}%` }} />
      </div>
    </div>
  );
}

/**
 * Progres pemrosesan satu impor nilai: batang keseluruhan dan per sheet kelas (hijau berhasil, merah gagal). Selama status
 * 'proses' rincian dimuat ulang tiap 1,5 detik sampai selesai/gagal. `onSelesai(log)` dipanggil sekali saat selesai.
 */
export default function ProgresImpor({ ujianId, log: awal, onSelesai }) {
  const [log, setLog] = useState(awal);
  const sudah = useRef(false);
  useEffect(() => { setLog(awal); sudah.current = false; }, [awal]);

  useEffect(() => {
    if (!log || log.status !== 'proses') return undefined;
    const t = setTimeout(async () => {
      try {
        const baru = await muatImpor(ujianId, log.id);
        setLog(baru);
        if (baru.status !== 'proses' && !sudah.current) { sudah.current = true; onSelesai?.(baru); }
      } catch { /* coba lagi di putaran berikutnya */ setLog((l) => ({ ...l })); }
    }, 1500);
    return () => clearTimeout(t);
  }, [log, ujianId, onSelesai]);

  if (!log) return null;
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" data-testid="progres-impor" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{log.mapel_nama} · Kelas {log.jenjang}</span>
        <BadgeStatusImpor status={log.status} />
      </div>
      {log.status === 'gagal' && log.pesan ? (
        <p className="flex items-center gap-2 text-sm text-rose-700"><XCircle className="h-4 w-4" /> {log.pesan}</p>
      ) : (
        <>
          <Batang label="Keseluruhan" diproses={log.diproses ?? log.total_baris} total={log.total_baris} gagal={log.gagal} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="progres-per-sheet">
            {(log.per_sheet || []).map((s) => (
              <div key={s.sheet} className="rounded-lg border border-slate-100 p-2">
                <Batang kecil label={`Sheet ${s.sheet}`} diproses={s.diproses ?? s.total} total={s.total} gagal={s.gagal} />
                <div className="mt-1 flex gap-3 text-[11px]">
                  <span className="text-emerald-700">{s.berhasil} berhasil</span>
                  <span className={s.gagal ? 'text-rose-700' : 'text-slate-400'}>{s.gagal} gagal</span>
                </div>
              </div>
            ))}
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            {log.status === 'proses'
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memproses baris nilai…</>
              : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Selesai: {log.berhasil} berhasil, {log.gagal} gagal dari {log.total_baris} baris.</>}
          </p>
        </>
      )}
    </div>
  );
}
