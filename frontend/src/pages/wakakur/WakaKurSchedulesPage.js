import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Calendar, LayoutGrid, List, Lock, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, DAY_LABELS } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const ALL_DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];

export default function WakaKurSchedulesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [grid, setGrid] = useState({ days: [], slots: [], grid: {} });
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [activeAY, setActiveAY] = useState(null);
  const [teachingSlots, setTeachingSlots] = useState([]);
  const [allTeachingSlots, setAllTeachingSlots] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSchedule, setDetailSchedule] = useState(null);
  const [filterMode, setFilterMode] = useState('class'); // class | teacher
  const [filterValue, setFilterValue] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // grid | list

  // Sorting state for list view
  const [sortColumn, setSortColumn] = useState('day'); // day, class_name, subject_name, teacher_name, jtm_count
  const [sortDirection, setSortDirection] = useState('asc'); // asc, desc

  const loadGrid = async (mode, val) => {
    const params = {};
    if (val && val !== 'all' && val !== '') {
      if (mode === 'class') params.class_id = val;
      else params.teacher_id = val;
    }
    const { data } = await api.get('/schedules/grid', { params });
    setGrid(data);

    // For list view, fetch grouped schedules with JTM
    const { data: groupedData } = await api.get('/schedules/grouped', { params });
    setItems(groupedData || []);
  };

  useEffect(() => {
    if (!user) return; // Wait for user to be loaded

    (async () => {
      const ay = await api.get('/academic-years/active');
      setActiveAY(ay.data);
      const [c, sub, r, u, settings] = await Promise.all([
        api.get('/wakakur/classes'),
        api.get('/wakakur/subjects'),
        api.get('/rooms'),
        api.get('/wakakur/users'),
        api.get('/settings'),
      ]);

      setClasses(c.data);
      setSubjects(sub.data);
      setRooms(r.data);
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
  }, [user]);

  useEffect(() => { loadGrid(filterMode, filterValue); }, [filterMode, filterValue]);

  // Handle column header click for sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort items based on current sort column and direction
  const sortedItems = [...items].sort((a, b) => {
    let aVal, bVal;

    switch (sortColumn) {
      case 'day':
        // Sort by day order
        const dayOrder = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
        aVal = dayOrder.indexOf(a.day?.toLowerCase() || '');
        bVal = dayOrder.indexOf(b.day?.toLowerCase() || '');
        break;
      case 'jam':
        // Sort by start_time
        aVal = a.start_time || '';
        bVal = b.start_time || '';
        break;
      case 'jtm':
        // Sort by jtm_count
        aVal = a.jtm_count || 1;
        bVal = b.jtm_count || 1;
        break;
      case 'class':
        // Sort by class_name
        aVal = (a.class_name || '').toLowerCase();
        bVal = (b.class_name || '').toLowerCase();
        break;
      case 'subject':
        // Sort by subject_name
        aVal = (a.subject_name || '').toLowerCase();
        bVal = (b.subject_name || '').toLowerCase();
        break;
      case 'teacher':
        // Sort by teacher_name
        aVal = (a.teacher_name || '').toLowerCase();
        bVal = (b.teacher_name || '').toLowerCase();
        break;
      case 'room':
        // Sort by room_name
        aVal = (a.room_name || '').toLowerCase();
        bVal = (b.room_name || '').toLowerCase();
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const openDetail = (s) => {
    setDetailSchedule(s);
    setDetailOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Calendar className="h-3 w-3 mr-1" /> Jadwal Pelajaran (Waka Kurikulum)
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold">Jadwal Pelajaran</h1>
          <p className="text-sm text-slate-600 mt-1">{items.length} jadwal • TP {activeAY?.name || '-'} (Read-Only)</p>
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
            {/* Color Legend */}
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
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs" data-testid="schedule-grid-table">
                <thead>
                  <tr>
                    {(grid.days || []).map((d) => (
                      <React.Fragment key={d}>
                        <th className="bg-slate-200 border border-slate-300 p-2 text-left w-28">Jam</th>
                        <th className="bg-slate-100 border border-slate-200 p-2 capitalize min-w-[140px]">{DAY_LABELS[d]}</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const slotsData = grid.slots || {};

                    // Find maximum number of slots across all days
                    let maxSlots = 0;
                    if (Array.isArray(slotsData)) {
                      maxSlots = slotsData.length;
                    } else {
                      Object.values(slotsData).forEach(daySlots => {
                        maxSlots = Math.max(maxSlots, daySlots.length);
                      });
                    }

                    const rows = [];
                    for (let slotIdx = 0; slotIdx < maxSlots; slotIdx++) {
                      rows.push(
                        <tr key={`slot-${slotIdx}`}>
                          {(grid.days || []).map((day) => {
                            const daySlotsData = Array.isArray(slotsData) ? slotsData : (slotsData[day] || []);
                            const slot = daySlotsData[slotIdx];

                            if (!slot) {
                              // Empty slot for this day
                              return (
                                <React.Fragment key={day}>
                                  <td className="border border-slate-200 p-1 bg-slate-100"></td>
                                  <td className="border border-slate-200 p-1 bg-slate-100"></td>
                                </React.Fragment>
                              );
                            }

                            const s = grid.grid?.[day]?.[slot.start_time];

                            // Time column
                            const timeCell = (
                              <td className={`border border-slate-200 p-2 ${slot.is_break ? 'bg-amber-50' : 'bg-slate-50'}`}>
                                <div className="font-semibold text-slate-800 text-[11px]">{slot.name}</div>
                                <div className="font-mono text-[10px] text-slate-500">{slot.start_time}-{slot.end_time}</div>
                              </td>
                            );

                            // Schedule cell
                            let scheduleCell;
                            if (slot.is_break) {
                              scheduleCell = (
                                <td className="border border-slate-200 p-1 bg-amber-50 text-center text-amber-700 italic">Istirahat</td>
                              );
                            } else if (s) {
                              const statusColors = {
                                draft: 'bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-900',
                                submitted: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900',
                                locked: 'bg-sky-100 hover:bg-sky-200 border-sky-400 text-sky-900',
                              };
                              const sStatus = s?.status || 'submitted';
                              const cellClass = statusColors[sStatus] || statusColors.submitted;
                              scheduleCell = (
                                <td className="border border-slate-200 p-1 align-top">
                                  <button type="button" onClick={() => openDetail(s)} className={`w-full text-left p-2 rounded border ${cellClass} transition-colors`} data-testid={`grid-cell-${day}-${slot.start_time}`} title={`${s.subject_name || s.subject_code} • ${s.teacher_name || ''} • ${sStatus}`}>
                                    <div className="font-semibold truncate flex items-center gap-1">
                                      <span>{s.subject_code || s.subject_name?.slice(0, 8)}</span>
                                      {sStatus === 'locked' && <Lock className="h-2.5 w-2.5 inline-block opacity-70" />}
                                      {sStatus === 'draft' && <span className="text-[9px] opacity-70">[D]</span>}
                                    </div>
                                    <div className="text-[10px] truncate opacity-90">{filterMode === 'class' ? s.teacher_name : s.class_name}</div>
                                    <div className="text-[10px] font-mono opacity-70">{s.room_name}</div>
                                  </button>
                                </td>
                              );
                            } else {
                              scheduleCell = (
                                <td className="border border-slate-200 p-1 align-top">
                                  <div className="w-full h-12 rounded border border-dashed border-slate-300 bg-slate-50"></div>
                                </td>
                              );
                            }

                            return (
                              <React.Fragment key={day}>
                                {timeCell}
                                {scheduleCell}
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      );
                    }
                    return rows;
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
          <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table data-testid="wakakur-schedules-table">
            <TableHeader><TableRow>
              <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('day')}>
                <div className="flex items-center gap-1">
                  Hari
                  {sortColumn === 'day' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('jam')}>
                <div className="flex items-center gap-1">
                  Jam
                  {sortColumn === 'jam' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('jtm')}>
                <div className="flex items-center gap-1">
                  JTM
                  {sortColumn === 'jtm' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('class')}>
                <div className="flex items-center gap-1">
                  Kelas
                  {sortColumn === 'class' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('subject')}>
                <div className="flex items-center gap-1">
                  Mapel
                  {sortColumn === 'subject' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('teacher')}>
                <div className="flex items-center gap-1">
                  Guru
                  {sortColumn === 'teacher' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </TableHead>
              <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('room')}>
                <div className="flex items-center gap-1">
                  Ruang
                  {sortColumn === 'room' ? (
                    sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                  ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                </div>
              </TableHead>
              <TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>{sortedItems.map((s) => {
              return (
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
              </TableRow>
              );
            })}</TableBody>
          </Table></div></CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog (Read-Only) */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Detail Jadwal</DialogTitle></DialogHeader>
          {detailSchedule && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-slate-500">Hari</Label>
                <div className="font-semibold capitalize">{DAY_LABELS[detailSchedule.day]}</div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Jam Mengajar</Label>
                  <div className="font-semibold">{detailSchedule.hour_range || `Jam ke-${detailSchedule.slot_index + 1 || '?'}`}</div>
                  <div className="text-xs text-slate-500">{detailSchedule.time_range || `${detailSchedule.start_time}-${detailSchedule.end_time}`}</div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">JTM</Label>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold">
                    {detailSchedule.jtm_count || 1} JTM
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Kelas</Label>
                <div className="font-semibold">{detailSchedule.class_name}</div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Mata Pelajaran</Label>
                <div className="font-semibold">{detailSchedule.subject_name}</div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Guru Pengajar</Label>
                <div className="font-semibold">{detailSchedule.teacher_name}</div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Ruangan</Label>
                <div className="font-semibold font-mono">{detailSchedule.room_name || '-'}</div>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Status</Label>
                <div>
                  {detailSchedule.status === 'locked' ? (
                    <Badge className="bg-rose-100 text-rose-700 border-rose-200 gap-1">
                      <Lock className="h-3 w-3" /> Terkunci
                    </Badge>
                  ) : detailSchedule.status === 'approved' ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Disetujui</Badge>
                  ) : detailSchedule.status === 'submitted' ? (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">Terkirim</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">Draft</Badge>
                  )}
                </div>
              </div>
              <div className="pt-4 border-t">
                <Button variant="outline" onClick={() => setDetailOpen(false)} className="w-full">Tutup</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
