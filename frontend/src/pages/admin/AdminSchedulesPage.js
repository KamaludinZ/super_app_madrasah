import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, DAY_LABELS } from '@/lib/api';
import { toast } from 'sonner';

const DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

export default function AdminSchedulesPage() {
  const [items, setItems] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [activeAY, setActiveAY] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterDay, setFilterDay] = useState('all');
  const [form, setForm] = useState({ class_id: '', subject_id: '', teacher_id: '', room_id: '', day: 'senin', start_time: '07:00', end_time: '08:30', semester: 'ganjil', academic_year_id: '' });

  const refresh = async () => { const { data } = await api.get('/schedules'); setItems(data); };
  useEffect(() => {
    (async () => {
      const ay = await api.get('/academic-years/active');
      setActiveAY(ay.data);
      const [s, c, sub, r, u] = await Promise.all([
        api.get('/schedules'), api.get('/classes'), api.get('/subjects'), api.get('/rooms'), api.get('/users'),
      ]);
      setItems(s.data); setClasses(c.data); setSubjects(sub.data); setRooms(r.data);
      setTeachers(u.data.filter((x) => x.roles?.some((rr) => ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'].includes(rr))));
    })();
  }, []);

  const openCreate = () => { setEditing(null); setForm({ class_id: '', subject_id: '', teacher_id: '', room_id: '', day: 'senin', start_time: '07:00', end_time: '08:30', semester: 'ganjil', academic_year_id: activeAY?.id }); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...s, academic_year_id: s.academic_year_id || activeAY?.id }); setOpen(true); };
  const handleSubmit = async () => {
    if (!form.class_id || !form.subject_id || !form.teacher_id || !form.room_id) { toast.error('Lengkapi semua field'); return; }
    try {
      if (editing) await api.put(`/schedules/${editing.id}`, form); else await api.post('/schedules', form);
      toast.success('Berhasil disimpan'); setOpen(false); refresh();
    } catch (e) { toast.error('Gagal'); }
  };
  const handleDelete = async (s) => { if (!window.confirm('Hapus jadwal?')) return; await api.delete(`/schedules/${s.id}`); toast.success('Dihapus'); refresh(); };

  const filtered = filterDay === 'all' ? items : items.filter((s) => s.day === filterDay);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><Calendar className="h-3 w-3 mr-1" /> Manajemen Jadwal</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Kelola Jadwal Pelajaran</h1>
          <p className="text-sm text-slate-600 mt-1">{items.length} jadwal • TP {activeAY?.name || '-'}</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterDay} onValueChange={setFilterDay}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Hari</SelectItem>
              {DAYS.map((d) => <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-schedule-button"><Plus className="h-4 w-4" /> Tambah</Button>
        </div>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table data-testid="admin-schedules-table">
        <TableHeader><TableRow>
          <TableHead>Hari</TableHead><TableHead>Jam</TableHead><TableHead>Kelas</TableHead><TableHead>Mapel</TableHead><TableHead>Guru</TableHead><TableHead>Ruang</TableHead><TableHead className="text-right">Aksi</TableHead>
        </TableRow></TableHeader>
        <TableBody>{filtered.map((s) => (
          <TableRow key={s.id}>
            <TableCell className="capitalize">{DAY_LABELS[s.day]}</TableCell>
            <TableCell className="font-mono">{s.start_time}-{s.end_time}</TableCell>
            <TableCell className="font-semibold">{s.class_name || '-'}</TableCell>
            <TableCell>{s.subject_name || '-'}</TableCell>
            <TableCell className="text-sm">{s.teacher_name || '-'}</TableCell>
            <TableCell className="font-mono text-sm">{s.room_name || '-'}</TableCell>
            <TableCell className="text-right">
              <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => handleDelete(s)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button>
            </TableCell>
          </TableRow>
        ))}</TableBody>
      </Table></div></CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Jadwal' : 'Tambah Jadwal'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Hari</Label>
              <Select value={form.day} onValueChange={(v) => setForm({...form, day: v})}>
                <SelectTrigger data-testid="schedule-form-day"><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Jam Mulai</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({...form, start_time: e.target.value})} data-testid="schedule-form-start" /></div>
            <div><Label>Jam Selesai</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({...form, end_time: e.target.value})} data-testid="schedule-form-end" /></div>
            <div className="col-span-2"><Label>Kelas</Label>
              <Select value={form.class_id} onValueChange={(v) => setForm({...form, class_id: v})}>
                <SelectTrigger data-testid="schedule-form-class"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Mata Pelajaran</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({...form, subject_id: v})}>
                <SelectTrigger data-testid="schedule-form-subject"><SelectValue placeholder="Pilih mapel" /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Guru</Label>
              <Select value={form.teacher_id} onValueChange={(v) => setForm({...form, teacher_id: v})}>
                <SelectTrigger data-testid="schedule-form-teacher"><SelectValue placeholder="Pilih guru" /></SelectTrigger>
                <SelectContent>{teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Ruang</Label>
              <Select value={form.room_id} onValueChange={(v) => setForm({...form, room_id: v})}>
                <SelectTrigger data-testid="schedule-form-room"><SelectValue placeholder="Pilih ruang" /></SelectTrigger>
                <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={handleSubmit} className="bg-[#006837]" data-testid="schedule-form-submit">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
