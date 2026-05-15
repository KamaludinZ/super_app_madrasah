import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, Loader2 } from 'lucide-react';
import { api, DAY_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function JadwalPage() {
  const { user, activeRole } = useAuth();
  const [today, setToday] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        if (activeRole === 'siswa') {
          const { data } = await api.get(`/student/${user.id}/today`);
          setToday(data?.today_schedule || []);
          if (data?.class?.id) {
            const { data: all } = await api.get('/schedules', { params: { class_id: data.class.id } });
            setWeekly(all);
          }
        } else if (activeRole === 'wali_kelas') {
          // Wali kelas: get jadwal kelasnya
          const { data: classes } = await api.get('/classes');
          const myClass = classes.find(c => c.homeroom_teacher_id === user.id);
          if (myClass) {
            const { data: todayData } = await api.get('/schedules', { params: { class_id: myClass.id, day: getDayId() } });
            setToday(todayData || []);
            const { data: all } = await api.get('/schedules', { params: { class_id: myClass.id } });
            setWeekly(all || []);
          } else {
            setToday([]);
            setWeekly([]);
          }
        } else {
          // Guru: jadwal mengajar mereka sendiri
          const { data } = await api.get('/schedules/my-today');
          setToday(data);
          const { data: all } = await api.get('/schedules', { params: { teacher_id: user.id } });
          setWeekly(all);
        }
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [user.id, activeRole]);

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
          {['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'].map((day) => (
            <div key={day}>
              <div className="text-sm font-semibold text-slate-700 mb-2 uppercase tracking-wide">{DAY_LABELS[day]}</div>
              <ScheduleList items={byDay[day] || []} />
            </div>
          ))}
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
