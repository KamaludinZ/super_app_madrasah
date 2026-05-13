import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, BookMarked } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminSubjectsPage() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name: '' });

  const refresh = async () => { const { data } = await api.get('/subjects'); setItems(data); };
  useEffect(() => { refresh(); }, []);

  const openCreate = () => { setEditing(null); setForm({ code: '', name: '' }); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm(s); setOpen(true); };
  const handleSubmit = async () => {
    if (!form.code || !form.name) { toast.error('Kode & nama wajib'); return; }
    try {
      if (editing) await api.put(`/subjects/${editing.id}`, form); else await api.post('/subjects', form);
      toast.success('Berhasil disimpan'); setOpen(false); refresh();
    } catch (e) { toast.error('Gagal'); }
  };
  const handleDelete = async (s) => { if (!window.confirm(`Hapus ${s.name}?`)) return; await api.delete(`/subjects/${s.id}`); toast.success('Dihapus'); refresh(); };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><BookMarked className="h-3 w-3 mr-1" /> Manajemen Mapel</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Kelola Mata Pelajaran</h1>
          <p className="text-sm text-slate-600 mt-1">{items.length} mapel terdaftar</p>
        </div>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-subject-button"><Plus className="h-4 w-4" /> Tambah Mapel</Button>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
        <TableHeader><TableRow><TableHead>Kode</TableHead><TableHead>Nama</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
        <TableBody>{items.map((s) => (
          <TableRow key={s.id} data-testid={`subject-row-${s.code}`}>
            <TableCell className="font-mono font-semibold">{s.code}</TableCell><TableCell>{s.name}</TableCell>
            <TableCell className="text-right">
              <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(s)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button>
            </TableCell>
          </TableRow>
        ))}</TableBody>
      </Table></div></CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Mapel' : 'Tambah Mapel'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Kode *</Label><Input value={form.code} onChange={(e) => setForm({...form, code: e.target.value.toUpperCase()})} placeholder="MTK" data-testid="subject-form-code" /></div>
            <div><Label>Nama *</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="Matematika" data-testid="subject-form-name" /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={handleSubmit} className="bg-[#006837]" data-testid="subject-form-submit">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
