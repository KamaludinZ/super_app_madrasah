import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCheck, Calendar, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const STATUS_OPTIONS = [
  { value: 'hadir', label: 'Hadir', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'sakit', label: 'Sakit', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'izin', label: 'Izin', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { value: 'alpa', label: 'Alpa', color: 'bg-rose-100 text-rose-700 border-rose-300' },
];

export default function KehadiranPage() {
  const { activeRole, user } = useAuth();
  const isAdmin = activeRole === 'admin' || user?.roles?.includes('admin');
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({});
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (isAdmin) {
        const c = await api.get('/classes'); setClasses(c.data);
      } else {
        // Wali kelas - get own class
        const wk = await api.get('/wali-kelas/my-class');
        if (wk.data?.class) {
          setClasses([wk.data.class]);
          setSelectedClass(wk.data.class.id);
        }
      }
    })();
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedClass) return;
    (async () => {
      setLoading(true);
      try {
        const s = await api.get('/students', { params: { class_id: selectedClass } });
        setStudents(s.data);
        // Load existing attendance for this date
        const att = await api.get(`/attendance/class/${selectedClass}`, { params: { date } });
        const existing = att.data?.[0]?.records || [];
        const initialRecords = {};
        s.data.forEach((stu) => {
          const found = existing.find((r) => r.student_id === stu.id);
          initialRecords[stu.id] = found?.status || 'hadir';
        });
        setRecords(initialRecords);
        // Load history
        const hist = await api.get(`/attendance/class/${selectedClass}`);
        setHistory(hist.data);
      } catch (e) { /* */ }
      finally { setLoading(false); }
    })();
  }, [selectedClass, date]);

  const setAllStatus = (status) => {
    const newRec = {};
    students.forEach((s) => { newRec[s.id] = status; });
    setRecords(newRec);
  };

  const handleSubmit = async () => {
    if (!selectedClass) { toast.error('Pilih kelas dulu'); return; }
    const recArr = students.map((s) => ({ student_id: s.id, status: records[s.id] || 'hadir' }));
    try {
      await api.post('/attendance/class', { class_id: selectedClass, date, records: recArr });
      toast.success('Kehadiran tersimpan');
      const hist = await api.get(`/attendance/class/${selectedClass}`);
      setHistory(hist.data);
    } catch (e) { toast.error(e?.response?.data?.detail || 'Gagal menyimpan'); }
  };

  const summary = students.reduce((acc, s) => {
    const st = records[s.id] || 'hadir';
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, { hadir: 0, sakit: 0, izin: 0, alpa: 0 });

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><UserCheck className="h-3 w-3 mr-1" /> Kehadiran Siswa</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Presensi Harian Kelas</h1>
        <p className="text-sm text-slate-600 mt-1">Catat kehadiran siswa per kelas per tanggal</p>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>Kelas</Label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger data-testid="kehadiran-class-select"><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Tanggal</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="kehadiran-date" /></div>
          <div className="flex items-end gap-2">
            <Button onClick={() => setAllStatus('hadir')} variant="outline" size="sm" className="flex-1" data-testid="kehadiran-set-all-hadir">Semua Hadir</Button>
            <Button onClick={handleSubmit} className="flex-1 bg-[#006837] hover:bg-[#0B7A3B] gap-1" data-testid="kehadiran-submit"><Save className="h-3.5 w-3.5" /> Simpan</Button>
          </div>
        </CardContent>
      </Card>

      {selectedClass && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {STATUS_OPTIONS.map((opt) => (
              <div key={opt.value} className={`rounded-xl border p-3 ${opt.color}`}>
                <div className="text-xs font-semibold uppercase">{opt.label}</div>
                <div className="text-2xl font-extrabold tabular-nums" data-testid={`kehadiran-count-${opt.value}`}>{summary[opt.value] || 0}</div>
              </div>
            ))}
          </div>
          <Card>
            <CardContent className="p-5">
              <h2 className="text-base font-semibold mb-4">Daftar Siswa ({students.length})</h2>
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                <div className="space-y-2" data-testid="kehadiran-list">
                  {students.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                      <div className="h-9 w-9 rounded-full bg-[#006837] text-white text-xs font-bold flex items-center justify-center shrink-0">{s.full_name?.substring(0,2).toUpperCase()}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{s.full_name}</div>
                        <div className="text-xs text-slate-500 font-mono">{s.nisn || '-'}</div>
                      </div>
                      <div className="flex gap-1">
                        {STATUS_OPTIONS.map((opt) => (
                          <button key={opt.value} type="button" onClick={() => setRecords({ ...records, [s.id]: opt.value })}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              records[s.id] === opt.value ? opt.color + ' ring-2 ring-offset-1 ring-[#006837]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                            data-testid={`kehadiran-${s.username}-${opt.value}`}
                          >{opt.label.charAt(0)}</button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h2 className="text-base font-semibold mb-3">Riwayat Presensi</h2>
                <div className="space-y-2">
                  {history.slice(0, 10).map((h) => (
                    <div key={h.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <div className="font-mono">{h.date}</div>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">H: {h.summary?.hadir || 0}</span>
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700">S: {h.summary?.sakit || 0}</span>
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">I: {h.summary?.izin || 0}</span>
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700">A: {h.summary?.alpa || 0}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
