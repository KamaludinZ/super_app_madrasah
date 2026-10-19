import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSpreadsheet, Pencil, Target } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { labelVersi, riwayatInstrumen } from '@/lib/pkgInstrumen';

const IKON = { instrumen_impor: FileSpreadsheet, instrumen_ubah: Pencil, instrumen_aktifkan: Target };

// Riwayat perubahan instrumen dikelompokkan per versi (template & revisi): impor, ubah sub (dengan ringkasan
// perubahan & alasan), dan penetapan acuan. Data dari GET /pkg/instrumen/riwayat (kepala madrasah).
export default function RiwayatPerubahanInstrumen({ kunci }) {
  const [daftar, setDaftar] = useState(null);
  const [galat, setGalat] = useState(null);

  useEffect(() => {
    let hidup = true;
    setGalat(null);
    riwayatInstrumen().then((d) => { if (hidup) setDaftar(d); }).catch((e) => { if (hidup) setGalat(e.message); });
    return () => { hidup = false; };
  }, [kunci]);

  const perVersi = useMemo(() => {
    const kelompok = new Map();
    (daftar || []).forEach((r) => {
      const k = `${r.versi_template || '-'}:${r.revisi ?? '-'}`;
      if (!kelompok.has(k)) kelompok.set(k, { versi_template: r.versi_template, revisi: r.revisi, entri: [] });
      kelompok.get(k).entri.push(r);
    });
    return [...kelompok.values()];
  }, [daftar]);

  if (galat) return <p className="py-4 text-center text-sm text-rose-700">{galat}</p>;
  if (!daftar) return <div className="py-4 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-[#006837]" /></div>;
  if (!daftar.length) return <p className="py-4 text-center text-sm text-slate-500">Belum ada perubahan instrumen tercatat.</p>;

  return (
    <div className="space-y-4" data-testid="pkg-riwayat-instrumen">
      {perVersi.map((v) => (
        <section key={`${v.versi_template}:${v.revisi}`} className="rounded-lg border border-slate-200 p-3">
          <Badge variant="outline" className="mb-2">{labelVersi(v)}</Badge>
          <ol className="space-y-3">
            {v.entri.map((r) => {
              const Ikon = IKON[r.aksi] || Pencil;
              return (
                <li key={r.id} className="flex gap-3" data-testid={`pkg-riwayat-instrumen-${r.id}`}>
                  <Ikon className="mt-0.5 h-4 w-4 shrink-0 text-[#006837]" aria-hidden="true" />
                  <div className="min-w-0 text-sm">
                    <div className="font-medium text-slate-900">
                      {r.label}{r.kode_sub ? ` · sub ${r.kode_sub}` : ''}{r.nama_berkas ? ` · ${r.nama_berkas}` : ''}
                    </div>
                    <div className="text-xs text-slate-500">{formatWIBPanjang(r.timestamp)}{r.aktor_nama ? ` · ${r.aktor_nama}` : ''}</div>
                    {r.perubahan?.length > 0 && (
                      <ul className="mt-1 list-disc list-inside text-xs text-slate-700">{r.perubahan.map((p) => <li key={p}>{p}</li>)}</ul>
                    )}
                    {r.alasan && <p className="mt-1 text-xs text-slate-600">Alasan: {r.alasan}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
