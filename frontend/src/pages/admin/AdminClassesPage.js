import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, BookOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export default function AdminClassesPage() {
  const [items, setItems] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [activeAY, setActiveAY] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', grade: 7, parallel: 'A', academic_year_id: '', homeroom_teacher_id: '', room_id: '' });

  const refresh = async () => {
    const { data } = await api.get('/classes');
    setItems(data);
  };
  useEffect(() => {
    (async () => {
      const ay = await api.get('/academic-years/active');
      setActiveAY(ay.data);
      const [c, r, u] = await Promise.all([api.get('/classes'), api.get('/rooms'), api.get('/users')]);
      setItems(c.data); setRooms(r.data);
      setTeachers(u.data.filter((x) => x.roles?.some((rr) => ['guru', 'wali_kelas'].includes(rr))));
    })();
  }, []);

  const openCreate = () => { setEditing(null); setForm({ name: '', grade: 7, parallel: 'A', academic_year_id: activeAY?.id, homeroom_teacher_id: '', room_id: '' }); setOpen(true); };
  const openEdit = (c) => { setEditing(c); setForm({ ...c, homeroom_teacher_id: c.homeroom_teacher_id || '', room_id: c.room_id || '' }); setOpen(true); };
  const handleSubmit = async () => {
    if (!form.name || !form.academic_year_id) { toast.error('Nama dan Tahun Pelajaran wajib'); return; }
    try {
      const payload = { ...form, homeroom_teacher_id: form.homeroom_teacher_id || null, room_id: form.room_id || null };
      if (editing) await api.put(`/classes/${editing.id}`, payload);
      else await api.post('/classes', payload);
      toast.success('Berhasil disimpan');
      setOpen(false); refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Gagal'); }
  };
  const handleDelete = async (c) => {
    if (!window.confirm(`Hapus kelas ${c.name}?`)) return;
    await api.delete(`/classes/${c.id}`); toast.success('Dihapus'); refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><BookOpen className="h-3 w-3 mr-1" /> Manajemen Kelas</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Kelola Kelas</h1>
          <p className="text-sm text-slate-600 mt-1">{items.length} kelas • TP {activeAY?.name || '-'}</p>
        </div>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-class-button"><Plus className="h-4 w-4" /> Tambah Kelas</Button>
      </div>
      <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table data-testid="admin-classes-table">
        <TableHeader><TableRow><TableHead>Nama</TableHead><TableHead>Tingkat</TableHead><TableHead>Wali Kelas</TableHead><TableHead>Ruang</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
        <TableBody>
          {items.map((c) => (
            <TableRow key={c.id} data-testid={`class-row-${c.name}`}>
              <TableCell className="font-semibold">{c.name}</TableCell>
              <TableCell>{c.grade}</TableCell>
              <TableCell className="text-sm">{teachers.find((t) => t.id === c.homeroom_teacher_id)?.full_name || '-'}</TableCell>
              <TableCell className="text-sm font-mono">{rooms.find((r) => r.id === c.room_id)?.name || '-'}</TableCell>
              <TableCell className="text-right">
                <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(c)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div></CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Kelas' : 'Tambah Kelas'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Tingkat</Label><Input type="number" min="7" max="9" value={form.grade} onChange={(e) => setForm({...form, grade: parseInt(e.target.value)||7})} /></div>
              <div><Label>Paralel</Label><Input value={form.parallel} onChange={(e) => setForm({...form, parallel: e.target.value.toUpperCase()})} /></div>
              <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="7A" data-testid="class-form-name" /></div>
            </div>
            <div><Label>Wali Kelas</Label>
              <Select value={form.homeroom_teacher_id || ''} onValueChange={(v) => setForm({...form, homeroom_teacher_id: v})}>
                <SelectTrigger><SelectValue placeholder="Pilih guru..." /></SelectTrigger>
                <SelectContent>{teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Ruang Default</Label>
              <Select value={form.room_id || ''} onValueChange={(v) => setForm({...form, room_id: v})}>
                <SelectTrigger><SelectValue placeholder="Pilih ruang..." /></SelectTrigger>
                <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={handleSubmit} className="bg-[#006837]" data-testid="class-form-submit">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
