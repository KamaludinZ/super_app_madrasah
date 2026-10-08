import React from 'react';
import { urutkanPenanda } from '@/lib/unduhDenah';

// Keterangan ruang di bawah denah: lencana KODE ruang + nama ruang, urut menurut kode.
// Menyorot/memilih baris ikut menyorot/memilih penandanya di denah.
export default function KeteranganRuang({ markers = [], dipilihId, onPilih, onSorot }) {
  if (!markers.length) return null;
  const daftar = urutkanPenanda(markers);
  return (
    <section className="mt-4" aria-label="Keterangan ruang" data-testid="masterplan-keterangan">
      <h3 className="mb-2 text-sm font-semibold text-slate-900">Keterangan Ruang</h3>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {daftar.map((m) => {
          const aktif = dipilihId === m.id;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onPilih?.(m)}
                onMouseEnter={() => onSorot?.(m.id)}
                onMouseLeave={() => onSorot?.(null)}
                onFocus={() => onSorot?.(m.id)}
                onBlur={() => onSorot?.(null)}
                className={`flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                  aktif ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
                data-testid={`masterplan-keterangan-${m.id}`}
              >
                <span
                  className={`min-w-[3.5rem] shrink-0 rounded-md px-1.5 py-0.5 text-center font-mono text-xs font-bold ${
                    m.kode_ruang ? 'bg-[#006837] text-white' : 'border border-dashed border-amber-400 text-amber-700'
                  }`}
                >
                  {m.kode_ruang || 'tanpa kode'}
                </span>
                <span className="truncate text-sm text-slate-800">{m.nama_ruang}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
