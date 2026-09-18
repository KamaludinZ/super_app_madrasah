import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DoorOpen, Loader2, Search, Eye, Boxes } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminSarprasRuanganAsetPage() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sarpras/ruangan-aset');
      setRooms(res.data || []);
    } catch (e) {
      toast.error('Gagal memuat data ruangan');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (room) => {
    setShowDetail(true);
    setDetailLoading(true);
    try {
      const res = await api.get(`/sarpras/ruangan-aset/${room.id}`);
      setDetail(res.data);
    } catch (e) {
      toast.error('Gagal memuat detail ruangan');
    } finally {
      setDetailLoading(false);
    }
  };

  const filtered = rooms.filter((r) => !search || (r.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6" data-testid="admin-sarpras-ruangan-aset-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <DoorOpen className="h-3 w-3 mr-1" /> Menu Sarpras
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Ruangan dan Aset</h1>
        <p className="text-sm text-slate-600 mt-1">Lihat ruangan beserta aset tetap dan aset lancar di dalamnya</p>
        <p className="text-xs text-slate-500 mt-1">Data ruangan mengikuti master ruangan di Master App. Untuk menambah ruangan baru, kelola melalui menu Ruangan.</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari nama ruangan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" /><p className="text-slate-500">Memuat data...</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Ruangan</TableHead>
                    <TableHead className="text-center">Aset Tetap</TableHead>
                    <TableHead className="text-center">Aset Lancar</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-12 text-slate-500">
                      <DoorOpen className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Belum ada data ruangan</div>
                    </TableCell></TableRow>
                  ) : (
                    filtered.map((room) => (
                      <TableRow key={room.id}>
                        <TableCell className="font-semibold">{room.name}</TableCell>
                        <TableCell className="text-center"><Badge variant="outline">{room.jumlah_aset_tetap}</Badge></TableCell>
                        <TableCell className="text-center"><Badge variant="outline">{room.jumlah_aset_lancar}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => openDetail(room)} className="gap-1 text-blue-600 hover:text-blue-700">
                            <Eye className="h-4 w-4" /> Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-[#006837]" /> Aset di {detail?.room?.name || 'Ruangan'}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>
          ) : detail ? (
            <div className="space-y-6 py-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Aset Tetap ({detail.aset_tetap.length})</h3>
                {detail.aset_tetap.length === 0 ? (
                  <p className="text-sm text-slate-500">Tidak ada aset tetap di ruangan ini</p>
                ) : (
                  <div className="space-y-1">
                    {detail.aset_tetap.map((a) => (
                      <div key={a.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                        <span>{a.nama_aset}</span>
                        <Badge variant="outline">{a.jumlah} unit</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Aset Lancar ({detail.aset_lancar.length})</h3>
                {detail.aset_lancar.length === 0 ? (
                  <p className="text-sm text-slate-500">Tidak ada aset lancar di ruangan ini</p>
                ) : (
                  <div className="space-y-1">
                    {detail.aset_lancar.map((a) => (
                      <div key={a.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 rounded">
                        <span>{a.nama_barang}</span>
                        <Badge variant="outline">{a.stok} {a.satuan}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
