import React from 'react';
import { Lock, Award } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { hitungTingkat } from '@/lib/pkgPenilaian';

const FORMAT = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Hasil akhir lembar yang sudah dikirim & dikunci: nilai, capaian, level, predikat jenjang, dan subtotal per
// kompetensi (rumus template resmi). `hasil` = { nilai_akhir, nilai_maks, capaian_persen, level_capaian, predikat,
// terkunci_pada }.
export default function HasilAkhirPenilaian({ hasil, kompetensi = [], isian = {} }) {
  if (!hasil) return null;
  return (
    <div className="rounded-xl border-2 border-[#006837]/30 bg-white p-4 space-y-4" data-testid="pkg-hasil-akhir">
      <div className="flex flex-wrap items-center gap-2 text-sm text-emerald-800">
        <Lock className="h-4 w-4" />
        <span className="font-semibold">Penilaian terkunci</span>
        {hasil.terkunci_pada && <span className="text-xs text-slate-500">· {formatWIBPanjang(hasil.terkunci_pada)}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-emerald-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-emerald-700">Nilai akhir</div>
          <div className="text-2xl font-extrabold tabular-nums text-[#006837]">{hasil.nilai_akhir}<span className="text-sm font-medium text-slate-500">/{hasil.nilai_maks}</span></div>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-emerald-700">Capaian</div>
          <div className="text-2xl font-extrabold tabular-nums text-[#006837]">{FORMAT.format(hasil.capaian_persen)}%</div>
        </div>
        <div className="rounded-lg bg-emerald-50 p-3">
          <div className="text-[11px] uppercase tracking-wide text-emerald-700">Level capaian</div>
          <div className="text-2xl font-extrabold text-[#006837]">{hasil.level_capaian || '-'}</div>
        </div>
        <div className="col-span-2 rounded-lg bg-[#006837] p-3 text-white sm:col-span-1">
          <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-emerald-100"><Award className="h-3 w-3" /> Predikat</div>
          <div className="text-sm font-semibold leading-snug">{hasil.predikat || '-'}</div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1.5 pr-3 font-medium">Kompetensi</th>
              {[1, 2, 3].map((n) => <th key={n} className="py-1.5 px-2 text-center font-medium">Sub {n}</th>)}
              <th className="py-1.5 pl-2 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {kompetensi.map((k) => {
              const skor = k.sub.map((s) => hitungTingkat(isian[s.kode]?.centang));
              return (
                <tr key={k.kode} className="border-b border-slate-100">
                  <td className="py-1.5 pr-3 text-slate-800">{k.kode}. {k.nama}</td>
                  {skor.map((n, i) => <td key={k.sub[i].kode} className="py-1.5 px-2 text-center tabular-nums">{n}</td>)}
                  <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">{skor.reduce((a, b) => a + b, 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
