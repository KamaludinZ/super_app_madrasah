import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ClipboardPlus, Plus, Pencil, Trash2, Loader2, Save } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';

const emptyForm = { nama: '', deskripsi: '', urutan: 0 };

export default function AdminUKSJenisPenangananPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/uks/jenis-penanganan');
      setList(res.data || []);
    } catch (e) {
      toast.error('Gagal memuat data jenis penanganan');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({ nama: item.nama || '', deskripsi: item.deskripsi || '', urutan: item.urutan || 0 });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.nama) { toast.error('Nama jenis penanganan wajib diisi'); return; }
    setSaving(true);
    try {
      const payload = { ...form, urutan: Number(form.urutan) || 0 };
      if (editing) {
        await api.put(`/uks/jenis-penanganan/${editing.id}`, payload);
        toast.success('Jenis penanganan berhasil diperbarui');
      } else {
        await api.post('/uks/jenis-penanganan', payload);
        toast.success('Jenis penanganan berhasil ditambahkan');
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
    if (!(await confirmDialog('Yakin ingin menghapus jenis penanganan ini?'))) return;
    try {
      await api.delete(`/uks/jenis-penanganan/${id}`);
      toast.success('Jenis penanganan dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-uks-jenis-penanganan-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <ClipboardPlus className="h-3 w-3 mr-1" /> Menu UKS
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Jenis Penanganan</h1>
          <p className="text-sm text-slate-600 mt-1">Kelola daftar jenis penanganan kesehatan di UKS</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Tambah Jenis Penanganan
        </Button>
      </div>

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
                    <TableHead className="w-12">NO</TableHead>
                    <TableHead>NAMA JENIS PENANGANAN</TableHead>
                    <TableHead>DESKRIPSI</TableHead>
                    <TableHead className="w-24">URUTAN</TableHead>
                    <TableHead className="text-right">AKSI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                        <ClipboardPlus className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Belum ada jenis penanganan</div>
                        <div className="text-xs mt-1">Klik "Tambah Jenis Penanganan" untuk memulai</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    list.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-center text-slate-500 font-mono">{idx + 1}</TableCell>
                        <TableCell className="font-semibold">{item.nama}</TableCell>
                        <TableCell className="max-w-md"><div className="line-clamp-2">{item.deskripsi || '-'}</div></TableCell>
                        <TableCell className="text-center font-mono">{item.urutan}</TableCell>
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
            <DialogTitle>{editing ? 'Edit Jenis Penanganan' : 'Tambah Jenis Penanganan Baru'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nama Jenis Penanganan <span className="text-rose-500">*</span></Label>
              <Input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Contoh: P3K Ringan, Rujukan Puskesmas" />
            </div>
            <div className="space-y-2">
              <Label>Deskripsi</Label>
              <Textarea rows={3} value={form.deskripsi} onChange={(e) => setForm({ ...form, deskripsi: e.target.value })} placeholder="Deskripsi (opsional)" />
            </div>
            <div className="space-y-2">
              <Label>Urutan</Label>
              <Input type="number" value={form.urutan} onChange={(e) => setForm({ ...form, urutan: e.target.value })} />
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
