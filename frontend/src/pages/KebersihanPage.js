import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Calendar, Save, Star, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';

const CONDITION_OPTIONS = [
  { value: 'bersih', label: 'Bersih', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'cukup', label: 'Cukup', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'kotor', label: 'Kotor', color: 'bg-rose-100 text-rose-700 border-rose-300' },
];

export default function KebersihanPage() {
  const { activeRole, user } = useAuth();
  const isAdmin = activeRole === 'admin' || user?.roles?.includes('admin');
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({ rating: 3, condition: 'bersih', notes: '', piket_students: [] });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (isAdmin) { const c = await api.get('/classes'); setClasses(c.data); }
      else {
        const wk = await api.get('/wali-kelas/my-class');
        if (wk.data?.class) { setClasses([wk.data.class]); setSelectedClass(wk.data.class.id); }
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
        const h = await api.get(`/cleanliness/class/${selectedClass}`);
        setHistory(h.data);
        // load existing for date
        const existing = h.data.find((x) => x.date === date);
        if (existing) {
          setForm({
            rating: existing.rating || 3, condition: existing.condition || 'bersih',
            notes: existing.notes || '', piket_students: existing.piket_students || [],
          });
        } else setForm({ rating: 3, condition: 'bersih', notes: '', piket_students: [] });
      } catch (e) { /* */ }
      finally { setLoading(false); }
    })();
  }, [selectedClass, date]);

  const handleSubmit = async () => {
    if (!selectedClass) { toast.error('Pilih kelas dulu'); return; }
    try {
      await api.post('/cleanliness/class', { class_id: selectedClass, date, ...form });
      toast.success('Data kebersihan tersimpan');
      const h = await api.get(`/cleanliness/class/${selectedClass}`); setHistory(h.data);
    } catch (e) { toast.error('Gagal menyimpan'); }
  };

  const togglePiket = (id) => {
    const ex = form.piket_students.includes(id);
    setForm({ ...form, piket_students: ex ? form.piket_students.filter((x) => x !== id) : [...form.piket_students, id] });
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><Sparkles className="h-3 w-3 mr-1" /> Kebersihan Kelas</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Catatan Kebersihan Kelas</h1>
        <p className="text-sm text-slate-600 mt-1">Kondisi kebersihan + daftar piket harian</p>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Kelas</Label>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger data-testid="kebersihan-class-select"><SelectValue placeholder="Pilih kelas..." /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Tanggal</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="kebersihan-date" /></div>
        </CardContent>
      </Card>

      {selectedClass && (
        <>
          <Card>
            <CardContent className="p-5 space-y-4">
              <div>
                <Label className="text-sm font-semibold">Rating Kebersihan (1-5)</Label>
                <div className="flex gap-2 mt-2">
                  {[1,2,3,4,5].map((n) => (
                    <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })} className="p-1" data-testid={`kebersihan-rating-${n}`}>
                      <Star className={`h-8 w-8 ${form.rating >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm font-semibold">Kondisi</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {CONDITION_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setForm({ ...form, condition: opt.value })}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold border ${form.condition === opt.value ? opt.color + ' ring-2 ring-offset-1 ring-[#006837]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                      data-testid={`kebersihan-condition-${opt.value}`}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Catatan</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Catatan tambahan..." rows={2} data-testid="kebersihan-notes" />
              </div>
              <div>
                <Label>Daftar Piket Hari Ini ({form.piket_students.length} siswa)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2 max-h-60 overflow-y-auto p-2 border border-slate-200 rounded-lg" data-testid="kebersihan-piket-list">
                  {students.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm p-1.5 rounded hover:bg-slate-50">
                      <Checkbox checked={form.piket_students.includes(s.id)} onCheckedChange={() => togglePiket(s.id)} data-testid={`kebersihan-piket-${s.username}`} />
                      <span className="truncate">{s.full_name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <Button onClick={handleSubmit} className="w-full bg-[#006837] hover:bg-[#0B7A3B] gap-2" data-testid="kebersihan-submit"><Save className="h-4 w-4" /> Simpan</Button>
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h2 className="text-base font-semibold mb-3">Riwayat Kebersihan</h2>
                <div className="space-y-2">
                  {history.slice(0, 14).map((h) => {
                    const opt = CONDITION_OPTIONS.find((o) => o.value === h.condition) || CONDITION_OPTIONS[0];
                    return (
                      <div key={h.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <div className="font-mono">{h.date}</div>
                          <Badge className={opt.color}>{opt.label}</Badge>
                          <div className="flex">{[1,2,3,4,5].map((n) => <Star key={n} className={`h-3 w-3 ${h.rating >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}</div>
                        </div>
                        <span className="text-xs text-slate-500">{h.piket_students?.length || 0} piket</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
