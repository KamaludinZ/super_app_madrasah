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
import { CalendarClock, Plus, Pencil, Trash2, Loader2, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';

const STATUS_LIST = ['Dipesan', 'Berlangsung', 'Selesai', 'Dibatalkan'];
const STATUS_BADGE = {
  Dipesan: 'bg-blue-100 text-blue-700 border-blue-200',
  Berlangsung: 'bg-amber-100 text-amber-700 border-amber-200',
  Selesai: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Dibatalkan: 'bg-slate-100 text-slate-700 border-slate-200',
};

const emptyForm = {
  room_id: '', peminjam_id: '', tanggal: new Date().toISOString().split('T')[0],
  jam_mulai: '', jam_selesai: '', keperluan: '', status: 'Dipesan', catatan: '',
};

export default function AdminSarprasPeminjamanRuanganPage() {
  const [list, setList] = useState([]);
  const [rooms, setRooms] = useState([]);
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
      const [res, roomsRes, wargaRes] = await Promise.all([
        api.get('/sarpras/peminjaman-ruangan'),
        api.get('/rooms'),
        api.get('/sarpras/warga-madrasah'),
      ]);
      setList(res.data || []);
      setRooms(roomsRes.data || []);
      setWargaList(wargaRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data peminjaman ruangan');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({
        room_id: item.room_id || '', peminjam_id: item.peminjam_id || '', tanggal: item.tanggal || '',
        jam_mulai: item.jam_mulai || '', jam_selesai: item.jam_selesai || '', keperluan: item.keperluan || '',
        status: item.status || 'Dipesan', catatan: item.catatan || '',
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.room_id || !form.peminjam_id || !form.tanggal || !form.keperluan) {
      toast.error('Ruangan, peminjam, tanggal, dan keperluan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/sarpras/peminjaman-ruangan/${editing.id}`, form);
        toast.success('Data peminjaman ruangan berhasil diperbarui');
      } else {
        await api.post('/sarpras/peminjaman-ruangan', form);
        toast.success('Data peminjaman ruangan berhasil ditambahkan');
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
    if (!(await confirmDialog('Yakin ingin menghapus data ini?'))) return;
    try {
      await api.delete(`/sarpras/peminjaman-ruangan/${id}`);
      toast.success('Data dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const filtered = list.filter((item) => {
    if (filterStatus && item.status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.peminjam_nama || '').toLowerCase().includes(q) || (item.room_nama || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6" data-testid="admin-sarpras-peminjaman-ruangan-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <CalendarClock className="h-3 w-3 mr-1" /> Menu Sarpras
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Peminjaman Ruangan</h1>
          <p className="text-sm text-slate-600 mt-1">Kelola pemesanan dan penggunaan ruangan</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Pesan Ruangan
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari peminjam atau ruangan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
            <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" /><p className="text-slate-500">Memuat data...</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ruangan</TableHead>
                    <TableHead>Peminjam</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">
                      <CalendarClock className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Belum ada data peminjaman ruangan</div>
                    </TableCell></TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-semibold">{item.room_nama}</TableCell>
                        <TableCell>{item.peminjam_nama}</TableCell>
                        <TableCell className="font-mono">{item.tanggal}</TableCell>
                        <TableCell className="font-mono">{item.jam_mulai || '-'}{item.jam_selesai ? ` - ${item.jam_selesai}` : ''}</TableCell>
                        <TableCell><Badge className={STATUS_BADGE[item.status] || ''}>{item.status}</Badge></TableCell>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Peminjaman Ruangan' : 'Pesan Ruangan'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Ruangan <span className="text-rose-500">*</span></Label>
              <Select value={form.room_id || 'none'} onValueChange={(v) => setForm({ ...form, room_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Ruangan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Ruangan</SelectItem>
                  {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Peminjam <span className="text-rose-500">*</span></Label>
              <Select value={form.peminjam_id || 'none'} onValueChange={(v) => setForm({ ...form, peminjam_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Peminjam" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Peminjam</SelectItem>
                  {wargaList.map((w) => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tanggal <span className="text-rose-500">*</span></Label>
                <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jam Mulai</Label>
                <Input type="time" value={form.jam_mulai} onChange={(e) => setForm({ ...form, jam_mulai: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jam Selesai</Label>
                <Input type="time" value={form.jam_selesai} onChange={(e) => setForm({ ...form, jam_selesai: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Keperluan <span className="text-rose-500">*</span></Label>
              <Textarea rows={2} value={form.keperluan} onChange={(e) => setForm({ ...form, keperluan: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea rows={2} value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
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
