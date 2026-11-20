import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { CalendarCheck2, History, Loader2, ShieldCheck } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { rentangTanggal } from '@/components/ujian/DaftarUjian';
import { pesanGalat } from '@/lib/ujian';
import { LABEL_AKSI_PLOTTING, muatRiwayatPlotting } from '@/lib/ujianRuang';

function RiwayatPlotting({ ujianId, buka, onTutup }) {
  const [items, setItems] = useState(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    if (!buka) return undefined;
    let hidup = true;
    setItems(null);
    setGalat('');
    muatRiwayatPlotting(ujianId)
      .then((h) => { if (hidup) setItems(h.items); })
      .catch((e) => { if (hidup) setGalat(pesanGalat(e, 'Gagal memuat jejak audit.')); });
    return () => { hidup = false; };
  }, [buka, ujianId]);

  return (
    <Sheet open={buka} onOpenChange={(o) => { if (!o) onTutup(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md" data-testid="riwayat-plotting">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><History className="h-5 w-5 text-[#006837]" /> Jejak Audit Plotting</SheetTitle>
          <SheetDescription>Setiap perubahan ruang, penempatan, dan nomor peserta tercatat beserta pelaku, waktu, dan alasannya.</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {galat && <p className="text-sm text-rose-700" role="alert">{galat}</p>}
          {!items && !galat && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</div>}
          {items?.length === 0 && <p className="text-sm text-slate-500">Belum ada perubahan tercatat.</p>}
          {items?.length > 0 && (
            <ol className="relative space-y-4 border-l border-slate-200 pl-4">
              {items.map((r) => (
                <li key={r.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#006837]" aria-hidden="true" />
                  <div className="text-xs text-slate-500">{formatWIBPanjang(r.waktu)} · {r.oleh_nama}</div>
                  <div className="text-sm font-medium text-slate-900">{LABEL_AKSI_PLOTTING[r.aksi] || r.aksi}</div>
                  <div className="text-sm text-slate-700">{r.ringkasan}</div>
                  {r.alasan && <div className="mt-0.5 text-xs italic text-slate-500">Alasan: {r.alasan}</div>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Indikator "Plotting sekali untuk seluruh ujian": penempatan ruang & nomor peserta berlaku untuk semua hari dan sesi
 * selama masa ujian (tanpa plotting ulang per sesi). Menampilkan kapan ditetapkan, perubahan terakhir, dan tautan ke
 * jejak audit. `plotting` = { ditetapkan_pada, diubah_pada, diubah_oleh_nama, jumlah_perubahan }.
 */
export default function IndikatorPlotting({ ujian, plotting, bolehUbah }) {
  const [riwayat, setRiwayat] = useState(false);
  const ditetapkan = plotting?.ditetapkan_pada;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between" data-testid="indikator-plotting">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#006837] ring-1 ring-emerald-200">
          {ditetapkan ? <ShieldCheck className="h-5 w-5" /> : <CalendarCheck2 className="h-5 w-5" />}
        </div>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-emerald-900">
            Plotting sekali untuk seluruh masa ujian{ujian ? ` (${rentangTanggal(ujian.mulai, ujian.selesai)})` : ''}
          </p>
          <p className="text-xs text-emerald-800">
            Ruang dan nomor peserta dipakai untuk semua hari dan sesi — tidak perlu plotting ulang per sesi.
            {bolehUbah ? ' Perubahan hanya oleh admin dan tercatat di jejak audit.' : ' Hanya admin yang dapat mengubahnya.'}
          </p>
          <p className="text-xs text-emerald-700">
            {ditetapkan ? `Ditetapkan ${formatWIBPanjang(ditetapkan)}` : 'Belum ada penempatan peserta'}
            {plotting?.diubah_pada && plotting.diubah_pada !== ditetapkan
              ? ` · terakhir diubah ${formatWIBPanjang(plotting.diubah_pada)}${plotting.diubah_oleh_nama ? ` oleh ${plotting.diubah_oleh_nama}` : ''}` : ''}
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => setRiwayat(true)} className="shrink-0 gap-1 self-start border-emerald-300 bg-white sm:self-center" data-testid="btn-riwayat-plotting">
        <History className="h-4 w-4" /> Jejak Audit{plotting?.jumlah_perubahan ? ` (${plotting.jumlah_perubahan})` : ''}
      </Button>
      {ujian && <RiwayatPlotting ujianId={ujian.id} buka={riwayat} onTutup={() => setRiwayat(false)} />}
    </div>
  );
}
