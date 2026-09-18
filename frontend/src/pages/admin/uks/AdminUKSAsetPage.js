import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HeartPulse, Plus, Pencil, Trash2, Loader2, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const KATEGORI_LIST = ['Alat Medis', 'Furniture', 'P3K', 'Obat & BMHP', 'Lainnya'];
const KONDISI_LIST = ['Baik', 'Rusak Ringan', 'Rusak Berat'];

const KONDISI_BADGE = {
  Baik: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Rusak Ringan': 'bg-amber-100 text-amber-700 border-amber-200',
  'Rusak Berat': 'bg-rose-100 text-rose-700 border-rose-200',
};

const emptyForm = { nama_aset: '', kategori: '', jumlah: 1, kondisi: 'Baik', lokasi: '', tanggal_perolehan: '', keterangan: '' };

export default function AdminUKSAsetPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/uks/aset');
      setList(res.data || []);
    } catch (e) {
      toast.error('Gagal memuat data aset UKS');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({
        nama_aset: item.nama_aset || '', kategori: item.kategori || '', jumlah: item.jumlah ?? 1,
        kondisi: item.kondisi || 'Baik', lokasi: item.lokasi || '', tanggal_perolehan: item.tanggal_perolehan || '',
        keterangan: item.keterangan || '',
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nama_aset) { toast.error('Nama aset wajib diisi'); return; }
    setSaving(true);
    try {
      const payload = { ...form, jumlah: Number(form.jumlah) || 0 };
      if (editing) {
        await api.put(`/uks/aset/${editing.id}`, payload);
        toast.success('Aset berhasil diperbarui');
      } else {
        await api.post('/uks/aset', payload);
        toast.success('Aset berhasil ditambahkan');
      }
      setShowModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus aset ini?')) return;
    try {
      await api.delete(`/uks/aset/${id}`);
      toast.success('Aset dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const filtered = list.filter((item) => !search || (item.nama_aset || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6" data-testid="admin-uks-aset-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <HeartPulse className="h-3 w-3 mr-1" /> Menu UKS
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Aset UKS</h1>
          <p className="text-sm text-slate-600 mt-1">Kelola peralatan dan aset milik UKS</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Tambah Aset
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari nama aset..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                    <TableHead>Nama Aset</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-center">Jumlah</TableHead>
                    <TableHead>Kondisi</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                        <HeartPulse className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Belum ada data aset</div>
                        <div className="text-xs mt-1">Klik "Tambah Aset" untuk mulai mendata</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold">{item.nama_aset}</TableCell>
                        <TableCell><Badge variant="outline">{item.kategori || '-'}</Badge></TableCell>
                        <TableCell className="text-center font-mono">{item.jumlah}</TableCell>
                        <TableCell><Badge className={KONDISI_BADGE[item.kondisi] || ''}>{item.kondisi}</Badge></TableCell>
                        <TableCell>{item.lokasi || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-700">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="text-rose-600 hover:text-rose-700">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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
            <DialogTitle>{editing ? 'Edit Aset' : 'Tambah Aset Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Aset <span className="text-rose-500">*</span></Label>
              <Input value={form.nama_aset} onChange={(e) => setForm({ ...form, nama_aset: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={form.kategori || 'none'} onValueChange={(v) => setForm({ ...form, kategori: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih Kategori" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih Kategori</SelectItem>
                    {KATEGORI_LIST.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kondisi</Label>
                <Select value={form.kondisi} onValueChange={(v) => setForm({ ...form, kondisi: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KONDISI_LIST.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jumlah</Label>
                <Input type="number" min="0" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Lokasi</Label>
                <Input value={form.lokasi} onChange={(e) => setForm({ ...form, lokasi: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tanggal Perolehan</Label>
              <Input type="date" value={form.tanggal_perolehan} onChange={(e) => setForm({ ...form, tanggal_perolehan: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea rows={2} value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
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
