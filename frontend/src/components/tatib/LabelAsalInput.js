import React from 'react';
import { ASAL_INPUT } from '@/lib/inputTatib';

// Warna tetap per asal input (urutan daftar baku) agar mudah dikenali di tabel & ringkasan.
const WARNA = [
  'border-sky-200 bg-sky-50 text-sky-800',
  'border-amber-200 bg-amber-50 text-amber-800',
  'border-emerald-200 bg-emerald-50 text-emerald-800',
  'border-pink-200 bg-pink-50 text-pink-800',
  'border-green-200 bg-green-50 text-green-800',
  'border-violet-200 bg-violet-50 text-violet-800',
  'border-red-200 bg-red-50 text-red-800',
  'border-slate-300 bg-slate-50 text-slate-800',
];

export const warnaAsalInput = (asal) => WARNA[ASAL_INPUT.indexOf(asal)] || 'border-dashed border-slate-300 text-slate-400';

/** Label asal input; catatan lama tanpa asal input tampil "Belum diisi". */
export default function LabelAsalInput({ asal }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] ${warnaAsalInput(asal)}`}>
      {asal || 'Belum diisi'}
    </span>
  );
}
