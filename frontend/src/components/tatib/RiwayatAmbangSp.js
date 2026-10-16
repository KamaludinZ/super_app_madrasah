import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { TINGKAT_SP } from '@/lib/tindakanTatib';

const formatWaktu = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso || '-' : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
};

// Nilai satu tingkat: "25 → 30" bila berubah (yang berubah ditebalkan), selain itu nilai saja.
function NilaiTingkat({ dari, ke }) {
  if (dari == null) return <span className="tabular-nums">{ke ?? '-'}</span>;
  if (dari === ke) return <span className="tabular-nums text-slate-400">{ke}</span>;
  return (
    <span className="whitespace-nowrap tabular-nums">
      <span className="text-slate-400 line-through">{dari}</span> → <span className="font-semibold">{ke}</span>
    </span>
  );
}

/** Tabel riwayat perubahan ambang SP (audit: siapa, kapan, nilai lama → baru, alasan). */
export default function RiwayatAmbangSp({ items = [], loading }) {
  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-500">Belum ada perubahan ambang.</p>;
  return (
    <div className="overflow-x-auto">
      <Table data-testid="riwayat-ambang">
        <TableHeader>
          <TableRow>
            <TableHead>Waktu</TableHead>
            <TableHead>Diubah oleh</TableHead>
            {TINGKAT_SP.map((sp) => <TableHead key={sp} className="text-center">{sp}</TableHead>)}
            <TableHead>Alasan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((r) => (
            <TableRow key={r.id} data-testid={`riwayat-ambang-${r.id}`}>
              <TableCell className="whitespace-nowrap text-sm">{formatWaktu(r.waktu)}</TableCell>
              <TableCell className="whitespace-nowrap">{r.oleh_nama || '-'}</TableCell>
              {TINGKAT_SP.map((sp) => (
                <TableCell key={sp} className="text-center">
                  <NilaiTingkat dari={r.dari?.[sp.toLowerCase()]} ke={r.ke?.[sp.toLowerCase()]} />
                </TableCell>
              ))}
              <TableCell className="text-sm text-slate-600">{r.alasan || <span className="text-slate-300">-</span>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
