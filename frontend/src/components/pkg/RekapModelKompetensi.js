import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calculator } from 'lucide-react';

const FORMAT = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Rekapitulasi hasil penilaian model kompetensi guru (sheet 04-RKAP-PKG): nilai rating & tingkat per sub-kompetensi
// dikelompokkan per kompetensi, jumlah skor, dan capaian tingkat kompetensi. `model` dari lib/pkgRekap.ambilModelKompetensi.
export function TabelModelKompetensi({ model }) {
  return (
    <Card data-testid="pkg-model-kompetensi">
      <CardHeader className="pb-3"><CardTitle className="text-base">Rekapitulasi Model Kompetensi Guru</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="w-10 py-1.5 pr-2 font-medium">No</th>
              <th className="py-1.5 pr-3 font-medium">Kompetensi</th>
              <th className="py-1.5 px-2 text-center font-medium">Tingkat kompetensi</th>
              <th className="py-1.5 pl-2 text-right font-medium">Nilai rating</th>
            </tr>
          </thead>
          <tbody>
            {model.kompetensi.map((k, i) => (
              <React.Fragment key={k.kode}>
                <tr className="bg-emerald-50/60">
                  <td className="py-1.5 pr-2 font-semibold text-[#006837]">{String.fromCharCode(65 + i)}.</td>
                  <td className="py-1.5 pr-3 font-semibold text-slate-900" colSpan={2}>{k.nama || k.label}</td>
                  <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">{k.jumlah_skor}<span className="text-xs font-normal text-slate-500">/{k.skor_maks}</span></td>
                </tr>
                {k.sub.map((s) => (
                  <tr key={s.kode} className="border-b border-slate-100" data-testid={`pkg-model-sub-${s.kode}`}>
                    <td className="py-1.5 pr-2 tabular-nums text-slate-500">{s.no}</td>
                    <td className="py-1.5 pr-3 text-slate-800">{s.nama || s.kode}</td>
                    <td className="py-1.5 px-2 text-center">{s.tingkat ? <Badge variant="outline">{s.tingkat}</Badge> : '-'}</td>
                    <td className="py-1.5 pl-2 text-right tabular-nums">{s.nilai_rating}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 font-semibold">
              <td colSpan={3} className="py-2 pr-3">Jumlah (hasil penilaian kompetensi profesional guru)</td>
              <td className="py-2 pl-2 text-right tabular-nums">{model.total_skor}</td>
            </tr>
            <tr className="font-semibold">
              <td colSpan={2} className="py-1 pr-3">Capaian tingkat kompetensi</td>
              <td className="py-1 px-2 text-center">{model.level_capaian || '-'}</td>
              <td className="py-1 pl-2 text-right tabular-nums">{FORMAT.format(model.nkg)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-xs text-slate-500">Nilai rating per sub = jumlah indikator yang terpenuhi (minimum 1, maksimum 5).</p>
      </CardContent>
    </Card>
  );
}

// Format penghitungan NKG (sheet 05-RKAP-PKGR): jumlah skor per kompetensi, total, lalu NKG = total / skor maks x 100.
// `tambahan` (opsional) dirender di bawahnya untuk langkah lanjutan (komponen 360° & kehadiran).
export function FormatPenghitungan({ model, tambahan = null }) {
  return (
    <Card data-testid="pkg-format-penghitungan">
      <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4 text-[#006837]" /> Format Penghitungan</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="w-8 py-1.5 font-medium">No</th>
              <th className="py-1.5 pr-3 font-medium">Kompetensi profesional guru</th>
              <th className="py-1.5 pr-3 font-medium">Kode PKG</th>
              <th className="py-1.5 text-right font-medium">Jumlah skor</th>
            </tr>
          </thead>
          <tbody>
            {model.kompetensi.map((k, i) => (
              <tr key={k.kode} className="border-b border-slate-100">
                <td className="py-1.5">{String.fromCharCode(65 + i)}.</td>
                <td className="py-1.5 pr-3 text-slate-800">{k.nama || '-'}</td>
                <td className="py-1.5 pr-3 text-xs text-slate-500">{k.label}</td>
                <td className="py-1.5 text-right tabular-nums">{k.jumlah_skor}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td />
              <td className="py-1.5 pr-3" colSpan={2}>Total</td>
              <td className="py-1.5 text-right tabular-nums">{model.total_skor}</td>
            </tr>
          </tbody>
        </table>
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="text-xs text-slate-500">NKG = (Total skor / {model.skor_maks}) × 100</div>
          <div className="mt-1 font-mono tabular-nums text-slate-800">
            ({model.total_skor} / {model.skor_maks}) × 100 = <span className="font-bold text-[#006837]">{FORMAT.format(model.nkg)}</span>
          </div>
          <div className="mt-1 text-xs text-slate-600">{model.level_capaian || '-'} · {model.predikat || '-'}</div>
        </div>
        {tambahan}
      </CardContent>
    </Card>
  );
}
