import React from 'react';
import { CheckCircle2, CircleDashed, FileSignature } from 'lucide-react';
import { kesiapanRuang, labelJenjang } from '@/lib/ujianCetak';

/**
 * Pemilih ruang untuk cetak per ruang: satu kartu per ruang (seluruh jenjang ruang dicetak dalam satu dokumen) beserta
 * jumlah peserta tiap jenjang dan kesiapan gabungan pada sesi terpilih. `kesiapan` = { 'ruangId:jenjang': {...} }.
 */
export default function PemilihRuang({ ruangList = [], kesiapan = {}, nilai, onPilih }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label="Ruang" data-testid="pemilih-ruang">
      {ruangList.map((ruang) => {
        const k = kesiapanRuang(kesiapan, ruang);
        const aktif = nilai === ruang.id;
        const total = ruang.jenjang.reduce((n, j) => n + (ruang.per_jenjang?.[j] ?? 0), 0);
        return (
          <button key={ruang.id} type="button" role="radio" aria-checked={aktif} onClick={() => onPilih(ruang)}
            className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${
              aktif ? 'border-[#006837] bg-emerald-50' : 'border-slate-200 bg-white hover:border-[#006837]/40'}`}
            data-testid={`pilih-ruang-${ruang.id}`}>
            <span className="text-sm font-semibold text-slate-900">Ruang {ruang.nama_ruang} · Kelas {labelJenjang(ruang.jenjang)}</span>
            <span className="text-xs text-slate-500">
              {total} peserta{ruang.jenjang.length > 1 ? ` (${ruang.jenjang.map((j) => `kelas ${j}: ${ruang.per_jenjang?.[j] ?? 0}`).join(', ')})` : ''}
            </span>
            {k && (
              <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px]">
                <span className={`inline-flex items-center gap-0.5 ${k.dh_lengkap ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {k.dh_lengkap ? <CheckCircle2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
                  {k.dh_lengkap ? 'Daftar hadir lengkap' : `${k.belum} belum hadir/ditandai`}
                </span>
                <span className={`inline-flex items-center gap-0.5 ${k.ba_terisi ? 'text-emerald-700' : 'text-slate-400'}`}>
                  <FileSignature className="h-3 w-3" /> {k.ba_terisi ? 'BA terisi' : 'BA belum'}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
