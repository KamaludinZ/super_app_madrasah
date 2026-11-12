import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { DoorOpen, ChevronDown, ChevronUp, NotebookPen } from 'lucide-react';
import { WAKTU_IZIN, kelompokkanWaktu, labelPeran } from '@/lib/izinKamad';

function BarisIzin({ izin, waktu, onPilih, onCatat }) {
  const w = WAKTU_IZIN[waktu];
  return (
    <li className={`flex items-center gap-1 ${waktu === 'selesai' ? 'opacity-60' : ''}`} data-testid={`papan-izin-${izin.id}`}>
      <button
        type="button"
        onClick={() => onPilih?.(izin)}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-lg px-2 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]/40"
        aria-label={`Lihat detail izin ${izin.pengaju_nama}`}
      >
        <div className={`w-[5.5rem] shrink-0 rounded-lg border px-2 py-1.5 text-center ${waktu === 'berlangsung' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums">{izin.jam_mulai}</div>
          <div className="font-mono text-[11px] text-slate-500 tabular-nums">s.d. {izin.jam_selesai}</div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-slate-900">{izin.pengaju_nama}</span>
            <span className="text-xs text-slate-500">{labelPeran(izin.pengaju_peran)}</span>
          </div>
          <p className="text-sm text-slate-700 mt-0.5 break-words">{izin.keperluan}</p>
        </div>
        <Badge variant="outline" className={`shrink-0 ${w.kelas}`}>{w.label}</Badge>
      </button>
      {onCatat && (
        <button
          type="button"
          onClick={() => onCatat(izin)}
          className="flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-[11px] font-medium text-[#006837] hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]/40"
          aria-label={`Tulis catatan untuk izin ${izin.pengaju_nama}`}
          data-testid={`btn-catat-izin-${izin.id}`}
        >
          <NotebookPen className="h-4 w-4" /> Catat
        </button>
      )}
    </li>
  );
}

/**
 * Daftar izin disetujui hari ini, dikelompokkan menurut jam berjalan: sedang izin, belum mulai,
 * lalu selesai (disembunyikan dulu agar yang masih relevan terlihat). Hanya-lihat; menekan baris
 * memanggil `onPilih(izin)` untuk membuka detail; `onCatat(izin)` (satpam) menampilkan tombol Catat per baris.
 */
export default function PapanIzinHariIni({ items = [], jam, onPilih, onCatat }) {
  const [tampilSelesai, setTampilSelesai] = useState(false);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center" data-testid="papan-izin-kosong">
        <DoorOpen className="h-8 w-8 text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-700">Tidak ada izin hari ini</p>
        <p className="text-xs text-slate-500 mt-0.5">Izin yang disetujui kepala madrasah untuk hari ini akan tampil di sini.</p>
      </div>
    );
  }

  const g = kelompokkanWaktu(items, jam);
  const aktif = [...g.berlangsung.map((i) => [i, 'berlangsung']), ...g.akan_datang.map((i) => [i, 'akan_datang'])];

  return (
    <div data-testid="papan-izin-hari-ini">
      {aktif.length > 0 ? (
        <ul className="divide-y divide-slate-100">
          {aktif.map(([izin, waktu]) => <BarisIzin key={izin.id} izin={izin} waktu={waktu} onPilih={onPilih} onCatat={onCatat} />)}
        </ul>
      ) : (
        <p className="py-4 text-center text-sm text-slate-500" data-testid="papan-izin-semua-selesai">
          Semua izin hari ini sudah selesai.
        </p>
      )}

      {g.selesai.length > 0 && (
        <div className="border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => setTampilSelesai((v) => !v)}
            className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            data-testid="btn-tampil-izin-selesai"
          >
            {tampilSelesai ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {tampilSelesai ? 'Sembunyikan' : 'Tampilkan'} izin yang sudah selesai ({g.selesai.length})
          </button>
          {tampilSelesai && (
            <ul className="divide-y divide-slate-100">
              {g.selesai.map((izin) => <BarisIzin key={izin.id} izin={izin} waktu="selesai" onPilih={onPilih} onCatat={onCatat} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
