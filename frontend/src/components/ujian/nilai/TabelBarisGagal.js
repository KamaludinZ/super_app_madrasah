import React, { useMemo, useState } from 'react';
import { XCircle } from 'lucide-react';

/**
 * Tabel baris gagal impor nilai: sheet, nomor baris Excel, nama, dan pesan penyebab (mis. siswa tidak ditemukan, nilai
 * di luar rentang, kelas tidak sesuai sheet). Dapat disaring per sheet sehingga panitia memperbaiki bagian yang gagal
 * saja lalu mengunggah ulang.
 */
export default function TabelBarisGagal({ log }) {
  const galat = useMemo(() => log?.galat || [], [log]);
  const [sheet, setSheet] = useState('semua');
  const daftarSheet = useMemo(() => [...new Set(galat.map((g) => g.sheet))], [galat]);
  const tampil = sheet === 'semua' ? galat : galat.filter((g) => g.sheet === sheet);
  if (!galat.length) return null;
  return (
    <div className="rounded-xl border border-rose-200 bg-white" data-testid="tabel-baris-gagal">
      <div className="flex flex-col gap-2 border-b border-rose-100 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1 text-sm font-semibold text-rose-800"><XCircle className="h-4 w-4" /> {galat.length} baris gagal diimpor</p>
        {daftarSheet.length > 1 && (
          <div role="group" aria-label="Saring sheet" className="flex flex-wrap gap-1">
            {['semua', ...daftarSheet].map((s) => (
              <button key={s} type="button" onClick={() => setSheet(s)} aria-pressed={sheet === s}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${sheet === s ? 'border-rose-600 bg-rose-600 text-white' : 'border-rose-200 text-rose-700 hover:bg-rose-50'}`}>
                {s === 'semua' ? 'Semua' : `Sheet ${s}`}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-rose-50 text-left text-xs uppercase tracking-wide text-rose-900">
            <tr>
              <th className="px-3 py-2 font-semibold">Sheet</th>
              <th className="px-3 py-2 font-semibold">Baris</th>
              <th className="px-3 py-2 font-semibold">Nama</th>
              <th className="px-3 py-2 font-semibold">Penyebab</th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((g) => (
              <tr key={`${g.sheet}-${g.baris}`} className="border-t border-rose-50" data-testid={`gagal-${g.sheet}-${g.baris}`}>
                <td className="px-3 py-1.5">{g.sheet}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{g.baris}</td>
                <td className="px-3 py-1.5">{g.nama || '—'}</td>
                <td className="px-3 py-1.5 text-rose-800">{g.pesan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-rose-100 px-3 py-2 text-xs text-slate-500">
        Perbaiki baris di atas pada berkas yang sama lalu unggah ulang — baris yang sudah berhasil cukup ditimpa dengan nilai yang sama.
      </p>
    </div>
  );
}
