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
  CheckCircle2, AlertCircle, FileText,
} from 'lucide-react';
import { api, DAY_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const ALL_DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const EMPTY = { day: 'senin', start_time: '07:00', end_time: '08:00', class_id: '', subject_id: '', room_id: '', semester: 'ganjil', academic_year_id: '' };

function StatusBadge({ status }) {
  if (status === 'locked') return <Badge className="bg-rose-100 text-rose-700 border-rose-200 gap-1"><Lock className="h-3 w-3" /> Terkunci</Badge>;
  if (status === 'submitted') return <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1"><Send className="h-3 w-3" /> Terkirim</Badge>;
  return <Badge variant="outline" className="text-amber-600 border-amber-300 gap-1"><FileText className="h-3 w-3" /> Draft</Badge>;
}

export default function MySchedulePage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [activeAY, setActiveAY] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const refresh = async () => {
    try {
      const [s, c, sub, r, ay] = await Promise.all([
        api.get('/schedules', { params: { teacher_id: user?.id } }),
        api.get('/classes'),
        api.get('/subjects'),
        api.get('/rooms'),
        api.get('/academic-years/active'),
      ]);
      setItems(s.data || []);
      setClasses(c.data || []);
      setSubjects(sub.data || []);
      setRooms(r.data || []);
      setActiveAY(ay.data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refresh(); }, [user?.id]);

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
          {drafts.length > 0 && (
            <Button onClick={handleSubmitAllDrafts} variant="outline" className="gap-2 border-blue-300 text-blue-700 hover:bg-blue-50" data-testid="submit-all-button">
              <Send className="h-4 w-4" /> Kirim Semua Draft ({drafts.length})
            </Button>
          )}
          <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-schedule-button">
            <Plus className="h-4 w-4" /> Tambah Jadwal
          </Button>
        </div>
      </div>

      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-700" />
        <AlertDescription className="text-blue-900 text-sm">
          <strong>Alur Jadwal:</strong> 1️⃣ <strong>Draft</strong> (Anda bisa edit) → 2️⃣ Klik <strong>Kirim</strong> ke Admin → 3️⃣ <strong>Terkirim</strong> (Anda tidak bisa edit) → 4️⃣ Admin <strong>mengunci</strong> jadwal final (status: <strong>Terkunci</strong>)
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={FileText} label="Draft" value={drafts.length} color="bg-amber-50 border-amber-200 text-amber-700" />
        <StatCard icon={Send} label="Terkirim" value={submitted.length} color="bg-blue-50 border-blue-200 text-blue-700" />
        <StatCard icon={Lock} label="Terkunci" value={locked.length} color="bg-rose-50 border-rose-200 text-rose-700" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table data-testid="my-schedule-table">
            <TableHeader><TableRow>
              <TableHead>Hari</TableHead><TableHead>Jam</TableHead><TableHead>Kelas</TableHead>
              <TableHead>Mata Pelajaran</TableHead><TableHead>Ruang</TableHead>
              <TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {items.map((s) => (
                <TableRow key={s.id} data-testid={`schedule-row-${s.id}`}>
                  <TableCell className="capitalize font-semibold">{DAY_LABELS[s.day]}</TableCell>
                  <TableCell className="font-mono text-sm">{s.start_time}–{s.end_time}</TableCell>
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
                          <CheckCircle2 className="h-3 w-3 text-blue-600" /> Menunggu Admin
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
            <div><Label>Jam Mulai</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} data-testid="form-start" /></div>
            <div><Label>Jam Selesai</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} data-testid="form-end" /></div>
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
