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
import { Trash, Plus, Trash2, Loader2, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';

const emptyForm = { aset_tipe: 'tetap', aset_id: '', tanggal: new Date().toISOString().split('T')[0], alasan: '', jumlah_dihapus: 1, nomor_berita_acara: '', keterangan: '' };

export default function AdminSarprasPenghapusanPage() {
  const [list, setList] = useState([]);
  const [asetTetap, setAsetTetap] = useState([]);
  const [asetLancar, setAsetLancar] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, tetapRes, lancarRes] = await Promise.all([
        api.get('/sarpras/penghapusan'),
        api.get('/sarpras/aset-tetap'),
        api.get('/sarpras/aset-lancar'),
      ]);
      setList(res.data || []);
      setAsetTetap(tetapRes.data || []);
      setAsetLancar(lancarRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data penghapusan');
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => { setForm(emptyForm); setShowModal(true); };

  const handleSave = async () => {
    if (!form.aset_id || !form.tanggal || !form.alasan) {
      toast.error('Aset, tanggal, dan alasan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      await api.post('/sarpras/penghapusan', { ...form, jumlah_dihapus: Number(form.jumlah_dihapus) || 1 });
      toast.success('Data penghapusan berhasil dicatat');
      setShowModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmDialog('Yakin ingin menghapus catatan ini?'))) return;
    try {
      await api.delete(`/sarpras/penghapusan/${id}`);
      toast.success('Catatan dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const asetOptions = form.aset_tipe === 'tetap' ? asetTetap : asetLancar;

  const filtered = list.filter((item) => !search || (item.aset_nama || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6" data-testid="admin-sarpras-penghapusan-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Trash className="h-3 w-3 mr-1" /> Menu Sarpras
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Penghapusan Barang</h1>
          <p className="text-sm text-slate-600 mt-1">Catat penghapusan aset tetap maupun aset lancar</p>
        </div>
        <Button onClick={openModal} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Catat Penghapusan
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
            <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" /><p className="text-slate-500">Memuat data...</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Aset</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-center">Jumlah</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">
                      <Trash className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Belum ada data penghapusan</div>
                    </TableCell></TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.tanggal}</TableCell>
                        <TableCell className="font-semibold">{item.aset_nama}</TableCell>
                        <TableCell><Badge variant="outline">{item.aset_tipe === 'tetap' ? 'Aset Tetap' : 'Aset Lancar'}</Badge></TableCell>
                        <TableCell className="text-center font-mono">{item.jumlah_dihapus}</TableCell>
                        <TableCell>{item.alasan}</TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
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
          <DialogHeader><DialogTitle>Catat Penghapusan Barang</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipe Aset</Label>
              <Select value={form.aset_tipe} onValueChange={(v) => setForm({ ...form, aset_tipe: v, aset_id: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tetap">Aset Tetap</SelectItem>
                  <SelectItem value="lancar">Aset Lancar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Aset <span className="text-rose-500">*</span></Label>
              <Select value={form.aset_id || 'none'} onValueChange={(v) => setForm({ ...form, aset_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Aset" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Aset</SelectItem>
                  {asetOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nama_aset || a.nama_barang}</SelectItem>
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
                <Label>Jumlah Dihapus</Label>
                <Input type="number" min="1" value={form.jumlah_dihapus} onChange={(e) => setForm({ ...form, jumlah_dihapus: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Alasan <span className="text-rose-500">*</span></Label>
              <Input value={form.alasan} onChange={(e) => setForm({ ...form, alasan: e.target.value })} placeholder="Rusak Berat, Hilang, Usang" />
            </div>
            <div className="space-y-2">
              <Label>Nomor Berita Acara</Label>
              <Input value={form.nomor_berita_acara} onChange={(e) => setForm({ ...form, nomor_berita_acara: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Textarea rows={2} value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-[#006837] hover:bg-[#005830]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
