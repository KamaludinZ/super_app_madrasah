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
import { BookOpenCheck, Plus, Trash2, Loader2, Save, FlaskConical, Monitor } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const LAB_META = { ipa: { title: 'Lab IPA', icon: FlaskConical }, komputer: { title: 'Lab Komputer', icon: Monitor } };
const emptyForm = { tanggal: new Date().toISOString().split('T')[0], jam_mulai: '', jam_selesai: '', kegiatan: '', penanggung_jawab_id: '', kondisi_setelah: '', keterangan: '' };

export default function LabJurnalPenggunaanPage() {
  const { labKey } = useParams();
  const meta = LAB_META[labKey] || LAB_META.ipa;
  const [list, setList] = useState([]);
  const [wargaList, setWargaList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, [labKey]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, wargaRes] = await Promise.all([
        api.get(`/lab/${labKey}/jurnal-penggunaan`),
        api.get(`/lab/${labKey}/warga-madrasah`),
      ]);
      setList(res.data || []);
      setWargaList(wargaRes.data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat jurnal penggunaan lab');
    } finally {
      setLoading(false);
    }
  };

  const openModal = () => { setForm(emptyForm); setShowModal(true); };

  const handleSave = async () => {
    if (!form.tanggal || !form.kegiatan) {
      toast.error('Tanggal dan kegiatan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, penanggung_jawab_id: form.penanggung_jawab_id || null };
      await api.post(`/lab/${labKey}/jurnal-penggunaan`, payload);
      toast.success('Jurnal penggunaan berhasil dicatat');
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
      await api.delete(`/lab/${labKey}/jurnal-penggunaan/${id}`);
      toast.success('Jurnal dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  return (
    <div className="space-y-6" data-testid={`lab-${labKey}-jurnal-penggunaan-page`}>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <meta.icon className="h-3 w-3 mr-1" /> {meta.title}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Jurnal Penggunaan Lab</h1>
          <p className="text-sm text-slate-600 mt-1">Catat riwayat penggunaan harian {meta.title}</p>
        </div>
        <Button onClick={openModal} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Catat Penggunaan
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
                    <TableHead>Kegiatan</TableHead>
                    <TableHead>Penanggung Jawab</TableHead>
                    <TableHead>Kondisi Setelah</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500">
                      <BookOpenCheck className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <div className="font-semibold">Belum ada jurnal penggunaan lab</div>
                    </TableCell></TableRow>
                  ) : (
                    list.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.tanggal} {item.jam_mulai ? `· ${item.jam_mulai}` : ''}</TableCell>
                        <TableCell className="max-w-xs"><div className="line-clamp-2">{item.kegiatan}</div></TableCell>
                        <TableCell>{item.penanggung_jawab_nama || '-'}</TableCell>
                        <TableCell>{item.kondisi_setelah || '-'}</TableCell>
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
          <DialogHeader><DialogTitle>Catat Penggunaan Lab</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
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
              <Label>Kegiatan <span className="text-rose-500">*</span></Label>
              <Textarea rows={2} value={form.kegiatan} onChange={(e) => setForm({ ...form, kegiatan: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Penanggung Jawab</Label>
              <Select value={form.penanggung_jawab_id || 'none'} onValueChange={(v) => setForm({ ...form, penanggung_jawab_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Penanggung Jawab" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada</SelectItem>
                  {wargaList.map((w) => <SelectItem key={w.id} value={w.id}>{w.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Kondisi Setelah Digunakan</Label>
              <Input value={form.kondisi_setelah} onChange={(e) => setForm({ ...form, kondisi_setelah: e.target.value })} />
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
