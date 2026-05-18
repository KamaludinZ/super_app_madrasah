import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Calendar, Plus, Pencil, Trash2, Send, Lock, Info,
  CheckCircle2, AlertCircle, FileText, LayoutGrid, List,
} from 'lucide-react';
import { api, DAY_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const ALL_DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const EMPTY = { day: 'senin', start_time: '07:00', end_time: '08:00', class_id: '', subject_id: '', room_id: '', semester: 'ganjil', academic_year_id: '' };

function StatusBadge({ status }) {
  if (status === 'locked') return <Badge className="bg-rose-100 text-rose-700 border-rose-200 gap-1"><Lock className="h-3 w-3" /> Terkunci</Badge>;
  if (status === 'approved') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="h-3 w-3" /> Disetujui</Badge>;
  if (status === 'submitted') return <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1"><Send className="h-3 w-3" /> Terkirim</Badge>;
  return <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1"><FileText className="h-3 w-3" /> Draft</Badge>;
}

export default function MySchedulePage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [grid, setGrid] = useState({ days: [], slots: [], grid: {} });
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [gridMode, setGridMode] = useState('view'); // 'view' (own schedule) | 'input' (by class for conflict checking)
  const [selectedClassId, setSelectedClassId] = useState('');
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeAY, setActiveAY] = useState(null);
  const [teachingSlots, setTeachingSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const loadGridData = async () => {
    // In view mode: show teacher's own schedule
    // In input mode: show selected class schedule with all teachers
    const params = {};
    if (gridMode === 'view') {
      params.teacher_id = user?.id;
    } else if (gridMode === 'input' && selectedClassId) {
      params.class_id = selectedClassId;
    }
    const g = await api.get('/schedules/grid', { params });

    // Process grid data to ensure status field in grid items
    const gridData = g.data || { days: [], slots: [], grid: {} };
    console.log('Grid days:', gridData.days);
    console.log('Grid slots:', gridData.slots);
    console.log('Grid grid object:', gridData.grid);

    if (gridData.grid) {
      console.log('=== GRID DEBUG ===');
      console.log('Available slot times:', gridData.slots.map(s => s.start_time));
      Object.keys(gridData.grid).forEach(day => {
        const dayTimes = Object.keys(gridData.grid[day]);
        console.log(`Day ${day} has ${dayTimes.length} schedules at times:`, dayTimes);
        Object.keys(gridData.grid[day]).forEach(time => {
          if (gridData.grid[day][time]) {
            const sch = gridData.grid[day][time];
            console.log(`  - Schedule at ${time}:`, {
              subject: sch.subject_name,
              class: sch.class_name,
              teacher: sch.teacher_name,
              start: sch.start_time,
              status: sch.status
            });
            gridData.grid[day][time].status = gridData.grid[day][time].status || 'draft';
          }
        });
      });
      console.log('=== END GRID DEBUG ===');
    }
    setGrid(gridData);
  };

  const refresh = async () => {
    try {
      const ay = await api.get('/academic-years/active');
      const activeAYData = ay.data;

      const [s, c, sub, r, settings] = await Promise.all([
        // Use grouped endpoint for JTM grouping
        api.get('/schedules/grouped', { params: { teacher_id: user?.id } }),
        // Load classes for active academic year
        activeAYData ? api.get('/classes', { params: { academic_year_id: activeAYData.id } }) : api.get('/classes'),
        api.get('/subjects'),
        api.get('/rooms'),
        api.get('/settings'),
      ]);
      console.log('MySchedulePage - grouped items:', s.data);

      // Ensure status field exists with default 'draft'
      const itemsWithStatus = (s.data || []).map(item => ({
        ...item,
        status: item.status || 'draft'
      }));
      setItems(itemsWithStatus);
      setClasses(c.data || []);
      setSubjects(sub.data || []);
      setRooms(r.data || []);
      setActiveAY(activeAYData);
      // Get teaching slots from settings, filter out break times
      const slots = settings.data?.teaching_slots || [];
      setTeachingSlots(slots.filter(slot => !slot.is_break));

      // Load initial grid data
      await loadGridData();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [user?.id]);
  useEffect(() => { if (viewMode === 'grid') loadGridData(); }, [gridMode, selectedClassId]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, academic_year_id: activeAY?.id, semester: activeAY?.active_semester || 'ganjil', teacher_id: user?.id });
    setOpen(true);
  };
  const openEdit = (s) => {
    if (s.status === 'locked') { toast.error('Jadwal terkunci tidak bisa diedit'); return; }
    if (s.status === 'submitted') { toast.error('Jadwal sudah dikirim ke admin, tidak bisa diedit lagi'); return; }
    setEditing(s);
    setForm({ ...s });
    setOpen(true);
  };
  const handleSubmit = async () => {
    if (!form.class_id || !form.subject_id || !form.room_id) {
      toast.error('Kelas, Mapel, dan Ruang wajib dipilih');
      return;
    }
    try {
      const payload = { ...form, teacher_id: user.id };
      if (editing) await api.put(`/schedules/${editing.id}`, payload);
      else await api.post('/schedules', payload);
      toast.success('Jadwal disimpan sebagai draft');
      setOpen(false); await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Gagal'); }
  };
  const handleDelete = async (s) => {
    if (s.status === 'locked') { toast.error('Jadwal terkunci tidak bisa dihapus'); return; }
    if (!window.confirm('Hapus jadwal ini?')) return;
    try { await api.delete(`/schedules/${s.id}`); toast.success('Dihapus'); await refresh(); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Gagal'); }
  };
  const handleSubmitDraft = async (s) => {
    if (!window.confirm(`Kirim jadwal "${s.subject_name} - ${s.class_name}" ke Admin? Setelah dikirim Anda tidak bisa edit lagi.`)) return;
    try { await api.put(`/schedules/${s.id}/submit`); toast.success('Jadwal terkirim ke Admin'); await refresh(); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Gagal'); }
  };
  const handleSubmitAllDrafts = async () => {
    const drafts = items.filter((s) => s.status === 'draft');
    if (drafts.length === 0) { toast.error('Tidak ada draft untuk dikirim'); return; }
    if (!window.confirm(`Kirim ${drafts.length} jadwal draft ke Admin sekaligus?`)) return;
    try {
      for (const d of drafts) {
        await api.put(`/schedules/${d.id}/submit`);
      }
      toast.success(`${drafts.length} jadwal terkirim ke Admin`);
      await refresh();
    } catch (e) { toast.error('Sebagian gagal: ' + (e?.response?.data?.detail || '')); }
  };

  if (loading) return <div className="text-sm text-slate-500">Memuat...</div>;

  const drafts = items.filter((s) => s.status === 'draft');
  const submitted = items.filter((s) => s.status === 'submitted');
  const approved = items.filter((s) => s.status === 'approved');
  const locked = items.filter((s) => s.status === 'locked');

  return (
    <div className="space-y-6" data-testid="my-schedule-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Calendar className="h-3 w-3 mr-1" /> Jadwal Mengajar Saya
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Atur Jadwal Mengajar</h1>
          <p className="text-sm text-slate-600 mt-1">Atur jadwal Anda sendiri (draft), kirim ke Admin, lalu Admin akan mengunci jadwal final</p>
        </div>
        <div className="flex gap-2">
          {drafts.length > 0 && viewMode === 'list' && (
            <Button onClick={handleSubmitAllDrafts} variant="outline" className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50" data-testid="submit-all-button">
              <Send className="h-4 w-4" /> Kirim Semua Draft ({drafts.length})
            </Button>
          )}
          {viewMode === 'list' && (
            <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-schedule-button">
              <Plus className="h-4 w-4" /> Tambah Jadwal
            </Button>
          )}
        </div>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-700" />
        <AlertDescription className="text-blue-900 text-sm">
          <strong>Alur Jadwal:</strong> 1️⃣ <strong>Draft</strong> (Anda bisa edit) → 2️⃣ Klik <strong>Kirim</strong> ke Admin → 3️⃣ <strong>Terkirim</strong> (menunggu persetujuan) → 4️⃣ Admin <strong>Menyetujui</strong> → 5️⃣ Admin <strong>Mengunci</strong> jadwal final (status: <strong>Terkunci</strong>)
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard icon={FileText} label="Draft" value={drafts.length} color="bg-amber-50 border-amber-200 text-amber-700" />
        <StatCard icon={Send} label="Terkirim" value={submitted.length} color="bg-blue-50 border-blue-200 text-blue-700" />
        <StatCard icon={CheckCircle2} label="Disetujui" value={approved.length} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <StatCard icon={Lock} label="Terkunci" value={locked.length} color="bg-rose-50 border-rose-200 text-rose-700" />
      </div>

      {/* View Mode Toggle */}
      <div className="flex justify-end gap-2">
        <Button variant={viewMode === 'grid' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('grid')} className={viewMode === 'grid' ? 'bg-[#006837]' : ''}>
          <LayoutGrid className="h-4 w-4 mr-1" /> Grid
        </Button>
        <Button variant={viewMode === 'list' ? 'default' : 'outline'} size="sm" onClick={() => setViewMode('list')} className={viewMode === 'list' ? 'bg-[#006837]' : ''}>
          <List className="h-4 w-4 mr-1" /> List
        </Button>
      </div>

      {viewMode === 'grid' ? (
        <>
          {/* Grid Mode Controls */}
          <Card>
            <CardContent className="p-4 flex flex-wrap items-center gap-3">
              <div className="flex gap-2">
                <Button
                  variant={gridMode === 'view' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGridMode('view')}
                  className={gridMode === 'view' ? 'bg-[#006837]' : ''}
                >
                  Lihat Jadwal Saya
                </Button>
                <Button
                  variant={gridMode === 'input' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGridMode('input')}
                  className={gridMode === 'input' ? 'bg-[#006837]' : ''}
                >
                  Input Jadwal (Per Kelas)
                </Button>
              </div>
              {gridMode === 'input' && (
                <div className="flex-1 min-w-[200px]">
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kelas untuk input jadwal..." />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
          {gridMode === 'input' && !selectedClassId && (
            <Alert className="border-amber-200 bg-amber-50">
              <Info className="h-4 w-4 text-amber-700" />
              <AlertDescription className="text-amber-900 text-sm">
                Pilih kelas terlebih dahulu untuk melihat jadwal kelas dan menghindari bentrok dengan guru lain.
              </AlertDescription>
            </Alert>
          )}
          <Card>
          <CardContent className="p-3">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
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
                        const statusColors = {
                          draft: 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900',
                          submitted: 'bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-900',
                          approved: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900',
                          locked: 'bg-rose-100 hover:bg-rose-200 border-rose-400 text-rose-900',
                        };
                        const sStatus = s?.status || 'draft';
                        const cellClass = statusColors[sStatus];
                        return (
                          <td key={day} className="border border-slate-200 p-1 align-top">
                            {s ? (
                              <button
                                type="button"
                                onClick={() => {
                                  // In view mode: only edit if it's user's own schedule and draft
                                  // In input mode: only edit if it's user's own schedule and draft
                                  if (s.teacher_id === user?.id && s.status === 'draft') {
                                    openEdit(s);
                                  }
                                }}
                                disabled={gridMode === 'view' ? s.status !== 'draft' : s.teacher_id !== user?.id || s.status !== 'draft'}
                                className={`w-full text-left p-2 rounded border ${cellClass} transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
                              >
                                <div className="font-semibold truncate flex items-center gap-1">
                                  <span>{s.subject_code || s.subject_name?.slice(0, 8)}</span>
                                  {sStatus === 'locked' && <Lock className="h-2.5 w-2.5 inline-block" />}
                                  {sStatus === 'approved' && <CheckCircle2 className="h-2.5 w-2.5 inline-block" />}
                                  {sStatus === 'submitted' && <Send className="h-2.5 w-2.5 inline-block" />}
                                </div>
                                {gridMode === 'input' && (
                                  <div className="text-[10px] truncate opacity-90 font-semibold text-blue-700">{s.teacher_name}</div>
                                )}
                                <div className="text-[10px] truncate opacity-90">{s.class_name}</div>
                                <div className="text-[10px] font-mono opacity-70">{s.room_name}</div>
                              </button>
                            ) : (
                              gridMode === 'input' && selectedClassId ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForm({
                                      ...EMPTY,
                                      day,
                                      start_time: slot.start_time,
                                      end_time: slot.end_time,
                                      class_id: selectedClassId,
                                      academic_year_id: activeAY?.id,
                                      semester: activeAY?.active_semester || 'ganjil',
                                      teacher_id: user?.id
                                    });
                                    setOpen(true);
                                  }}
                                  className="w-full h-12 rounded border border-dashed border-slate-300 hover:border-[#006837] hover:bg-[#006837]/5 transition-colors text-slate-300 hover:text-[#006837] text-xs"
                                >
                                  +
                                </button>
                              ) : null
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {(grid.days || []).length === 0 && (
                <div className="text-center py-8 text-slate-500">Loading grid...</div>
              )}
            </div>
          </CardContent>
        </Card>
        </>
      ) : (
        <Card>
        <CardContent className="p-3">
          <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
            <span className="font-semibold">JTM (Jam Tugas Mengajar):</span> Jam mengajar berdekatan di kelas, hari, dan mata pelajaran yang sama digabung menjadi 1 entry.
          </div>
        </CardContent>
        <CardContent className="p-0">
          <Table data-testid="my-schedule-table">
            <TableHeader><TableRow>
              <TableHead>Hari</TableHead><TableHead>Jam</TableHead><TableHead>JTM</TableHead><TableHead>Kelas</TableHead>
              <TableHead>Mata Pelajaran</TableHead><TableHead>Ruang</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id} data-testid={`schedule-row-${s.id}`}>
                  <TableCell className="capitalize font-semibold">{DAY_LABELS[s.day]}</TableCell>
                  <TableCell className="font-mono text-sm">
                    <div>{s.hour_range || `Jam ke-${s.slot_index + 1 || '?'}`}</div>
                    <div className="text-[10px] text-slate-500">{s.time_range || `${s.start_time}–${s.end_time}`}</div>
                  </TableCell>
                  <TableCell className="font-semibold text-[#006837]">
                    {s.jtm_count || 1} JTM
                  </TableCell>
                  <TableCell>{s.class_name || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-slate-100 rounded px-1.5 py-0.5">{s.subject_code}</span>
                      <span className="text-sm">{s.subject_name || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{s.room_name || '-'}</TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {s.status === 'draft' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleSubmitDraft(s)}
                            className="border-blue-300 text-blue-700 hover:bg-blue-50 gap-1"
                            data-testid={`submit-${s.id}`}>
                            <Send className="h-3.5 w-3.5" /> Kirim
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(s)} data-testid={`edit-${s.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(s)} className="text-rose-600" data-testid={`delete-${s.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {s.status === 'submitted' && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Send className="h-3 w-3 text-blue-600" /> Menunggu Persetujuan
                        </Badge>
                      )}
                      {s.status === 'approved' && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Disetujui
                        </Badge>
                      )}
                      {s.status === 'locked' && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Lock className="h-3 w-3 text-rose-600" /> Final
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500">
                  <Calendar className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                  <div className="font-semibold">Belum ada jadwal</div>
                  <div className="text-sm mt-1">Klik "Tambah Jadwal" untuk mulai mengatur jadwal mengajar Anda</div>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit Jadwal Draft' : 'Tambah Jadwal Baru'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <Label>Hari</Label>
              <Select value={form.day} onValueChange={(v) => setForm({ ...form, day: v })}>
                <SelectTrigger data-testid="form-day"><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_DAYS.map((d) => <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Jam Mengajar *</Label>
              <Select
                value={`${form.start_time}-${form.end_time}`}
                onValueChange={(v) => {
                  const [start, end] = v.split('-');
                  setForm({ ...form, start_time: start, end_time: end });
                }}
              >
                <SelectTrigger data-testid="form-time-slot"><SelectValue placeholder="Pilih jam mengajar..." /></SelectTrigger>
                <SelectContent>
                  {teachingSlots.map((slot, idx) => (
                    <SelectItem key={idx} value={`${slot.start_time}-${slot.end_time}`}>
                      {slot.name} ({slot.start_time} - {slot.end_time})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Kelas *</Label>
              <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                <SelectTrigger data-testid="form-class"><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Mata Pelajaran *</Label>
              <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
                <SelectTrigger data-testid="form-subject"><SelectValue placeholder="Pilih mapel..." /></SelectTrigger>
                <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Ruang *</Label>
              <Select value={form.room_id} onValueChange={(v) => setForm({ ...form, room_id: v })}>
                <SelectTrigger data-testid="form-room"><SelectValue placeholder="Pilih ruang..." /></SelectTrigger>
                <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <AlertDescription className="text-amber-900 text-xs">
                  Jadwal akan tersimpan sebagai <strong>Draft</strong>. Setelah selesai mengisi semua jadwal, klik <strong>Kirim ke Admin</strong> untuk submit.
                </AlertDescription>
              </Alert>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]" data-testid="form-submit">
              {editing ? 'Simpan Perubahan' : 'Tambah sebagai Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums mt-1">{value}</div>
    </div>
  );
}
