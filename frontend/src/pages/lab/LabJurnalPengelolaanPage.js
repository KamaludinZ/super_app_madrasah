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
import { ClipboardList, Plus, Trash2, Loader2, Save, FlaskConical, Monitor } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const LAB_META = { ipa: { title: 'Lab IPA', icon: FlaskConical }, komputer: { title: 'Lab Komputer', icon: Monitor } };
const emptyForm = { aset_tipe: 'room', aset_id: '', tanggal: new Date().toISOString().split('T')[0], jenis_perawatan: '', petugas_pelaksana: '', biaya: '', hasil: '', keterangan: '' };

export default function LabJurnalPengelolaanPage() {
  const { labKey } = useParams();
  const meta = LAB_META[labKey] || LAB_META.ipa;
  const [list, setList] = useState([]);
  const [labData, setLabData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, [labKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, labRes] = await Promise.all([
        api.get(`/lab/${labKey}/jurnal-pengelolaan`),
        api.get(`/lab/${labKey}/alat-bahan`),
      ]);
      setList(res.data || []);
      setLabData(labRes.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat jurnal pengelolaan');
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => { setForm({ ...emptyForm, aset_id: labData?.room?.id || '' }); setShowModal(true); };

  const assetOptions = form.aset_tipe === 'tetap' ? (labData?.aset_tetap || [])
    : form.aset_tipe === 'lancar' ? (labData?.aset_lancar || [])
    : (labData?.room ? [labData.room] : []);

  const handleSave = async () => {
    if (!form.aset_id || !form.tanggal || !form.jenis_perawatan) {
      toast.error('Objek, tanggal, dan jenis perawatan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, biaya: form.biaya === '' ? null : Number(form.biaya) };
      await api.post(`/lab/${labKey}/jurnal-pengelolaan`, payload);
      toast.success('Jurnal pengelolaan berhasil dicatat');
      setShowModal(false);
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menyimpan data');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus jurnal ini?')) return;
    try {
      await api.delete(`/lab/${labKey}/jurnal-pengelolaan/${id}`);
      toast.success('Jurnal dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  return (
    <div className="space-y-6" data-testid={`lab-${labKey}-jurnal-pengelolaan-page`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <meta.icon className="h-3 w-3 mr-1" /> {meta.title}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Jurnal Pengelolaan</h1>
          <p className="text-sm text-slate-600 mt-1">Catat kegiatan perawatan/pengelolaan ruangan dan alat {meta.title}</p>
        </div>
        <Button onClick={openModal} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Catat Pengelolaan
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Objek</TableHead>
                    <TableHead>Jenis Perawatan</TableHead>
                    <TableHead>Petugas</TableHead>
                    <TableHead className="text-right">Biaya</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">
                      <ClipboardList className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Belum ada jurnal pengelolaan</div>
                    </TableCell></TableRow>
                  ) : (
                    list.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.tanggal}</TableCell>
                        <TableCell className="font-semibold">{item.aset_nama}</TableCell>
                        <TableCell><Badge variant="outline">{item.jenis_perawatan}</Badge></TableCell>
                        <TableCell>{item.petugas_pelaksana || '-'}</TableCell>
                        <TableCell className="text-right font-mono">{item.biaya ? `Rp${Number(item.biaya).toLocaleString('id-ID')}` : '-'}</TableCell>
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
          <DialogHeader><DialogTitle>Catat Pengelolaan</DialogTitle></DialogHeader>
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
                <Label>Objek <span className="text-rose-500">*</span></Label>
                <Select value={form.aset_id || 'none'} onValueChange={(v) => setForm({ ...form, aset_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih Objek" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Pilih Objek</SelectItem>
                    {assetOptions.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nama_aset || a.nama_barang || a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Tanggal <span className="text-rose-500">*</span></Label>
              <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Jenis Perawatan <span className="text-rose-500">*</span></Label>
              <Input value={form.jenis_perawatan} onChange={(e) => setForm({ ...form, jenis_perawatan: e.target.value })} placeholder="Servis Rutin, Pembersihan, Kalibrasi" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Petugas Pelaksana</Label>
                <Input value={form.petugas_pelaksana} onChange={(e) => setForm({ ...form, petugas_pelaksana: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Biaya (Rp)</Label>
                <Input type="number" min="0" value={form.biaya} onChange={(e) => setForm({ ...form, biaya: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Hasil</Label>
              <Textarea rows={2} value={form.hasil} onChange={(e) => setForm({ ...form, hasil: e.target.value })} />
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
