import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, Calendar, Briefcase, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const EMPTY_FORM = {
  staff_id: '',
  title: '',
  description: '',
  date: '',
  time: '',
  category: 'administrasi',
  priority: 'normal',
  status: 'pending',
};

const CATEGORY_OPTIONS = [
  { value: 'administrasi', label: 'Administrasi' },
  { value: 'keuangan', label: 'Keuangan' },
  { value: 'inventaris', label: 'Inventaris' },
  { value: 'perpustakaan', label: 'Perpustakaan' },
  { value: 'laboratorium', label: 'Laboratorium' },
  { value: 'kebersihan', label: 'Kebersihan' },
  { value: 'lainnya', label: 'Lainnya' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Rendah', color: 'bg-slate-100 text-slate-700' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'Tinggi', color: 'bg-amber-100 text-amber-700' },
  { value: 'urgent', label: 'Mendesak', color: 'bg-rose-100 text-rose-700' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Menunggu', color: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'Dalam Proses', color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Selesai', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: 'Dibatalkan', color: 'bg-rose-100 text-rose-700' },
];

export default function AdminAgendaTendikPage() {
  const [agendas, setAgendas] = useState([]);
  const [staff, setStaff] = useState([]);
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
      // Load tenaga kependidikan
      const { data: usersData } = await api.get('/users');
      const tendikList = usersData.filter(u => u.roles?.includes('tenaga_kependidikan'));
      setStaff(tendikList);

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
    if (!form.staff_id || !form.title || !form.date) {
      toast.error('Tendik, judul, dan tanggal wajib diisi');
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
            <Briefcase className="h-3 w-3 mr-1" /> Agenda Tendik
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Agenda Tenaga Kependidikan</h1>
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
                  <TableHead>Petugas</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Prioritas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : filteredAgendas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      Belum ada agenda. Klik "Tambah Agenda" untuk membuat agenda baru.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAgendas.map((agenda) => {
                    const staffMember = staff.find(s => s.id === agenda.staff_id);
                    const statusInfo = STATUS_OPTIONS.find(s => s.value === agenda.status);
                    const priorityInfo = PRIORITY_OPTIONS.find(p => p.value === agenda.priority);
                    const categoryInfo = CATEGORY_OPTIONS.find(c => c.value === agenda.category);

                    return (
                      <TableRow key={agenda.id}>
                        <TableCell>
                          <div className="font-medium">{agenda.date}</div>
                          {agenda.time && <div className="text-xs text-slate-500">{agenda.time}</div>}
                        </TableCell>
                        <TableCell className="font-medium">{agenda.title}</TableCell>
                        <TableCell>{staffMember?.full_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{categoryInfo?.label || agenda.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={priorityInfo?.color}>{priorityInfo?.label || agenda.priority}</Badge>
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
                <Label>Petugas *</Label>
                <Select value={form.staff_id} onValueChange={(v) => setForm({ ...form, staff_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih tendik..." />
                  </SelectTrigger>
                  <SelectContent>
                    {staff.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioritas</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
