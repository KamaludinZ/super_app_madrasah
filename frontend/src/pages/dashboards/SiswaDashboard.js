import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, BookOpen, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

export default function SiswaDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(`/student/${user.id}/today`).then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, [user.id]);

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">Dashboard Siswa</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Assalamu'alaikum, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-600 mt-1">Kelas: <span className="font-semibold">{data?.class?.name || '-'}</span></p>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Jadwal Pelajaran Hari Ini</h2>
          {loading ? (
            <div className="text-slate-500 text-sm">Memuat...</div>
          ) : !data?.today_schedule?.length ? (
            <div className="text-center py-8 text-slate-500">
              <Calendar className="h-10 w-10 mx-auto opacity-40 mb-2" />
              <div className="text-sm">Tidak ada jadwal hari ini</div>
            </div>
          ) : (
            <div className="space-y-2">
              {data.today_schedule.map((s, idx) => (
                <div key={s.id || idx} className={`rounded-xl border p-3 ${s.journal ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-sm font-semibold text-slate-900">{s.start_time}-{s.end_time}</div>
                      <div className="font-semibold text-slate-900">{s.subject_name}</div>
                    </div>
                    {s.journal ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Sudah Mengajar</Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-600">Belum</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 ml-0">{s.teacher_name} • {s.room_name}</div>
                  {s.journal && (
                    <div className="mt-2 pt-2 border-t border-emerald-200 text-sm">
                      <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-0.5">Materi:</div>
                      <div className="text-slate-800">{s.journal.materi}</div>
                      {s.journal.catatan && <div className="text-xs text-slate-600 mt-1">{s.journal.catatan}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
