import React from 'react';
import { CalendarClock } from 'lucide-react';
import { formatWIB } from '@/lib/datetime';

export const teksSesi = (sesi) => (sesi
  ? `${formatWIB(sesi.tanggal, 'Date', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Sesi ${sesi.sesi_ke} · ${sesi.jam_mulai}–${sesi.jam_selesai} WIB`
  : null);

/** Kerangka halaman publik ujian (tanpa login): kop madrasah, judul formulir, nama ujian, dan sesi aktif. */
export default function KerangkaPublik({ info, judul, children }) {
  const m = info?.madrasah;
  return (
    <div className="min-h-screen bg-[#FBF7EE]">
      <header className="border-b border-emerald-900/10 bg-[#006837] text-white">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          {m?.logo_url && <img src={m.logo_url} alt="" className="h-10 w-10 shrink-0 rounded bg-white/95 object-contain p-0.5" />}
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-emerald-100">{m?.nama || 'Madrasah'}</div>
            <h1 className="text-base font-bold leading-tight sm:text-lg">{judul}</h1>
            {info?.ujian && <div className="truncate text-xs text-emerald-100">{info.ujian.nama}{info.ujian.tahun_pelajaran ? ` · TP ${info.ujian.tahun_pelajaran}` : ''}</div>}
          </div>
        </div>
        {info?.sesi && (
          <div className="border-t border-white/10 bg-black/10">
            <p className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2 text-xs text-emerald-50" data-testid="publik-sesi">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" /> {teksSesi(info.sesi)}
            </p>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-2xl space-y-4 px-4 py-5 pb-16">{children}</main>
    </div>
  );
}

export function Langkah({ nomor, judul, keterangan, children, selesai }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${selesai ? 'bg-emerald-500' : 'bg-[#006837]'}`}>{nomor}</span>
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-900">{judul}</h2>
          {keterangan && <p className="text-sm text-slate-500">{keterangan}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function PesanPublik({ Ikon, warna, judul, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <Ikon className={`mx-auto mb-3 h-10 w-10 ${warna}`} />
      <h2 className="text-lg font-bold text-slate-900">{judul}</h2>
      <div className="mt-1 text-sm text-slate-600">{children}</div>
    </div>
  );
}
