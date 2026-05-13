import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, GraduationCap, Check, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminAcademicYearPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', is_active: false });

  const refresh = async () => { const { data } = await api.get('/academic-years'); setItems(data); };
  useEffect(() => { refresh(); }, []);

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Nama wajib'); return; }
    try { await api.post('/academic-years', form); toast.success('Berhasil'); setOpen(false); setForm({ name: '', is_active: false }); refresh(); }
    catch (e) { toast.error('Gagal'); }
  };

  const handleActivate = async (ay) => {
    if (!window.confirm(`Aktifkan ${ay.name}?`)) return;
    await api.put(`/academic-years/${ay.id}/activate`); toast.success('Diaktifkan'); refresh();
  };

  const handleDelete = async (ay) => {
    if (!window.confirm(`Hapus ${ay.name}?`)) return;
    try { await api.delete(`/academic-years/${ay.id}`); toast.success('Dihapus'); refresh(); }
    catch (e) { toast.error('Gagal'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><GraduationCap className="h-3 w-3 mr-1" /> Tahun Pelajaran</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Kelola Tahun Pelajaran</h1>
          <p className="text-sm text-slate-600 mt-1">Tahun pelajaran yang aktif menjadi acuan untuk semua data baru</p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-ay-button"><Plus className="h-4 w-4" /> Tambah</Button>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
        <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
        <TableBody>{items.map((ay) => (
          <TableRow key={ay.id} data-testid={`ay-row-${ay.name}`}>
            <TableCell className="font-mono font-semibold">{ay.name}</TableCell>
            <TableCell>{ay.is_active ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Aktif</Badge> : <Badge variant="outline">Arsip</Badge>}</TableCell>
            <TableCell className="text-right">
              {!ay.is_active && <Button size="sm" variant="outline" onClick={() => handleActivate(ay)} className="gap-1" data-testid={`activate-ay-${ay.name}`}><Check className="h-3.5 w-3.5" /> Aktifkan</Button>}
              <Button size="icon" variant="ghost" onClick={() => handleDelete(ay)} className="text-rose-600 ml-1"><Trash2 className="h-4 w-4" /></Button>
            </TableCell>
          </TableRow>
        ))}</TableBody>
      </Table></div></CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Tahun Pelajaran</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama (mis: 2026/2027)</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="2026/2027" data-testid="ay-form-name" /></div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({...form, is_active: e.target.checked})} />
              <span className="text-sm">Set sebagai aktif (akan menonaktifkan TP lain)</span>
            </label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={handleSubmit} className="bg-[#006837]" data-testid="ay-form-submit">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
