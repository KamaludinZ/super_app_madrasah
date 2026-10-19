import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Loader2, ChevronLeft, ChevronRight, AlertTriangle, RotateCw } from 'lucide-react';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import { formatWIBPanjang } from '@/lib/datetime';
import { KATEGORI_AUDIT, daftarAudit } from '@/lib/pkgAudit';

const PER_HALAMAN = 10;

function IsiHalamanAudit() {
  const [halaman, setHalaman] = useState(1);
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState(null);

  const muat = useCallback(async () => {
    setGalat(null);
    try {
      setData(await daftarAudit({ halaman, perHalaman: PER_HALAMAN }));
    } catch (e) {
      setGalat(e);
    }
  }, [halaman]);

  useEffect(() => { muat(); }, [muat]);

  if (galat) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
        <AlertTriangle className="h-8 w-8 text-amber-600" />
        <p className="text-sm text-slate-700">{galat.message || 'Gagal memuat jejak audit.'}</p>
        <Button variant="outline" size="sm" onClick={muat} className="gap-2"><RotateCw className="h-4 w-4" /> Coba lagi</Button>
      </div>
    );
  }
  if (!data) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;

  const jumlahHalaman = Math.max(1, Math.ceil(data.total / data.per_halaman));

  return (
    <Card data-testid="pkg-audit">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4 text-[#006837]" /> Jejak Audit PKG</CardTitle>
        <p className="text-xs text-slate-500">Riwayat aksi penilaian, perubahan instrumen, susunan periode & SK, cetak/unduh, dan akses. Aksi yang berulang dicatat harian beserta jumlahnya.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.item.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Belum ada aktivitas tercatat.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Pelaku</TableHead>
                  <TableHead>Ringkasan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.item.map((a) => {
                  const kat = KATEGORI_AUDIT[a.kategori] || KATEGORI_AUDIT.akses;
                  return (
                    <TableRow key={a.id} data-testid={`pkg-audit-${a.id}`}>
                      <TableCell className="whitespace-nowrap text-sm text-slate-600">
                        {formatWIBPanjang(a.terakhir || a.timestamp)}
                        {a.jumlah > 1 && <div className="text-xs text-slate-400">{a.jumlah}× hari itu</div>}
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="text-sm font-medium text-slate-900">{a.label}</div>
                        <Badge className={`mt-0.5 ${kat.kelas}`}>{kat.label}</Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-700">{a.aktor_nama || '-'}</TableCell>
                      <TableCell className="min-w-[220px] text-sm text-slate-600">{a.ringkasan || '-'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="tabular-nums">{data.total} entri · halaman {data.halaman}/{jumlahHalaman}</span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-8" disabled={halaman <= 1} onClick={() => setHalaman((h) => h - 1)} aria-label="Halaman sebelumnya" data-testid="pkg-audit-sebelumnya">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="h-8" disabled={halaman >= jumlahHalaman} onClick={() => setHalaman((h) => h + 1)} aria-label="Halaman berikutnya" data-testid="pkg-audit-berikutnya">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Jejak audit PKG (khusus kepala madrasah): daftar aksi terbaru dengan kategori, pelaku, dan ringkasan.
// Data sementara dari lib/pkgAudit (tiruan).
export default function PkgAuditPage() {
  return (
    <PenjagaMenuPkg menuKey="audit">
      <IsiHalamanAudit />
    </PenjagaMenuPkg>
  );
}
