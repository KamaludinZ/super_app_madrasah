import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus, Trash2, Loader2, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const TUJUAN_LIST = ['Membaca', 'Meminjam Buku', 'Mengembalikan Buku', 'Mengerjakan Tugas', 'Lainnya'];

const emptyForm = {
  pengunjung_id: '',
  tanggal: new Date().toISOString().split('T')[0],
  waktu: '',
  tujuan: '',
  keterangan: '',
};

export default function AdminPerpusKunjunganPage() {
  const [list, setList] = useState([]);
  const [wargaList, setWargaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, wargaRes] = await Promise.all([
        api.get('/perpus/kunjungan'),
        api.get('/perpus/warga-madrasah'),
      ]);
      setList(res.data || []);
      setWargaList(wargaRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data kunjungan');
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => {
    setForm(emptyForm);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.pengunjung_id || !form.tanggal) {
      toast.error('Pengunjung dan tanggal wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await api.post('/perpus/kunjungan', form);
      toast.success('Data kunjungan berhasil dicatat');
      setShowModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus data kunjungan ini?')) return;
    try {
      await api.delete(`/perpus/kunjungan/${id}`);
      toast.success('Data kunjungan dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const filtered = list.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.pengunjung_nama || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6" data-testid="admin-perpus-kunjungan-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Users className="h-3 w-3 mr-1" /> Menu Perpus
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Kunjungan Perpustakaan</h1>
          <p className="text-sm text-slate-600 mt-1">Catat kunjungan warga madrasah ke perpustakaan</p>
        </div>
        <Button onClick={openModal} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Catat Kunjungan
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari nama pengunjung..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
              <p className="text-slate-500">Memuat data...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Pengunjung</TableHead>
                    <TableHead>Tujuan</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                        <Users className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Belum ada data kunjungan</div>
                        <div className="text-xs mt-1">Klik "Catat Kunjungan" untuk mulai mencatat</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.tanggal}</TableCell>
                        <TableCell className="font-mono">{item.waktu || '-'}</TableCell>
                        <TableCell className="font-semibold">{item.pengunjung_nama}<div className="text-xs text-slate-500 font-normal">{item.pengunjung_identitas}</div></TableCell>
                        <TableCell><Badge variant="outline">{item.tujuan || '-'}</Badge></TableCell>
                        <TableCell className="max-w-xs"><div className="line-clamp-2">{item.keterangan || '-'}</div></TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="text-rose-600 hover:text-rose-700">
                            <Trash2 className="h-4 w-4" />
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

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Catat Kunjungan Perpustakaan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pengunjung <span className="text-rose-500">*</span></Label>
              <Select value={form.pengunjung_id || 'none'} onValueChange={(v) => setForm({ ...form, pengunjung_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Pengunjung" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Pengunjung</SelectItem>
                  {wargaList.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.full_name} {w.nis ? `(${w.nis})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal <span className="text-rose-500">*</span></Label>
                <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Waktu</Label>
                <Input type="time" value={form.waktu} onChange={(e) => setForm({ ...form, waktu: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tujuan</Label>
              <Select value={form.tujuan || 'none'} onValueChange={(v) => setForm({ ...form, tujuan: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Tujuan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Tujuan</SelectItem>
                  {TUJUAN_LIST.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Input value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} placeholder="Keterangan tambahan (opsional)" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
