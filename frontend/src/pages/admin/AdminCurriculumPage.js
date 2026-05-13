import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { BookMarked, Plus, Pencil, Trash2, CheckCircle2, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const EMPTY = { name: '', code: '', description: '', is_active: true };

export default function AdminCurriculumPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const refresh = async () => {
    try { const { data } = await api.get('/curriculums'); setItems(data || []); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...c }); setOpen(true); };
  const handleSubmit = async () => {
    if (!form.name || !form.code) { toast.error('Nama dan kode wajib'); return; }
    try {
      if (editing) await api.put(`/curriculums/${editing.id}`, form);
      else await api.post('/curriculums', form);
      toast.success('Kurikulum disimpan');
      setOpen(false); await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Gagal'); }
  };
  const handleDelete = async (c) => {
    if (!window.confirm(`Hapus kurikulum ${c.name}?`)) return;
    try { await api.delete(`/curriculums/${c.id}`); toast.success('Dihapus'); await refresh(); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Gagal'); }
  };
  const toggleActive = async (c) => {
    try { await api.put(`/curriculums/${c.id}`, { is_active: !c.is_active }); await refresh(); toast.success('Status diperbarui'); }
    catch (e) { toast.error('Gagal'); }
  };

  if (loading) return <div className="text-sm text-slate-500">Memuat...</div>;

  return (
    <div className="space-y-6" data-testid="admin-curriculum-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <BookMarked className="h-3 w-3 mr-1" /> Kurikulum
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Manajemen Kurikulum</h1>
          <p className="text-sm text-slate-600 mt-1">Kelola kurikulum yang dipakai madrasah (K-13, Merdeka, dll). Setiap mapel & TP dapat memilih kurikulum.</p>
        </div>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-curriculum-button">
          <Plus className="h-4 w-4" /> Tambah Kurikulum
        </Button>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-700" />
        <AlertDescription className="text-blue-900 text-sm">
          Aktifkan kurikulum yang sedang dipakai. Mapel dan Tahun Pelajaran akan menampilkan badge kurikulum sesuai pilihan.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="p-0">
          <Table data-testid="curriculum-table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">NO</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Nama Kurikulum</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead className="text-center">Aktif</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c, i) => (
                <TableRow key={c.id} data-testid={`curriculum-row-${c.code}`}>
                  <TableCell className="text-center font-mono text-slate-500">{i + 1}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">{c.code}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{c.name}</TableCell>
                  <TableCell className="text-sm text-slate-600 max-w-md">{c.description || '-'}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={!!c.is_active} onCheckedChange={() => toggleActive(c)} data-testid={`toggle-active-${c.code}`} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(c)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-slate-500">
                  <BookMarked className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                  <div className="font-semibold">Belum ada kurikulum</div>
                  <div className="text-sm mt-1">Klik "Tambah Kurikulum" untuk menambah</div>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Kurikulum' : 'Tambah Kurikulum'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Kode *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="KM, K13, KMA183" maxLength={16} data-testid="curr-form-code" />
            </div>
            <div>
              <Label>Nama Kurikulum *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mis. Kurikulum Merdeka" data-testid="curr-form-name" />
            </div>
            <div>
              <Label>Deskripsi</Label>
              <Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3} placeholder="Penjelasan singkat kurikulum..." />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div>
                <div className="font-semibold text-sm">Aktif</div>
                <div className="text-xs text-slate-600">Kurikulum aktif akan tampil sebagai pilihan di Mapel & TP</div>
              </div>
              <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]" data-testid="curr-form-submit">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
