import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BATAS_TEKS, hitungTingkat } from '@/lib/pkgPenilaian';

// Satu sub-kompetensi pada lembar penilaian: ceklist indikator perilaku Level 1–5 dan skor otomatis
// (jumlah indikator dicentang, rumus template resmi), catatan bukti fisik, dan tanggapan penilai.
// `isian` = { centang: [level...], catatan_bukti, tanggapan }.
export default function KartuSubPenilaian({ sub, isian, terkunci, onUbah, galat, peringatan, tegas }) {
  const centang = isian?.centang || [];
  const tingkat = hitungTingkat(centang);
  const alih = (level) => {
    if (terkunci) return;
    const ada = centang.includes(level);
    onUbah({ ...(isian || {}), centang: ada ? centang.filter((l) => l !== level) : [...centang, level].sort((a, b) => a - b) });
  };
  const ubahTeks = (kunci) => (e) => onUbah({ ...(isian || {}), centang, [kunci]: e.target.value.slice(0, BATAS_TEKS) });

  return (
    // `galat` = pesan validasi; `tegas` = sudah mencoba mengirim, penanda dibuat lebih mencolok.
    <div
      id={`sub-${sub.kode}`}
      className={`scroll-mt-28 rounded-xl border bg-white p-4 ${galat && !terkunci ? (tegas ? 'border-rose-300 ring-1 ring-rose-200' : 'border-amber-300') : 'border-slate-200'}`}
      data-testid={`pkg-lembar-sub-${sub.kode}`}
      data-galat={galat ? 'ya' : undefined}
    >
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
      {galat && !terkunci ? (
        <p className={`mt-2 text-xs ${tegas ? 'text-rose-700 font-medium' : 'text-amber-700'}`} role={tegas ? 'alert' : undefined}>{galat}</p>
      ) : peringatan && !terkunci && (
        <p className="mt-2 text-xs text-amber-700">{peringatan}</p>
      )}
      <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
        {[['catatan_bukti', 'Catatan bukti fisik', 'mis. RPP, foto kegiatan, laporan'], ['tanggapan', 'Tanggapan penilai', 'Umpan balik untuk guru']].map(([kunci, label, contoh]) => {
          const id = `${kunci}-${sub.kode}`;
          const teks = isian?.[kunci] || '';
          return (
            <div key={kunci} className="space-y-1">
              <div className="flex items-baseline justify-between">
                <Label htmlFor={id} className="text-xs text-slate-600">{label}</Label>
                <span className={`text-[10px] tabular-nums ${teks.length >= BATAS_TEKS * 0.9 ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}
                  aria-live={teks.length >= BATAS_TEKS * 0.9 ? 'polite' : undefined}>{teks.length}/{BATAS_TEKS}</span>
              </div>
              <Textarea id={id} value={teks} onChange={ubahTeks(kunci)} rows={2} maxLength={BATAS_TEKS} placeholder={contoh}
                disabled={terkunci} className="text-sm" data-testid={`pkg-lembar-${kunci}-${sub.kode}`} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
