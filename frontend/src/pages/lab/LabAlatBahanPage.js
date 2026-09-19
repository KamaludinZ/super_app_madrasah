import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Package, Loader2, FlaskConical, Monitor } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const LAB_META = {
  ipa: { title: 'Lab IPA', icon: FlaskConical },
  komputer: { title: 'Lab Komputer', icon: Monitor },
};

const KONDISI_BADGE = {
  Baik: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Rusak Ringan': 'bg-amber-100 text-amber-700 border-amber-200',
  'Rusak Berat': 'bg-rose-100 text-rose-700 border-rose-200',
};

export default function LabAlatBahanPage() {
  const { labKey } = useParams();
  const meta = LAB_META[labKey] || LAB_META.ipa;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [labKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/lab/${labKey}/alat-bahan`);
      setData(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat data alat dan bahan lab');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid={`lab-${labKey}-alat-bahan-page`}>
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <meta.icon className="h-3 w-3 mr-1" /> {meta.title}
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Alat dan Bahan Lab</h1>
        <p className="text-sm text-slate-600 mt-1">Daftar aset tetap dan aset lancar yang tersedia di {meta.title}</p>
      </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" /></div>
      ) : (
        <Tabs defaultValue="tetap">
          <TabsList className="bg-white border border-slate-200">
            <TabsTrigger value="tetap">Aset Tetap ({data?.aset_tetap?.length || 0})</TabsTrigger>
            <TabsTrigger value="lancar">Aset Lancar / Bahan ({data?.aset_lancar?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="tetap" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Alat</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-center">Jumlah</TableHead>
                        <TableHead>Kondisi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.aset_tetap || []).length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-500">
                          <Package className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                          <div className="font-semibold">Belum ada aset tetap terdaftar di lab ini</div>
                        </TableCell></TableRow>
                      ) : (
                        data.aset_tetap.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-semibold">{a.nama_aset}</TableCell>
                            <TableCell>{a.kategori || '-'}</TableCell>
                            <TableCell className="text-center font-mono">{a.jumlah}</TableCell>
                            <TableCell><Badge className={KONDISI_BADGE[a.kondisi] || ''}>{a.kondisi}</Badge></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lancar" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nama Barang</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead className="text-center">Stok</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(data?.aset_lancar || []).length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center py-12 text-slate-500">
                          <Package className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                          <div className="font-semibold">Belum ada bahan habis pakai terdaftar di lab ini</div>
                        </TableCell></TableRow>
                      ) : (
                        data.aset_lancar.map((a) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-semibold">{a.nama_barang}</TableCell>
                            <TableCell>{a.kategori || '-'}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={a.stok <= (a.stok_minimum || 0) ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}>
                                {a.stok} {a.satuan}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <p className="text-xs text-slate-500 italic">Data aset dikelola oleh Waka Sarpras melalui menu Sarpras. Hubungi Sarpras untuk menambah/mengubah data aset.</p>
    </div>
  );
}
