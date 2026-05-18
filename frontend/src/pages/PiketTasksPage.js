import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ClipboardList, Plus, Pencil, Trash2, Send, Clock, CheckCircle2,
  AlertCircle, FileText, User, BookOpen, Building, Info,
} from 'lucide-react';
import { api, DAY_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const ATTENDANCE_DEFAULT = { siswa_hadir: 0, siswa_tidak_hadir: 0, siswa_izin: 0, siswa_sakit: 0 };

export default function PiketTasksPage() {
  const { user, activeRole } = useAuth();
  const isPiket = activeRole === 'guru_piket';
  const isAdmin = activeRole === 'admin';
  const isTeacher = ['guru', 'wali_kelas'].includes(activeRole);
  const canFill = isPiket || isAdmin;

  const [tab, setTab] = useState(isTeacher ? 'mine' : 'today');
  const [tasks, setTasks] = useState([]);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({ schedule_id: '', date: new Date().toISOString().slice(0, 10), task_content: '', notes: '', leave_type: '' });
  const [fillOpen, setFillOpen] = useState(false);
  const [fillTarget, setFillTarget] = useState(null);
  const [fillForm, setFillForm] = useState({ materi: '', catatan: '', piket_note: '', ...ATTENDANCE_DEFAULT });
  const [fillStudents, setFillStudents] = useState([]);
  const [fillAttendance, setFillAttendance] = useState({});

  const refresh = async () => {
    try {
      const [t, ts, sch] = await Promise.all([
        api.get('/teacher-tasks'),
        canFill ? api.get('/piket/schedules/today') : Promise.resolve({ data: [] }),
        api.get('/schedules'),
      ]);
      setTasks(t.data || []);
      setTodaySchedules(ts.data || []);
      const all = sch.data || [];
      setSchedules(isTeacher && !isAdmin ? all.filter((s) => s.teacher_id === user?.id) : all);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, [activeRole]);

  const openCreateTask = () => {
    setEditingTask(null);
    setTaskForm({ schedule_id: '', date: new Date().toISOString().slice(0, 10), task_content: '', notes: '', leave_type: '' });
    setTaskOpen(true);
  };
  const openEditTask = (t) => {
    setEditingTask(t);
    setTaskForm({ schedule_id: t.schedule_id, date: t.date, task_content: t.task_content, notes: t.notes || '', leave_type: t.leave_type || '' });
    setTaskOpen(true);
  };
  const submitTask = async () => {
    if (!taskForm.schedule_id || !taskForm.date || !taskForm.task_content) {
      toast.error('Jadwal, tanggal, dan materi tugas wajib');
      return;
    }
    try {
      if (editingTask) await api.put(`/teacher-tasks/${editingTask.id}`, { ...taskForm });
      else await api.post('/teacher-tasks', taskForm);
      toast.success('Tugas titipan disimpan');
      setTaskOpen(false); await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Gagal'); }
  };
  const deleteTask = async (t) => {
    if (!window.confirm(`Hapus tugas titipan?`)) return;
    try { await api.delete(`/teacher-tasks/${t.id}`); toast.success('Dihapus'); await refresh(); }
    catch (e) { toast.error('Gagal hapus'); }
  };

  const acceptTask = async (t) => {
    if (!window.confirm(`Terima tugas titipan dari ${t.teacher_name}?`)) return;
    try {
      await api.put(`/teacher-tasks/${t.id}/accept`);
      toast.success('Tugas diterima');
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menerima tugas');
    }
  };

  const openFill = async (sch, task = null) => {
    setFillTarget({ schedule: sch, task });
    setFillForm({
      materi: task?.task_content || '',
      catatan: '',
      piket_note: task ? `Titipan dari ${sch.teacher_name || 'guru pengajar'}` : 'Diisi oleh guru piket',
      ...ATTENDANCE_DEFAULT,
    });

    // Load students for attendance
    try {
      const res = await api.get('/students', { params: { class_id: sch.class_id } });
      setFillStudents(res.data);
      // Initialize all students as 'hadir'
      const initialAttendance = {};
      res.data.forEach(student => {
        initialAttendance[student.id] = 'hadir';
      });
      setFillAttendance(initialAttendance);
    } catch (e) {
      toast.error('Gagal memuat daftar siswa');
      setFillStudents([]);
      setFillAttendance({});
    }

    setFillOpen(true);
  };
  const submitFill = async () => {
    if (!fillForm.materi.trim()) { toast.error('Materi wajib diisi'); return; }

    // Calculate attendance summary from individual records
    const attendanceSummary = {
      siswa_hadir: 0,
      siswa_tidak_hadir: 0,
      siswa_izin: 0,
      siswa_sakit: 0
    };

    Object.values(fillAttendance).forEach(status => {
      if (status === 'hadir') attendanceSummary.siswa_hadir++;
      else if (status === 'alpa') attendanceSummary.siswa_tidak_hadir++;
      else if (status === 'izin') attendanceSummary.siswa_izin++;
      else if (status === 'sakit') attendanceSummary.siswa_sakit++;
    });

    try {
      await api.post('/piket/fill-journal', {
        schedule_id: fillTarget.schedule.id,
        task_id: fillTarget.task?.id || null,
        materi: fillForm.materi,
        catatan: fillForm.catatan,
        piket_note: fillForm.piket_note,
        ...attendanceSummary,
        attendance_records: fillAttendance, // Send individual records
      });
      toast.success('Jurnal berhasil diisi atas nama guru pengajar');
      setFillOpen(false); await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal isi jurnal');
    }
  };

  if (loading) return <div className="text-sm text-slate-500">Memuat...</div>;

  const myTasks = isTeacher && !isAdmin ? tasks.filter((t) => t.teacher_id === user?.id) : tasks;
  const pendingTasks = tasks.filter((t) => t.status === 'pending');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-6" data-testid="piket-tasks-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <ClipboardList className="h-3 w-3 mr-1" /> {isPiket ? 'Dashboard Piket' : 'Tugas & Titipan'}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {isPiket ? 'Tugas Hari Ini & Titipan' : 'Titipkan Tugas Mengajar'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isPiket ? 'Isi jurnal atas nama guru pengajar yang berhalangan' :
             isAdmin ? 'Pantau & kelola titipan tugas serta jurnal piket' :
             'Titipkan materi pengajaran ke guru piket jika berhalangan hadir'}
          </p>
        </div>
        {(isTeacher || isAdmin) && (
          <Button onClick={openCreateTask} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-task-button">
            <Plus className="h-4 w-4" /> Titipkan Tugas
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200">
          {canFill && <TabsTrigger value="today" data-testid="tab-today">Jadwal Hari Ini <Badge variant="secondary" className="ml-2 px-1.5 text-xs">{todaySchedules.length}</Badge></TabsTrigger>}
          <TabsTrigger value="mine" data-testid="tab-mine">{isTeacher && !isAdmin ? 'Tugas Saya' : 'Semua Titipan'} <Badge variant="secondary" className="ml-2 px-1.5 text-xs">{myTasks.length}</Badge></TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-pending">Menunggu <Badge className="ml-2 px-1.5 text-xs bg-amber-100 text-amber-800 border-amber-200">{pendingTasks.length}</Badge></TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-completed">Selesai <Badge className="ml-2 px-1.5 text-xs bg-emerald-100 text-emerald-800 border-emerald-200">{completedTasks.length}</Badge></TabsTrigger>
        </TabsList>

        {canFill && (
          <TabsContent value="today" className="mt-4">
            <Alert className="border-blue-200 bg-blue-50 mb-3">
              <Info className="h-4 w-4 text-blue-700" />
              <AlertDescription className="text-blue-900 text-sm">
                Jadwal hari ini yang <strong>belum ada jurnal</strong>. Klik "Isi Jurnal" jika guru pengajar tidak bisa hadir dan menitipkan tugas — jurnal akan tercatat sebagai <strong>"Diisi oleh Piket"</strong>.
              </AlertDescription>
            </Alert>
            <Card>
              <CardContent className="p-0">
                <Table data-testid="today-schedules-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Jam</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Mata Pelajaran</TableHead>
                      <TableHead>Guru Pengajar</TableHead>
                      <TableHead>Ruang</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {todaySchedules.map((s) => (
                      <TableRow key={s.id} data-testid={`today-row-${s.id}`}>
                        <TableCell className="font-mono text-sm">{s.start_time} - {s.end_time}</TableCell>
                        <TableCell className="font-semibold">{s.class_name || '-'}</TableCell>
                        <TableCell className="text-sm">{s.subject_name || s.subject_code || '-'}</TableCell>
                        <TableCell className="text-sm">{s.teacher_name || '-'}</TableCell>
                        <TableCell className="text-sm font-mono">{s.room_name || '-'}</TableCell>
                        <TableCell>
                          {s.has_journal ? (
                            s.journal_info?.fill_mode === 'piket' ? (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Sudah Diisi (Piket)
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Sudah Diisi
                              </Badge>
                            )
                          ) : s.task ? (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1">
                              <FileText className="h-3 w-3" /> Ada Titipan
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                              <Clock className="h-3 w-3" /> Belum
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!s.has_journal && (
                            <Button size="sm" variant="outline" onClick={() => openFill(s, s.task)}
                              className="border-[#006837] text-[#006837] hover:bg-[#006837]/5 gap-1"
                              data-testid={`fill-journal-${s.id}`}>
                              <Send className="h-3.5 w-3.5" /> Isi Jurnal
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {todaySchedules.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-500">
                        <ClipboardList className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Tidak ada jadwal hari ini</div>
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {['mine', 'pending', 'completed'].map((sTab) => (
          <TabsContent key={sTab} value={sTab} className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table data-testid={`tasks-table-${sTab}`}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Jadwal Mengajar</TableHead>
                      <TableHead>Kelas</TableHead>
                      <TableHead>Mapel</TableHead>
                      <TableHead>Guru Pengajar</TableHead>
                      <TableHead>Jenis Izin</TableHead>
                      <TableHead>Materi Titipan</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Diterima Oleh</TableHead>
                      <TableHead>Waktu Terima</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(sTab === 'mine' ? myTasks : sTab === 'pending' ? pendingTasks : completedTasks).map((t) => {
                      const leaveTypeLabels = {
                        'sakit': 'Izin Sakit',
                        'cuti': 'Izin Cuti',
                        'dinas_luar': 'Dinas Luar',
                        'lainnya': 'Izin Lainnya'
                      };
                      return (
                        <TableRow key={t.id} data-testid={`task-row-${t.id}`}>
                          <TableCell className="font-mono text-sm">{t.date}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {t.start_time && t.end_time ? `${t.start_time}-${t.end_time}` : '-'}
                          </TableCell>
                          <TableCell className="font-semibold text-sm">{t.class_name || '-'}</TableCell>
                          <TableCell className="text-sm">{t.subject_name || t.subject_code || '-'}</TableCell>
                          <TableCell className="text-sm">{t.teacher_name || '-'}</TableCell>
                          <TableCell className="text-xs">
                            {t.leave_type ? (
                              <Badge variant="outline" className="text-xs">
                                {leaveTypeLabels[t.leave_type] || t.leave_type}
                              </Badge>
                            ) : (
                              <span className="text-slate-400 italic">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm max-w-[200px]">
                            <div className="line-clamp-2">{t.task_content}</div>
                          </TableCell>
                          <TableCell className="text-xs max-w-[150px]">
                            {t.notes ? (
                              <div className="line-clamp-2 text-slate-600 italic">{t.notes}</div>
                            ) : (
                              <span className="text-slate-400 italic">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {t.status === 'completed' ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Selesai</Badge>
                            ) : t.status === 'accepted' ? (
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200">Diterima</Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200">Menunggu</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {t.accepted_by_name ? (
                              <span className="text-blue-700 font-medium text-xs">{t.accepted_by_name}</span>
                            ) : t.completed_by_name ? (
                              <span className="text-emerald-700 font-medium text-xs">{t.completed_by_name}</span>
                            ) : (
                              <span className="text-slate-400 italic">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">
                            {t.accepted_at ? (
                              new Date(t.accepted_at).toLocaleString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            ) : (
                              <span className="text-slate-400 italic">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {t.status === 'pending' && isPiket && (
                                <Button size="sm" variant="outline" onClick={() => acceptTask(t)}
                                  className="border-blue-600 text-blue-600 hover:bg-blue-50 gap-1 text-xs"
                                  data-testid={`accept-task-${t.id}`}>
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Terima
                                </Button>
                              )}
                              {t.status === 'pending' && (t.teacher_id === user?.id || isAdmin) && (
                                <>
                                  <Button size="icon" variant="ghost" onClick={() => openEditTask(t)} data-testid={`edit-task-${t.id}`}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => deleteTask(t)} className="text-rose-600" data-testid={`delete-task-${t.id}`}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(sTab === 'mine' ? myTasks : sTab === 'pending' ? pendingTasks : completedTasks).length === 0 && (
                      <TableRow><TableCell colSpan={12} className="text-center py-12 text-slate-500">
                        <FileText className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Tidak ada data</div>
                      </TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Task create/edit */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingTask ? 'Edit Tugas Titipan' : 'Titipkan Tugas Mengajar'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <Alert className="border-blue-200 bg-blue-50">
              <Info className="h-4 w-4 text-blue-700" />
              <AlertDescription className="text-blue-900 text-xs">
                Titip materi tugas jika Anda berhalangan hadir. Guru Piket akan mengisi jurnal di kelas Anda dengan materi yang dititipkan.
              </AlertDescription>
            </Alert>
            <div>
              <Label>Jadwal Mengajar *</Label>
              <Select value={taskForm.schedule_id} onValueChange={(v) => setTaskForm({ ...taskForm, schedule_id: v })}>
                <SelectTrigger data-testid="task-form-schedule"><SelectValue placeholder="Pilih jadwal..." /></SelectTrigger>
                <SelectContent>
                  {schedules.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {DAY_LABELS[s.day]} {s.start_time}-{s.end_time} • {s.class_name} • {s.subject_name || s.subject_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tanggal Pelaksanaan *</Label>
              <Input type="date" value={taskForm.date}
                onChange={(e) => setTaskForm({ ...taskForm, date: e.target.value })}
                data-testid="task-form-date" />
            </div>
            <div>
              <Label>Jenis Izin Guru</Label>
              <Select value={taskForm.leave_type} onValueChange={(v) => setTaskForm({ ...taskForm, leave_type: v })}>
                <SelectTrigger data-testid="task-form-leave-type">
                  <SelectValue placeholder="Pilih jenis izin..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sakit">Izin Sakit</SelectItem>
                  <SelectItem value="cuti">Izin Cuti</SelectItem>
                  <SelectItem value="dinas_luar">Dinas Luar</SelectItem>
                  <SelectItem value="lainnya">Izin Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Materi Tugas / Instruksi *</Label>
              <Textarea value={taskForm.task_content}
                onChange={(e) => setTaskForm({ ...taskForm, task_content: e.target.value })}
                placeholder="Mis. Siswa mengerjakan LKS Bab 5 halaman 32-35, kumpulkan akhir pelajaran"
                rows={4} data-testid="task-form-content" />
            </div>
            <div>
              <Label>Catatan Tambahan (Opsional)</Label>
              <Textarea value={taskForm.notes || ''}
                onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                placeholder="Catatan untuk guru piket..."
                rows={2} data-testid="task-form-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>Batal</Button>
            <Button onClick={submitTask} className="bg-[#006837] hover:bg-[#0B7A3B]" data-testid="task-form-submit">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fill journal dialog */}
      <Dialog open={fillOpen} onOpenChange={setFillOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-amber-600" /> Isi Jurnal sebagai Guru Piket
            </DialogTitle>
          </DialogHeader>
          {fillTarget && (
            <div className="space-y-3 py-2">
              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-700" />
                <AlertDescription className="text-amber-900 text-xs">
                  Jurnal akan dicatat <strong>atas nama guru pengajar</strong> ({fillTarget.schedule.teacher_name}), tetapi sistem akan menandai bahwa <strong>Anda (Guru Piket)</strong> yang mengisi — untuk keperluan audit.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-slate-50 rounded-lg flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">Kelas</div>
                    <div className="font-semibold">{fillTarget.schedule.class_name}</div>
                  </div>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">Guru Pengajar</div>
                    <div className="font-semibold text-xs">{fillTarget.schedule.teacher_name}</div>
                  </div>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">Mapel</div>
                    <div className="font-semibold text-xs">{fillTarget.schedule.subject_name}</div>
                  </div>
                </div>
                <div className="p-2 bg-slate-50 rounded-lg flex items-center gap-2">
                  <Building className="h-4 w-4 text-slate-500" />
                  <div>
                    <div className="text-xs text-slate-500">Ruang</div>
                    <div className="font-semibold font-mono">{fillTarget.schedule.room_name}</div>
                  </div>
                </div>
              </div>
              {fillTarget.task && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Titipan dari Guru Pengajar</div>
                  <div className="text-sm text-blue-900">{fillTarget.task.task_content}</div>
                  {fillTarget.task.notes && <div className="text-xs text-blue-700 mt-1 italic">{fillTarget.task.notes}</div>}
                </div>
              )}
              <div>
                <Label>Materi yang Disampaikan *</Label>
                <Textarea value={fillForm.materi} onChange={(e) => setFillForm({ ...fillForm, materi: e.target.value })}
                  rows={3} placeholder="Materi/kegiatan yang dilakukan di kelas..."
                  data-testid="fill-materi" />
              </div>
              <div>
                <Label>Catatan Pembelajaran (Opsional)</Label>
                <Textarea value={fillForm.catatan} onChange={(e) => setFillForm({ ...fillForm, catatan: e.target.value })}
                  rows={2} data-testid="fill-catatan" />
              </div>
              <div>
                <Label>Catatan Piket (Alasan, dll)</Label>
                <Input value={fillForm.piket_note} onChange={(e) => setFillForm({ ...fillForm, piket_note: e.target.value })}
                  placeholder="Mis. Guru izin, sakit, diklat..."
                  data-testid="fill-piket-note" />
              </div>
              <div>
                <Label className="font-semibold">Absensi Siswa</Label>
                <div className="mt-2 max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">No</TableHead>
                        <TableHead>Nama Siswa</TableHead>
                        <TableHead className="w-[140px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fillStudents.map((student, index) => (
                        <TableRow key={student.id}>
                          <TableCell className="text-center text-xs">{index + 1}</TableCell>
                          <TableCell className="text-sm">{student.full_name}</TableCell>
                          <TableCell>
                            <Select
                              value={fillAttendance[student.id] || 'hadir'}
                              onValueChange={(val) => setFillAttendance({ ...fillAttendance, [student.id]: val })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hadir">Hadir</SelectItem>
                                <SelectItem value="izin">Izin</SelectItem>
                                <SelectItem value="sakit">Sakit</SelectItem>
                                <SelectItem value="alpa">Alpa</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-2 text-xs text-slate-600 flex gap-4">
                  <span>Hadir: {Object.values(fillAttendance).filter(s => s === 'hadir').length}</span>
                  <span>Izin: {Object.values(fillAttendance).filter(s => s === 'izin').length}</span>
                  <span>Sakit: {Object.values(fillAttendance).filter(s => s === 'sakit').length}</span>
                  <span>Alpa: {Object.values(fillAttendance).filter(s => s === 'alpa').length}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFillOpen(false)}>Batal</Button>
            <Button onClick={submitFill} className="bg-amber-600 hover:bg-amber-700 gap-2" data-testid="fill-submit">
              <Send className="h-4 w-4" /> Simpan Jurnal (sebagai Piket)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
