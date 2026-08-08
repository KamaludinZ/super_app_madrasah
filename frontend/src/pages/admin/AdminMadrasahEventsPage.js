import React, { useEffect, useState } from 'react';
import { Calendar, CalendarDays, Clock, MapPin, Users, Plus, Edit, Trash2, Search, Filter, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

const MONTH_LABELS = {
  1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April',
  5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus',
  9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember',
};

export default function AdminMadrasahEventsPage() {
  const { activeRole } = useAuth();
  const canEdit = activeRole !== 'kepala_sekolah';

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    location: '',
    participants_count: 0,
  });

  useEffect(() => {
    fetchEvents();
  }, [filterYear, filterMonth]);

  const fetchEvents = async () => {
    try {
      const params = {};
      if (filterYear) params.year = parseInt(filterYear);
      if (filterMonth) params.month = parseInt(filterMonth);

      const { data } = await api.get('/madrasah-events', { params });
      setEvents(data);
    } catch (e) {
      toast.error('Gagal memuat data kegiatan');
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (event = null) => {
    if (event) {
      setEditing(event.id);
      setForm({
        name: event.name || '',
        description: event.description || '',
        date: event.date || '',
        end_date: event.end_date || '',
        start_time: event.start_time || '',
        end_time: event.end_time || '',
        location: event.location || '',
        participants_count: event.participants_count || 0,
      });
    } else {
      setEditing(null);
      setForm({
        name: '',
        description: '',
        date: '',
        end_date: '',
        start_time: '',
        end_time: '',
        location: '',
        participants_count: 0,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.date || !form.start_time || !form.end_time || !form.location) {
      toast.error('Mohon lengkapi semua field yang wajib');
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await api.put(`/madrasah-events/${editing}`, form);
        toast.success('Kegiatan berhasil diperbarui');
      } else {
        await api.post('/madrasah-events', form);
        toast.success('Kegiatan berhasil ditambahkan');
      }
      setDialogOpen(false);
      fetchEvents();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal menyimpan kegiatan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Yakin ingin menghapus kegiatan ini?')) return;

    try {
      await api.delete(`/madrasah-events/${id}`);
      toast.success('Kegiatan berhasil dihapus');
      fetchEvents();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal menghapus kegiatan');
    }
  };

  const clearFilters = () => {
    setFilterYear('');
    setFilterMonth('');
    setSearchQuery('');
  };

  const filteredEvents = events.filter(e => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.name?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const availableYears = [...new Set(events.map(e => e.date?.substring(0, 4)))].sort((a, b) => b - a);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Kegiatan Madrasah</h1>
            <p className="text-sm text-slate-600 mt-1">
              Kelola kegiatan dan acara madrasah
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => openDialog()} className="gap-2 bg-[#006837] hover:bg-[#0B7A3B]">
              <Plus className="h-4 w-4" />
              Tambah Kegiatan
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Cari</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Cari kegiatan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Tahun</Label>
                <Select value={filterYear || undefined} onValueChange={(v) => setFilterYear(v === 'all' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Tahun</SelectItem>
                    {availableYears.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Bulan</Label>
                <Select value={filterMonth || undefined} onValueChange={(v) => setFilterMonth(v === 'all' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Bulan</SelectItem>
                    {Object.entries(MONTH_LABELS).map(([num, label]) => (
                      <SelectItem key={num} value={num}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full gap-2">
                  <X className="h-4 w-4" />
                  Clear Filter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="text-center py-12">Memuat data...</div>
      ) : filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <div className="text-slate-700 font-semibold">Tidak ada kegiatan</div>
            <div className="text-sm text-slate-500 mt-1">
              {searchQuery || filterYear || filterMonth
                ? 'Tidak ada kegiatan sesuai filter'
                : 'Belum ada kegiatan yang ditambahkan'}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              canEdit={canEdit}
              onEdit={() => openDialog(event)}
              onDelete={() => handleDelete(event.id)}
            />
          ))}
        </div>
      )}

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Kegiatan Madrasah' : 'Tambah Kegiatan Madrasah'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label>Nama Kegiatan <span className="text-red-500">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: Peringatan Hari Santri Nasional"
                required
              />
            </div>

            <div>
              <Label>Deskripsi</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Deskripsi kegiatan..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Tanggal Mulai <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Tanggal Selesai</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  min={form.date || undefined}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Jam Mulai <span className="text-red-500">*</span></Label>
                <Input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Jam Selesai <span className="text-red-500">*</span></Label>
                <Input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Tempat <span className="text-red-500">*</span></Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="Contoh: Aula Utama"
                required
              />
            </div>

            <div>
              <Label>Jumlah Peserta</Label>
              <Input
                type="number"
                value={form.participants_count}
                onChange={(e) => setForm({ ...form, participants_count: parseInt(e.target.value) || 0 })}
                min="0"
                placeholder="0"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting} className="bg-[#006837] hover:bg-[#0B7A3B]">
                {submitting ? 'Menyimpan...' : (editing ? 'Perbarui' : 'Simpan')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventCard({ event, canEdit, onEdit, onDelete }) {
  const date = event.date ? new Date(event.date + 'T00:00:00') : null;
  const dayName = date ? ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][date.getDay()] : '';

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Date Badge */}
          <div className="flex flex-col items-center justify-center w-16 h-16 rounded-lg bg-gradient-to-br from-[#006837] to-[#0B7A3B] text-white shrink-0">
            <div className="text-2xl font-extrabold leading-none">
              {date ? date.getDate() : '-'}
            </div>
            <div className="text-[10px] uppercase font-semibold opacity-90">
              {date ? MONTH_LABELS[date.getMonth() + 1].substring(0, 3) : ''}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="font-bold text-slate-900 text-lg leading-tight">{event.name}</h3>
                {date && (
                  <Badge className="bg-slate-100 text-slate-700 text-xs mt-1">
                    {dayName}, {date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </Badge>
                )}
              </div>
              {canEdit && (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={onEdit} className="h-8 w-8 p-0">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onDelete} className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {event.description && (
              <p className="text-sm text-slate-600 mb-3">{event.description}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="h-4 w-4 text-[#006837]" />
                <span className="font-medium">{event.start_time} - {event.end_time} WIB</span>
              </div>

              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="h-4 w-4 text-[#006837]" />
                <span>{event.location}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-600">
                <Users className="h-4 w-4 text-[#006837]" />
                <span>{event.participants_count} Peserta</span>
              </div>

              {event.created_by_name && (
                <div className="text-xs text-slate-500">
                  Dibuat oleh: {event.created_by_name}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
