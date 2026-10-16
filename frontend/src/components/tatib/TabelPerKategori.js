import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPoin } from '@/components/tatib/RingkasanPoin';

// Rekap per kategori tatib (struktur baru): jumlah & total poin pelanggaran dan kebaikan.
export default function TabelPerKategori({ items, judul = 'Per Kategori', testid = 'rekap-per-kategori' }) {
  return (
    <Card data-testid={testid}>
      <CardHeader className="pb-3"><CardTitle className="text-base">{judul}</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Pelanggaran</TableHead>
                <TableHead className="text-right">Kebaikan</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((k) => (
                <TableRow key={k.kategori} data-testid={`${testid}-${k.kategori}`}>
                  <TableCell className="font-medium">{k.kategori}</TableCell>
                  <TableCell className="text-right tabular-nums text-red-700">
                    {formatPoin(k.total_minus)} <span className="text-xs text-slate-400">({k.jumlah_pelanggaran})</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-emerald-700">
                    {formatPoin(k.total_plus)} <span className="text-xs text-slate-400">({k.jumlah_kebaikan})</span>
                  </TableCell>
                  <TableCell className={`text-right font-semibold tabular-nums ${k.total_plus + k.total_minus < 0 ? 'text-red-700' : ''}`}>
                    {formatPoin(k.total_plus + k.total_minus)}
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-slate-500">Belum ada data.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
