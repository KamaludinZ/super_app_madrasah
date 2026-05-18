import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, BookOpen, Copy, RefreshCw, KeyRound, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import ClassDetailDialog from '@/components/classes/ClassDetailDialog';

export default function AdminClassesPage() {
  const [items, setItems] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [activeAY, setActiveAY] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailClass, setDetailClass] = useState(null);
  const [form, setForm] = useState({
    name: '', grade: 7, parallel: 'A', academic_year_id: '',
    homeroom_teacher_id: '', room_id: '', capacity: 40,
    curriculum_id: '', semester: '',
  });

  const refresh = async () => {
    const { data } = await api.get('/classes');
    setItems(data);
  };

  useEffect(() => {
    (async () => {
      const ay = await api.get('/academic-years/active');
      setActiveAY(ay.data);
      const [c, r, u, cur] = await Promise.all([
        api.get('/classes'), api.get('/rooms'), api.get('/users'), api.get('/curriculums'),
      ]);
      setItems(c.data); setRooms(r.data); setCurriculums(cur.data);
      setTeachers(u.data.filter((x) => x.roles?.some((rr) => ['guru', 'wali_kelas'].includes(rr))));
    })();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '', grade: 7, parallel: 'A',
      academic_year_id: activeAY?.id || '',
      homeroom_teacher_id: '', room_id: '', capacity: 40,
      curriculum_id: activeAY?.curriculum_id || '',
      semester: activeAY?.active_semester || '',
    });
    setOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      ...c,
      homeroom_teacher_id: c.homeroom_teacher_id || '',
      room_id: c.room_id || '',
      capacity: c.capacity || 40,
      curriculum_id: c.curriculum_id || '',
      semester: c.semester || c.effective_semester || '',
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.academic_year_id) { toast.error('Nama dan Tahun Pelajaran wajib'); return; }
    try {
      const payload = {
        ...form,
        homeroom_teacher_id: form.homeroom_teacher_id || null,
        room_id: form.room_id || null,
        curriculum_id: form.curriculum_id || null,
        semester: form.semester || null,
        capacity: parseInt(form.capacity) || 40,
      };
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

  const handleCopy = (token, name) => {
    navigator.clipboard.writeText(token);
    toast.success(`Token kelas ${name} disalin ke clipboard`);
  };

  const handleRegenerate = async (c) => {
    if (!window.confirm(`Generate ulang token kelas ${c.name}? Token lama tidak berlaku lagi.`)) return;
    try {
      const { data } = await api.post(`/classes/${c.id}/regenerate-token`);
      toast.success(`Token baru: ${data.token}`);
      refresh();
    } catch (e) { toast.error('Gagal'); }
  };

  const handleBackfill = async () => {
    if (!window.confirm('Generate token untuk semua kelas yang belum punya?')) return;
    try {
      const { data } = await api.post('/classes/backfill-tokens');
      toast.success(`${data.updated} token dibuat`);
      refresh();
    } catch (e) { toast.error('Gagal'); }
  };

  const missingToken = items.filter((i) => !i.token).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><BookOpen className="h-3 w-3 mr-1" /> Manajemen Kelas</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Kelola Kelas</h1>
          <p className="text-sm text-slate-600 mt-1">{items.length} kelas • TP {activeAY?.name || '-'}</p>
        </div>
        <div className="flex gap-2">
          {missingToken > 0 && (
            <Button onClick={handleBackfill} variant="outline" className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50" data-testid="btn-backfill-tokens">
              <KeyRound className="h-4 w-4" /> Generate {missingToken} Token
            </Button>
          )}
          <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-class-button"><Plus className="h-4 w-4" /> Tambah Kelas</Button>
        </div>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table data-testid="admin-classes-table">
        <TableHeader><TableRow>
          <TableHead>Nama</TableHead>
          <TableHead>Tingkat</TableHead>
          <TableHead>Peserta</TableHead>
          <TableHead>Kurikulum</TableHead>
          <TableHead>Semester</TableHead>
          <TableHead>Wali Kelas</TableHead>
          <TableHead>Ruang</TableHead>
          <TableHead>Token</TableHead>
          <TableHead className="text-right">Aksi</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {items.map((c) => {
            const cap = c.capacity || 40;
            const cnt = c.student_count || 0;
            const ratio = cap > 0 ? cnt / cap : 0;
            const barColor = ratio >= 1 ? 'bg-rose-500' : ratio >= 0.85 ? 'bg-amber-500' : 'bg-emerald-500';
            return (
              <TableRow key={c.id} data-testid={`class-row-${c.name}`}>
                <TableCell className="font-semibold">{c.name}</TableCell>
                <TableCell>{c.grade}</TableCell>
                <TableCell data-testid={`class-peserta-${c.name}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-semibold text-sm ${ratio >= 1 ? 'text-rose-600' : 'text-slate-900'}`}>
                      {cnt}/{cap}
                    </span>
                    <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                      <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  {c.curriculum_name ? (
                    <span title={c.curriculum_name}>
                      <Badge variant="outline" className="font-mono text-[10px]">{c.curriculum_code || '?'}</Badge>
                    </span>
                  ) : <span className="text-slate-400">-</span>}
                </TableCell>
                <TableCell className="text-xs capitalize">
                  {c.effective_semester ? (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 capitalize">{c.effective_semester}</Badge>
                  ) : <span className="text-slate-400">-</span>}
                </TableCell>
                <TableCell className="text-sm">{c.homeroom_teacher_name || teachers.find((t) => t.id === c.homeroom_teacher_id)?.full_name || '-'}</TableCell>
                <TableCell className="text-sm font-mono">{c.room_name || rooms.find((r) => r.id === c.room_id)?.name || '-'}</TableCell>
                <TableCell data-testid={`class-token-${c.name}`}>
                  {c.token ? (
                    <div className="flex items-center gap-1">
                      <code className="text-[11px] bg-emerald-50 text-emerald-900 border border-emerald-200 px-1.5 py-0.5 rounded font-mono">
                        {c.token}
                      </code>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleCopy(c.token, c.name)} title="Copy">
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRegenerate(c)} title="Regenerate">
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-amber-700 italic">Belum ada</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => setDetailClass(c)} title="Detail Kelas"><Users className="h-4 w-4 text-blue-600" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(c)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table></div></CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Kelas' : 'Tambah Kelas'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div><Label>Tingkat</Label><Input type="number" min="7" max="9" value={form.grade} onChange={(e) => setForm({...form, grade: parseInt(e.target.value)||7})} /></div>
              <div><Label>Paralel</Label><Input value={form.parallel} onChange={(e) => setForm({...form, parallel: e.target.value.toUpperCase()})} /></div>
              <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="7A" data-testid="class-form-name" /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Kapasitas</Label>
                <Input type="number" min="1" max="60" value={form.capacity} onChange={(e) => setForm({...form, capacity: e.target.value})} placeholder="40" data-testid="class-form-capacity" />
              </div>
              <div>
                <Label>Semester Aktif</Label>
                <Select value={form.semester || ''} onValueChange={(v) => setForm({...form, semester: v})}>
                  <SelectTrigger data-testid="class-form-semester"><SelectValue placeholder="ganjil/genap" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ganjil">Ganjil</SelectItem>
                    <SelectItem value="genap">Genap</SelectItem>
                    <SelectItem value="1">Semester 1 (Percepatan)</SelectItem>
                    <SelectItem value="2">Semester 2 (Percepatan)</SelectItem>
                    <SelectItem value="3">Semester 3 (Percepatan)</SelectItem>
                    <SelectItem value="4">Semester 4 (Percepatan)</SelectItem>
                    <SelectItem value="5">Semester 5 (Percepatan)</SelectItem>
                    <SelectItem value="6">Semester 6 (Percepatan)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Kurikulum</Label>
              <Select value={form.curriculum_id || ''} onValueChange={(v) => setForm({...form, curriculum_id: v})}>
                <SelectTrigger data-testid="class-form-curriculum"><SelectValue placeholder="Pilih kurikulum (ikut TP jika kosong)" /></SelectTrigger>
                <SelectContent>{curriculums.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>)}</SelectContent>
              </Select>
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

      <ClassDetailDialog
        classData={detailClass}
        open={!!detailClass}
        onOpenChange={(open) => !open && setDetailClass(null)}
        onRefresh={refresh}
      />
    </div>
  );
}
