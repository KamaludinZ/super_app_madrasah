import React, { useEffect, useState } from 'react';
import { Loader2, PlayCircle, Eye, Save, Lock, Circle } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';

const IKON = { penilaian_mulai: PlayCircle, penilaian_buka: Eye, penilaian_draf: Save, penilaian_kirim: Lock };

// Linimasa aksi lembar penilaian satu guru (mulai, buka, draf, kirim & kunci), terbaru dulu.
// `muat()` mengembalikan Promise daftar aksi; `kunci` berubah -> dimuat ulang.
export default function RiwayatAksiPenilaian({ muat, kunci }) {
  const [daftar, setDaftar] = useState(null);
  const [galat, setGalat] = useState(null);

  useEffect(() => {
    let hidup = true;
    setDaftar(null);
    setGalat(null);
    muat().then((d) => { if (hidup) setDaftar(d || []); }).catch((e) => { if (hidup) setGalat(e.message || 'Gagal memuat riwayat.'); });
    return () => { hidup = false; };
  }, [muat, kunci]);

  if (galat) return <p className="py-4 text-center text-sm text-rose-700">{galat}</p>;
  if (!daftar) return <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-[#006837]" /></div>;
  if (!daftar.length) return <p className="py-4 text-center text-sm text-slate-500">Belum ada aksi pada lembar ini.</p>;

  return (
    <ol className="relative space-y-3 border-l border-slate-200 pl-5" data-testid="pkg-riwayat-aksi">
      {daftar.map((a, i) => {
        const Ikon = IKON[a.aksi] || Circle;
        return (
          // eslint-disable-next-line react/no-array-index-key
          <li key={`${a.aksi}-${a.timestamp}-${i}`} className="relative">
            <span className={`absolute -left-[29px] flex h-6 w-6 items-center justify-center rounded-full border bg-white ${a.aksi === 'penilaian_kirim' ? 'border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
              <Ikon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="text-sm font-medium text-slate-900">{a.label}</div>
            <div className="text-xs text-slate-500">
              {formatWIBPanjang(a.timestamp)}
              {a.jumlah > 1 && ` · ${a.jumlah}× (terakhir ${formatWIBPanjang(a.terakhir || a.timestamp)})`}
              {a.aktor_nama && ` · ${a.aktor_nama}`}
            </div>
            {(a.progres != null || a.nilai_akhir != null) && (
              <div className="text-xs text-slate-600">
                {a.progres != null && `Progres ${a.progres}%`}{a.progres != null && a.nilai_akhir != null && ' · '}{a.nilai_akhir != null && `Nilai akhir ${a.nilai_akhir}`}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
