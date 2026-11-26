import React from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Ringkasan hasil impor per sheet kelas: total baris, berhasil, gagal, nilai kosong yang disimpan 0, dan status tiap sheet,
 * beserta baris jumlah.
 * Sheet dengan baris gagal ditandai agar panitia tahu bagian mana yang perlu diperbaiki lalu diunggah ulang.
 */
export default function RingkasanImporSheet({ log }) {
  const sheet = log?.per_sheet || [];
  if (!sheet.length) return null;
  const jumlah = sheet.reduce((a, s) => ({ total: a.total + s.total, berhasil: a.berhasil + s.berhasil, gagal: a.gagal + s.gagal, nol: a.nol + (s.diisi_nol || 0) }),
    { total: 0, berhasil: 0, gagal: 0, nol: 0 });
  const terhenti = log.status === 'gagal';
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white" data-testid="ringkasan-impor-sheet">
      <table className="w-full text-sm">
        <caption className="px-3 pt-3 text-left text-sm font-semibold text-slate-900">Hasil per sheet kelas</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2 font-semibold">Sheet</th>
            <th className="px-3 py-2 text-right font-semibold">Baris</th>
            <th className="px-3 py-2 text-right font-semibold">Berhasil</th>
            <th className="px-3 py-2 text-right font-semibold">Gagal</th>
            <th className="px-3 py-2 text-right font-semibold" title="Nilai kosong di berkas yang disimpan sebagai 0">Kosong → 0</th>
            <th className="px-3 py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {sheet.map((s) => (
            <tr key={s.sheet} className="border-b border-slate-100 last:border-0" data-testid={`ringkasan-sheet-${s.sheet}`}>
              <td className="px-3 py-2 font-medium">{s.sheet}{s.kelas && s.kelas !== s.sheet ? ` (${s.kelas})` : ''}</td>
              <td className="px-3 py-2 text-right tabular-nums">{s.total}</td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{s.berhasil}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${s.gagal ? 'font-semibold text-rose-700' : 'text-slate-400'}`}>{s.gagal}</td>
              <td className={`px-3 py-2 text-right tabular-nums ${s.diisi_nol ? 'text-amber-700' : 'text-slate-400'}`}>{s.diisi_nol || 0}</td>
              <td className="px-3 py-2">
                {terhenti && (s.diproses ?? s.total) < s.total ? (
                  <span className="inline-flex items-center gap-1 text-xs text-rose-700"><AlertTriangle className="h-3.5 w-3.5" /> Terhenti di {s.diproses || 0}/{s.total} baris</span>
                ) : s.gagal ? (
                  <span className="inline-flex items-center gap-1 text-xs text-rose-700"><AlertTriangle className="h-3.5 w-3.5" /> Perbaiki {s.gagal} baris</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" /> Semua tersimpan</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-200 bg-slate-50 text-sm font-semibold">
            <td className="px-3 py-2">Jumlah</td>
            <td className="px-3 py-2 text-right tabular-nums">{jumlah.total}</td>
            <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{jumlah.berhasil}</td>
            <td className="px-3 py-2 text-right tabular-nums text-rose-700">{jumlah.gagal}</td>
            <td className="px-3 py-2 text-right tabular-nums text-amber-700">{jumlah.nol}</td>
            <td className="px-3 py-2 text-xs font-normal text-slate-500">{jumlah.total ? `${Math.round((jumlah.berhasil / jumlah.total) * 100)}% berhasil` : ''}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
