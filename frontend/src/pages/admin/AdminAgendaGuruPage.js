import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Calendar, BookOpen, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const EMPTY_FORM = {
  teacher_id: '',
  title: '',
  description: '',
  date: '',
  time: '',
  category: 'rapat',
  status: 'scheduled',
};

const CATEGORY_OPTIONS = [
  { value: 'rapat', label: 'Rapat' },
  { value: 'pelatihan', label: 'Pelatihan' },
  { value: 'supervisi', label: 'Supervisi' },
  { value: 'ekskul', label: 'Ekstrakurikuler' },
  { value: 'lainnya', label: 'Lainnya' },
];

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Terjadwal', color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Selesai', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: 'Dibatalkan', color: 'bg-rose-100 text-rose-700' },
];

export default function AdminAgendaGuruPage() {
  const [agendas, setAgendas] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load guru
      const { data: usersData } = await api.get('/users');
      const guruList = usersData.filter(u => u.roles?.includes('guru'));
      setTeachers(guruList);

      // TODO: Load agendas from API when backend ready
      setAgendas([]);
    } catch (e) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (agenda) => {
    setEditing(agenda);
    setForm(agenda);
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.teacher_id || !form.title || !form.date) {
      toast.error('Guru, judul, dan tanggal wajib diisi');
      return;
    }

    toast.info('Fitur simpan agenda sedang dalam pengembangan');
    setOpen(false);
  };

  const handleDelete = (agenda) => {
    if (!window.confirm('Hapus agenda ini?')) return;
    toast.info('Fitur hapus sedang dalam pengembangan');
  };

  const filteredAgendas = agendas.filter(a => {
    if (!search) return true;
    const s = search.toLowerCase();
    return a.title?.toLowerCase().includes(s) || a.description?.toLowerCase().includes(s);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Calendar className="h-3 w-3 mr-1" /> Agenda Guru
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Agenda Guru</h1>
          <p className="text-sm text-slate-600 mt-1">{agendas.length} agenda terjadwal</p>
        </div>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2">
          <Plus className="h-4 w-4" /> Tambah Agenda
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari agenda..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal & Waktu</TableHead>
                  <TableHead>Judul Agenda</TableHead>
                  <TableHead>Guru</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : filteredAgendas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Belum ada agenda. Klik "Tambah Agenda" untuk membuat agenda baru.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAgendas.map((agenda) => {
                    const teacher = teachers.find(t => t.id === agenda.teacher_id);
                    const statusInfo = STATUS_OPTIONS.find(s => s.value === agenda.status);
                    const categoryInfo = CATEGORY_OPTIONS.find(c => c.value === agenda.category);

                    return (
                      <TableRow key={agenda.id}>
                        <TableCell>
                          <div className="font-medium">{agenda.date}</div>
                          {agenda.time && <div className="text-xs text-slate-500">{agenda.time}</div>}
                        </TableCell>
                        <TableCell className="font-medium">{agenda.title}</TableCell>
                        <TableCell>{teacher?.full_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{categoryInfo?.label || agenda.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo?.color}>{statusInfo?.label || agenda.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(agenda)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(agenda)} className="text-rose-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Agenda' : 'Tambah Agenda Baru'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Guru *</Label>
                <Select value={form.teacher_id} onValueChange={(v) => setForm({ ...form, teacher_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih guru..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Kategori</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Judul Agenda *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Judul agenda..." />
            </div>

            <div>
              <Label>Deskripsi</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Detail agenda..." rows={3} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tanggal *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div>
                <Label>Waktu</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
