import React from 'react';
import { CheckCircle2, CircleDashed, FileSignature } from 'lucide-react';

/**
 * Pemilih ruang & jenjang untuk cetak: setiap kombinasi ruang–jenjang tampil sebagai kartu (ruang campuran dua jenjang
 * muncul sebagai dua kartu) beserta jumlah peserta dan kesiapan pada sesi terpilih (daftar hadir lengkap, berita acara
 * sudah diisi). `kesiapan` = { 'ruangId:jenjang': { dh_lengkap, belum, ba_terisi } }.
 */
export default function PemilihRuangJenjang({ ruangList = [], kesiapan = {}, nilai, onPilih }) {
  const kombinasi = ruangList.flatMap((r) => r.jenjang.map((j) => ({ ruang: r, jenjang: j, kunci: `${r.id}:${j}` })));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" role="radiogroup" aria-label="Ruang dan jenjang" data-testid="pemilih-ruang-jenjang">
      {kombinasi.map(({ ruang, jenjang, kunci }) => {
        const k = kesiapan[kunci];
        const aktif = nilai === kunci;
        return (
          <button key={kunci} type="button" role="radio" aria-checked={aktif} onClick={() => onPilih(ruang, jenjang)}
            className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${
              aktif ? 'border-[#006837] bg-emerald-50' : 'border-slate-200 bg-white hover:border-[#006837]/40'}`}
            data-testid={`pilih-${kunci}`}>
            <span className="text-sm font-semibold text-slate-900">Ruang {ruang.nama_ruang} · Kelas {jenjang}</span>
            <span className="text-xs text-slate-500">{ruang.per_jenjang?.[jenjang] ?? 0} peserta{ruang.jenjang.length > 1 ? ' · ruang campuran' : ''}</span>
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
