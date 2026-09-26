import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertOctagon, Plus, Pencil, Trash2, Loader2, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';

const TINGKAT_LIST = ['Ringan', 'Sedang', 'Berat'];
const STATUS_LIST = ['Dilaporkan', 'Diperbaiki', 'Selesai', 'Tidak Dapat Diperbaiki'];

const TINGKAT_BADGE = {
  Ringan: 'bg-slate-100 text-slate-700 border-slate-200',
  Sedang: 'bg-amber-100 text-amber-700 border-amber-200',
  Berat: 'bg-rose-100 text-rose-700 border-rose-200',
};
const STATUS_BADGE = {
  Dilaporkan: 'bg-blue-100 text-blue-700 border-blue-200',
  Diperbaiki: 'bg-amber-100 text-amber-700 border-amber-200',
  Selesai: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Tidak Dapat Diperbaiki': 'bg-slate-100 text-slate-700 border-slate-200',
};

const emptyForm = {
  aset_tipe: 'tetap', aset_id: '', tanggal_lapor: new Date().toISOString().split('T')[0], pelapor_id: '',
  deskripsi_kerusakan: '', tingkat_kerusakan: 'Ringan', status: 'Dilaporkan',
  tanggal_perbaikan: '', biaya_perbaikan: '', hasil_perbaikan: '',
};

export default function AdminSarprasKerusakanPage() {
  const [list, setList] = useState([]);
  const [summary, setSummary] = useState(null);
  const [asetTetap, setAsetTetap] = useState([]);
  const [asetLancar, setAsetLancar] = useState([]);
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
      const [res, summaryRes, tetapRes, lancarRes, roomsRes, wargaRes] = await Promise.all([
        api.get('/sarpras/kerusakan'),
        api.get('/sarpras/kerusakan/summary'),
        api.get('/sarpras/aset-tetap'),
        api.get('/sarpras/aset-lancar'),
        api.get('/rooms'),
        api.get('/sarpras/warga-madrasah'),
      ]);
      setList(res.data || []);
      setSummary(summaryRes.data);
      setAsetTetap(tetapRes.data || []);
      setAsetLancar(lancarRes.data || []);
      setRooms(roomsRes.data || []);
      setWargaList(wargaRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat laporan kerusakan');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({
        aset_tipe: item.aset_tipe || 'tetap', aset_id: item.aset_id || '', tanggal_lapor: item.tanggal_lapor || '',
        pelapor_id: item.pelapor_id || '', deskripsi_kerusakan: item.deskripsi_kerusakan || '',
        tingkat_kerusakan: item.tingkat_kerusakan || 'Ringan', status: item.status || 'Dilaporkan',
        tanggal_perbaikan: item.tanggal_perbaikan || '', biaya_perbaikan: item.biaya_perbaikan ?? '',
        hasil_perbaikan: item.hasil_perbaikan || '',
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.aset_id || !form.tanggal_lapor || !form.deskripsi_kerusakan) {
      toast.error('Aset, tanggal lapor, dan deskripsi kerusakan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        pelapor_id: form.pelapor_id || null,
        biaya_perbaikan: form.biaya_perbaikan === '' ? null : Number(form.biaya_perbaikan),
      };
      if (editing) {
        await api.put(`/sarpras/kerusakan/${editing.id}`, payload);
        toast.success('Laporan kerusakan berhasil diperbarui');
      } else {
        await api.post('/sarpras/kerusakan', payload);
        toast.success('Laporan kerusakan berhasil ditambahkan');
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
    if (!(await confirmDialog('Yakin ingin menghapus laporan ini?'))) return;
    try {
      await api.delete(`/sarpras/kerusakan/${id}`);
      toast.success('Laporan dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const asetOptions = form.aset_tipe === 'tetap' ? asetTetap : form.aset_tipe === 'lancar' ? asetLancar : rooms;

  const filtered = list.filter((item) => {
    if (filterStatus && item.status !== filterStatus) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.aset_nama || '').toLowerCase().includes(q) || (item.deskripsi_kerusakan || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6" data-testid="admin-sarpras-kerusakan-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <AlertOctagon className="h-3 w-3 mr-1" /> Menu Sarpras
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Laporan Kerusakan & Perbaikan</h1>
          <p className="text-sm text-slate-600 mt-1">Kelola laporan kerusakan aset dan status perbaikannya</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Lapor Kerusakan
        </Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardContent className="p-4"><div className="text-2xl font-bold text-slate-900">{summary.total_laporan}</div><div className="text-xs text-slate-500">Total Laporan</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold text-slate-900">{summary.by_status?.Dilaporkan || 0}</div><div className="text-xs text-slate-500">Belum Ditangani</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold text-slate-900">{summary.by_status?.Selesai || 0}</div><div className="text-xs text-slate-500">Selesai Diperbaiki</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-2xl font-bold text-slate-900">Rp{Number(summary.total_biaya_perbaikan || 0).toLocaleString('id-ID')}</div><div className="text-xs text-slate-500">Total Biaya Perbaikan</div></CardContent></Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari aset atau deskripsi..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterStatus || 'all'} onValueChange={(v) => setFilterStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Semua Status" /></SelectTrigger>
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
                    <TableHead>Tanggal Lapor</TableHead>
                    <TableHead>Aset</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead>Tingkat</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">
                      <AlertOctagon className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Belum ada laporan kerusakan</div>
                    </TableCell></TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.tanggal_lapor}</TableCell>
                        <TableCell className="font-semibold">{item.aset_nama}</TableCell>
                        <TableCell className="max-w-xs"><div className="line-clamp-2">{item.deskripsi_kerusakan}</div></TableCell>
                        <TableCell><Badge className={TINGKAT_BADGE[item.tingkat_kerusakan] || ''}>{item.tingkat_kerusakan}</Badge></TableCell>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Laporan Kerusakan' : 'Lapor Kerusakan'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipe Aset</Label>
              <Select value={form.aset_tipe} onValueChange={(v) => setForm({ ...form, aset_tipe: v, aset_id: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tetap">Aset Tetap</SelectItem>
                  <SelectItem value="lancar">Aset Lancar</SelectItem>
                  <SelectItem value="room">Ruangan</SelectItem>
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
                    <SelectItem key={a.id} value={a.id}>{a.nama_aset || a.nama_barang || a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Lapor <span className="text-rose-500">*</span></Label>
                <Input type="date" value={form.tanggal_lapor} onChange={(e) => setForm({ ...form, tanggal_lapor: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Pelapor</Label>
                <Select value={form.pelapor_id || 'none'} onValueChange={(v) => setForm({ ...form, pelapor_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih Pelapor" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada</SelectItem>
                    {wargaList.map((w) => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Deskripsi Kerusakan <span className="text-rose-500">*</span></Label>
              <Textarea rows={2} value={form.deskripsi_kerusakan} onChange={(e) => setForm({ ...form, deskripsi_kerusakan: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tingkat Kerusakan</Label>
                <Select value={form.tingkat_kerusakan} onValueChange={(v) => setForm({ ...form, tingkat_kerusakan: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TINGKAT_LIST.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Perbaikan</Label>
                <Input type="date" value={form.tanggal_perbaikan} onChange={(e) => setForm({ ...form, tanggal_perbaikan: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Biaya Perbaikan (Rp)</Label>
                <Input type="number" min="0" value={form.biaya_perbaikan} onChange={(e) => setForm({ ...form, biaya_perbaikan: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Hasil Perbaikan</Label>
              <Textarea rows={2} value={form.hasil_perbaikan} onChange={(e) => setForm({ ...form, hasil_perbaikan: e.target.value })} />
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
