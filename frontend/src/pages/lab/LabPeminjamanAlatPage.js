import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Handshake, Plus, Pencil, Trash2, Loader2, Save, ListChecks, CheckCircle2, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import LabPeminjamPicker from './LabPeminjamPicker';
import LabKPI from './LabKPI';
import { LAB_META } from './LabMeta';
const STATUS_LIST = ['Dipinjam', 'Dikembalikan', 'Terlambat', 'Hilang/Rusak'];
const STATUS_BADGE = {
  Dipinjam: 'bg-blue-100 text-blue-700 border-blue-200',
  Dikembalikan: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Terlambat: 'bg-amber-100 text-amber-700 border-amber-200',
  'Hilang/Rusak': 'bg-rose-100 text-rose-700 border-rose-200',
};
const emptyForm = { aset_tipe: 'tetap', aset_id: '', peminjam_id: '', tanggal_pinjam: new Date().toISOString().split('T')[0], tanggal_kembali_rencana: '', tanggal_kembali_aktual: '', jumlah: 1, status: 'Dipinjam', keperluan: '', catatan: '' };

export default function LabPeminjamanAlatPage() {
  const { labKey } = useParams();
  const meta = LAB_META[labKey] || LAB_META.ipa;
  const [list, setList] = useState([]);
  const [labData, setLabData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, [labKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, labRes] = await Promise.all([
        api.get(`/lab/${labKey}/peminjaman-alat`),
        api.get(`/lab/${labKey}/alat-bahan`),
      ]);
      setList(res.data || []);
      setLabData(labRes.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat data peminjaman alat');
    } finally {
      setLoading(false);
    }
  };

  const assetOptions = form.aset_tipe === 'tetap' ? (labData?.aset_tetap || []) : (labData?.aset_lancar || []);

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({ aset_tipe: item.aset_tipe, aset_id: item.aset_id, peminjam_id: item.peminjam_id, tanggal_pinjam: item.tanggal_pinjam, tanggal_kembali_rencana: item.tanggal_kembali_rencana || '', tanggal_kembali_aktual: item.tanggal_kembali_aktual || '', jumlah: item.jumlah ?? 1, status: item.status || 'Dipinjam', keperluan: item.keperluan || '', catatan: item.catatan || '' });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.aset_id || !form.peminjam_id || !form.tanggal_pinjam) {
      toast.error('Alat, peminjam, dan tanggal pinjam wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, jumlah: Number(form.jumlah) || 1 };
      if (editing) {
        await api.put(`/lab/${labKey}/peminjaman-alat/${editing.id}`, payload);
        toast.success('Data peminjaman berhasil diperbarui');
      } else {
        await api.post(`/lab/${labKey}/peminjaman-alat`, payload);
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
    if (!window.confirm('Yakin ingin menghapus data ini?')) return;
    try {
      await api.delete(`/lab/${labKey}/peminjaman-alat/${id}`);
      toast.success('Data dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const stats = {
    total: list.length,
    dipinjam: list.filter((i) => i.status === 'Dipinjam').length,
    dikembalikan: list.filter((i) => i.status === 'Dikembalikan').length,
    terlambat: list.filter((i) => i.status === 'Terlambat').length,
  };

  return (
    <div className="space-y-6" data-testid={`lab-${labKey}-peminjaman-alat-page`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <meta.icon className="h-3 w-3 mr-1" /> {meta.title}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Form Peminjaman Alat Laboratorium</h1>
          <p className="text-sm text-slate-600 mt-1">Pengguna dapat mengajukan peminjaman alat untuk praktikum luar ruangan atau pembelajaran khusus.</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Ajukan Peminjaman Baru
        </Button>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 grid-spacing-dense">
          <LabKPI label="Total Peminjaman" value={stats.total} icon={ListChecks} color="slate" />
          <LabKPI label="Sedang Dipinjam" value={stats.dipinjam} icon={Handshake} color="blue" />
          <LabKPI label="Dikembalikan" value={stats.dikembalikan} icon={CheckCircle2} color="emerald" />
          <LabKPI label="Terlambat" value={stats.terlambat} icon={Clock} color="amber" />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">NO</TableHead>
                    <TableHead>NAMA PEMINJAM</TableHead>
                    <TableHead>TANGGAL PINJAM</TableHead>
                    <TableHead>RENCANA KEMBALI</TableHead>
                    <TableHead>ALAT & JUMLAH</TableHead>
                    <TableHead>KEPERLUAN</TableHead>
                    <TableHead>STATUS</TableHead>
                    <TableHead className="text-right">AKSI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-500">
                      <Handshake className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Belum ada data peminjaman alat</div>
                    </TableCell></TableRow>
                  ) : (
                    list.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm text-slate-500">{idx + 1}</TableCell>
                        <TableCell className="font-semibold">{item.peminjam_nama}</TableCell>
                        <TableCell className="font-mono text-sm">{item.tanggal_pinjam}</TableCell>
                        <TableCell className="font-mono text-sm">{item.tanggal_kembali_rencana || '-'}</TableCell>
                        <TableCell>{item.aset_nama} <span className="text-slate-400">({item.jumlah})</span></TableCell>
                        <TableCell className="max-w-xs"><div className="line-clamp-2 text-sm">{item.keperluan || '-'}</div></TableCell>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Peminjaman Alat' : 'Input Peminjaman Alat'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Jenis Alat</Label>
              <Select value={form.aset_tipe} onValueChange={(v) => setForm({ ...form, aset_tipe: v, aset_id: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tetap">Aset Tetap</SelectItem>
                  <SelectItem value="lancar">Aset Lancar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Alat <span className="text-rose-500">*</span></Label>
              <Select value={form.aset_id || 'none'} onValueChange={(v) => setForm({ ...form, aset_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Alat" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Alat</SelectItem>
                  {assetOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.nama_aset || a.nama_barang}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <LabPeminjamPicker
              labKey={labKey}
              value={form.peminjam_id}
              onChange={(v) => setForm({ ...form, peminjam_id: v })}
              label="Peminjam"
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Pinjam <span className="text-rose-500">*</span></Label>
                <Input type="date" value={form.tanggal_pinjam} onChange={(e) => setForm({ ...form, tanggal_pinjam: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Jumlah</Label>
                <Input type="number" min="1" value={form.jumlah} onChange={(e) => setForm({ ...form, jumlah: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rencana Kembali</Label>
                <Input type="date" value={form.tanggal_kembali_rencana} onChange={(e) => setForm({ ...form, tanggal_kembali_rencana: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_LIST.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tanggal Kembali Aktual</Label>
              <Input type="date" value={form.tanggal_kembali_aktual} onChange={(e) => setForm({ ...form, tanggal_kembali_aktual: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Keperluan</Label>
              <Textarea rows={2} value={form.keperluan} onChange={(e) => setForm({ ...form, keperluan: e.target.value })} />
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
