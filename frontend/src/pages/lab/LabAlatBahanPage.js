import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Package, Loader2, Plus, Pencil, Trash2, Search, Boxes, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import LabKPI from './LabKPI';
import { LAB_META } from './LabMeta';

const EMPTY_FORM = { aset_tipe: 'tetap', nama: '', kategori: '', satuan: '', jumlah_baik: 0, jumlah_rusak: 0, lokasi_penyimpanan: '', ruangan_id: '', keterangan: '' };
const JENIS_LABELS = { tetap: 'Aset Tetap', lancar: 'Aset Lancar' };

export default function LabAlatBahanPage() {
  const { labKey } = useParams();
  const meta = LAB_META[labKey] || LAB_META.ipa;
  const [items, setItems] = useState([]);
  const [kategoriOptions, setKategoriOptions] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [labRoomId, setLabRoomId] = useState('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('all');
  const [filterJenis, setFilterJenis] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, [labKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data }, { data: metaData }, { data: roomsData }] = await Promise.all([
        api.get(`/lab/${labKey}/alat-bahan`),
        api.get(`/lab/${labKey}/meta`),
        api.get('/rooms'),
      ]);
      setItems(data.items || []);
      setKategoriOptions(metaData.kategori_alat_bahan || []);
      setRooms(roomsData || []);
      setLabRoomId(data.room?.id || '');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat data alat dan bahan lab');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY_FORM, ruangan_id: labRoomId }); setOpen(true); };
  const openEdit = (item) => {
    setEditing(item);
    setForm({
      aset_tipe: item.aset_tipe, nama: item.nama, kategori: item.kategori || '', satuan: item.satuan || '',
      jumlah_baik: item.jumlah_baik || 0, jumlah_rusak: item.jumlah_rusak || 0,
      lokasi_penyimpanan: item.lokasi_penyimpanan || '', ruangan_id: item.ruangan_id || labRoomId,
      keterangan: item.keterangan || '',
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.nama.trim()) {
      toast.error('Nama Alat/Bahan wajib diisi');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form, jumlah_baik: Number(form.jumlah_baik) || 0, jumlah_rusak: Number(form.jumlah_rusak) || 0 };
      if (editing) {
        await api.put(`/lab/${labKey}/alat-bahan/${editing.aset_tipe}/${editing.id}`, payload);
        toast.success('Data alat/bahan berhasil diperbarui');
      } else {
        await api.post(`/lab/${labKey}/alat-bahan`, payload);
        toast.success('Data alat/bahan berhasil ditambahkan');
      }
      setOpen(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Hapus "${item.nama}"?`)) return;
    try {
      await api.delete(`/lab/${labKey}/alat-bahan/${item.aset_tipe}/${item.id}`);
      toast.success('Data berhasil dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const filtered = items.filter((i) => {
    if (filterKategori !== 'all' && i.kategori !== filterKategori) return false;
    if (filterJenis !== 'all' && i.aset_tipe !== filterJenis) return false;
    if (!search) return true;
    return (i.nama || '').toLowerCase().includes(search.toLowerCase());
  });

  const stats = {
    totalItem: items.length,
    totalBaik: items.reduce((sum, i) => sum + (i.jumlah_baik || 0), 0),
    totalRusak: items.reduce((sum, i) => sum + (i.jumlah_rusak || 0), 0),
    totalTetap: items.filter((i) => i.aset_tipe === 'tetap').length,
    totalLancar: items.filter((i) => i.aset_tipe === 'lancar').length,
  };

  return (
    <div className="space-y-6" data-testid={`lab-${labKey}-alat-bahan-page`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <meta.icon className="h-3 w-3 mr-1" /> {meta.title}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Daftar Inventaris Alat & Bahan {meta.title}</h1>
          <p className="text-sm text-slate-600 mt-1">Kelola alat dan bahan yang tersedia di {meta.title}</p>
        </div>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
          <Plus className="h-4 w-4" /> Tambah Alat/Bahan
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Cari nama alat, bahan, atau spesifikasi..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">NO</TableHead>
                  <TableHead>NAMA ALAT/BAHAN</TableHead>
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
                {loading ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-slate-500"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-12 text-slate-500">
                    <Package className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <div className="font-semibold">Belum ada alat/bahan terdaftar di lab ini</div>
                  </TableCell></TableRow>
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
                          <Button size="icon" variant="ghost" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(item)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Alat/Bahan' : 'Tambah Alat/Bahan'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Nama Alat/Bahan *</Label>
              <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} />
            </div>
            <div>
              <Label>Jenis</Label>
              <Select value={form.aset_tipe} onValueChange={(v) => setForm({ ...form, aset_tipe: v })} disabled={!!editing}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tetap">Aset Tetap (alat)</SelectItem>
                  <SelectItem value="lancar">Aset Lancar (bahan habis pakai)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Kategori</Label>
                <Select value={form.kategori || undefined} onValueChange={(v) => setForm({ ...form, kategori: v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori..." /></SelectTrigger>
                  <SelectContent>
                    {kategoriOptions.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Satuan</Label>
                <Input value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value })} placeholder="unit, pcs, botol, gram" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Jumlah Kondisi Baik</Label>
                <Input type="number" min="0" value={form.jumlah_baik} onChange={(e) => setForm({ ...form, jumlah_baik: e.target.value })} />
              </div>
              <div>
                <Label>Jumlah Rusak</Label>
                <Input type="number" min="0" value={form.jumlah_rusak} onChange={(e) => setForm({ ...form, jumlah_rusak: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Ruang</Label>
              <Select value={form.ruangan_id || undefined} onValueChange={(v) => setForm({ ...form, ruangan_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih ruangan..." /></SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Otomatis terpilih {meta.title}. Ubah jika alat/bahan disimpan di ruangan lain.</p>
            </div>
            <div>
              <Label>Lokasi Penyimpanan</Label>
              <Input value={form.lokasi_penyimpanan} onChange={(e) => setForm({ ...form, lokasi_penyimpanan: e.target.value })} placeholder="Lemari A1, Rak Glassware, dsb." />
            </div>
            <div>
              <Label>Keterangan</Label>
              <Textarea value={form.keterangan} onChange={(e) => setForm({ ...form, keterangan: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Batal</Button>
            <Button onClick={handleSubmit} disabled={submitting} className="bg-[#006837] hover:bg-[#0B7A3B]">
              {submitting ? 'Menyimpan...' : 'Simpan Data'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
