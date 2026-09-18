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
import { Home, Plus, Pencil, Trash2, Loader2, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const emptyForm = {
  siswa_id: '',
  tanggal: new Date().toISOString().split('T')[0],
  tujuan: '',
  hasil_kunjungan: '',
  pihak_ditemui: '',
  rekomendasi: '',
};

export default function AdminBKHomeVisitPage() {
  const [list, setList] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, studentsRes] = await Promise.all([
        api.get('/bk/home-visit'),
        api.get('/students'),
      ]);
      setList(res.data || []);
      setStudents(studentsRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data home visit');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    if (item) {
      setEditing(item);
      setForm({
        siswa_id: item.siswa_id || '',
        tanggal: item.tanggal || '',
        tujuan: item.tujuan || '',
        hasil_kunjungan: item.hasil_kunjungan || '',
        pihak_ditemui: item.pihak_ditemui || '',
        rekomendasi: item.rekomendasi || '',
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.siswa_id || !form.tanggal || !form.tujuan || !form.hasil_kunjungan) {
      toast.error('Siswa, tanggal, tujuan, dan hasil kunjungan wajib diisi');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/bk/home-visit/${editing.id}`, form);
        toast.success('Jurnal home visit berhasil diperbarui');
      } else {
        await api.post('/bk/home-visit', form);
        toast.success('Jurnal home visit berhasil ditambahkan');
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
    if (!window.confirm('Yakin ingin menghapus jurnal home visit ini?')) return;
    try {
      await api.delete(`/bk/home-visit/${id}`);
      toast.success('Jurnal home visit dihapus');
      loadData();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus data');
    }
  };

  const filtered = list.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (item.siswa_nama || '').toLowerCase().includes(q) ||
      (item.siswa_nis || '').toLowerCase().includes(q) ||
      (item.tujuan || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6" data-testid="admin-bk-home-visit-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Home className="h-3 w-3 mr-1" /> Menu BK
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Jurnal Home Visit</h1>
          <p className="text-sm text-slate-600 mt-1">Catat kunjungan rumah dan hasil koordinasi dengan orang tua/wali</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Input Home Visit
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Cari nama, NIS, atau tujuan..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Siswa</TableHead>
                    <TableHead>Tujuan</TableHead>
                    <TableHead>Pihak Ditemui</TableHead>
                    <TableHead>Hasil Kunjungan</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                        <Home className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Belum ada jurnal home visit</div>
                        <div className="text-xs mt-1">Klik "Input Home Visit" untuk mulai mencatat</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.tanggal}</TableCell>
                        <TableCell className="font-semibold">{item.siswa_nama}<div className="text-xs text-slate-500 font-normal">{item.siswa_nis}</div></TableCell>
                        <TableCell className="max-w-xs"><div className="line-clamp-2">{item.tujuan}</div></TableCell>
                        <TableCell>{item.pihak_ditemui || '-'}</TableCell>
                        <TableCell className="max-w-sm"><div className="line-clamp-2">{item.hasil_kunjungan}</div></TableCell>
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
            <DialogTitle>{editing ? 'Edit Jurnal Home Visit' : 'Input Jurnal Home Visit'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Siswa <span className="text-rose-500">*</span></Label>
              <Select value={form.siswa_id || 'none'} onValueChange={(v) => setForm({ ...form, siswa_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Siswa" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Siswa</SelectItem>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nis} - {s.full_name} {s.class_name ? `(${s.class_name})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tanggal <span className="text-rose-500">*</span></Label>
              <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tujuan <span className="text-rose-500">*</span></Label>
              <Textarea rows={2} value={form.tujuan} onChange={(e) => setForm({ ...form, tujuan: e.target.value })} placeholder="Tujuan kunjungan rumah" />
            </div>
            <div className="space-y-2">
              <Label>Pihak Ditemui</Label>
              <Input value={form.pihak_ditemui} onChange={(e) => setForm({ ...form, pihak_ditemui: e.target.value })} placeholder="Contoh: Orang Tua, Wali, Kakak" />
            </div>
            <div className="space-y-2">
              <Label>Hasil Kunjungan <span className="text-rose-500">*</span></Label>
              <Textarea rows={3} value={form.hasil_kunjungan} onChange={(e) => setForm({ ...form, hasil_kunjungan: e.target.value })} placeholder="Uraikan hasil kunjungan" />
            </div>
            <div className="space-y-2">
              <Label>Rekomendasi</Label>
              <Textarea rows={2} value={form.rekomendasi} onChange={(e) => setForm({ ...form, rekomendasi: e.target.value })} placeholder="Rekomendasi tindak lanjut (opsional)" />
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
