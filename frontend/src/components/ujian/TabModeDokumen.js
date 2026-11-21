import React from 'react';
import { DoorOpen, Layers } from 'lucide-react';
import { MODE_DOKUMEN } from '@/lib/ujianCetak';

const IKON = { jenjang: Layers, ruang: DoorOpen };

/**
 * Tab mode dokumen di bawah tab Cetak Dokumen & Arsip Administrasi: "Per Jenjang per Ruang" atau "Per Ruang".
 * `bagian` membedakan data-testid (cetak / arsip).
 */
export default function TabModeDokumen({ mode, onUbah, bagian }) {
  return (
    <div className="space-y-1.5">
      <div className="inline-flex w-full rounded-lg border border-slate-200 bg-white p-1 sm:w-auto" role="tablist" aria-label="Mode dokumen" data-testid={`mode-${bagian}`}>
        {Object.entries(MODE_DOKUMEN).map(([k, m]) => {
          const Ikon = IKON[k];
          const aktif = mode === k;
          return (
            <button key={k} type="button" role="tab" aria-selected={aktif} onClick={() => onUbah(k)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] sm:flex-none ${
                aktif ? 'bg-[#006837] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
              data-testid={`mode-${bagian}-${k}`}>
              <Ikon className="h-4 w-4 shrink-0" /> {m.label}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">{MODE_DOKUMEN[mode].ket}</p>
    </div>
  );
}
