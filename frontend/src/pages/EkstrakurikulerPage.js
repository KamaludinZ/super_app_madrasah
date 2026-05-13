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
import {
  Trophy, Sparkles, Plus, Pencil, Trash2, Users, Calendar, Clock,
  MapPin, UserPlus, ClipboardCheck, GraduationCap, ArrowLeft, Search,
  CalendarDays, Award,
} from 'lucide-react';
import { api, DAY_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const ATTENDANCE_STATUSES = [
  { value: 'hadir', label: 'Hadir', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'sakit', label: 'Sakit', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'izin', label: 'Izin', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'alpa', label: 'Alpa', color: 'bg-rose-100 text-rose-800 border-rose-200' },
];
const PREDICATES = [
  { value: 'A', label: 'A - Sangat Baik' },
  { value: 'B', label: 'B - Baik' },
  { value: 'C', label: 'C - Cukup' },
  { value: 'D', label: 'D - Kurang' },
];

const EMPTY_EXTRA = {
  name: '', description: '', coach_id: '',
  schedule_day: '', schedule_start: '15:00', schedule_end: '17:00',
  location: '', is_active: true,
};

export default function EkstrakurikulerPage() {
  const { activeRole, user } = useAuth();
  const isAdmin = activeRole === 'admin';
  const isCoach = activeRole === 'guru_ekstrakurikuler';

  const [extras, setExtras] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_EXTRA);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    const { data } = await api.get('/extracurriculars');
    setExtras(data || []);
  };

  useEffect(() => {
    (async () => {
      try {
        await refresh();
        if (isAdmin) {
          const { data } = await api.get('/users');
          setCoaches((data || []).filter((u) => (u.roles || []).some((r) =>
            ['guru_ekstrakurikuler', 'guru'].includes(r)
          )));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [activeRole]);

  const openCreate = () => { setEditing(null); setForm(EMPTY_EXTRA); setOpen(true); };
  const openEdit = (e) => { setEditing(e); setForm({ ...EMPTY_EXTRA, ...e }); setOpen(true); };

  const handleSubmit = async () => {
    if (!form.name) { toast.error('Nama ekstrakurikuler wajib'); return; }
    try {
      if (editing) {
        await api.put(`/extracurriculars/${editing.id}`, form);
        toast.success('Ekstrakurikuler diperbarui');
      } else {
        await api.post('/extracurriculars', form);
        toast.success('Ekstrakurikuler dibuat');
      }
      setOpen(false);
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal');
    }
  };

  const handleDelete = async (e) => {
    if (!window.confirm(`Hapus ekstra "${e.name}"?`)) return;
    try {
      await api.delete(`/extracurriculars/${e.id}`);
      toast.success('Dihapus');
      await refresh();
    } catch (err) { toast.error('Gagal hapus'); }
  };

  const filtered = extras.filter((e) => {
    if (isCoach && e.coach_id !== user?.id) return false;
    if (!search) return true;
    return (e.name || '').toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <div className="text-sm text-slate-500">Memuat...</div>;

  if (selected) {
    return <EkstraDetailView extra={selected} onBack={() => { setSelected(null); refresh(); }} />;
  }

  return (
    <div className="space-y-6" data-testid="ekstra-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Sparkles className="h-3 w-3 mr-1" /> Ekstrakurikuler
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {isCoach ? 'Ekstrakurikuler Saya' : 'Manajemen Ekstrakurikuler'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isAdmin ? 'Kelola kegiatan ekstrakurikuler madrasah' : isCoach ? 'Kelola anggota, absensi, dan nilai' : 'Jelajahi kegiatan ekstrakurikuler'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-extra-button">
            <Plus className="h-4 w-4" /> Tambah Ekstra
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input placeholder="Cari ekstrakurikuler..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" data-testid="extra-search" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="extra-grid">
        {filtered.map((e) => (
          <ExtraCard key={e.id} e={e} canEdit={isAdmin} canManage={isAdmin || (isCoach && e.coach_id === user?.id)}
            onSelect={() => setSelected(e)} onEdit={() => openEdit(e)} onDelete={() => handleDelete(e)} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-12 bg-white rounded-xl border border-slate-200">
            <Sparkles className="h-12 w-12 mx-auto text-slate-300 mb-3" />
            <div className="font-semibold text-slate-700">Belum ada ekstrakurikuler</div>
            <div className="text-sm text-slate-500 mt-1">
              {isAdmin ? 'Klik "Tambah Ekstra" untuk menambahkan' : 'Hubungi admin untuk menambahkan ekstrakurikuler'}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Ekstrakurikuler' : 'Tambah Ekstrakurikuler'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <div className="sm:col-span-2">
              <Label>Nama *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mis. Pramuka, PMR, Tahfidz" data-testid="extra-form-name" />
            </div>
            <div className="sm:col-span-2">
              <Label>Deskripsi</Label>
              <Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3} placeholder="Profil & tujuan kegiatan..." />
            </div>
            <div className="sm:col-span-2">
              <Label>Pembina (Coach)</Label>
              <Select value={form.coach_id || ''} onValueChange={(v) => setForm({ ...form, coach_id: v })}>
                <SelectTrigger data-testid="extra-form-coach"><SelectValue placeholder="Pilih pembina..." /></SelectTrigger>
                <SelectContent>
                  {coaches.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Hari</Label>
              <Select value={form.schedule_day || ''} onValueChange={(v) => setForm({ ...form, schedule_day: v })}>
                <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lokasi</Label>
              <Input value={form.location || ''} onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Mis. Aula, Lapangan" />
            </div>
            <div>
              <Label>Jam Mulai</Label>
              <Input type="time" value={form.schedule_start || ''} onChange={(e) => setForm({ ...form, schedule_start: e.target.value })} />
            </div>
            <div>
              <Label>Jam Selesai</Label>
              <Input type="time" value={form.schedule_end || ''} onChange={(e) => setForm({ ...form, schedule_end: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]" data-testid="extra-form-submit">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExtraCard({ e, canEdit, canManage, onSelect, onEdit, onDelete }) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`extra-card-${e.id}`}>
      <CardContent className="p-5 space-y-3" onClick={onSelect}>
        <div className="flex items-start justify-between gap-2">
          <div className="h-12 w-12 rounded-xl bg-[#006837]/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-6 w-6 text-[#006837]" />
          </div>
          {canEdit && (
            <div className="flex gap-1" onClick={(ev) => ev.stopPropagation()}>
              <Button size="icon" variant="ghost" onClick={onEdit} data-testid={`extra-edit-${e.id}`}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={onDelete} className="text-rose-600 hover:text-rose-700" data-testid={`extra-delete-${e.id}`}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">{e.name}</h3>
          {e.description && <p className="text-xs text-slate-600 line-clamp-2 mt-1">{e.description}</p>}
        </div>
        <div className="space-y-1 text-xs text-slate-600">
          {e.coach_name && <div className="flex items-center gap-1.5"><GraduationCap className="h-3 w-3" /> {e.coach_name}</div>}
          {e.schedule_day && (
            <div className="flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> {DAY_LABELS[e.schedule_day]}, {e.schedule_start || '-'}-{e.schedule_end || '-'}</div>
          )}
          {e.location && <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {e.location}</div>}
        </div>
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
          <Badge variant="secondary" className="text-xs">
            <Users className="h-3 w-3 mr-1" /> {e.member_count ?? 0} anggota
          </Badge>
          {canManage && <span className="text-[#006837] font-semibold">Kelola →</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function EkstraDetailView({ extra, onBack }) {
  const { activeRole, user } = useAuth();
  const isAdmin = activeRole === 'admin';
  const isCoach = activeRole === 'guru_ekstrakurikuler' && extra.coach_id === user?.id;
  const canManage = isAdmin || isCoach;

  const [tab, setTab] = useState('members');

  return (
    <div className="space-y-4" data-testid="extra-detail-view">
      <Button variant="ghost" onClick={onBack} className="gap-2" data-testid="extra-back-button">
        <ArrowLeft className="h-4 w-4" /> Kembali ke Daftar
      </Button>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-2xl bg-[#006837]/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-8 w-8 text-[#006837]" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">{extra.name}</h1>
              {extra.description && <p className="text-sm text-slate-600 mt-1">{extra.description}</p>}
              <div className="flex flex-wrap gap-3 mt-3 text-xs text-slate-700">
                {extra.coach_name && <Badge variant="outline" className="gap-1"><GraduationCap className="h-3 w-3" /> {extra.coach_name}</Badge>}
                {extra.schedule_day && <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> {DAY_LABELS[extra.schedule_day]} {extra.schedule_start}-{extra.schedule_end}</Badge>}
                {extra.location && <Badge variant="outline" className="gap-1"><MapPin className="h-3 w-3" /> {extra.location}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="members" data-testid="tab-members"><Users className="h-3.5 w-3.5 mr-1" /> Anggota</TabsTrigger>
          <TabsTrigger value="attendance" data-testid="tab-attendance"><ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Absensi</TabsTrigger>
          <TabsTrigger value="grades" data-testid="tab-grades"><Award className="h-3.5 w-3.5 mr-1" /> Nilai</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <MembersTab extra={extra} canManage={canManage} />
        </TabsContent>
        <TabsContent value="attendance" className="mt-4">
          <AttendanceTab extra={extra} canManage={canManage} />
        </TabsContent>
        <TabsContent value="grades" className="mt-4">
          <GradesTab extra={extra} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MembersTab({ extra, canManage }) {
  const [members, setMembers] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const refresh = async () => {
    const { data } = await api.get(`/extracurriculars/${extra.id}/members`);
    setMembers(data || []);
  };

  useEffect(() => {
    (async () => {
      await refresh();
      if (canManage) {
        const { data } = await api.get('/users', { params: { role: 'siswa' } });
        setAllStudents(data || []);
      }
    })();
  }, [extra.id]);

  const addMembers = async () => {
    if (selectedIds.length === 0) {
      toast.error('Pilih minimal 1 siswa');
      return;
    }
    try {
      const { data } = await api.post(`/extracurriculars/${extra.id}/members`, { student_ids: selectedIds });
      toast.success(`${data.inserted || selectedIds.length} siswa ditambahkan`);
      setOpen(false);
      setSelectedIds([]);
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal');
    }
  };

  const removeMember = async (m) => {
    if (!window.confirm(`Keluarkan ${m.student_name} dari ekstra ini?`)) return;
    try {
      await api.delete(`/extracurriculars/${extra.id}/members/${m.id}`);
      toast.success('Anggota dikeluarkan');
      await refresh();
    } catch (e) { toast.error('Gagal'); }
  };

  const memberIds = new Set(members.map((m) => m.student_id));
  const availableStudents = allStudents.filter((s) => !memberIds.has(s.id));

  return (
    <Card data-testid="members-tab">
      <CardContent className="p-0">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
          <div>
            <div className="font-semibold">{members.length} Anggota</div>
            <div className="text-xs text-slate-500">Daftar siswa yang terdaftar dalam ekstra ini</div>
          </div>
          {canManage && (
            <Button onClick={() => setOpen(true)} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-member-button">
              <UserPlus className="h-4 w-4" /> Tambah Anggota
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>NISN</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Bergabung</TableHead>
                {canManage && <TableHead className="text-right">Aksi</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id} data-testid={`member-row-${m.id}`}>
                  <TableCell className="font-medium">{m.student_name || '-'}</TableCell>
                  <TableCell className="font-mono text-xs">{m.student_nisn || '-'}</TableCell>
                  <TableCell>{m.class_name || '-'}</TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {m.joined_at ? new Date(m.joined_at).toLocaleDateString('id-ID') : '-'}
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => removeMember(m)}
                        className="text-rose-600 hover:text-rose-700"
                        data-testid={`remove-member-${m.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {members.length === 0 && (
                <TableRow><TableCell colSpan={canManage ? 5 : 4} className="text-center py-8 text-slate-500">
                  Belum ada anggota
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[80vh]">
          <DialogHeader><DialogTitle>Tambah Anggota</DialogTitle></DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-1 p-1">
            {availableStudents.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-500">Semua siswa sudah jadi anggota</div>
            )}
            {availableStudents.map((s) => (
              <label key={s.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm">
                <input type="checkbox" checked={selectedIds.includes(s.id)}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds([...selectedIds, s.id]);
                    else setSelectedIds(selectedIds.filter((x) => x !== s.id));
                  }}
                  data-testid={`student-checkbox-${s.id}`}
                />
                <span className="font-medium">{s.full_name}</span>
                <span className="text-xs text-slate-500 ml-auto">{s.nisn || '-'}</span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={addMembers} className="bg-[#006837] hover:bg-[#0B7A3B]" data-testid="confirm-add-members">
              Tambah ({selectedIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AttendanceTab({ extra, canManage }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [history, setHistory] = useState([]);
  const [members, setMembers] = useState([]);
  const [records, setRecords] = useState({});
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [h, m] = await Promise.all([
      api.get(`/extracurriculars/${extra.id}/attendance`),
      api.get(`/extracurriculars/${extra.id}/members`),
    ]);
    setHistory(h.data || []);
    setMembers(m.data || []);
    // Pre-fill from latest record if any matches the date
    const todayRec = (h.data || []).find((x) => x.date === date);
    if (todayRec) {
      const map = {};
      (todayRec.records || []).forEach((r) => { map[r.student_id] = r.status; });
      setRecords(map);
    } else {
      setRecords({});
    }
  };

  useEffect(() => { refresh(); }, [extra.id, date]);

  const setStatus = (sid, status) => setRecords({ ...records, [sid]: status });

  const submitAttendance = async () => {
    setBusy(true);
    try {
      const recList = members.map((m) => ({
        student_id: m.student_id,
        student_name: m.student_name,
        status: records[m.student_id] || 'alpa',
      }));
      await api.post(`/extracurriculars/${extra.id}/attendance`, { date, records: recList });
      toast.success(`Absensi ${date} disimpan`);
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal simpan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="attendance-tab">
      {canManage && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-end gap-2 flex-wrap">
              <div>
                <Label className="text-xs uppercase tracking-wide">Tanggal Pertemuan</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" data-testid="attendance-date" />
              </div>
              <Button onClick={submitAttendance} disabled={busy} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2 ml-auto" data-testid="submit-attendance">
                <ClipboardCheck className="h-4 w-4" /> {busy ? 'Menyimpan...' : 'Simpan Absensi'}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.student_name || '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {ATTENDANCE_STATUSES.map((s) => (
                            <button key={s.value} type="button"
                              onClick={() => setStatus(m.student_id, s.value)}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium border ${records[m.student_id] === s.value ? s.color : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                              data-testid={`attendance-${m.student_id}-${s.value}`}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {members.length === 0 && (
                    <TableRow><TableCell colSpan={2} className="text-center py-6 text-slate-500">Belum ada anggota. Tambahkan anggota dulu.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-5">
          <h3 className="font-semibold mb-3">Riwayat Absensi</h3>
          {history.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">Belum ada riwayat absensi.</div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const counts = (h.records || []).reduce((acc, r) => {
                  acc[r.status] = (acc[r.status] || 0) + 1; return acc;
                }, {});
                return (
                  <div key={h.id} className="p-3 rounded-lg border border-slate-200 flex items-center justify-between flex-wrap gap-2" data-testid={`attendance-history-${h.date}`}>
                    <div>
                      <div className="font-semibold">{new Date(h.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      <div className="text-xs text-slate-600">{(h.records || []).length} siswa</div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {ATTENDANCE_STATUSES.map((s) => counts[s.value] ? (
                        <Badge key={s.value} variant="outline" className={s.color + ' text-xs'}>
                          {s.label}: {counts[s.value]}
                        </Badge>
                      ) : null)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GradesTab({ extra, canManage }) {
  const [grades, setGrades] = useState([]);
  const [members, setMembers] = useState([]);
  const [activeAY, setActiveAY] = useState(null);
  const [semester, setSemester] = useState('ganjil');
  const [inputs, setInputs] = useState({});
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [g, m, ay] = await Promise.all([
      api.get(`/extracurriculars/${extra.id}/grades`, { params: { semester } }),
      api.get(`/extracurriculars/${extra.id}/members`),
      api.get('/academic-years/active'),
    ]);
    setGrades(g.data || []);
    setMembers(m.data || []);
    setActiveAY(ay.data);
    // Pre-fill inputs from existing grades
    const map = {};
    (g.data || []).forEach((x) => { map[x.student_id] = { predicate: x.predicate, description: x.description }; });
    setInputs(map);
  };

  useEffect(() => { refresh(); }, [extra.id, semester]);

  const setVal = (sid, field, val) => setInputs({ ...inputs, [sid]: { ...(inputs[sid] || {}), [field]: val } });

  const submitGrades = async () => {
    if (!activeAY) { toast.error('Tahun Pelajaran aktif tidak ditemukan'); return; }
    setBusy(true);
    try {
      const grades = members
        .filter((m) => inputs[m.student_id]?.predicate)
        .map((m) => ({
          student_id: m.student_id,
          predicate: inputs[m.student_id].predicate,
          description: inputs[m.student_id].description || '',
        }));
      if (grades.length === 0) {
        toast.error('Isi minimal 1 predikat siswa');
        setBusy(false);
        return;
      }
      const { data } = await api.post(`/extracurriculars/${extra.id}/grades`, { semester, grades });
      toast.success(`Nilai ${data.success || grades.length} siswa disimpan`);
      await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="grades-tab">
      <Card>
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div>
              <Label className="text-xs uppercase tracking-wide">Semester</Label>
              <Select value={semester} onValueChange={setSemester}>
                <SelectTrigger className="w-40" data-testid="semester-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ganjil">Ganjil</SelectItem>
                  <SelectItem value="genap">Genap</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Badge variant="outline" className="self-end mb-2">TP {activeAY?.name || '-'}</Badge>
            {canManage && (
              <Button onClick={submitGrades} disabled={busy} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2 ml-auto" data-testid="submit-grades">
                <Award className="h-4 w-4" /> {busy ? 'Menyimpan...' : 'Simpan Nilai'}
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead className="w-48">Predikat</TableHead>
                  <TableHead>Deskripsi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.student_name || '-'}</TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select value={inputs[m.student_id]?.predicate || ''} onValueChange={(v) => setVal(m.student_id, 'predicate', v)}>
                          <SelectTrigger data-testid={`predicate-${m.student_id}`}><SelectValue placeholder="-" /></SelectTrigger>
                          <SelectContent>
                            {PREDICATES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline">{inputs[m.student_id]?.predicate || '-'}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Input value={inputs[m.student_id]?.description || ''}
                          onChange={(e) => setVal(m.student_id, 'description', e.target.value)}
                          placeholder="Catatan tambahan..." />
                      ) : (
                        <span className="text-sm text-slate-600">{inputs[m.student_id]?.description || '-'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {members.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-slate-500">Belum ada anggota.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
