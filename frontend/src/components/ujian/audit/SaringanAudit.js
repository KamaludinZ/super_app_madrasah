import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

const kelas = 'h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]';

/** Galat rentang tanggal 'YYYY-MM-DD' -> pesan atau null. */
export const galatRentang = ({ dari, sampai }) => (dari && sampai && dari > sampai ? 'Tanggal "dari" harus sebelum atau sama dengan "sampai".' : null);

/**
 * Saringan bersama jejak audit: rentang tanggal (WIB) dan pencarian IP/perangkat (diterapkan 400 ms setelah berhenti
 * mengetik). `nilai` = { dari, sampai, cari }; `onUbah` hanya dipanggil dengan nilai yang sah. `testId` awalan data-testid.
 */
export default function SaringanAudit({ nilai, onUbah, testId }) {
  const [cari, setCari] = useState(nilai.cari || '');
  const [rentang, setRentang] = useState({ dari: nilai.dari || '', sampai: nilai.sampai || '' });
  const galat = galatRentang(rentang);
  const terakhir = useRef(nilai);
  terakhir.current = nilai;

  useEffect(() => {
    const t = setTimeout(() => { if ((terakhir.current.cari || '') !== cari.trim()) onUbah({ ...terakhir.current, cari: cari.trim() }); }, 400);
    return () => clearTimeout(t);
  }, [cari, onUbah]);

  const ubahTanggal = (k) => (e) => {
    const baru = { ...rentang, [k]: e.target.value };
    setRentang(baru);
    if (!galatRentang(baru)) onUbah({ ...terakhir.current, ...baru });
  };
  const reset = () => { setCari(''); setRentang({ dari: '', sampai: '' }); onUbah({ ...terakhir.current, dari: '', sampai: '', cari: '' }); };
  const aktif = cari || rentang.dari || rentang.sampai;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <label className="flex items-center gap-1.5">Dari
          <input type="date" value={rentang.dari} onChange={ubahTanggal('dari')} className={kelas} data-testid={`${testId}-dari`} />
        </label>
        <label className="flex items-center gap-1.5">Sampai
          <input type="date" value={rentang.sampai} onChange={ubahTanggal('sampai')} className={kelas} data-testid={`${testId}-sampai`} />
        </label>
        <label className="relative flex min-w-[10rem] flex-1 items-center">
          <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <input type="search" value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari IP atau perangkat…" aria-label="Cari IP atau perangkat"
            className={`${kelas} w-full pl-7`} data-testid={`${testId}-cari`} />
        </label>
        {aktif && (
          <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100" data-testid={`${testId}-reset`}>
            <X className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>
      {galat && <p className="text-xs text-rose-600" role="alert" data-testid={`${testId}-galat`}>{galat}</p>}
    </div>
  );
}
