import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ListChecks, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { bolehInputTatib, pesanGalatTatib } from '@/lib/aksesTatib';
import { formatPoin } from '@/components/tatib/RingkasanPoin';
import BannerModeLihat from '@/components/tatib/BannerModeLihat';
import { ambilMasterJenis } from '@/lib/masterJenisTatib';

// Master Jenis Pelanggaran: daftar jenis aturan (pelanggaran & kebaikan) beserta kode, kategori,
// jalur, dan besar poin yang dipakai otomatis saat mencatat di Input Tata Tertib.
export default function TatibMasterJenisPage() {
  const { activeRole } = useAuth();
  const bolehUbah = bolehInputTatib(activeRole);
  const [jenisList, setJenisList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ambilMasterJenis()
      .then(setJenisList)
      .catch((e) => toast.error(pesanGalatTatib(e, 'Gagal memuat master jenis pelanggaran')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6" data-testid="tatib-master-jenis-page">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ListChecks className="h-6 w-6" /> Master Jenis Pelanggaran
        </h1>
        <p className="text-sm text-slate-600">
          Daftar jenis aturan beserta kode, kategori, jalur, dan besar poin. Poin di sini dipakai otomatis saat mencatat tata tertib.
        </p>
      </div>

      {!bolehUbah && <BannerModeLihat />}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat data...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama Jenis</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Jalur</TableHead>
                    <TableHead className="text-right">Besar Poin</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jenisList.map((j) => (
                    <TableRow key={j.id} className={j.aktif ? '' : 'text-slate-400'} data-testid={`master-jenis-${j.id}`}>
                      <TableCell className="font-mono text-xs font-semibold">{j.kode_aturan}</TableCell>
                      <TableCell>
                        <div className="font-medium">{j.nama}</div>
                        {j.deskripsi && <div className="text-xs text-slate-500 line-clamp-1">{j.deskripsi}</div>}
                      </TableCell>
                      <TableCell>{j.kategori_nama}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={j.jalur_poin === 'minus' ? 'border-red-200 text-red-700' : 'border-emerald-200 text-emerald-700'}>
                          {j.jalur_poin === 'minus' ? 'Minus (pelanggaran)' : 'Plus (kebaikan)'}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-semibold tabular-nums ${j.poin < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {formatPoin(j.poin)}
                      </TableCell>
                      <TableCell>
                        {j.aktif ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Aktif</Badge> : <Badge variant="secondary">Nonaktif</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                  {jenisList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-slate-500">Belum ada jenis aturan.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
