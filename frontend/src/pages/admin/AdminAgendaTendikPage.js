import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Briefcase, Search, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const EMPTY_FORM = {
  user_id: '',
  event_name: '',
  description: '',
  date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  location: '',
  category: 'administrasi',
  priority: 'normal',
  status: 'pending',
  is_public: true,
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
  { value: 'low', label: 'Rendah', color: 'bg-slate-100 text-slate-700', icon: '●' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700', icon: '●●' },
  { value: 'high', label: 'Tinggi', color: 'bg-amber-100 text-amber-700', icon: '●●●' },
  { value: 'urgent', label: 'Mendesak', color: 'bg-rose-100 text-rose-700', icon: '●●●●' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Menunggu', color: 'bg-slate-100 text-slate-700' },
  { value: 'in_progress', label: 'Dalam Proses', color: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Selesai', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'cancelled', label: 'Dibatalkan', color: 'bg-rose-100 text-rose-700' },
];

export default function AdminAgendaTendikPage() {
  const { activeRole } = useAuth();
  const isAdmin = activeRole === 'admin';

  const [agendas, setAgendas] = useState([]);
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    loadData();
    // Update waktu setiap detik untuk auto-update status
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    try {
      // Load tenaga kependidikan
      const { data: usersData } = await api.get('/users');
      const tendikList = usersData.filter(u => u.roles?.includes('tenaga_kependidikan'));
      setStaff(tendikList);

      // Load agendas from backend
      const { data: agendasData } = await api.get('/staff-events');
      // Filter only tendik events
      const tendikAgendas = agendasData.filter(a => {
        const user = usersData.find(u => u.id === a.user_id);
        return user && user.roles?.includes('tenaga_kependidikan');
      });
      setAgendas(tendikAgendas);
    } catch (e) {
      toast.error('Gagal memuat data');
      console.error(e);
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
    setEditing(agenda.id);
    setForm({
      user_id: agenda.user_id || '',
      event_name: agenda.event_name || '',
      description: agenda.description || '',
      date: agenda.date || '',
      end_date: agenda.end_date || '',
      start_time: agenda.start_time || '',
      end_time: agenda.end_time || '',
      location: agenda.location || '',
      category: agenda.category || 'administrasi',
      priority: agenda.priority || 'normal',
      status: agenda.status || 'pending',
      is_public: agenda.is_public !== false, // Default true if undefined
    });
    setOpen(true);
  };

  const handleSubmit = async () => {
    // Validation
    if (!form.user_id || !form.event_name || !form.date || !form.start_time || !form.end_time) {
      toast.error('Petugas, nama kegiatan, tanggal, dan waktu wajib diisi');
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/staff-events/${editing}`, form);
        toast.success('Agenda berhasil diperbarui');
      } else {
        await api.post('/staff-events', form);
        toast.success('Agenda berhasil ditambahkan');
      }
      setOpen(false);
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal menyimpan agenda');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (agenda) => {
    if (!window.confirm('Hapus agenda ini?')) return;

    try {
      await api.delete(`/staff-events/${agenda.id}`);
      toast.success('Agenda berhasil dihapus');
      loadData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal menghapus agenda');
    }
  };

  // Fungsi untuk menghitung status otomatis berdasarkan waktu
  const calculateAutoStatus = (agenda) => {
    // Jika status cancelled, tetap cancelled
    if (agenda.status === 'cancelled') return 'cancelled';

    try {
      const eventDate = agenda.date;
      const startTime = agenda.start_time || '00:00';
      const endTime = agenda.end_time || '23:59';

      const eventStart = new Date(`${eventDate}T${startTime}:00`);
      const eventEnd = new Date(`${eventDate}T${endTime}:00`);

      if (now < eventStart) {
        return 'pending'; // Menunggu/Mendatang
      } else if (now >= eventStart && now <= eventEnd) {
        return 'in_progress'; // Dalam Proses
      } else {
        return 'completed'; // Selesai
      }
    } catch (e) {
      return agenda.status || 'pending';
    }
  };

  const filteredAgendas = agendas.filter(a => {
    if (!search) return true;
    const s = search.toLowerCase();
    return a.event_name?.toLowerCase().includes(s) ||
           a.description?.toLowerCase().includes(s) ||
           a.user_name?.toLowerCase().includes(s);
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
                  <TableHead>Kegiatan</TableHead>
                  <TableHead>Petugas</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Prioritas</TableHead>
                  <TableHead>Tempat</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Visibilitas</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      Memuat data...
                    </TableCell>
                  </TableRow>
                ) : filteredAgendas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      Belum ada agenda. Klik "Tambah Agenda" untuk membuat agenda baru.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAgendas.map((agenda) => {
                    const staffMember = staff.find(t => t.id === agenda.user_id) || { full_name: agenda.user_name };
                    // Hitung status otomatis (kecuali jika cancelled)
                    const currentStatus = calculateAutoStatus(agenda);
                    const statusInfo = STATUS_OPTIONS.find(s => s.value === currentStatus);
                    const categoryInfo = CATEGORY_OPTIONS.find(c => c.value === agenda.category);
                    const priorityInfo = PRIORITY_OPTIONS.find(p => p.value === agenda.priority);

                    return (
                      <TableRow key={agenda.id}>
                        <TableCell>
                          <div className="font-medium">{new Date(agenda.date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                          <div className="text-xs text-slate-500">{agenda.start_time} - {agenda.end_time}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{agenda.event_name}</div>
                          {agenda.description && <div className="text-xs text-slate-500 line-clamp-1">{agenda.description}</div>}
                        </TableCell>
                        <TableCell>{staffMember.full_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{categoryInfo?.label || agenda.category || '-'}</Badge>
                        </TableCell>
                        <TableCell>
                          {priorityInfo ? (
                            <Badge className={priorityInfo.color}>
                              <span className="mr-1">{priorityInfo.icon}</span>
                              {priorityInfo.label}
                            </Badge>
                          ) : (
                            <Badge>{agenda.priority || '-'}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{agenda.location || '-'}</TableCell>
                        <TableCell>
                          <Badge className={statusInfo?.color}>{statusInfo?.label || currentStatus}</Badge>
                        </TableCell>
                        <TableCell>
                          {agenda.is_public ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                              <Eye className="h-3 w-3" /> Publik
                            </Badge>
                          ) : (
                            <Badge className="bg-slate-100 text-slate-600 border-slate-200 gap-1">
                              <EyeOff className="h-3 w-3" /> Internal
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(agenda)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button size="icon" variant="ghost" onClick={() => handleDelete(agenda)} className="text-rose-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Agenda' : 'Tambah Agenda Baru'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Petugas / Tenaga Kependidikan <span className="text-red-500">*</span></Label>
              <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih petugas..." />
                </SelectTrigger>
                <SelectContent>
                  {staff.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Nama Kegiatan <span className="text-red-500">*</span></Label>
              <Input
                value={form.event_name}
                onChange={(e) => setForm({ ...form, event_name: e.target.value })}
                placeholder="Contoh: Inventarisasi Barang Semester Genap"
              />
            </div>

            <div>
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detail kegiatan..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <div>
                <Label>Prioritas</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="mr-2">{p.icon}</span>
                        {p.label}
                      </SelectItem>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Tanggal Mulai <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div>
                <Label>Tanggal Selesai</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} min={form.date || undefined} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Jam Mulai <span className="text-red-500">*</span></Label>
                <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
              </div>
              <div>
                <Label>Jam Selesai <span className="text-red-500">*</span></Label>
                <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
              </div>
            </div>

            <div>
              <Label>Tempat</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Contoh: Ruang Tata Usaha"
              />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <Label className="flex items-center gap-3 cursor-pointer">
                <Switch
                  checked={form.is_public}
                  onCheckedChange={(v) => setForm({ ...form, is_public: v })}
                />
                <div className="flex items-center gap-2">
                  {form.is_public ? (
                    <>
                      <Eye className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm font-medium">Tampilkan di Halaman Publik</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-4 w-4 text-slate-500" />
                      <span className="text-sm font-medium">Hanya untuk Internal (Admin & Petugas Terkait)</span>
                    </>
                  )}
                </div>
              </Label>
              <p className="text-xs text-slate-500 mt-2 ml-11">
                {form.is_public
                  ? 'Agenda ini akan muncul di halaman publik /public/agenda'
                  : 'Agenda ini hanya akan terlihat oleh admin dan petugas yang bersangkutan'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]" disabled={submitting}>
              {submitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
