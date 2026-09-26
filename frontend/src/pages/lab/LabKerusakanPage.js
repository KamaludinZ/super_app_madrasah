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
import { AlertOctagon, Plus, Pencil, Trash2, Loader2, Save, ListChecks, Wrench, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import LabPeminjamPicker from './LabPeminjamPicker';
import LabKPI from './LabKPI';
import { LAB_META } from './LabMeta';
import { confirmDialog } from '@/components/ui/confirm-dialog';
const STATUS_BADGE = {
  Diajukan: 'bg-blue-100 text-blue-700 border-blue-200',
  'Proses Ganti': 'bg-amber-100 text-amber-700 border-amber-200',
  'Selesai Diganti': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};
const emptyForm = {
  aset_tipe: 'room', aset_id: '', tanggal_lapor: new Date().toISOString().split('T')[0], pelapor_id: '',
  jumlah_rusak: 1, deskripsi_kerusakan: '', status: 'Diajukan',
  tanggal_perbaikan: '', biaya_perbaikan: '', hasil_perbaikan: '',
};

export default function LabKerusakanPage() {
  const { labKey } = useParams();
  const meta = LAB_META[labKey] || LAB_META.ipa;
  const [list, setList] = useState([]);
  const [labData, setLabData] = useState(null);
  const [metaData, setMetaData] = useState({ kerusakan_status: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, [labKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, labRes, metaRes] = await Promise.all([
        api.get(`/lab/${labKey}/kerusakan`),
        api.get(`/lab/${labKey}/alat-bahan`),
        api.get(`/lab/${labKey}/meta`),
      ]);
      setList(res.data || []);
      setLabData(labRes.data);
      setMetaData(metaRes.data || { kerusakan_status: [] });
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat laporan kerusakan');
    } finally {
      setLoading(false);
    }
  };

  const assetOptions = form.aset_tipe === 'tetap' ? (labData?.aset_tetap || [])
    : form.aset_tipe === 'lancar' ? (labData?.aset_lancar || [])
    : (labData?.room ? [labData.room] : []);

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({
        aset_tipe: item.aset_tipe, aset_id: item.aset_id, tanggal_lapor: item.tanggal_lapor,
        pelapor_id: item.pelapor_id || '', jumlah_rusak: item.jumlah_rusak ?? 1,
        deskripsi_kerusakan: item.deskripsi_kerusakan || '', status: item.status || 'Diajukan',
        tanggal_perbaikan: item.tanggal_perbaikan || '', biaya_perbaikan: item.biaya_perbaikan ?? '',
        hasil_perbaikan: item.hasil_perbaikan || '',
      });
    } else {
      setEditing(null);
      setForm({ ...emptyForm, aset_id: labData?.room?.id || '' });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.aset_id || !form.tanggal_lapor || !form.deskripsi_kerusakan) {
      toast.error('Nama Alat, Tanggal Kejadian, dan Penyebab/Kronologi wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form, pelapor_id: form.pelapor_id || null, jumlah_rusak: Number(form.jumlah_rusak) || 1,
        biaya_perbaikan: form.biaya_perbaikan === '' ? null : Number(form.biaya_perbaikan),
      };
      if (editing) {
        await api.put(`/lab/${labKey}/kerusakan/${editing.id}`, payload);
        toast.success('Laporan berhasil diperbarui');
      } else {
        await api.post(`/lab/${labKey}/kerusakan`, payload);
        toast.success('Laporan berhasil ditambahkan');
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
      await api.delete(`/lab/${labKey}/kerusakan/${id}`);
      toast.success('Laporan dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const stats = {
    total: list.length,
    diajukan: list.filter((i) => i.status === 'Diajukan').length,
    prosesGanti: list.filter((i) => i.status === 'Proses Ganti').length,
    selesai: list.filter((i) => i.status === 'Selesai Diganti').length,
  };

  return (
    <div className="space-y-6" data-testid={`lab-${labKey}-kerusakan-page`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <meta.icon className="h-3 w-3 mr-1" /> {meta.title}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Laporan & Penggantian Alat Rusak/Pecah</h1>
          <p className="text-sm text-slate-600 mt-1">Pencatatan kerusakan alat selama praktikum dan proses tindak lanjut ganti rugi/pengadaan.</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-rose-600 hover:bg-rose-700">
          <Plus className="h-4 w-4" /> Laporkan Alat Rusak
        </Button>
      </div>

      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 grid-spacing-dense">
          <LabKPI label="Total Laporan" value={stats.total} icon={ListChecks} color="slate" />
          <LabKPI label="Diajukan" value={stats.diajukan} icon={AlertOctagon} color="blue" />
          <LabKPI label="Proses Ganti" value={stats.prosesGanti} icon={Wrench} color="amber" />
          <LabKPI label="Selesai Diganti" value={stats.selesai} icon={CheckCircle2} color="emerald" />
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
                    <TableHead>TANGGAL LAPOR</TableHead>
                    <TableHead>PELAPOR</TableHead>
                    <TableHead>NAMA ALAT</TableHead>
                    <TableHead className="text-center">JUMLAH RUSAK</TableHead>
                    <TableHead>PENYEBAB/KETERANGAN</TableHead>
                    <TableHead>STATUS PENGGANTIAN</TableHead>
                    <TableHead className="text-right">AKSI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-12 text-slate-500">
                      <AlertOctagon className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Belum ada laporan kerusakan</div>
                    </TableCell></TableRow>
                  ) : (
                    list.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm text-slate-500">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-sm">{item.tanggal_lapor}</TableCell>
                        <TableCell className="text-sm">{item.pelapor_nama || '-'}</TableCell>
                        <TableCell className="font-semibold text-rose-600">{item.aset_nama}</TableCell>
                        <TableCell className="text-center font-mono">{item.jumlah_rusak ?? '-'}</TableCell>
                        <TableCell className="max-w-xs"><div className="line-clamp-2 text-sm">{item.deskripsi_kerusakan}</div></TableCell>
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
          <DialogHeader><DialogTitle>{editing ? 'Edit Laporan Alat Rusak / Ganti Rugi' : 'Laporan Alat Rusak / Ganti Rugi'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Jenis Objek</Label>
              <Select value={form.aset_tipe} onValueChange={(v) => setForm({ ...form, aset_tipe: v, aset_id: v === 'room' ? (labData?.room?.id || '') : '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="room">Ruangan {meta.title}</SelectItem>
                  <SelectItem value="tetap">Aset Tetap</SelectItem>
                  <SelectItem value="lancar">Aset Lancar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.aset_tipe !== 'room' && (
              <div className="space-y-2">
                <Label>Nama Alat <span className="text-rose-500">*</span></Label>
                <Select value={form.aset_id || 'none'} onValueChange={(v) => setForm({ ...form, aset_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih Alat" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih Alat</SelectItem>
                    {assetOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.nama_aset || a.nama_barang}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <LabPeminjamPicker
              labKey={labKey}
              value={form.pelapor_id}
              onChange={(v) => setForm({ ...form, pelapor_id: v })}
              label="Pelapor / Pengguna"
            />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Jumlah Rusak</Label>
                <Input type="number" min="1" value={form.jumlah_rusak} onChange={(e) => setForm({ ...form, jumlah_rusak: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Kejadian <span className="text-rose-500">*</span></Label>
                <Input type="date" value={form.tanggal_lapor} onChange={(e) => setForm({ ...form, tanggal_lapor: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Penyebab / Kronologi Kerusakan <span className="text-rose-500">*</span></Label>
              <Textarea rows={2} value={form.deskripsi_kerusakan} onChange={(e) => setForm({ ...form, deskripsi_kerusakan: e.target.value })} placeholder="Jatuh saat praktikum, retak terkena panas, dsb." />
            </div>
            <div className="space-y-2">
              <Label>Status Penggantian</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(metaData.kerusakan_status || []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tanggal Penggantian</Label>
                <Input type="date" value={form.tanggal_perbaikan} onChange={(e) => setForm({ ...form, tanggal_perbaikan: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Biaya Penggantian (Rp)</Label>
                <Input type="number" min="0" value={form.biaya_perbaikan} onChange={(e) => setForm({ ...form, biaya_perbaikan: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Keterangan Penggantian</Label>
              <Textarea rows={2} value={form.hasil_perbaikan} onChange={(e) => setForm({ ...form, hasil_perbaikan: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={saving}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 bg-rose-600 hover:bg-rose-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Laporan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
