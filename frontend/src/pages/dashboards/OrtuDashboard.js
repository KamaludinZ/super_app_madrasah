import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, CheckCircle2, ChevronDown, Calendar } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

export default function OrtuDashboard() {
  const { user } = useAuth();
  const [children, setChildren] = useState([]);
  const [selectedChild, setSelectedChild] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/parent/children').then(({ data }) => {
      setChildren(data);
      if (data.length > 0) setSelectedChild(data[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedChild) return;
    api.get(`/student/${selectedChild}/today`).then(({ data }) => setData(data)).catch(() => {});
  }, [selectedChild]);

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">Dashboard Wali Murid</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Pantau Aktivitas Anak</h1>
        <p className="text-sm text-slate-600 mt-1">Anda memiliki <span className="font-semibold">{children.length}</span> anak di sekolah</p>
      </div>

      {children.length > 1 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 flex-wrap">
              <Users className="h-5 w-5 text-[#006837]" />
              <div className="flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">Pilih Anak</div>
              </div>
              <Select value={selectedChild || ''} onValueChange={setSelectedChild}>
                <SelectTrigger className="w-64" data-testid="switch-student-trigger">
                  <SelectValue placeholder="Pilih anak..." />
                </SelectTrigger>
                <SelectContent>
                  {children.map((c) => (
                    <SelectItem key={c.id} value={c.id} data-testid={`switch-student-${c.username}`}>
                      {c.full_name} ({c.nisn || '-'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {data?.student && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-100">
              <div className="h-12 w-12 rounded-full bg-[#006837] text-white flex items-center justify-center font-bold">
                {data.student.full_name?.substring(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900">{data.student.full_name}</div>
                <div className="text-xs text-slate-600">NISN: {data.student.nisn || '-'} • Kelas: {data?.class?.name || '-'}</div>
              </div>
            </div>

            <h2 className="text-sm font-semibold text-slate-900 mb-3 uppercase tracking-wide">Jadwal & Jurnal Hari Ini</h2>
            {!data.today_schedule?.length ? (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
                <div className="text-sm">Tidak ada jadwal hari ini</div>
              </div>
            ) : (
              <div className="space-y-2">
                {data.today_schedule.map((s, idx) => (
                  <div key={s.id || idx} className={`rounded-xl border p-3 ${s.journal ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="font-mono text-sm font-semibold w-24">{s.start_time}-{s.end_time}</div>
                        <div>
                          <div className="font-semibold text-slate-900">{s.subject_name}</div>
                          <div className="text-xs text-slate-600">{s.teacher_name}</div>
                        </div>
                      </div>
                      {s.journal ? (
                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Diisi</Badge>
                      ) : (
                        <Badge variant="outline">Belum</Badge>
                      )}
                    </div>
                    {s.journal && (
                      <div className="mt-2 pt-2 border-t border-emerald-200 text-sm">
                        <div className="text-slate-800"><span className="font-semibold">Materi: </span>{s.journal.materi}</div>
                        {s.journal.catatan && <div className="text-xs text-slate-600 mt-1">{s.journal.catatan}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
