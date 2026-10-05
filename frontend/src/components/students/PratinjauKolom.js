import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Lock, Columns3 } from 'lucide-react';

/** Huruf kolom Excel dari indeks 0-based: 0 -> A, 25 -> Z, 26 -> AA. */
export function hurufKolom(i) {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Kelompokkan kolom per grup dengan mempertahankan urutan & huruf kolom Excel. */
export function kelompokKolom(kolom) {
  const grup = [];
  kolom.forEach((k, i) => {
    let g = grup.find((x) => x.nama === k.grup);
    if (!g) { g = { nama: k.grup, kolom: [] }; grup.push(g); }
    g.kolom.push({ ...k, huruf: hurufKolom(i) });
  });
  return grup;
}

/**
 * Pratinjau urutan kolom berkas Excel (sama untuk unduhan, template, dan impor).
 * Bisa dilipat agar dialog tetap ringkas.
 */
export default function PratinjauKolom({ kolom, judul = 'Urutan kolom berkas', defaultOpen = false, maxHeight = 'max-h-64', pilihBagian = false }) {
  const [buka, setBuka] = useState(defaultOpen);
  const [bagian, setBagian] = useState('semua');
  const grup = kelompokKolom(kolom);
  const tampil = bagian === 'semua' ? grup : grup.filter((g) => g.nama === bagian);
  const jumlahKunci = kolom.filter((k) => k.kunci).length;

  return (
    <div className="rounded-lg border border-slate-200" data-testid="pratinjau-kolom">
      <button
        type="button"
        onClick={() => setBuka((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
        aria-expanded={buka}
      >
        <span className="flex items-center gap-2 font-medium text-slate-800">
          <Columns3 className="h-4 w-4 text-[#006837]" /> {judul}
        </span>
        <span className="flex items-center gap-2 text-xs text-slate-500">
          {kolom.length} kolom · {grup.length} bagian
          {buka ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
      </button>
      {buka && (
        <div className={`${maxHeight} overflow-y-auto border-t border-slate-200 px-3 py-2 space-y-3`}>
          {pilihBagian && (
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Pilih bagian kolom" data-testid="pilih-bagian-kolom">
              {[{ nama: 'semua', label: 'Semua', n: kolom.length }, ...grup.map((g) => ({ nama: g.nama, label: g.nama, n: g.kolom.length }))].map((b) => (
                <button
                  key={b.nama}
                  type="button"
                  role="tab"
                  aria-selected={bagian === b.nama}
                  onClick={() => setBagian(b.nama)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${bagian === b.nama ? 'border-[#006837] bg-[#006837] text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                >
                  {b.label} <span className="opacity-70">{b.n}</span>
                </button>
              ))}
            </div>
          )}
          {jumlahKunci > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-slate-600">
              <Lock className="h-3 w-3 text-amber-600" /> {jumlahKunci} kolom identitas <strong>terkunci</strong> (penanda baris saat impor) — jangan diubah isinya; baris tanpa identitas valid akan dilewati.
            </p>
          )}
          {tampil.map((g) => (
            <div key={g.nama}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {g.nama} <span className="font-normal normal-case">({g.kolom[0].huruf}–{g.kolom[g.kolom.length - 1].huruf})</span>
              </div>
              <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                {g.kolom.map((k) => (
                  <li
                    key={k.key}
                    className={`flex items-center gap-2 rounded px-1 text-xs ${k.kunci ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200' : 'text-slate-700'}`}
                    title={k.kunci ? `${k.label} — kolom identitas terkunci: dipakai mencocokkan baris saat impor, jangan diubah` : k.label}
                    data-kunci={k.kunci ? 'true' : undefined}
                  >
                    <span className={`w-7 shrink-0 font-mono ${k.kunci ? 'text-amber-600' : 'text-slate-400'}`}>{k.huruf}</span>
                    <span className={`truncate ${k.kunci ? 'font-semibold' : ''}`}>{k.label}</span>
                    {k.kunci && (
                      <span className="ml-auto flex shrink-0 items-center gap-0.5 rounded bg-amber-100 px-1 text-[10px] font-medium uppercase text-amber-700">
                        <Lock className="h-2.5 w-2.5" aria-hidden="true" /> Terkunci
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
