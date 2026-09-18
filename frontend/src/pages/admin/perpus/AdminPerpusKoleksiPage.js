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
import { BookMarked, Plus, Pencil, Trash2, Loader2, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const JENIS_LIST = ['Buku', 'Majalah', 'Peta', 'Alat Peraga', 'Lainnya'];
const KONDISI_LIST = ['Baik', 'Rusak Ringan', 'Rusak Berat'];

const KONDISI_BADGE = {
  Baik: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Rusak Ringan': 'bg-amber-100 text-amber-700 border-amber-200',
  'Rusak Berat': 'bg-rose-100 text-rose-700 border-rose-200',
};

const emptyForm = {
  judul: '',
  jenis: 'Buku',
  penulis: '',
  penerbit: '',
  tahun_terbit: '',
  kategori: '',
  kode_koleksi: '',
  jumlah: 1,
  jumlah_tersedia: '',
  kondisi: 'Baik',
  lokasi_rak: '',
  keterangan: '',
};

export default function AdminPerpusKoleksiPage() {
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
      const res = await api.get('/perpus/koleksi');
      setList(res.data || []);
    } catch (e) {
      toast.error('Gagal memuat data koleksi');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({
        judul: item.judul || '',
        jenis: item.jenis || 'Buku',
        penulis: item.penulis || '',
        penerbit: item.penerbit || '',
        tahun_terbit: item.tahun_terbit || '',
        kategori: item.kategori || '',
        kode_koleksi: item.kode_koleksi || '',
        jumlah: item.jumlah ?? 1,
        jumlah_tersedia: item.jumlah_tersedia ?? '',
        kondisi: item.kondisi || 'Baik',
        lokasi_rak: item.lokasi_rak || '',
        keterangan: item.keterangan || '',
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.judul) {
      toast.error('Judul koleksi wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        jumlah: Number(form.jumlah) || 0,
        jumlah_tersedia: form.jumlah_tersedia === '' ? null : Number(form.jumlah_tersedia),
      };
      if (editing) {
        await api.put(`/perpus/koleksi/${editing.id}`, payload);
        toast.success('Koleksi berhasil diperbarui');
      } else {
        await api.post('/perpus/koleksi', payload);
        toast.success('Koleksi berhasil ditambahkan');
      }
      setShowModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan koleksi');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus koleksi ini?')) return;
    try {
      await api.delete(`/perpus/koleksi/${id}`);
      toast.success('Koleksi dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus koleksi');
    }
  };

  const filtered = list.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.judul || '').toLowerCase().includes(q) ||
      (item.penulis || '').toLowerCase().includes(q) ||
      (item.kode_koleksi || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6" data-testid="admin-perpus-koleksi-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <BookMarked className="h-3 w-3 mr-1" /> Menu Perpus
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Aset & Koleksi Perpustakaan</h1>
          <p className="text-sm text-slate-600 mt-1">Kelola buku dan koleksi perpustakaan</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Tambah Koleksi
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari judul, penulis, atau kode..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                    <TableHead>Judul</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Penulis</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead className="text-center">Jumlah</TableHead>
                    <TableHead className="text-center">Tersedia</TableHead>
                    <TableHead>Kondisi</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                        <BookMarked className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Belum ada koleksi</div>
                        <div className="text-xs mt-1">Klik "Tambah Koleksi" untuk mulai mendata</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold">{item.judul}<div className="text-xs text-slate-500 font-normal">{item.kode_koleksi}</div></TableCell>
                        <TableCell><Badge variant="outline">{item.jenis}</Badge></TableCell>
                        <TableCell>{item.penulis || '-'}</TableCell>
                        <TableCell>{item.kategori || '-'}</TableCell>
                        <TableCell className="text-center font-mono">{item.jumlah}</TableCell>
                        <TableCell className="text-center font-mono">{item.jumlah_tersedia}</TableCell>
                        <TableCell><Badge className={KONDISI_BADGE[item.kondisi] || ''}>{item.kondisi}</Badge></TableCell>
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
            <DialogTitle>{editing ? 'Edit Koleksi' : 'Tambah Koleksi Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Judul <span className="text-rose-500">*</span></Label>
              <Input value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} placeholder="Judul buku/koleksi" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jenis</Label>
                <Select value={form.jenis} onValueChange={(v) => setForm({ ...form, jenis: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JENIS_LIST.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
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
                <Label>Penulis</Label>
                <Input value={form.penulis} onChange={(e) => setForm({ ...form, penulis: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Penerbit</Label>
                <Input value={form.penerbit} onChange={(e) => setForm({ ...form, penerbit: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tahun Terbit</Label>
                <Input value={form.tahun_terbit} onChange={(e) => setForm({ ...form, tahun_terbit: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Input value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })} placeholder="Fiksi, Referensi, dsb" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kode Koleksi</Label>
                <Input value={form.kode_koleksi} onChange={(e) => setForm({ ...form, kode_koleksi: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Lokasi Rak</Label>
                <Input value={form.lokasi_rak} onChange={(e) => setForm({ ...form, lokasi_rak: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jumlah</Label>
                <Input type="number" min="0" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jumlah Tersedia</Label>
                <Input type="number" min="0" value={form.jumlah_tersedia} onChange={(e) => setForm({ ...form, jumlah_tersedia: e.target.value })} placeholder="Otomatis = Jumlah jika kosong" />
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
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
