import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { History, Loader2 } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { JENIS_DOKUMEN, riwayatUnduhan } from '@/lib/pkgCetak';

// Riwayat unduhan & cetak dokumen PKG (kepala madrasah): siapa, kapan, berkas, jenis, format, versi template.
// `muatUlangKunci` berubah (mis. setelah unduhan baru) -> daftar dimuat ulang.
export default function RiwayatUnduhan({ periodeId, muatUlangKunci }) {
  const [daftar, setDaftar] = useState(null);
  const [galat, setGalat] = useState(null);

  useEffect(() => {
    let hidup = true;
    setGalat(null);
    riwayatUnduhan(periodeId)
      .then((d) => { if (hidup) setDaftar(d); })
      .catch((e) => { if (hidup) setGalat(e.message); });
    return () => { hidup = false; };
  }, [periodeId, muatUlangKunci]);

  return (
    <Card data-testid="pkg-riwayat-unduhan">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4 text-[#006837]" /> Riwayat Unduhan</CardTitle>
        <p className="text-xs text-slate-500">Setiap cetak & unduh dokumen resmi tercatat beserta pengunduh dan versi template.</p>
      </CardHeader>
      <CardContent>
        {galat && <p className="py-4 text-center text-sm text-rose-700">{galat}</p>}
        {!galat && !daftar && <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-[#006837]" /></div>}
        {daftar?.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Belum ada dokumen yang diunduh pada periode ini.</p>}
        {daftar?.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Berkas</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Pengunduh</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daftar.map((u) => (
                  <TableRow key={u.id} data-testid={`pkg-unduhan-${u.id}`}>
                    <TableCell className="whitespace-nowrap text-sm text-slate-600">{formatWIBPanjang(u.timestamp)}</TableCell>
                    <TableCell className="min-w-[200px]">
                      <div className="font-mono text-xs text-slate-800 break-all">{u.nama_berkas}</div>
                      <div className="text-xs text-slate-500">{JENIS_DOKUMEN[u.jenis]?.judul || u.jenis}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="uppercase">{u.format}</Badge></TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-slate-600">{u.versi_template ? `v${u.versi_template}` : '-'}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-slate-700">{u.aktor_nama || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
