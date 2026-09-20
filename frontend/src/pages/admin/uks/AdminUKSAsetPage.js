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
import { HeartPulse, Plus, Pencil, Trash2, Loader2, Save, Search, Boxes, CheckCircle2, AlertTriangle, Package, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import LabKPI from '@/pages/lab/LabKPI';

const JENIS_LABELS = { tetap: 'Aset Tetap', lancar: 'Aset Lancar' };
const EMPTY_FORM = { aset_tipe: 'tetap', nama: '', kategori: '', satuan: '', jumlah_baik: 0, jumlah_rusak: 0, lokasi_penyimpanan: '', ruangan_id: '', keterangan: '' };

export default function AdminUKSAsetPage() {
  const [items, setItems] = useState([]);
  const [kategoriOptions, setKategoriOptions] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [uksRoomId, setUksRoomId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('all');
  const [filterKategori, setFilterKategori] = useState('all');
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data }, { data: metaData }, { data: roomsData }] = await Promise.all([
        api.get('/uks/aset'),
        api.get('/uks/aset/meta'),
        api.get('/rooms'),
      ]);
      setItems(data.items || []);
      setUksRoomId(data.room?.id || '');
      setKategoriOptions(metaData.kategori_alat_bahan || []);
      setRooms(roomsData || []);
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
        aset_tipe: item.aset_tipe, nama: item.nama, kategori: item.kategori || '', satuan: item.satuan || '',
        jumlah_baik: item.jumlah_baik || 0, jumlah_rusak: item.jumlah_rusak || 0,
        lokasi_penyimpanan: item.lokasi_penyimpanan || '', ruangan_id: item.ruangan_id || uksRoomId,
        keterangan: item.keterangan || '',
      });
    } else {
      setEditing(null);
      setForm({ ...EMPTY_FORM, ruangan_id: uksRoomId });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nama.trim()) { toast.error('Nama aset wajib diisi'); return; }
    setSaving(true);
    try {
      const payload = { ...form, jumlah_baik: Number(form.jumlah_baik) || 0, jumlah_rusak: Number(form.jumlah_rusak) || 0 };
      if (editing) {
        await api.put(`/uks/aset/${editing.aset_tipe}/${editing.id}`, payload);
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

  const handleDelete = async (item) => {
    if (!window.confirm(`Hapus "${item.nama}"?`)) return;
    try {
      await api.delete(`/uks/aset/${item.aset_tipe}/${item.id}`);
      toast.success('Aset dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const filtered = items.filter((item) => {
    if (filterJenis !== 'all' && item.aset_tipe !== filterJenis) return false;
    if (filterKategori !== 'all' && item.kategori !== filterKategori) return false;
    if (!search) return true;
    return (item.nama || '').toLowerCase().includes(search.toLowerCase());
  });

  const stats = {
    totalItem: items.length,
    totalBaik: items.reduce((sum, i) => sum + (i.jumlah_baik || 0), 0),
    totalRusak: items.reduce((sum, i) => sum + (i.jumlah_rusak || 0), 0),
    totalTetap: items.filter((i) => i.aset_tipe === 'tetap').length,
    totalLancar: items.filter((i) => i.aset_tipe === 'lancar').length,
  };

  return (
    <div className="space-y-6" data-testid="admin-uks-aset-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <HeartPulse className="h-3 w-3 mr-1" /> Menu UKS
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Aset UKS</h1>
          <p className="text-sm text-slate-600 mt-1">Kelola peralatan dan aset milik UKS (terintegrasi dengan data Sarpras)</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Tambah Aset
        </Button>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-5 grid-spacing-dense">
          <LabKPI label="Total Item" value={stats.totalItem} icon={Boxes} color="slate" />
          <LabKPI label="Jumlah Baik" value={stats.totalBaik} icon={CheckCircle2} color="emerald" />
          <LabKPI label="Jumlah Rusak" value={stats.totalRusak} icon={AlertTriangle} color="rose" />
          <LabKPI label="Aset Tetap" value={stats.totalTetap} icon={Package} color="blue" />
          <LabKPI label="Aset Lancar" value={stats.totalLancar} icon={Layers} color="amber" />
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Cari nama aset..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterJenis} onValueChange={setFilterJenis}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                <SelectItem value="tetap">Aset Tetap</SelectItem>
                <SelectItem value="lancar">Aset Lancar</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterKategori} onValueChange={setFilterKategori}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {kategoriOptions.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
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
                    <TableHead className="w-10">NO</TableHead>
                    <TableHead>NAMA ASET</TableHead>
                    <TableHead>JENIS</TableHead>
                    <TableHead>KATEGORI</TableHead>
                    <TableHead className="text-center">JUMLAH BAIK</TableHead>
                    <TableHead className="text-center">JUMLAH RUSAK</TableHead>
                    <TableHead>SATUAN</TableHead>
                    <TableHead>RUANG</TableHead>
                    <TableHead>LOKASI PENYIMPANAN</TableHead>
                    <TableHead className="text-right">AKSI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-12 text-slate-500">
                        <HeartPulse className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Belum ada data aset</div>
                        <div className="text-xs mt-1">Klik "Tambah Aset" untuk mulai mendata</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item, idx) => (
                      <TableRow key={`${item.aset_tipe}-${item.id}`}>
                        <TableCell className="text-sm text-slate-500">{idx + 1}</TableCell>
                        <TableCell className="font-semibold">{item.nama}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{JENIS_LABELS[item.aset_tipe] || item.aset_tipe}</Badge></TableCell>
                        <TableCell>{item.kategori ? <Badge variant="outline" className="text-xs">{item.kategori}</Badge> : '-'}</TableCell>
                        <TableCell className="text-center font-mono text-emerald-700">{item.jumlah_baik}</TableCell>
                        <TableCell className="text-center font-mono text-rose-600">{item.jumlah_rusak}</TableCell>
                        <TableCell className="text-sm">{item.satuan || '-'}</TableCell>
                        <TableCell className="text-sm">{item.ruangan_nama || '-'}</TableCell>
                        <TableCell className="text-sm">{item.lokasi_penyimpanan || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openModal(item)} className="text-blue-600 hover:text-blue-700">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(item)} className="text-rose-600 hover:text-rose-700">
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Aset' : 'Tambah Aset Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Aset <span className="text-rose-500">*</span></Label>
              <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Jenis</Label>
              <Select value={form.aset_tipe} onValueChange={(v) => setForm({ ...form, aset_tipe: v })} disabled={!!editing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tetap">Aset Tetap (alat)</SelectItem>
                  <SelectItem value="lancar">Aset Lancar (bahan habis pakai)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select value={form.kategori || 'none'} onValueChange={(v) => setForm({ ...form, kategori: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih Kategori" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih Kategori</SelectItem>
                    {kategoriOptions.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Satuan</Label>
                <Input value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value })} placeholder="unit, pcs, botol, box" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jumlah Kondisi Baik</Label>
                <Input type="number" min="0" value={form.jumlah_baik} onChange={(e) => setForm({ ...form, jumlah_baik: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jumlah Rusak</Label>
                <Input type="number" min="0" value={form.jumlah_rusak} onChange={(e) => setForm({ ...form, jumlah_rusak: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ruang</Label>
              <Select value={form.ruangan_id || undefined} onValueChange={(v) => setForm({ ...form, ruangan_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih ruangan..." /></SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">Otomatis terpilih Ruang UKS. Ubah jika aset disimpan di ruangan lain.</p>
            </div>
            <div className="space-y-2">
              <Label>Lokasi Penyimpanan</Label>
              <Input value={form.lokasi_penyimpanan} onChange={(e) => setForm({ ...form, lokasi_penyimpanan: e.target.value })} placeholder="Lemari Obat, Rak P3K, dsb." />
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
