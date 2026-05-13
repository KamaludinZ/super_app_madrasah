import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  CalendarDays, Plus, Pencil, Trash2, Calendar as CalendarIcon,
  ChevronLeft, ChevronRight, Info, Sun, Star, BookmarkX, Award,
} from 'lucide-react';
import { api, DAY_LABELS } from '@/lib/api';
import { toast } from 'sonner';

const DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
const MONTHS_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_HEAD_ID = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const HOLIDAY_CATEGORIES = [
  { value: 'libur_nasional', label: 'Libur Nasional', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: Star },
  { value: 'libur_keagamaan', label: 'Libur Keagamaan', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Award },
  { value: 'libur_semester', label: 'Libur Semester', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: BookmarkX },
  { value: 'kegiatan_akademik', label: 'Kegiatan Akademik', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: CalendarIcon },
];

function catInfo(cat) {
  return HOLIDAY_CATEGORIES.find((c) => c.value === cat) || HOLIDAY_CATEGORIES[0];
}

export default function AdminHolidaysPage() {
  const [tab, setTab] = useState('weekly');
  return (
    <div className="space-y-6" data-testid="admin-holidays-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <CalendarDays className="h-3 w-3 mr-1" /> Pengaturan Hari Libur
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Hari Libur</h1>
        <p className="text-sm text-slate-600 mt-1">Atur libur mingguan rutin & libur akademik tahunan</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="weekly" data-testid="tab-weekly-holidays">Libur Mingguan</TabsTrigger>
          <TabsTrigger value="academic" data-testid="tab-academic-holidays">Libur Akademik</TabsTrigger>
        </TabsList>
        <TabsContent value="weekly" className="mt-4">
          <WeeklyHolidaysTab />
        </TabsContent>
        <TabsContent value="academic" className="mt-4">
          <AcademicHolidaysTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function WeeklyHolidaysTab() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ day: 'minggu', description: 'Libur', is_active: true });

  const refresh = async () => {
    const { data } = await api.get('/weekly-holidays');
    setItems(data || []);
  };
  useEffect(() => { refresh(); }, []);

  const openCreate = () => { setEditing(null); setForm({ day: 'minggu', description: 'Libur', is_active: true }); setOpen(true); };
  const openEdit = (h) => { setEditing(h); setForm({ ...h }); setOpen(true); };
  const handleSubmit = async () => {
    try {
      if (editing) await api.put(`/weekly-holidays/${editing.id}`, form);
      else await api.post('/weekly-holidays', form);
      toast.success('Berhasil disimpan');
      setOpen(false); await refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal');
    }
  };
  const handleDelete = async (h) => {
    if (!window.confirm(`Hapus hari libur ${DAY_LABELS[h.day] || h.day}?`)) return;
    await api.delete(`/weekly-holidays/${h.id}`);
    toast.success('Dihapus'); await refresh();
  };

  return (
    <div className="space-y-4" data-testid="weekly-holidays-section">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-slate-600">Hari libur rutin per minggu (mis. Minggu untuk full school week, Sabtu/Min untuk 5-hari kerja)</p>
        <Button onClick={openCreate} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-weekly-holiday-button">
          <Plus className="h-4 w-4" /> Tambah Hari Libur
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table data-testid="weekly-holidays-table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">NO</TableHead>
                <TableHead>HARI</TableHead>
                <TableHead>KETERANGAN</TableHead>
                <TableHead className="text-center">STATUS</TableHead>
                <TableHead className="text-right">AKSI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((h, i) => (
                <TableRow key={h.id} data-testid={`weekly-holiday-row-${h.day}`}>
                  <TableCell className="text-center text-slate-500 font-mono">{i + 1}</TableCell>
                  <TableCell className="font-semibold">{DAY_LABELS[h.day] || h.day}</TableCell>
                  <TableCell className="text-sm">{h.description || '-'}</TableCell>
                  <TableCell className="text-center">
                    {h.is_active ?
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Aktif</Badge> :
                      <Badge variant="outline">Nonaktif</Badge>
                    }
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(h)} data-testid={`edit-weekly-${h.day}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(h)} className="text-rose-600" data-testid={`delete-weekly-${h.day}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-12 text-slate-500">
                  <Sun className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                  <div className="font-semibold">Belum ada hari libur mingguan</div>
                  <div className="text-sm mt-1">Klik "Tambah Hari Libur" untuk mengatur</div>
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Hari Libur' : 'Tambah Hari Libur Mingguan'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Hari *</Label>
              <Select value={form.day} onValueChange={(v) => setForm({ ...form, day: v })} disabled={!!editing}>
                <SelectTrigger data-testid="weekly-form-day"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Keterangan</Label>
              <Input value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Mis. Libur akhir pekan, Libur khusus, dll"
                data-testid="weekly-form-description" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50">
              <div>
                <div className="font-semibold text-sm">Aktif</div>
                <div className="text-xs text-slate-600">Saat aktif, hari ini tidak masuk hitungan jadwal mengajar</div>
              </div>
              <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} data-testid="weekly-form-active" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]" data-testid="weekly-form-submit">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AcademicHolidaysTab() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ date: '', end_date: '', name: '', category: 'libur_nasional', description: '' });

  const refresh = async () => {
    const { data } = await api.get('/academic-holidays', { params: { year } });
    setItems(data || []);
  };
  useEffect(() => { refresh(); }, [year]);

  const holidaysByDate = useMemo(() => {
    const map = {};
    items.forEach((h) => {
      // Handle multi-day holidays
      if (h.end_date && h.end_date > h.date) {
        const start = new Date(h.date);
        const end = new Date(h.end_date);
        const cur = new Date(start);
        while (cur <= end) {
          const k = cur.toISOString().slice(0, 10);
          (map[k] = map[k] || []).push(h);
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        (map[h.date] = map[h.date] || []).push(h);
      }
    });
    return map;
  }, [items]);

  const openCreate = (date) => {
    setEditing(null);
    setForm({ date: date || '', end_date: '', name: '', category: 'libur_nasional', description: '' });
    setOpen(true);
  };
  const openEdit = (h) => {
    setEditing(h);
    setForm({ ...h, end_date: h.end_date || '' });
    setOpen(true);
  };
  const handleSubmit = async () => {
    if (!form.date || !form.name) { toast.error('Tanggal dan nama wajib'); return; }
    try {
      const payload = { ...form, end_date: form.end_date || null };
      if (editing) await api.put(`/academic-holidays/${editing.id}`, payload);
      else await api.post('/academic-holidays', payload);
      toast.success('Berhasil disimpan');
      setOpen(false); await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Gagal'); }
  };
  const handleDelete = async (h) => {
    if (!window.confirm(`Hapus libur ${h.name}?`)) return;
    await api.delete(`/academic-holidays/${h.id}`);
    toast.success('Dihapus'); await refresh();
  };

  return (
    <div className="space-y-4" data-testid="academic-holidays-section">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={() => setYear(year - 1)} data-testid="year-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-2xl font-bold tabular-nums text-slate-900 min-w-[80px] text-center">{year}</div>
          <Button size="icon" variant="outline" onClick={() => setYear(year + 1)} data-testid="year-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
          {HOLIDAY_CATEGORIES.map((c) => (
            <Badge key={c.value} variant="outline" className={c.color + ' gap-1'}>
              <c.icon className="h-3 w-3" /> {c.label}
            </Badge>
          ))}
        </div>
        <Button onClick={() => openCreate()} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-academic-holiday-button">
          <Plus className="h-4 w-4" /> Tambah Libur
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="academic-calendar-grid">
        {MONTHS_ID.map((m, mi) => (
          <MonthCalendar key={mi} year={year} month={mi} holidaysByDate={holidaysByDate}
            onAddDate={(date) => openCreate(date)} />
        ))}
      </div>

      {/* List view */}
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-slate-100 font-semibold">Daftar Libur {year} ({items.length})</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nama Libur</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((h) => {
                const ci = catInfo(h.category);
                return (
                  <TableRow key={h.id} data-testid={`academic-holiday-row-${h.id}`}>
                    <TableCell className="font-mono text-sm">
                      {h.date}{h.end_date && h.end_date !== h.date ? ` – ${h.end_date}` : ''}
                    </TableCell>
                    <TableCell className="font-semibold">{h.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={ci.color + ' gap-1'}>
                        <ci.icon className="h-3 w-3" /> {ci.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{h.description || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(h)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(h)} className="text-rose-600"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada libur di tahun {year}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Libur Akademik' : 'Tambah Libur Akademik'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Tanggal Mulai *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
                  data-testid="academic-form-date" />
              </div>
              <div>
                <Label>Tanggal Selesai (opsional)</Label>
                <Input type="date" value={form.end_date || ''} onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  data-testid="academic-form-end-date" />
              </div>
            </div>
            <div>
              <Label>Nama Libur *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mis. Idul Fitri 1447H, Libur Semester Ganjil"
                data-testid="academic-form-name" />
            </div>
            <div>
              <Label>Kategori</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger data-testid="academic-form-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HOLIDAY_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Keterangan (Opsional)</Label>
              <Textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Detail tambahan..." rows={2} />
            </div>
            <div className="text-xs text-slate-600 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-700 mt-0.5 shrink-0" />
              <div>
                Libur akademik bersifat <strong>informasi</strong> — ditampilkan di halaman monitoring publik & kalender, tidak memblok jurnal jika ada kegiatan akademik di hari itu.
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837] hover:bg-[#0B7A3B]" data-testid="academic-form-submit">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MonthCalendar({ year, month, holidaysByDate, onAddDate }) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = firstDay.getDay(); // 0=Sun
  const daysInMonth = lastDay.getDate();
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Card className="overflow-hidden" data-testid={`month-${month}`}>
      <CardContent className="p-3">
        <div className="font-bold text-slate-900 text-center mb-2">{MONTHS_ID[month]}</div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-500 uppercase">
          {DAY_HEAD_ID.map((d, i) => (
            <div key={i} className={`py-1 ${i === 0 ? 'text-rose-500' : ''}`}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((d, idx) => {
            if (!d) return <div key={idx} className="aspect-square" />;
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayOfWeek = idx % 7;
            const isWeekend = dayOfWeek === 0;
            const holidays = holidaysByDate[dateKey] || [];
            const isHoliday = holidays.length > 0;
            const isToday = dateKey === todayKey;
            const cat = isHoliday ? catInfo(holidays[0].category) : null;
            return (
              <button
                key={idx}
                onClick={() => onAddDate(dateKey)}
                title={isHoliday ? holidays.map((h) => h.name).join(', ') : 'Klik untuk tambah libur'}
                className={`aspect-square text-xs font-medium rounded transition-colors flex items-center justify-center relative
                  ${isHoliday ? cat.color : isWeekend ? 'text-rose-500 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'}
                  ${isToday ? 'ring-2 ring-[#006837] font-bold' : ''}
                `}
                data-testid={`cal-day-${dateKey}`}
              >
                {d}
                {isHoliday && (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-rose-600" />
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
