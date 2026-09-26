import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, ShieldAlert, Clock, User, CalendarCheck, HandHeart, Users2, MoonStar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api, DAY_LABELS } from '@/lib/api';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';

const DAYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
const SHIFTS = [
  { value: 'pagi', label: 'Pagi', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'siang', label: 'Siang', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'sore', label: 'Sore', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'fullday', label: 'Fullday', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];

const IBADAH_KATEGORI_LIST = [
  { value: 'salaman_putri', label: 'Piket Salaman & Pendampingan Ibadah Putri', icon: HandHeart, color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'salaman_putra', label: 'Piket Salaman & Pendampingan Ibadah Putra', icon: HandHeart, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'keputrian', label: 'Piket Keputrian', icon: Users2, color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'imam_shalat', label: 'Imam Shalat', icon: MoonStar, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
];
const IMAM_JENIS_LIST = [
  { value: 'dhuha', label: 'Shalat Dhuha' },
  { value: 'dhuhur', label: 'Shalat Dhuhur' },
  { value: 'jumat', label: 'Khotib Shalat Jumat (Jumat saja)' },
  { value: 'ashar', label: 'Shalat Ashar' },
];
const IBADAH_EMPTY_FORM = {
  kategori: 'salaman_putri', hari: 'senin', jenis_ibadah: 'dhuha', waktu: '',
  petugas_id: '', notes: '', is_active: true,
};

export default function WakaKurJadwalPiketPage() {
  const [items, setItems] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [filterDay, setFilterDay] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    day: 'senin', shift: 'pagi', start_time: '06:30', end_time: '14:00',
    teacher_id: '', notes: '', is_active: true,
  });

  // Piket Hari Ini
  const [todayPiket, setTodayPiket] = useState([]);
  const [todayIbadah, setTodayIbadah] = useState([]);
  const [loadingToday, setLoadingToday] = useState(true);

  // Jadwal Ibadah & Keputrian
  const [ibadahItems, setIbadahItems] = useState([]);
  const [ibadahOpen, setIbadahOpen] = useState(false);
  const [ibadahEditing, setIbadahEditing] = useState(null);
  const [ibadahForm, setIbadahForm] = useState(IBADAH_EMPTY_FORM);

  const refresh = async () => {
    try {
      const { data } = await api.get('/piket-schedules');
      setItems(data);
    } catch (e) {
      toast.error('Gagal memuat jadwal piket');
    }
  };

  const refreshIbadah = async () => {
    try {
      const { data } = await api.get('/ibadah-schedules');
      setIbadahItems(data);
    } catch (e) {
      toast.error('Gagal memuat jadwal ibadah');
    }
  };

  const refreshToday = async () => {
    setLoadingToday(true);
    try {
      const [p, i] = await Promise.all([
        api.get('/piket-schedules/today'),
        api.get('/ibadah-schedules/today'),
      ]);
      setTodayPiket(p.data || []);
      setTodayIbadah(i.data || []);
    } catch (e) {
      toast.error('Gagal memuat piket hari ini');
    } finally {
      setLoadingToday(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        // Load piket schedules first
        const p = await api.get('/piket-schedules');
        setItems(p.data);
        refreshIbadah();
        refreshToday();

        // Load users for teacher selection
        try {
          const u = await api.get('/wakakur/users');
          // Filter only eligible teachers (GTK roles)
          const eligibleTeachers = u.data.filter((x) => x.roles?.some((rr) =>
            ['guru_piket', 'guru', 'wali_kelas', 'guru_bk', 'guru_tata_tertib', 'tenaga_kependidikan'].includes(rr)
          ));
          setTeachers(eligibleTeachers);
        } catch (err) {
          setTeachers([]);
        }
      } catch (e) {
        toast.error('Gagal memuat jadwal piket');
      }
    })();
  }, []);

  const openCreate = (presetDay) => {
    setEditing(null);
    setForm({
      day: presetDay || 'senin', shift: 'pagi',
      start_time: '06:30', end_time: '14:00',
      teacher_id: '', notes: '', is_active: true,
    });
    setOpen(true);
  };
  const openEdit = (p) => { setEditing(p); setForm({ ...p }); setOpen(true); };
  const handleSubmit = async () => {
    if (!form.teacher_id) { toast.error('Pilih guru piket'); return; }
    try {
      if (editing) await api.put(`/piket-schedules/${editing.id}`, form);
      else await api.post('/piket-schedules', form);
      toast.success('Jadwal piket tersimpan'); setOpen(false); refresh(); refreshToday();
    } catch (e) { toast.error('Gagal menyimpan jadwal piket'); }
  };
  const handleDelete = async (p) => {
    if (!(await confirmDialog('Hapus jadwal piket?'))) return;
    try {
      await api.delete(`/piket-schedules/${p.id}`);
      toast.success('Jadwal piket dihapus');
      refresh(); refreshToday();
    } catch (e) {
      toast.error('Gagal menghapus jadwal piket');
    }
  };

  const openIbadahCreate = (presetKategori) => {
    setIbadahEditing(null);
    setIbadahForm({ ...IBADAH_EMPTY_FORM, kategori: presetKategori || 'salaman_putri' });
    setIbadahOpen(true);
  };
  const openIbadahEdit = (s) => {
    setIbadahEditing(s);
    setIbadahForm({
      kategori: s.kategori, hari: s.hari || 'senin', jenis_ibadah: s.jenis_ibadah || 'dhuha',
      waktu: s.waktu || '', petugas_id: s.petugas_id || '', notes: s.notes || '', is_active: s.is_active,
    });
    setIbadahOpen(true);
  };
  const handleIbadahSubmit = async () => {
    if (!ibadahForm.petugas_id) { toast.error('Pilih petugas'); return; }
    try {
      if (ibadahEditing) await api.put(`/ibadah-schedules/${ibadahEditing.id}`, ibadahForm);
      else await api.post('/ibadah-schedules', ibadahForm);
      toast.success('Jadwal ibadah tersimpan'); setIbadahOpen(false); refreshIbadah(); refreshToday();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Gagal menyimpan'); }
  };
  const handleIbadahDelete = async (s) => {
    if (!(await confirmDialog('Hapus jadwal ini?'))) return;
    await api.delete(`/ibadah-schedules/${s.id}`); toast.success('Dihapus'); refreshIbadah(); refreshToday();
  };

  // Group by day
  const byDay = items.reduce((acc, p) => {
    (acc[p.day] = acc[p.day] || []).push(p);
    return acc;
  }, {});

  const filtered = filterDay === 'all' ? items : items.filter((p) => p.day === filterDay);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <ShieldAlert className="h-3 w-3 mr-1" /> Jadwal Piket (Waka Kurikulum)
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Jadwal Tugas Piket Guru</h1>
          <p className="text-sm text-slate-600 mt-1">{items.length} jadwal piket terdaftar</p>
        </div>
        <Button onClick={() => openCreate()} className="bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="add-piket-button">
          <Plus className="h-4 w-4" /> Tambah Jadwal Piket
        </Button>
      </div>

      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today" data-testid="piket-tab-today">Piket Hari Ini</TabsTrigger>
          <TabsTrigger value="week" data-testid="piket-tab-week">Tampilan Minggu</TabsTrigger>
          <TabsTrigger value="list" data-testid="piket-tab-list">List</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          {loadingToday ? (
            <div className="text-center py-10 text-slate-400 text-sm">Memuat piket hari ini...</div>
          ) : (
            <div className="space-y-4" data-testid="piket-today-content">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-bold text-[#006837] flex items-center gap-2 mb-3">
                    <CalendarCheck className="h-4 w-4" /> Piket Guru Hari Ini
                  </h3>
                  {todayPiket.length === 0 ? (
                    <div className="text-xs text-slate-400 italic text-center py-4">Tidak ada jadwal piket hari ini</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {todayPiket.map((p) => {
                        const shift = SHIFTS.find((s) => s.value === p.shift) || SHIFTS[0];
                        return (
                          <div key={p.id} className="rounded-lg border border-slate-200 p-2.5 bg-white">
                            <div className="flex items-center justify-between mb-1">
                              <Badge className={`text-[10px] ${shift.color}`}>{shift.label}</Badge>
                              <div className="font-mono text-[10px] text-slate-500">{p.start_time}-{p.end_time}</div>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <div className="text-sm font-semibold truncate">{p.teacher_name || '-'}</div>
                            </div>
                            {p.notes && <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{p.notes}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <h3 className="font-bold text-[#006837] flex items-center gap-2 mb-3">
                    <MoonStar className="h-4 w-4" /> Piket Ibadah & Keputrian Hari Ini
                  </h3>
                  {todayIbadah.length === 0 ? (
                    <div className="text-xs text-slate-400 italic text-center py-4">Tidak ada jadwal ibadah hari ini</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {todayIbadah.map((s) => {
                        const kat = IBADAH_KATEGORI_LIST.find((k) => k.value === s.kategori) || IBADAH_KATEGORI_LIST[0];
                        const jenis = IMAM_JENIS_LIST.find((j) => j.value === s.jenis_ibadah);
                        return (
                          <div key={s.id} className="rounded-lg border border-slate-200 p-2.5 bg-white">
                            <Badge className={`text-[10px] ${kat.color} mb-1`}>{jenis ? jenis.label : kat.label}</Badge>
                            <div className="flex items-center gap-2 mt-1">
                              <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <div className="text-sm font-semibold truncate">{s.petugas_name || '-'}</div>
                            </div>
                            {s.waktu && <div className="font-mono text-[10px] text-slate-500 mt-1">{s.waktu}</div>}
                            {s.notes && <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{s.notes}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="piket-week-grid">
            {DAYS.map((d) => {
              const dayItems = byDay[d] || [];
              return (
                <Card key={d}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-[#006837]">{DAY_LABELS[d]}</h3>
                      <Button size="sm" variant="ghost" onClick={() => openCreate(d)} className="h-7 px-2 text-xs" data-testid={`add-piket-${d}`}>
                        <Plus className="h-3 w-3 mr-1" /> Tugas
                      </Button>
                    </div>
                    {dayItems.length === 0 ? (
                      <div className="text-xs text-slate-400 italic text-center py-4">Belum ada jadwal</div>
                    ) : (
                      <div className="space-y-2">
                        {dayItems.map((p) => {
                          const shift = SHIFTS.find((s) => s.value === p.shift) || SHIFTS[0];
                          return (
                            <div key={p.id} className="rounded-lg border border-slate-200 p-2.5 bg-white">
                              <div className="flex items-center justify-between mb-1">
                                <Badge className={`text-[10px] ${shift.color}`}>{shift.label}</Badge>
                                <div className="font-mono text-[10px] text-slate-500">{p.start_time}-{p.end_time}</div>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <div className="text-sm font-semibold truncate">{p.teacher_name || '-'}</div>
                              </div>
                              {p.notes && <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{p.notes}</div>}
                              {!p.is_active && (
                                <Badge variant="secondary" className="text-[10px] mt-1">Nonaktif</Badge>
                              )}
                              <div className="flex justify-end gap-1 mt-1.5">
                                <Button size="icon" variant="ghost" onClick={() => openEdit(p)} className="h-6 w-6">
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => handleDelete(p)} className="h-6 w-6 text-rose-600">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <div className="flex justify-end mb-3">
            <Select value={filterDay} onValueChange={setFilterDay}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Hari</SelectItem>
                {DAYS.map((d) => <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table data-testid="piket-list-table">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hari</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Jam</TableHead>
                      <TableHead>Guru Piket</TableHead>
                      <TableHead>Catatan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                          Belum ada jadwal piket
                        </TableCell>
                      </TableRow>
                    ) : filtered.map((p) => {
                      const shift = SHIFTS.find((s) => s.value === p.shift) || SHIFTS[0];
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="capitalize font-semibold">{DAY_LABELS[p.day]}</TableCell>
                          <TableCell><Badge className={shift.color}>{shift.label}</Badge></TableCell>
                          <TableCell className="font-mono">{p.start_time}-{p.end_time}</TableCell>
                          <TableCell className="font-medium">{p.teacher_name || '-'}</TableCell>
                          <TableCell className="text-xs text-slate-600 max-w-xs truncate">{p.notes || '-'}</TableCell>
                          <TableCell>
                            {p.is_active ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Aktif</Badge>
                            ) : (
                              <Badge variant="outline">Nonaktif</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(p)} className="text-rose-600">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Jadwal Piket Salaman, Ibadah, Keputrian & Imam Shalat */}
      <div className="space-y-4">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><HandHeart className="h-3 w-3 mr-1" /> Jadwal Ibadah & Keputrian</Badge>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Jadwal Piket Salaman, Ibadah, Keputrian & Imam Shalat</h2>
          <p className="text-sm text-slate-600 mt-1">Jadwal piket salaman & pendampingan ibadah putra/putri, keputrian, dan imam shalat (Dhuha, Dhuhur, Khotib Jumat, Ashar)</p>
        </div>

        {IBADAH_KATEGORI_LIST.map((kat) => {
          const katItems = ibadahItems.filter((s) => s.kategori === kat.value);
          return (
            <Card key={kat.value}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-[#006837] flex items-center gap-2">
                    <kat.icon className="h-4 w-4" /> {kat.label}
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => openIbadahCreate(kat.value)} className="h-7 px-2 text-xs gap-1" data-testid={`add-ibadah-${kat.value}`}>
                    <Plus className="h-3 w-3" /> Tambah
                  </Button>
                </div>
                {katItems.length === 0 ? (
                  <div className="text-xs text-slate-400 italic text-center py-4">Belum ada jadwal</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {katItems.map((s) => {
                      const jenis = IMAM_JENIS_LIST.find((j) => j.value === s.jenis_ibadah);
                      return (
                        <div key={s.id} className="rounded-lg border border-slate-200 p-2.5 bg-white">
                          <div className="flex items-center justify-between mb-1">
                            <Badge className={`text-[10px] ${kat.color}`}>
                              {kat.value === 'imam_shalat' ? (jenis?.label || '-') : DAY_LABELS[s.hari] || '-'}
                            </Badge>
                            {s.waktu && <div className="font-mono text-[10px] text-slate-500">{s.waktu}</div>}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <div className="text-sm font-semibold truncate">{s.petugas_name || '-'}</div>
                          </div>
                          {s.notes && <div className="text-[10px] text-slate-500 mt-1 line-clamp-2">{s.notes}</div>}
                          {!s.is_active && <Badge variant="outline" className="text-[10px] mt-1">Nonaktif</Badge>}
                          <div className="flex justify-end gap-1 mt-1.5">
                            <Button size="icon" variant="ghost" onClick={() => openIbadahEdit(s)} className="h-6 w-6"><Pencil className="h-3 w-3" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleIbadahDelete(s)} className="h-6 w-6 text-rose-600"><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={ibadahOpen} onOpenChange={setIbadahOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{ibadahEditing ? 'Edit Jadwal Ibadah' : 'Tambah Jadwal Ibadah'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Kategori *</Label>
              <Select value={ibadahForm.kategori} onValueChange={(v) => setIbadahForm({ ...ibadahForm, kategori: v })}>
                <SelectTrigger data-testid="ibadah-form-kategori"><SelectValue /></SelectTrigger>
                <SelectContent>{IBADAH_KATEGORI_LIST.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {ibadahForm.kategori === 'imam_shalat' ? (
              <div className="col-span-2">
                <Label>Jenis Shalat *</Label>
                <Select value={ibadahForm.jenis_ibadah} onValueChange={(v) => setIbadahForm({ ...ibadahForm, jenis_ibadah: v })}>
                  <SelectTrigger data-testid="ibadah-form-jenis"><SelectValue /></SelectTrigger>
                  <SelectContent>{IMAM_JENIS_LIST.map((j) => <SelectItem key={j.value} value={j.value}>{j.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="col-span-2">
                <Label>Hari *</Label>
                <Select value={ibadahForm.hari} onValueChange={(v) => setIbadahForm({ ...ibadahForm, hari: v })}>
                  <SelectTrigger data-testid="ibadah-form-hari"><SelectValue /></SelectTrigger>
                  <SelectContent>{DAYS.map((d) => <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="col-span-2">
              <Label>Waktu</Label>
              <Input value={ibadahForm.waktu} onChange={(e) => setIbadahForm({ ...ibadahForm, waktu: e.target.value })} placeholder="Misal: 06:30-07:00 atau 07:00" data-testid="ibadah-form-waktu" />
            </div>
            <div className="col-span-2">
              <Label>Petugas *</Label>
              <Select value={ibadahForm.petugas_id} onValueChange={(v) => setIbadahForm({ ...ibadahForm, petugas_id: v })}>
                <SelectTrigger data-testid="ibadah-form-petugas"><SelectValue placeholder="Pilih guru..." /></SelectTrigger>
                <SelectContent>{teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Catatan / Lokasi</Label>
              <Textarea value={ibadahForm.notes} onChange={(e) => setIbadahForm({ ...ibadahForm, notes: e.target.value })} placeholder="Misal: Masjid, Aula, dll." rows={2} data-testid="ibadah-form-notes" />
            </div>
            <label className="col-span-2 flex items-center gap-3 cursor-pointer">
              <Switch checked={ibadahForm.is_active} onCheckedChange={(v) => setIbadahForm({ ...ibadahForm, is_active: v })} />
              <span className="text-sm">Jadwal aktif</span>
            </label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIbadahOpen(false)}>Batal</Button><Button onClick={handleIbadahSubmit} className="bg-[#006837]" data-testid="ibadah-form-submit">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Jadwal Piket' : 'Tambah Jadwal Piket'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Hari *</Label>
              <Select value={form.day} onValueChange={(v) => setForm({...form, day: v})}>
                <SelectTrigger data-testid="piket-form-day"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DAYS.map((d) => <SelectItem key={d} value={d}>{DAY_LABELS[d]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Shift *</Label>
              <Select value={form.shift} onValueChange={(v) => setForm({...form, shift: v})}>
                <SelectTrigger data-testid="piket-form-shift"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SHIFTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jam Mulai</Label>
              <Input type="time" value={form.start_time} onChange={(e) => setForm({...form, start_time: e.target.value})} data-testid="piket-form-start" />
            </div>
            <div>
              <Label>Jam Selesai</Label>
              <Input type="time" value={form.end_time} onChange={(e) => setForm({...form, end_time: e.target.value})} data-testid="piket-form-end" />
            </div>
            <div className="col-span-2">
              <Label>Guru Piket *</Label>
              <Select value={form.teacher_id} onValueChange={(v) => setForm({...form, teacher_id: v})}>
                <SelectTrigger data-testid="piket-form-teacher"><SelectValue placeholder="Pilih guru..." /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Catatan / Lokasi Piket</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} placeholder="Misal: Gerbang utama, lobby, dll." rows={2} data-testid="piket-form-notes" />
            </div>
            <label className="col-span-2 flex items-center gap-3 cursor-pointer">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({...form, is_active: v})} />
              <span className="text-sm">Jadwal aktif</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} className="bg-[#006837]" data-testid="piket-form-submit">Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
