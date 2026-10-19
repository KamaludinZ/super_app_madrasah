import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { hitungTingkat } from '@/lib/pkgPenilaian';

// Satu sub-kompetensi pada lembar penilaian: ceklist indikator perilaku Level 1–5 dan tingkat kompetensi yang
// dihitung otomatis (level tertinggi berurutan dari Level 1). `isian` = { centang: [level...], ... }.
export default function KartuSubPenilaian({ sub, isian, terkunci, onUbah, children }) {
  const centang = isian?.centang || [];
  const tingkat = hitungTingkat(centang);
  const alih = (level) => {
    if (terkunci) return;
    const ada = centang.includes(level);
    onUbah({ ...(isian || {}), centang: ada ? centang.filter((l) => l !== level) : [...centang, level].sort((a, b) => a - b) });
  };
  // Level yang dicentang namun tidak berurutan dari Level 1 tidak dihitung; beri tanda agar penilai sadar.
  const lompat = centang.filter((l) => l > tingkat + 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" data-testid={`pkg-lembar-sub-${sub.kode}`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-900"><span className="mr-1 font-mono text-slate-500">{sub.kode}</span>{sub.nama}</h4>
        <Badge className={`shrink-0 tabular-nums ${tingkat ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
          data-testid={`pkg-lembar-tingkat-${sub.kode}`}>
          {tingkat ? `Level ${tingkat}` : 'Belum dinilai'}
        </Badge>
      </div>
      <ul className="mt-3 space-y-1.5">
        {sub.indikator.map((i) => {
          const id = `ind-${sub.kode}-${i.level}`;
          return (
            <li key={i.level}>
              <label htmlFor={id} className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm ${terkunci ? '' : 'cursor-pointer hover:bg-slate-50'}`}>
                <Checkbox id={id} checked={centang.includes(i.level)} onCheckedChange={() => alih(i.level)} disabled={terkunci} className="mt-0.5" />
                <span className="w-14 shrink-0 text-xs font-semibold text-slate-500 mt-0.5">Level {i.level}</span>
                <span className="text-slate-700">{i.teks}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {lompat.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          Level {lompat.join(', ')} dicentang tetapi level di bawahnya belum; tingkat dihitung berurutan dari Level 1.
        </p>
      )}
      {children}
    </div>
  );
}
