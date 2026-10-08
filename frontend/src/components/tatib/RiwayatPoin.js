import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ThumbsUp, ThumbsDown, ChevronRight } from 'lucide-react';
import { formatPoin, nilaiPoin } from '@/components/tatib/RingkasanPoin';

// Terbaru di atas: tanggal kejadian, lalu waktu pencatatan sebagai penentu bila tanggalnya sama.
export const bandingTerbaru = (a, b) =>
  (b.tanggal || '').localeCompare(a.tanggal || '') || (b.created_at || '').localeCompare(a.created_at || '');

export function formatTanggalPoin(iso) {
  if (!iso) return '-';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function labelBulan(iso) {
  const [y, m] = iso.slice(0, 7).split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

const FILTER = [
  { key: 'semua', label: 'Semua' },
  { key: 'kebaikan', label: 'Kebaikan' },
  { key: 'pelanggaran', label: 'Pelanggaran' },
];

// Daftar riwayat poin tata tertib, terbaru di atas, dikelompokkan per bulan.
// `onPilih` (opsional) dipanggil saat satu catatan diklik untuk membuka rinciannya.
export default function RiwayatPoin({ records = [], onPilih }) {
  const [filter, setFilter] = useState('semua');

  const grup = useMemo(() => {
    const tersaring = records
      .filter((r) => filter === 'semua' || (filter === 'kebaikan' ? nilaiPoin(r) > 0 : nilaiPoin(r) < 0))
      .sort(bandingTerbaru);
    const hasil = [];
    tersaring.forEach((r) => {
      const kunci = (r.tanggal || '').slice(0, 7);
      const terakhir = hasil[hasil.length - 1];
      if (terakhir && terakhir.kunci === kunci) terakhir.items.push(r);
      else hasil.push({ kunci, label: kunci ? labelBulan(r.tanggal) : 'Tanpa tanggal', items: [r] });
    });
    return hasil;
  }, [records, filter]);

  return (
    <div className="space-y-3" data-testid="poin-riwayat">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">Riwayat Poin</h2>
        <div className="inline-flex rounded-lg border bg-white p-0.5" role="tablist" aria-label="Saring riwayat poin">
          {FILTER.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${filter === f.key ? 'bg-[#006837] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              data-testid={`poin-filter-${f.key}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {grup.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-slate-500">Belum ada catatan poin.</CardContent></Card>
      ) : (
        grup.map((g) => (
          <section key={g.kunci} className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{g.label}</h3>
            {g.items.map((r) => {
              const poin = nilaiPoin(r);
              const plus = poin > 0;
              const Ikon = plus ? ThumbsUp : ThumbsDown;
              const isi = (
                <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${plus ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    <Ikon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 truncate">{r.tatib_nama}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{formatTanggalPoin(r.tanggal)} · {r.kategori_nama || 'Lainnya'}</p>
                  </div>
                  <span className={`shrink-0 font-bold tabular-nums ${plus ? 'text-emerald-700' : 'text-red-700'}`}>{formatPoin(poin)}</span>
                  {onPilih && <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                </CardContent>
              );
              return (
                <Card key={r.id} data-testid={`poin-item-${r.id}`} className={onPilih ? 'transition-colors hover:border-slate-300' : ''}>
                  {onPilih ? (
                    <button type="button" className="w-full text-left" onClick={() => onPilih(r)}>{isi}</button>
                  ) : isi}
                </Card>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
