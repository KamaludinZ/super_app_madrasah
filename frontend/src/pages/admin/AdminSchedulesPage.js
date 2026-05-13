import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Calendar, Download, Upload, LayoutGrid, List, FileSpreadsheet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api, DAY_LABELS } from '@/lib/api';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const ALL_DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

export default function AdminSchedulesPage() {
  const [items, setItems] = useState([]);
  const [grid, setGrid] = useState({ days: [], slots: [], grid: {} });
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [activeAY, setActiveAY] = useState(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterMode, setFilterMode] = useState('class'); // class | teacher
  const [filterValue, setFilterValue] = useState('');
  const [form, setForm] = useState({ class_id: '', subject_id: '', teacher_id: '', room_id: '', day: 'senin', start_time: '07:00', end_time: '08:30', semester: 'ganjil', academic_year_id: '' });
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef(null);

  const loadGrid = async (mode, val) => {
    const params = {};
    if (val && val !== 'all') {
      if (mode === 'class') params.class_id = val;
      else params.teacher_id = val;
    }
    const { data } = await api.get('/schedules/grid', { params });
    setGrid(data);
    setItems(data.schedules || []);
  };

  useEffect(() => {
    (async () => {
      const ay = await api.get('/academic-years/active');
      setActiveAY(ay.data);
      const [c, sub, r, u] = await Promise.all([
        api.get('/classes'), api.get('/subjects'), api.get('/rooms'), api.get('/users'),
      ]);
      setClasses(c.data); setSubjects(sub.data); setRooms(r.data);
      setTeachers(u.data.filter((x) => x.roles?.some((rr) => ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'].includes(rr))));
      await loadGrid('class', '');
    })();
  }, []);

  useEffect(() => { loadGrid(filterMode, filterValue); }, [filterMode, filterValue]);

  const openCreate = (presetDay, presetStart, presetEnd) => {
    setEditing(null);
    setForm({
      class_id: filterMode === 'class' && filterValue && filterValue !== 'all' ? filterValue : '',
      subject_id: '', teacher_id: filterMode === 'teacher' && filterValue && filterValue !== 'all' ? filterValue : '',
      room_id: '', day: presetDay || 'senin',
      start_time: presetStart || '07:00', end_time: presetEnd || '08:30',
      semester: activeAY?.active_semester || 'ganjil', academic_year_id: activeAY?.id,
    });
    setOpen(true);
  };
  const openEdit = (s) => { setEditing(s); setForm({ ...s, academic_year_id: s.academic_year_id || activeAY?.id }); setOpen(true); };
  const handleSubmit = async () => {
    if (!form.class_id || !form.subject_id || !form.teacher_id || !form.room_id) { toast.error('Lengkapi semua field'); return; }
    try {
      if (editing) await api.put(`/schedules/${editing.id}`, form);
      else await api.post('/schedules', form);
      toast.success('Berhasil disimpan'); setOpen(false); await loadGrid(filterMode, filterValue);
    } catch (e) { toast.error('Gagal'); }
  };
  const handleDelete = async (s) => {
    if (!window.confirm('Hapus jadwal?')) return;
    await api.delete(`/schedules/${s.id}`); toast.success('Dihapus'); await loadGrid(filterMode, filterValue);
  };

  const downloadTemplate = () => {
    const token = localStorage.getItem('matsa_token');
    const link = document.createElement('a');
    link.href = `${BACKEND_URL}/api/schedules/excel-template`;
    // we need to fetch with auth and download
    fetch(`${BACKEND_URL}/api/schedules/excel-template`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'template_jadwal_matsandatama.xlsx';
        a.click();
        URL.revokeObjectURL(url);
      });
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const fd = new FormData(); fd.append('file', file);
      const token = localStorage.getItem('matsa_token');
      const r = await fetch(`${BACKEND_URL}/api/schedules/import-excel`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Gagal');
      toast.success(`Berhasil import ${data.success} jadwal${data.errors.length ? `, ${data.errors.length} error` : ''}`);
      if (data.errors.length) {
        console.error('Import errors:', data.errors);
        toast.warning(`${data.errors.length} baris error - lihat console untuk detail`);
      }
      setImportOpen(false); await loadGrid(filterMode, filterValue);
    } catch (err) { toast.error(err.message); }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><Calendar className="h-3 w-3 mr-1" /> Manajemen Jadwal</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Kelola Jadwal Pelajaran</h1>
          <p className="text-sm text-slate-600 mt-1">{items.length} jadwal • TP {activeAY?.name || '-'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={downloadTemplate} variant="outline" className="gap-2" data-testid="download-template-button"><Download className="h-4 w-4" /> Template Excel</Button>
          <Button onClick={() => setImportOpen(true)} variant="outline" className="gap-2" data-testid="import-excel-button"><Upload className="h-4 w-4" /> Import Excel</Button>
          <Button onClick={() => openCreate()} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-schedule-button"><Plus className="h-4 w-4" /> Tambah</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wide">Tampilkan Per</Label>
            <Select value={filterMode} onValueChange={(v) => { setFilterMode(v); setFilterValue(''); }}>
              <SelectTrigger data-testid="schedule-filter-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="class">Per Kelas</SelectItem>
                <SelectItem value="teacher">Per Guru</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide">{filterMode === 'class' ? 'Pilih Kelas' : 'Pilih Guru'}</Label>
            <Select value={filterValue} onValueChange={setFilterValue}>
              <SelectTrigger data-testid="schedule-filter-value"><SelectValue placeholder="Semua" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua {filterMode === 'class' ? 'Kelas' : 'Guru'}</SelectItem>
                {filterMode === 'class' ?
                  classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                  : teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)
                }
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="grid">
        <TabsList>
          <TabsTrigger value="grid" data-testid="view-tab-grid"><LayoutGrid className="h-4 w-4 mr-1" /> Grid (Hari & Jam)</TabsTrigger>
          <TabsTrigger value="list" data-testid="view-tab-list"><List className="h-4 w-4 mr-1" /> List</TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="mt-4">
          <Card><CardContent className="p-3">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" data-testid="schedule-grid-table">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-slate-100 border border-slate-200 p-2 text-left w-32">Jam</th>
                    {(grid.days || []).map((d) => (
                      <th key={d} className="bg-slate-100 border border-slate-200 p-2 capitalize min-w-[140px]">{DAY_LABELS[d]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(grid.slots || []).map((slot, idx) => (
                    <tr key={idx}>
                      <td className={`sticky left-0 border border-slate-200 p-2 ${slot.is_break ? 'bg-amber-50' : 'bg-slate-50'}`}>
                        <div className="font-semibold text-slate-800">{slot.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">{slot.start_time}-{slot.end_time}</div>
                      </td>
                      {(grid.days || []).map((day) => {
                        const s = grid.grid?.[day]?.[slot.start_time];
                        if (slot.is_break) {
                          return <td key={day} className="border border-slate-200 p-1 bg-amber-50 text-center text-amber-700 italic">Istirahat</td>;
                        }
                        return (
                          <td key={day} className="border border-slate-200 p-1 align-top">
                            {s ? (
                              <button type="button" onClick={() => openEdit(s)} className="w-full text-left p-2 rounded bg-[#006837]/5 hover:bg-[#006837]/10 border border-[#006837]/20" data-testid={`grid-cell-${day}-${slot.start_time}`}>
                                <div className="font-semibold text-[#006837] truncate">{s.subject_code}</div>
                                <div className="text-[10px] text-slate-700 truncate">{filterMode === 'class' ? s.teacher_name : s.class_name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{s.room_name}</div>
                              </button>
                            ) : (
                              <button type="button" onClick={() => openCreate(day, slot.start_time, slot.end_time)} className="w-full h-12 rounded border border-dashed border-slate-300 hover:border-[#006837] hover:bg-[#006837]/5 transition-colors text-slate-300 hover:text-[#006837] text-xs" data-testid={`grid-empty-${day}-${slot.start_time}`}>+</button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {(grid.days || []).length === 0 && (
                <div className="text-center py-8 text-slate-500">Atur hari aktif & jam mengajar di menu Pengaturan terlebih dahulu</div>
              )}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table data-testid="admin-schedules-table">
            <TableHeader><TableRow>
              <TableHead>Hari</TableHead><TableHead>Jam</TableHead><TableHead>Kelas</TableHead><TableHead>Mapel</TableHead><TableHead>Guru</TableHead><TableHead>Ruang</TableHead><TableHead className="text-right">Aksi</TableHead>
            </TableRow></TableHeader>
            <TableBody>{items.map((s) => (
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
        </TabsContent>
      </Tabs>

      {/* Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Jadwal' : 'Tambah Jadwal'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Hari</Label>
              <Select value={form.day} onValueChange={(v) => setForm({...form, day: v})}>
                <SelectTrigger data-testid="schedule-form-day"><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_DAYS.map((d) => <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>)}</SelectContent>
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

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Import Jadwal dari Excel</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-600">1. Download template Excel terlebih dulu.</p>
            <Button onClick={downloadTemplate} variant="outline" className="w-full gap-2"><Download className="h-4 w-4" /> Download Template Excel</Button>
            <p className="text-sm text-slate-600">2. Isi data jadwal sesuai format di template (lihat sheet INSTRUKSI).</p>
            <p className="text-sm text-slate-600">3. Upload file Excel yang sudah diisi:</p>
            <Button onClick={() => fileRef.current?.click()} className="w-full bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="import-file-trigger"><Upload className="h-4 w-4" /> Pilih File .xlsx</Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xlsm" onChange={handleImport} className="hidden" data-testid="import-file-input" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
