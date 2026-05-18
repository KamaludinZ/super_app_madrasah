import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Loader2, LayoutGrid, List, Trash2, XCircle } from 'lucide-react';
import { api, DAY_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

export default function JadwalPage() {
  const { user, activeRole } = useAuth();
  const [today, setToday] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [weeklyGrouped, setWeeklyGrouped] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('card'); // card | list

  const loadSchedules = async () => {
    try {
      if (activeRole === 'siswa') {
        const { data } = await api.get(`/student/${user.id}/today`);
        setToday(data?.today_schedule || []);
        if (data?.class?.id) {
          const { data: all } = await api.get('/schedules', { params: { class_id: data.class.id } });
          setWeekly(all);
          const { data: grouped } = await api.get('/schedules/grouped', { params: { class_id: data.class.id } });
          setWeeklyGrouped(grouped || []);
        }
      } else if (activeRole === 'wali_kelas') {
        // Wali kelas: get jadwal kelasnya
        // Get active academic year first
        const ayRes = await api.get('/academic-years/active');
        const activeAY = ayRes.data;

        const { data: classes } = await api.get('/classes', {
          params: activeAY ? { academic_year_id: activeAY.id } : {}
        });
        const myClass = classes.find(c => c.homeroom_teacher_id === user.id);
        if (myClass) {
          const { data: todayData } = await api.get('/schedules', { params: { class_id: myClass.id, day: getDayId() } });
          setToday(todayData || []);
          const { data: all } = await api.get('/schedules', { params: { class_id: myClass.id } });
          setWeekly(all || []);
          const { data: grouped } = await api.get('/schedules/grouped', { params: { class_id: myClass.id } });
          setWeeklyGrouped(grouped || []);
        } else {
          setToday([]);
          setWeekly([]);
          setWeeklyGrouped([]);
        }
      } else {
        // Guru: jadwal mengajar mereka sendiri
        const { data } = await api.get('/schedules/my-today');
        setToday(data);
        const { data: all } = await api.get('/schedules', { params: { teacher_id: user.id } });
        setWeekly(all);
        const { data: grouped } = await api.get('/schedules/grouped', { params: { teacher_id: user.id } });
        setWeeklyGrouped(grouped || []);
      }
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, activeRole]);

  const handleUnsubmit = async (s) => {
    if (!window.confirm('Batalkan pengiriman jadwal ini? Jadwal akan kembali ke status draft.')) return;
    try {
      await api.put(`/schedules/${s.id}/unsubmit`);
      toast.success('Jadwal dibatalkan dan kembali ke draft');
      await loadSchedules();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal membatalkan');
    }
  };

  const handleDelete = async (s) => {
    if (!window.confirm('Hapus jadwal ini?')) return;
    try {
      await api.delete(`/schedules/${s.id}`);
      toast.success('Jadwal dihapus');
      await loadSchedules();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal menghapus');
    }
  };

  // Helper function to get current day ID (senin, selasa, etc)
  function getDayId() {
    const days = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
    return days[new Date().getDay()];
  }

  // Group weekly by day
  const byDay = (weekly || []).reduce((acc, s) => {
    (acc[s.day] = acc[s.day] || []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">Jadwal Pelajaran</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Jadwal Saya</h1>
      </div>
      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today" data-testid="jadwal-tab-today">Hari Ini ({today.length})</TabsTrigger>
          <TabsTrigger value="weekly" data-testid="jadwal-tab-weekly">Mingguan ({weekly.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="today" className="mt-4">
          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <ScheduleList items={today} />
          )}
        </TabsContent>
        <TabsContent value="weekly" className="mt-4 space-y-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-slate-600">
              {viewMode === 'list' && (
                <span className="px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800">
                  <span className="font-semibold">JTM (Jam Tugas Mengajar):</span> Jam mengajar berdekatan digabung
                </span>
              )}
            </div>
            <Tabs value={viewMode} onValueChange={setViewMode}>
              <TabsList>
                <TabsTrigger value="card" data-testid="view-mode-card"><LayoutGrid className="h-4 w-4 mr-1" /> Card</TabsTrigger>
                <TabsTrigger value="list" data-testid="view-mode-list"><List className="h-4 w-4 mr-1" /> List</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {viewMode === 'card' ? (
            <>
              {['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'].map((day) => (
                <div key={day}>
                  <div className="text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">{DAY_LABELS[day]}</div>
                  <ScheduleList items={byDay[day] || []} />
                </div>
              ))}
            </>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table data-testid="jadwal-table">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hari</TableHead>
                        <TableHead>Jam</TableHead>
                        <TableHead>JTM</TableHead>
                        <TableHead>Kelas</TableHead>
                        <TableHead>Mapel</TableHead>
                        <TableHead>Guru</TableHead>
                        <TableHead>Ruang</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weeklyGrouped.map((s) => (
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
                              <Badge className="bg-rose-100 text-rose-700 border-rose-200">Terkunci</Badge>
                            ) : s.status === 'approved' ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Disetujui</Badge>
                            ) : s.status === 'submitted' ? (
                              <Badge className="bg-blue-100 text-blue-700 border-blue-200">Terkirim</Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">Draft</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {s.status === 'submitted' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUnsubmit(s)}
                                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  title="Batal Kirim"
                                  data-testid={`unsubmit-${s.id}`}
                                >
                                  <XCircle className="h-4 w-4 mr-1" /> Batal Kirim
                                </Button>
                              )}
                              {s.status === 'approved' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDelete(s)}
                                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                  title="Hapus"
                                  data-testid={`delete-${s.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" /> Hapus
                                </Button>
                              )}
                              {s.status === 'locked' && (
                                <span className="text-xs text-slate-500 italic">Terkunci</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScheduleList({ items }) {
  if (!items || items.length === 0) {
    return <div className="text-sm text-slate-500 italic py-4">Tidak ada jadwal</div>;
  }
  return (
    <div className="space-y-2">
      {items.map((s, idx) => (
        <div key={s.id || idx} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="font-mono text-sm font-semibold w-24 shrink-0">{s.start_time}-{s.end_time}</div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900 truncate">{s.subject_name}</div>
            <div className="text-xs text-slate-600">{s.class_name} • {s.room_name} • {s.teacher_name}</div>
          </div>
          {s.journal_filled && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Terisi</Badge>}
        </div>
      ))}
    </div>
  );
}
