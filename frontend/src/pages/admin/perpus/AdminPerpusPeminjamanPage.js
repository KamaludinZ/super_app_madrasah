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
import { BookOpen, Plus, Pencil, Trash2, Loader2, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';

const STATUS_LIST = ['Dipinjam', 'Dikembalikan', 'Terlambat', 'Hilang'];

const STATUS_BADGE = {
  Dipinjam: 'bg-blue-100 text-blue-700 border-blue-200',
  Dikembalikan: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Terlambat: 'bg-amber-100 text-amber-700 border-amber-200',
  Hilang: 'bg-rose-100 text-rose-700 border-rose-200',
};

const emptyForm = {
  koleksi_id: '',
  peminjam_id: '',
  tanggal_pinjam: new Date().toISOString().split('T')[0],
  tanggal_kembali_rencana: '',
  tanggal_kembali_aktual: '',
  status: 'Dipinjam',
  catatan: '',
};

export default function AdminPerpusPeminjamanPage() {
  const [list, setList] = useState([]);
  const [koleksiList, setKoleksiList] = useState([]);
  const [wargaList, setWargaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, koleksiRes, wargaRes] = await Promise.all([
        api.get('/perpus/peminjaman'),
        api.get('/perpus/koleksi'),
        api.get('/perpus/warga-madrasah'),
      ]);
      setList(res.data || []);
      setKoleksiList(koleksiRes.data || []);
      setWargaList(wargaRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data peminjaman');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({
        koleksi_id: item.koleksi_id || '',
        peminjam_id: item.peminjam_id || '',
        tanggal_pinjam: item.tanggal_pinjam || '',
        tanggal_kembali_rencana: item.tanggal_kembali_rencana || '',
        tanggal_kembali_aktual: item.tanggal_kembali_aktual || '',
        status: item.status || 'Dipinjam',
        catatan: item.catatan || '',
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.koleksi_id || !form.peminjam_id || !form.tanggal_pinjam) {
      toast.error('Koleksi, peminjam, dan tanggal pinjam wajib diisi');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/perpus/peminjaman/${editing.id}`, form);
        toast.success('Data peminjaman berhasil diperbarui');
      } else {
        await api.post('/perpus/peminjaman', form);
        toast.success('Data peminjaman berhasil ditambahkan');
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
    if (!(await confirmDialog('Yakin ingin menghapus data peminjaman ini?'))) return;
    try {
      await api.delete(`/perpus/peminjaman/${id}`);
      toast.success('Data peminjaman dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const filtered = list.filter((item) => {
    if (filterStatus && item.status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.peminjam_nama || '').toLowerCase().includes(q) ||
      (item.koleksi_judul || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6" data-testid="admin-perpus-peminjaman-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <BookOpen className="h-3 w-3 mr-1" /> Menu Perpus
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Peminjaman Buku</h1>
          <p className="text-sm text-slate-600 mt-1">Kelola transaksi peminjaman dan pengembalian koleksi</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Input Peminjaman
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari peminjam atau judul..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus || 'all'} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Semua Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
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
                    <TableHead>Peminjam</TableHead>
                    <TableHead>Koleksi</TableHead>
                    <TableHead>Tgl Pinjam</TableHead>
                    <TableHead>Rencana Kembali</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                        <BookOpen className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Belum ada data peminjaman</div>
                        <div className="text-xs mt-1">Klik "Input Peminjaman" untuk mulai mencatat</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold">{item.peminjam_nama}<div className="text-xs text-slate-500 font-normal">{item.peminjam_identitas}</div></TableCell>
                        <TableCell>{item.koleksi_judul}</TableCell>
                        <TableCell className="font-mono">{item.tanggal_pinjam}</TableCell>
                        <TableCell className="font-mono">{item.tanggal_kembali_rencana || '-'}</TableCell>
                        <TableCell><Badge className={STATUS_BADGE[item.status] || ''}>{item.status}</Badge></TableCell>
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
            <DialogTitle>{editing ? 'Edit Peminjaman' : 'Input Peminjaman'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Peminjam <span className="text-rose-500">*</span></Label>
              <Select value={form.peminjam_id || 'none'} onValueChange={(v) => setForm({ ...form, peminjam_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Peminjam" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Peminjam</SelectItem>
                  {wargaList.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.full_name} {w.nis ? `(${w.nis})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Koleksi <span className="text-rose-500">*</span></Label>
              <Select value={form.koleksi_id || 'none'} onValueChange={(v) => setForm({ ...form, koleksi_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Koleksi" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Koleksi</SelectItem>
                  {koleksiList.map((k) => (
                    <SelectItem key={k.id} value={k.id}>{k.judul} (Tersedia: {k.jumlah_tersedia})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Pinjam <span className="text-rose-500">*</span></Label>
                <Input type="date" value={form.tanggal_pinjam} onChange={(e) => setForm({ ...form, tanggal_pinjam: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Rencana Kembali</Label>
                <Input type="date" value={form.tanggal_kembali_rencana} onChange={(e) => setForm({ ...form, tanggal_kembali_rencana: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tanggal Kembali Aktual</Label>
                <Input type="date" value={form.tanggal_kembali_aktual} onChange={(e) => setForm({ ...form, tanggal_kembali_aktual: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea rows={2} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
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
