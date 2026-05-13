import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BookMarked, Users, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

export default function WaliKelasDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get('/wali-kelas/my-class').then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (!data?.class) return (
    <Card><CardContent className="py-12 text-center text-slate-500">
      <BookMarked className="h-10 w-10 mx-auto opacity-40 mb-2" />
      <div>Anda tidak terdaftar sebagai wali kelas pada tahun pelajaran aktif</div>
    </CardContent></Card>
  );

  const filled = (data.today_schedule || []).filter((s) => s.journal_filled).length;
  const total = (data.today_schedule || []).length;
  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-amber-100 text-amber-900 border-amber-200 mb-2">✦ Wali Kelas {data.class.name}</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Dashboard Kelas {data.class.name}</h1>
        <p className="text-sm text-slate-600 mt-1">{data.students?.length || 0} siswa • {filled}/{total} jurnal terisi hari ini</p>
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="text-base font-semibold mb-4">Status Pengisian Jurnal Hari Ini</h2>
          {!data.today_schedule?.length ? <div className="text-sm text-slate-500">Tidak ada jadwal hari ini</div> : (
            <div className="space-y-2">
              {data.today_schedule.map((s, idx) => (
                <div key={s.id || idx} className={`flex items-center gap-3 rounded-xl border p-3 ${s.journal_filled ? 'bg-emerald-50/50 border-emerald-200' : 'bg-amber-50/50 border-amber-200'}`}>
                  <div className="font-mono text-sm font-semibold w-24 shrink-0">{s.start_time}-{s.end_time}</div>
                  <div className="flex-1">
                    <div className="font-semibold">{s.subject_name}</div>
                    <div className="text-xs text-slate-600">{s.teacher_name} • {s.room_name}</div>
                    {s.journal_materi && <div className="text-xs text-emerald-800 mt-1 italic">Materi: {s.journal_materi}</div>}
                  </div>
                  {s.journal_filled ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Terisi</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200"><AlertCircle className="h-3 w-3 mr-1" />Belum</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="text-base font-semibold mb-4 flex items-center gap-2"><Users className="h-4 w-4" /> Daftar Siswa</h2>
          {!data.students?.length ? <div className="text-sm text-slate-500">Belum ada siswa terdaftar</div> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.students.map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5">
                  <div className="h-8 w-8 rounded-full bg-[#006837] text-white text-xs font-bold flex items-center justify-center">
                    {s.full_name?.substring(0,2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{s.full_name}</div>
                    <div className="text-xs text-slate-500 font-mono">{s.nisn || '-'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
