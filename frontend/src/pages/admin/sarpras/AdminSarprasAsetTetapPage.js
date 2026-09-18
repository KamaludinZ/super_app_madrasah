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
import { Building2, Plus, Pencil, Trash2, Loader2, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const SUMBER_DANA_LIST = ['Komite', 'BMN'];
const KONDISI_LIST = ['Baik', 'Rusak Ringan', 'Rusak Berat'];

const KONDISI_BADGE = {
  Baik: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Rusak Ringan': 'bg-amber-100 text-amber-700 border-amber-200',
  'Rusak Berat': 'bg-rose-100 text-rose-700 border-rose-200',
};

const emptyForm = {
  nama_aset: '', sumber_dana: 'Komite', kode_aset: '', kategori: '', tanggal_perolehan: '',
  nilai_perolehan: '', jumlah: 1, kondisi: 'Baik', lokasi_room_id: '', keterangan: '',
};

export default function AdminSarprasAsetTetapPage() {
  const [list, setList] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterSumber, setFilterSumber] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, roomsRes] = await Promise.all([
        api.get('/sarpras/aset-tetap'),
        api.get('/rooms'),
      ]);
      setList(res.data || []);
      setRooms(roomsRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data aset tetap');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({
        nama_aset: item.nama_aset || '', sumber_dana: item.sumber_dana || 'Komite', kode_aset: item.kode_aset || '',
        kategori: item.kategori || '', tanggal_perolehan: item.tanggal_perolehan || '',
        nilai_perolehan: item.nilai_perolehan ?? '', jumlah: item.jumlah ?? 1, kondisi: item.kondisi || 'Baik',
        lokasi_room_id: item.lokasi_room_id || '', keterangan: item.keterangan || '',
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
      const payload = {
        ...form,
        jumlah: Number(form.jumlah) || 0,
        nilai_perolehan: form.nilai_perolehan === '' ? null : Number(form.nilai_perolehan),
        lokasi_room_id: form.lokasi_room_id || null,
      };
      if (editing) {
        await api.put(`/sarpras/aset-tetap/${editing.id}`, payload);
        toast.success('Aset tetap berhasil diperbarui');
      } else {
        await api.post('/sarpras/aset-tetap', payload);
        toast.success('Aset tetap berhasil ditambahkan');
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
      await api.delete(`/sarpras/aset-tetap/${id}`);
      toast.success('Aset dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const filtered = list.filter((item) => {
    if (filterSumber && item.sumber_dana !== filterSumber) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.nama_aset || '').toLowerCase().includes(q) || (item.kode_aset || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6" data-testid="admin-sarpras-aset-tetap-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Building2 className="h-3 w-3 mr-1" /> Menu Sarpras
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Aset Tetap Komite & BMN</h1>
          <p className="text-sm text-slate-600 mt-1">Kelola aset tetap dari dana Komite maupun BMN (aset negara)</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Tambah Aset Tetap
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari nama atau kode aset..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterSumber || 'all'} onValueChange={(v) => setFilterSumber(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Semua Sumber Dana" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Sumber Dana</SelectItem>
              {SUMBER_DANA_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
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
                    <TableHead>Nama Aset</TableHead>
                    <TableHead>Sumber Dana</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-center">Jumlah</TableHead>
                    <TableHead>Kondisi</TableHead>
                    <TableHead>Lokasi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500">
                      <Building2 className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Belum ada data aset tetap</div>
                    </TableCell></TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold">{item.nama_aset}<div className="text-xs text-slate-500 font-normal">{item.kode_aset}</div></TableCell>
                        <TableCell><Badge variant="outline">{item.sumber_dana}</Badge></TableCell>
                        <TableCell>{item.kategori || '-'}</TableCell>
                        <TableCell className="text-center font-mono">{item.jumlah}</TableCell>
                        <TableCell><Badge className={KONDISI_BADGE[item.kondisi] || ''}>{item.kondisi}</Badge></TableCell>
                        <TableCell>{item.lokasi_room_nama || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-700"><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(item.id)} className="text-rose-600 hover:text-rose-700"><Trash2 className="h-4 w-4" /></Button>
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Aset Tetap' : 'Tambah Aset Tetap Baru'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Aset <span className="text-rose-500">*</span></Label>
              <Input value={form.nama_aset} onChange={(e) => setForm({ ...form, nama_aset: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sumber Dana</Label>
                <Select value={form.sumber_dana} onValueChange={(v) => setForm({ ...form, sumber_dana: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SUMBER_DANA_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Kode Aset</Label>
                <Input value={form.kode_aset} onChange={(e) => setForm({ ...form, kode_aset: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Input value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} placeholder="Elektronik, Furniture, dsb" />
              </div>
              <div className="space-y-2">
                <Label>Kondisi</Label>
                <Select value={form.kondisi} onValueChange={(v) => setForm({ ...form, kondisi: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{KONDISI_LIST.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Perolehan</Label>
                <Input type="date" value={form.tanggal_perolehan} onChange={(e) => setForm({ ...form, tanggal_perolehan: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nilai Perolehan (Rp)</Label>
                <Input type="number" min="0" value={form.nilai_perolehan} onChange={(e) => setForm({ ...form, nilai_perolehan: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jumlah</Label>
                <Input type="number" min="0" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Lokasi Ruangan</Label>
                <Select value={form.lokasi_room_id || 'none'} onValueChange={(v) => setForm({ ...form, lokasi_room_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih Ruangan" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada</SelectItem>
                    {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
