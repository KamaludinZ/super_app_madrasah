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
import { HeartHandshake, Plus, Pencil, Trash2, Loader2, Save, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const JENIS_LAYANAN = ['Konseling Individu', 'Konseling Kelompok', 'Konsultasi', 'Bimbingan Klasikal', 'Mediasi'];

const emptyForm = {
  siswa_id: '',
  tanggal: new Date().toISOString().split('T')[0],
  jenis_layanan: '',
  masalah: '',
  penanganan: '',
  tindak_lanjut: '',
};

export default function AdminBKKunjunganPage() {
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
        api.get('/bk/kunjungan'),
        api.get('/students'),
      ]);
      setList(res.data || []);
      setStudents(studentsRes.data || []);
    } catch (e) {
      toast.error('Gagal memuat data kunjungan');
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
        jenis_layanan: item.jenis_layanan || '',
        masalah: item.masalah || '',
        penanganan: item.penanganan || '',
        tindak_lanjut: item.tindak_lanjut || '',
      });
    } else {
      setEditing(null);
      setForm(emptyForm);
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.siswa_id || !form.tanggal || !form.jenis_layanan || !form.masalah) {
      toast.error('Siswa, tanggal, jenis layanan, dan masalah wajib diisi');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/bk/kunjungan/${editing.id}`, form);
        toast.success('Data kunjungan berhasil diperbarui');
      } else {
        await api.post('/bk/kunjungan', form);
        toast.success('Data kunjungan berhasil ditambahkan');
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
    if (!window.confirm('Yakin ingin menghapus data kunjungan ini?')) return;
    try {
      await api.delete(`/bk/kunjungan/${id}`);
      toast.success('Data kunjungan dihapus');
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
      (item.jenis_layanan || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6" data-testid="admin-bk-kunjungan-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <HeartHandshake className="h-3 w-3 mr-1" /> Menu BK
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Data Kunjungan Konseling</h1>
          <p className="text-sm text-slate-600 mt-1">Input kunjungan dan riwayat layanan konseling siswa</p>
        </div>
        <Button onClick={() => openModal()} className="gap-2 bg-[#006837] hover:bg-[#005830]">
          <Plus className="h-4 w-4" /> Input Kunjungan
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Cari nama, NIS, atau jenis layanan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
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
                    <TableHead>Kelas</TableHead>
                    <TableHead>Jenis Layanan</TableHead>
                    <TableHead>Masalah</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                        <HeartHandshake className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Belum ada data kunjungan</div>
                        <div className="text-xs mt-1">Klik "Input Kunjungan" untuk mulai mencatat</div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono">{item.tanggal}</TableCell>
                        <TableCell className="font-semibold">{item.siswa_nama}<div className="text-xs text-slate-500 font-normal">{item.siswa_nis}</div></TableCell>
                        <TableCell>{item.siswa_kelas || '-'}</TableCell>
                        <TableCell><Badge variant="outline">{item.jenis_layanan}</Badge></TableCell>
                        <TableCell className="max-w-sm"><div className="line-clamp-2">{item.masalah}</div></TableCell>
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
            <DialogTitle>{editing ? 'Edit Kunjungan Konseling' : 'Input Kunjungan Konseling'}</DialogTitle>
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
              <Label>Jenis Layanan <span className="text-rose-500">*</span></Label>
              <Select value={form.jenis_layanan || 'none'} onValueChange={(v) => setForm({ ...form, jenis_layanan: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih Jenis Layanan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih Jenis Layanan</SelectItem>
                  {JENIS_LAYANAN.map((j) => <SelectItem key={j} value={j}>{j}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Masalah <span className="text-rose-500">*</span></Label>
              <Textarea rows={3} value={form.masalah} onChange={(e) => setForm({ ...form, masalah: e.target.value })} placeholder="Uraikan masalah/topik konseling" />
            </div>
            <div className="space-y-2">
              <Label>Penanganan</Label>
              <Textarea rows={2} value={form.penanganan} onChange={(e) => setForm({ ...form, penanganan: e.target.value })} placeholder="Penanganan yang diberikan (opsional)" />
            </div>
            <div className="space-y-2">
              <Label>Tindak Lanjut</Label>
              <Textarea rows={2} value={form.tindak_lanjut} onChange={(e) => setForm({ ...form, tindak_lanjut: e.target.value })} placeholder="Rencana tindak lanjut (opsional)" />
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
