import React, { useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, Calendar, Download, Upload, LayoutGrid, List, FileSpreadsheet, Lock, Unlock } from 'lucide-react';
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
  const [teachingSlots, setTeachingSlots] = useState([]);
  const [allTeachingSlots, setAllTeachingSlots] = useState(null); // Store full settings
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterMode, setFilterMode] = useState('class'); // class | teacher
  const [filterValue, setFilterValue] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid | list
  const [form, setForm] = useState({ class_id: '', subject_id: '', teacher_id: '', room_id: '', day: 'senin', start_time: '07:00', end_time: '08:30', semester: 'ganjil', academic_year_id: '' });
  const [selectedSlots, setSelectedSlots] = useState([]); // v1.1.1: Multi-slot selector
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef(null);

  const loadGrid = async (mode, val) => {
    const params = {};
    if (val && val !== 'all' && val !== '') {
      if (mode === 'class') params.class_id = val;
      else params.teacher_id = val;
    }
    console.log('Loading grid with params:', params);
    const { data } = await api.get('/schedules/grid', { params });
    console.log('Grid data received:', data);
    console.log('Grid.days:', data.days);
    console.log('Grid.slots:', data.slots);
    console.log('Grid.grid:', data.grid);
    console.log('Grid.schedules length:', data.schedules?.length);
    setGrid(data);

    // For list view, fetch grouped schedules with JTM
    const { data: groupedData } = await api.get('/schedules/grouped', { params });
    console.log('Grouped schedules with JTM:', groupedData);
    setItems(groupedData || []);
  };

  useEffect(() => {
    (async () => {
      const ay = await api.get('/academic-years/active');
      setActiveAY(ay.data);
      const [c, sub, r, u, settings] = await Promise.all([
        api.get('/classes'), api.get('/subjects'), api.get('/rooms'), api.get('/users'), api.get('/settings'),
      ]);
      setClasses(c.data); setSubjects(sub.data); setRooms(r.data);
      setTeachers(u.data.filter((x) => x.roles?.some((rr) => ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'].includes(rr))));

      // Store full teaching slots settings
      const slotsData = settings.data?.teaching_slots || [];
      setAllTeachingSlots(slotsData);

      // Get initial teaching slots (use first day or global)
      let allSlots = [];
      if (Array.isArray(slotsData)) {
        // Legacy: global slots
        allSlots = slotsData;
      } else if (typeof slotsData === 'object') {
        // New: per-day slots - use senin as default
        allSlots = slotsData['senin'] || Object.values(slotsData)[0] || [];
      }
      setTeachingSlots(allSlots.filter(slot => !slot.is_break));
      await loadGrid('class', 'all');
    })();
  }, []);

  useEffect(() => { loadGrid(filterMode, filterValue); }, [filterMode, filterValue]);

  // Update teaching slots when selected day changes
  useEffect(() => {
    if (!allTeachingSlots) return;

    let daySlots = [];
    if (Array.isArray(allTeachingSlots)) {
      // Global slots - same for all days
      daySlots = allTeachingSlots;
    } else if (typeof allTeachingSlots === 'object') {
      // Per-day slots - get slots for selected day
      daySlots = allTeachingSlots[form.day] || [];
    }
    setTeachingSlots(daySlots.filter(slot => !slot.is_break));
  }, [form.day, allTeachingSlots]);

  const openCreate = (presetDay, presetStart, presetEnd) => {
    setEditing(null);
    setForm({
      class_id: filterMode === 'class' && filterValue && filterValue !== 'all' ? filterValue : '',
      subject_id: '', teacher_id: filterMode === 'teacher' && filterValue && filterValue !== 'all' ? filterValue : '',
      room_id: '', day: presetDay || 'senin',
      start_time: presetStart || '07:00', end_time: presetEnd || '08:30',
      semester: activeAY?.active_semester || 'ganjil', academic_year_id: activeAY?.id,
    });
    setSelectedSlots([]); // v1.1.1: Reset multi-slot selection
    setOpen(true);
  };
  const openEdit = (s) => {
    setEditing(s);
    setForm({ ...s, academic_year_id: s.academic_year_id || activeAY?.id });
    // v1.1.1: Load existing slot_indexes if available
    setSelectedSlots(s.slot_indexes || []);
    setOpen(true);
  };

  // v1.1.1: Multi-slot toggle handler
  const handleSlotToggle = (index) => {
    if (selectedSlots.includes(index)) {
      setSelectedSlots(selectedSlots.filter(i => i !== index));
    } else {
      setSelectedSlots([...selectedSlots, index].sort((a, b) => a - b));
    }
  };
  const handleSubmit = async () => {
    if (!form.class_id || !form.subject_id || !form.teacher_id) { toast.error('Lengkapi semua field wajib'); return; }

    // v1.1.1: Build payload with slot_indexes if multi-slot is used
    const payload = { ...form };

    if (selectedSlots.length > 0) {
      // Multi-slot mode: use slot_indexes
      payload.slot_indexes = selectedSlots.sort((a, b) => a - b);
      // Calculate start_time and end_time from selected slots
      const firstSlot = teachingSlots[selectedSlots[0]];
      const lastSlot = teachingSlots[selectedSlots[selectedSlots.length - 1]];
      if (firstSlot && lastSlot) {
        payload.start_time = firstSlot.start_time;
        payload.end_time = lastSlot.end_time;
      }
      // room_id will be auto-assigned from class_id by backend
      delete payload.room_id;
    } else {
      // Single slot mode (legacy): ensure room_id is provided
      if (!form.room_id) { toast.error('Pilih ruang atau gunakan multi-slot selector'); return; }
    }

    try {
      if (editing) await api.put(`/schedules/${editing.id}`, payload);
      else await api.post('/schedules', payload);
      toast.success('Berhasil disimpan'); setOpen(false); await loadGrid(filterMode, filterValue);
    } catch (e) {
      const detail = e?.response?.data?.detail;
      if (e?.response?.status === 409 && typeof detail === 'object') {
        const msg = detail.message || 'Jadwal bentrok';
        // Show conflicts visually
        toast.error(msg, { duration: 8000 });
      } else {
        toast.error(typeof detail === 'string' ? detail : 'Gagal menyimpan');
      }
    }
  };
  const handleDelete = async (s) => {
    if (!window.confirm('Hapus jadwal?')) return;
    await api.delete(`/schedules/${s.id}`); toast.success('Dihapus'); await loadGrid(filterMode, filterValue);
  };
  const handleApprove = async (s) => {
    if (!window.confirm(`Setujui jadwal ini?`)) return;
    try { await api.put(`/schedules/${s.id}/approve`); toast.success('Jadwal disetujui'); await loadGrid(filterMode, filterValue); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Gagal'); }
  };
  const handleLock = async (s) => {
    if (!window.confirm(`Kunci jadwal ini? Setelah dikunci tidak bisa diedit kecuali dibuka kunci.`)) return;
    try { await api.put(`/schedules/${s.id}/lock`); toast.success('Jadwal dikunci'); await loadGrid(filterMode, filterValue); }
    catch (e) {
      const detail = e?.response?.data?.detail;
      const msg = typeof detail === 'object' ? detail.message : (typeof detail === 'string' ? detail : 'Gagal');
      toast.error(msg, { duration: 8000 });
    }
  };
  const handleUnlock = async (s) => {
    if (!window.confirm(`Buka kunci jadwal ini?`)) return;
    try { await api.put(`/schedules/${s.id}/unlock`); toast.success('Kunci dibuka'); await loadGrid(filterMode, filterValue); }
    catch (e) { toast.error(e?.response?.data?.detail || 'Gagal'); }
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
          {viewMode === 'list' && (
            <Button onClick={() => openCreate()} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-schedule-button"><Plus className="h-4 w-4" /> Tambah</Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs uppercase tracking-wide">Tampilkan Per</Label>
            <Select value={filterMode} onValueChange={(v) => { setFilterMode(v); setFilterValue('all'); }}>
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

      <Tabs defaultValue="grid" onValueChange={setViewMode}>
        <TabsList>
          <TabsTrigger value="grid" data-testid="view-tab-grid"><LayoutGrid className="h-4 w-4 mr-1" /> Grid (Hari & Jam)</TabsTrigger>
          <TabsTrigger value="list" data-testid="view-tab-list"><List className="h-4 w-4 mr-1" /> List</TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="mt-4">
          <Card><CardContent className="p-3">
            {/* Color Legend (Phase 6 visual cue) */}
            <div className="flex items-center gap-3 flex-wrap mb-2 px-1 text-[11px] text-slate-600">
              <span className="font-semibold">Petunjuk Status:</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Draft
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Terkirim/Disetujui
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded bg-sky-200 border border-sky-400" /> Terkunci
              </span>
              <span className="ml-auto text-[10px] italic">Cell sudah terisi = bentrok, isi nama guru/mapel sebagai petunjuk</span>
            </div>
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
                  {/* Render slots based on per-day configuration */}
                  {(() => {
                    // Get all unique slots across all days
                    const slotsData = grid.slots || {};
                    const allSlots = [];
                    const slotMap = new Map(); // key: start_time, value: slot object

                    if (Array.isArray(slotsData)) {
                      // Legacy: global slots
                      slotsData.forEach(slot => {
                        allSlots.push(slot);
                        slotMap.set(slot.start_time, slot);
                      });
                    } else {
                      // New: per-day slots - collect all unique time slots
                      Object.values(slotsData).forEach(daySlots => {
                        daySlots.forEach(slot => {
                          if (!slotMap.has(slot.start_time)) {
                            allSlots.push(slot);
                            slotMap.set(slot.start_time, slot);
                          }
                        });
                      });
                      // Sort by start time
                      allSlots.sort((a, b) => a.start_time.localeCompare(b.start_time));
                    }

                    return allSlots.map((slot, idx) => (
                    <tr key={idx}>
                      <td className={`sticky left-0 border border-slate-200 p-2 ${slot.is_break ? 'bg-amber-50' : 'bg-slate-50'}`}>
                        <div className="font-semibold text-slate-800">{slot.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">{slot.start_time}-{slot.end_time}</div>
                      </td>
                      {(grid.days || []).map((day) => {
                        // Check if this slot exists for this specific day
                        const daySlotsData = Array.isArray(slotsData) ? slotsData : (slotsData[day] || []);
                        const daySlot = daySlotsData.find(s => s.start_time === slot.start_time);

                        if (!daySlot) {
                          // This slot doesn't exist for this day
                          return <td key={day} className="border border-slate-200 p-1 bg-slate-100"></td>;
                        }

                        const s = grid.grid?.[day]?.[slot.start_time];
                        if (daySlot.is_break) {
                          return <td key={day} className="border border-slate-200 p-1 bg-amber-50 text-center text-amber-700 italic">Istirahat</td>;
                        }
                        // Color coding by status (Phase 6 visual cue)
                        const statusColors = {
                          draft: 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900',
                          submitted: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900',
                          locked: 'bg-sky-100 hover:bg-sky-200 border-sky-400 text-sky-900',
                        };
                        const sStatus = s?.status || 'submitted';
                        const cellClass = statusColors[sStatus] || statusColors.submitted;
                        return (
                          <td key={day} className="border border-slate-200 p-1 align-top">
                            {s ? (
                              <button type="button" onClick={() => openEdit(s)} className={`w-full text-left p-2 rounded border ${cellClass} transition-colors`} data-testid={`grid-cell-${day}-${slot.start_time}`} title={`${s.subject_name || s.subject_code} • ${s.teacher_name || ''} • ${sStatus}`}>
                                <div className="font-semibold truncate flex items-center gap-1">
                                  <span>{s.subject_code || s.subject_name?.slice(0, 8)}</span>
                                  {sStatus === 'locked' && <Lock className="h-2.5 w-2.5 inline-block opacity-70" />}
                                  {sStatus === 'draft' && <span className="text-[9px] opacity-70">[D]</span>}
                                </div>
                                <div className="text-[10px] truncate opacity-90">{filterMode === 'class' ? s.teacher_name : s.class_name}</div>
                                <div className="text-[10px] font-mono opacity-70">{s.room_name}</div>
                              </button>
                            ) : (
                              <button type="button" onClick={() => openCreate(day, slot.start_time, slot.end_time)} className="w-full h-12 rounded border border-dashed border-slate-300 hover:border-[#006837] hover:bg-[#006837]/5 transition-colors text-slate-300 hover:text-[#006837] text-xs" data-testid={`grid-empty-${day}-${slot.start_time}`}>+</button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                    ));
                  })()}
                </tbody>
              </table>
              {(grid.days || []).length === 0 && (
                <div className="text-center py-8 text-slate-500">Atur hari aktif & jam mengajar di menu Pengaturan terlebih dahulu</div>
              )}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <Card><CardContent className="p-3">
            <div className="mb-3 p-2 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
              <span className="font-semibold">JTM (Jam Tugas Mengajar):</span> Jam mengajar yang berdekatan di kelas, hari, dan mata pelajaran yang sama otomatis digabung menjadi 1 entry. Contoh: Jam ke-2 dan ke-3 Matematika di kelas yang sama = 2 JTM.
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table data-testid="admin-schedules-table">
            <TableHeader><TableRow>
              <TableHead>Hari</TableHead><TableHead>Jam</TableHead><TableHead>JTM</TableHead><TableHead>Kelas</TableHead><TableHead>Mapel</TableHead><TableHead>Guru</TableHead><TableHead>Ruang</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead>
            </TableRow></TableHeader>
            <TableBody>{items.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="capitalize">{DAY_LABELS[s.day]}</TableCell>
                <TableCell className="font-mono">
                  <div>{s.hour_range || `Jam ke-${s.slot_index + 1 || '?'}`}</div>
                  <div className="text-[10px] text-slate-500">{s.time_range || `${s.start_time}-${s.end_time}`}</div>
                </TableCell>
                <TableCell className="font-semibold text-[#006837]">
                  {s.jtm_count || 1} JTM
                </TableCell>
                <TableCell className="font-semibold">{s.class_name || '-'}</TableCell>
                <TableCell>{s.subject_name || '-'}</TableCell>
                <TableCell className="text-sm">{s.teacher_name || '-'}</TableCell>
                <TableCell className="font-mono text-sm">{s.room_name || '-'}</TableCell>
                <TableCell>
                  {s.status === 'locked' ? (
                    <Badge className="bg-rose-100 text-rose-700 border-rose-200 gap-1" data-testid={`status-locked-${s.id}`}>
                      <Lock className="h-3 w-3" /> Terkunci
                    </Badge>
                  ) : s.status === 'approved' ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Disetujui</Badge>
                  ) : s.status === 'submitted' ? (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">Terkirim</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">Draft</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* Status: draft → submitted → approved → locked */}
                    {s.status === 'locked' ? (
                      <span className="text-xs text-slate-500 italic mr-2">Terkunci</span>
                    ) : s.status === 'submitted' ? (
                      <Button size="sm" variant="outline" onClick={() => handleApprove(s)} className="text-blue-600 border-blue-300" title="Setujui Jadwal" data-testid={`approve-${s.id}`}>
                        Setujui
                      </Button>
                    ) : s.status === 'approved' ? (
                      <Button size="sm" variant="outline" onClick={() => handleLock(s)} className="text-rose-600 border-rose-300" title="Kunci Jadwal" data-testid={`lock-${s.id}`}>
                        <Lock className="h-3.5 w-3.5 mr-1" /> Kunci
                      </Button>
                    ) : null}
                    {s.status === 'locked' && (
                      <Button size="sm" variant="ghost" onClick={() => handleUnlock(s)} className="text-emerald-600" title="Buka Kunci" data-testid={`unlock-${s.id}`}>
                        <Unlock className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)} disabled={s.status === 'locked'} title="Edit"><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(s)} className="text-rose-600" disabled={s.status === 'locked'} title="Hapus"><Trash2 className="h-4 w-4" /></Button>
                  </div>
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
              <Select value={form.day} onValueChange={(v) => {
                // When day changes, reset time to first available slot for that day
                const newDaySlots = Array.isArray(allTeachingSlots)
                  ? allTeachingSlots
                  : (allTeachingSlots?.[v] || []);
                const firstSlot = newDaySlots.find(slot => !slot.is_break);
                setForm({
                  ...form,
                  day: v,
                  start_time: firstSlot?.start_time || '07:00',
                  end_time: firstSlot?.end_time || '08:00'
                });
              }}>
                <SelectTrigger data-testid="schedule-form-day"><SelectValue /></SelectTrigger>
                <SelectContent>{ALL_DAYS.map((d) => <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {/* v1.1.1: Multi-Slot Selector */}
            <div className="col-span-2">
              <Label>Jam Mengajar * (Klik untuk pilih lebih dari 1 jam)</Label>
              <div className="grid grid-cols-3 gap-2 mt-2 max-h-64 overflow-y-auto p-2 border border-slate-200 rounded">
                {teachingSlots.map((slot, index) => {
                  const isSelected = selectedSlots.includes(index);
                  return (
                    <button
                      key={index}
                      type="button"
                      className={`p-3 rounded border text-left transition-all ${
                        isSelected
                          ? 'bg-[#006837] text-white border-[#006837] shadow-md'
                          : 'bg-white border-slate-300 hover:border-[#006837] hover:bg-[#006837]/5'
                      }`}
                      onClick={() => handleSlotToggle(index)}
                      data-testid={`slot-selector-${index}`}
                    >
                      <div className="font-semibold text-sm">{slot.name}</div>
                      <div className="text-xs mt-1 opacity-90">
                        {slot.start_time} - {slot.end_time}
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedSlots.length > 0 && (
                <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded text-sm">
                  <span className="font-semibold text-emerald-800">Terpilih:</span>{' '}
                  <span className="text-emerald-700">
                    Jam ke-{selectedSlots.map(i => i + 1).join(', ')}
                  </span>
                  {teachingSlots[selectedSlots[0]] && teachingSlots[selectedSlots[selectedSlots.length - 1]] && (
                    <span className="text-emerald-600 ml-2">
                      ({teachingSlots[selectedSlots[0]].start_time} - {teachingSlots[selectedSlots[selectedSlots.length - 1]].end_time})
                    </span>
                  )}
                  <div className="text-xs text-emerald-600 mt-1">
                    💡 Ruang akan otomatis mengikuti ruang kelas
                  </div>
                </div>
              )}
            </div>
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
            {/* v1.1.1: Hide room selector when multi-slot is used (auto-assigned from class) */}
            {selectedSlots.length === 0 && (
              <div className="col-span-2"><Label>Ruang</Label>
                <Select value={form.room_id} onValueChange={(v) => setForm({...form, room_id: v})}>
                  <SelectTrigger data-testid="schedule-form-room"><SelectValue placeholder="Pilih ruang" /></SelectTrigger>
                  <SelectContent>{rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
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
