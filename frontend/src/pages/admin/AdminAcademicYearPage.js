import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, GraduationCap, Check, Trash2, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const REGULAR_SEMESTERS = [
  { name: 'ganjil', label: 'Ganjil' },
  { name: 'genap', label: 'Genap' },
];
const ACCELERATED_SEMESTERS = [
  { name: '1', label: 'Semester 1' }, { name: '2', label: 'Semester 2' },
  { name: '3', label: 'Semester 3' }, { name: '4', label: 'Semester 4' },
  { name: '5', label: 'Semester 5' }, { name: '6', label: 'Semester 6' },
];

export default function AdminAcademicYearPage() {
  const [items, setItems] = useState([]);
  const [curriculums, setCurriculums] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: '', is_active: false, semester_type: 'regular', semesters: [], active_semester: 'ganjil',
    curriculum_id: '',
  });

  const refresh = async () => {
    const [{ data }, { data: curs }] = await Promise.all([
      api.get('/academic-years'),
      api.get('/curriculums'),
    ]);
    setItems(data); setCurriculums(curs || []);
  };
  useEffect(() => { refresh(); }, []);

  const curriculumById = (id) => curriculums.find((c) => c.id === id);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '', is_active: false, semester_type: 'regular',
      semesters: REGULAR_SEMESTERS.map((s) => ({ ...s, is_active: s.name === 'ganjil' })),
      active_semester: 'ganjil',
      curriculum_id: '',
    });
    setOpen(true);
  };
  const openEdit = (ay) => {
    setEditing(ay);
    setForm({
      name: ay.name, is_active: ay.is_active,
      semester_type: ay.semester_type || 'regular',
      semesters: ay.semesters || [],
      active_semester: ay.active_semester || (ay.semesters?.find((s) => s.is_active)?.name || ''),
      curriculum_id: ay.curriculum_id || '',
    });
    setOpen(true);
  };

  const onTypeChange = (type) => {
    const baseSet = type === 'regular' ? REGULAR_SEMESTERS : ACCELERATED_SEMESTERS;
    setForm({
      ...form, semester_type: type,
      semesters: baseSet.map((s, idx) => ({ ...s, is_active: idx === 0 })),
      active_semester: baseSet[0]?.name,
    });
  };

  const setActiveSemester = (name) => {
    const updated = (form.semesters || []).map((s) => ({ ...s, is_active: s.name === name }));
    setForm({ ...form, semesters: updated, active_semester: name });
  };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Nama wajib'); return; }
    try {
      if (editing) {
        await api.put(`/academic-years/${editing.id}`, form);
        toast.success('Tahun pelajaran diperbarui');
      } else {
        await api.post('/academic-years', form);
        toast.success('Tahun pelajaran ditambahkan');
      }
      setOpen(false); refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Gagal menyimpan'); }
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
          <p className="text-sm text-slate-600 mt-1">Tahun pelajaran aktif menjadi acuan semua data baru. Mendukung semester Ganjil/Genap dan kelas Percepatan (Semester 1-6).</p>
        </div>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-ay-button"><Plus className="h-4 w-4" /> Tambah</Button>
      </div>

      <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table>
        <TableHeader><TableRow>
          <TableHead>Nama</TableHead><TableHead>Tipe</TableHead><TableHead>Kurikulum</TableHead><TableHead>Semester</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead>
        </TableRow></TableHeader>
        <TableBody>{items.map((ay) => (
          <TableRow key={ay.id} data-testid={`ay-row-${ay.name}`}>
            <TableCell className="font-mono font-semibold">{ay.name}</TableCell>
            <TableCell>
              <Badge variant="outline" className="capitalize">{ay.semester_type === 'accelerated' ? 'Percepatan (1-6)' : 'Regular (Ganjil/Genap)'}</Badge>
            </TableCell>
            <TableCell>
              {ay.curriculum_id ? (
                <Badge variant="outline" className="bg-[#006837]/5 text-[#006837] border-[#006837]/20" title={curriculumById(ay.curriculum_id)?.name || ''}>
                  {curriculumById(ay.curriculum_id)?.code || curriculumById(ay.curriculum_id)?.name || '?'}
                </Badge>
              ) : <span className="text-xs text-slate-400 italic">Belum diset</span>}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {(ay.semesters || []).map((s) => (
                  <Badge key={s.name} className={s.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>
                    {s.label || s.name}{s.is_active ? ' (aktif)' : ''}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell>{ay.is_active ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Aktif</Badge> : <Badge variant="outline">Arsip</Badge>}</TableCell>
            <TableCell className="text-right">
              <Button size="sm" variant="outline" onClick={() => openEdit(ay)} className="gap-1 mr-1" data-testid={`edit-ay-${ay.name}`}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              {!ay.is_active && <Button size="sm" variant="outline" onClick={() => handleActivate(ay)} className="gap-1" data-testid={`activate-ay-${ay.name}`}><Check className="h-3.5 w-3.5" /> Aktifkan</Button>}
              <Button size="icon" variant="ghost" onClick={() => handleDelete(ay)} className="text-rose-600 ml-1"><Trash2 className="h-4 w-4" /></Button>
            </TableCell>
          </TableRow>
        ))}</TableBody>
      </Table></div></CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Tahun Pelajaran' : 'Tambah Tahun Pelajaran'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nama Tahun Pelajaran *</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="2026/2027" data-testid="ay-form-name" /></div>
            <div>
              <Label>Tipe Semester *</Label>
              <Select value={form.semester_type} onValueChange={onTypeChange}>
                <SelectTrigger data-testid="ay-form-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Regular - Ganjil & Genap</SelectItem>
                  <SelectItem value="accelerated">Kelas Percepatan - Semester 1 s/d 6</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">Pilih "Percepatan" untuk kelas akselerasi yang menyelesaikan 6 semester dalam 2 tahun.</p>
            </div>
            <div>
              <Label>Semester Aktif</Label>
              <Select value={form.active_semester} onValueChange={setActiveSemester}>
                <SelectTrigger data-testid="ay-form-active-sem"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(form.semesters || []).map((s) => (
                    <SelectItem key={s.name} value={s.name}>{s.label || s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kurikulum yang Digunakan</Label>
              <Select value={form.curriculum_id || '__none__'} onValueChange={(v) => setForm({...form, curriculum_id: v === '__none__' ? '' : v})}>
                <SelectTrigger data-testid="ay-form-curriculum"><SelectValue placeholder="Pilih kurikulum..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Belum diset</SelectItem>
                  {curriculums.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Kurikulum ini akan dipakai sebagai default untuk semua kelas di TP ini.
                {curriculums.length === 0 && (
                  <span className="block text-amber-700 mt-0.5">Belum ada kurikulum. Buat di menu Kurikulum dulu.</span>
                )}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
              <Label className="text-xs text-slate-600">Daftar Semester:</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {(form.semesters || []).map((s) => (
                  <Badge key={s.name} variant="outline">{s.label || s.name}</Badge>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({...form, is_active: e.target.checked})} />
              <span className="text-sm">Set sebagai TP aktif (akan menonaktifkan TP lain)</span>
            </label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={handleSubmit} className="bg-[#006837]" data-testid="ay-form-submit">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
