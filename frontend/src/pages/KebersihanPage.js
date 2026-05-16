import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Calendar, Save, Star, Loader2, Clock, Filter, X, Eye } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
  const isGuru = activeRole === 'guru';
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [students, setStudents] = useState([]);
  // Always use today's date for guru
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [form, setForm] = useState({ rating: 3, condition: 'bersih', notes: '', piket_students: [] });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingClasses, setLoadingClasses] = useState(false);

  // For guru: load their own cleanliness history across all classes
  const [guruHistory, setGuruHistory] = useState([]);
  const [loadingGuruHistory, setLoadingGuruHistory] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterClassHistory, setFilterClassHistory] = useState('all');
  const [filterCondition, setFilterCondition] = useState('all');
  const [detailDialog, setDetailDialog] = useState({ open: false, data: null });

  // Load classes (for guru: all classes they teach from schedule, not limited to today)
  useEffect(() => {
    if (isGuru) {
      setLoadingClasses(true);
      (async () => {
        try {
          const res = await api.get('/cleanliness/guru/classes/all');
          setClasses(res.data);
          // Auto-select first class if only one class available
          if (res.data.length === 1) {
            setSelectedClass(res.data[0].id);
          }
          // If currently selected class is not in the new list, reset selection
          if (selectedClass && !res.data.find(c => c.id === selectedClass)) {
            setSelectedClass('');
          }
        } catch (e) {
          toast.error('Gagal memuat kelas yang diajar');
          setClasses([]);
        } finally {
          setLoadingClasses(false);
        }
      })();
    } else {
      // For wali_kelas, load all classes (they manage their own class)
      setLoadingClasses(true);
      (async () => {
        try {
          // Get active academic year first
          const ayRes = await api.get('/academic-years/active');
          const activeAY = ayRes.data;

          // Load classes for active academic year
          const res = await api.get('/classes', {
            params: activeAY ? { academic_year_id: activeAY.id } : {}
          });
          setClasses(res.data);
          // Auto-select homeroom class if wali_kelas
          if (user?.homeroom_class_id) {
            setSelectedClass(user.homeroom_class_id);
          }
        } catch (e) {
          toast.error('Gagal memuat kelas');
          setClasses([]);
        } finally {
          setLoadingClasses(false);
        }
      })();
    }
  }, [isGuru, user]); // Only run once on mount

  // Load guru's own cleanliness history (for guru only)
  useEffect(() => {
    if (isGuru) {
      setLoadingGuruHistory(true);
      api.get('/cleanliness/guru/history')
        .then(({ data }) => setGuruHistory(data))
        .catch(() => toast.error('Gagal memuat riwayat'))
        .finally(() => setLoadingGuruHistory(false));
    }
  }, [isGuru]);

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
      const h = await api.get(`/cleanliness/class/${selectedClass}`);
      setHistory(h.data);

      // Reload guru history if guru
      if (isGuru) {
        const gh = await api.get('/cleanliness/guru/history');
        setGuruHistory(gh.data);
      }
    } catch (e) { toast.error('Gagal menyimpan'); }
  };

  const togglePiket = (id) => {
    const ex = form.piket_students.includes(id);
    setForm({ ...form, piket_students: ex ? form.piket_students.filter((x) => x !== id) : [...form.piket_students, id] });
  };

  // Filter guru history
  const filteredGuruHistory = useMemo(() => {
    let filtered = [...guruHistory];

    if (filterDateStart) {
      filtered = filtered.filter(h => new Date(h.date) >= new Date(filterDateStart));
    }
    if (filterDateEnd) {
      const endDate = new Date(filterDateEnd);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(h => new Date(h.date) <= endDate);
    }
    if (filterClassHistory !== 'all') {
      filtered = filtered.filter(h => h.class_id === filterClassHistory);
    }
    if (filterCondition !== 'all') {
      filtered = filtered.filter(h => h.condition === filterCondition);
    }

    return filtered;
  }, [guruHistory, filterDateStart, filterDateEnd, filterClassHistory, filterCondition]);

  const clearFilters = () => {
    setFilterDateStart('');
    setFilterDateEnd('');
    setFilterClassHistory('all');
    setFilterCondition('all');
  };

  const hasActiveFilters = filterDateStart || filterDateEnd || filterClassHistory !== 'all' || filterCondition !== 'all';

  // Get unique class names from guru history for filter
  const uniqueClassesInHistory = useMemo(() => {
    const classMap = new Map();
    guruHistory.forEach(h => {
      if (h.class_id && h.class_name) {
        classMap.set(h.class_id, h.class_name);
      }
    });
    return Array.from(classMap.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [guruHistory]);

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><Sparkles className="h-3 w-3 mr-1" /> Kebersihan Kelas</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Catatan Kebersihan Kelas</h1>
        <p className="text-sm text-slate-600 mt-1">
          {isGuru
            ? 'Isi kebersihan untuk semua kelas yang Anda ajar (dapat diisi kapan saja pada hari yang sama)'
            : 'Kondisi kebersihan + daftar piket harian'}
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          {isGuru && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <strong>Info:</strong> Anda dapat mengisi kebersihan untuk semua kelas yang Anda ajar, kapan saja pada hari ini (tidak terbatas jam mengajar).
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Kelas</Label>
              {loadingClasses ? (
                <div className="h-10 border border-slate-200 rounded-md flex items-center justify-center text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Memuat kelas...
                </div>
              ) : classes.length === 0 ? (
                <div className="h-10 border border-amber-200 bg-amber-50 rounded-md flex items-center px-3 text-sm text-amber-700">
                  Tidak ada kelas di jadwal mengajar Anda
                </div>
              ) : (
                <Select value={selectedClass} onValueChange={setSelectedClass} disabled={classes.length === 0}>
                  <SelectTrigger data-testid="kebersihan-class-select">
                    <SelectValue placeholder="Pilih kelas..." />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={date}
                readOnly={isGuru}
                onChange={(e) => !isGuru && setDate(e.target.value)}
                className={isGuru ? 'bg-slate-100 cursor-not-allowed' : ''}
                data-testid="kebersihan-date"
              />
              {isGuru && (
                <p className="text-xs text-slate-500 mt-1">Tanggal otomatis mengikuti hari ini</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedClass && classes.length > 0 && (
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

          {history.length > 0 && !isGuru && (
            <Card>
              <CardContent className="p-5">
                <h2 className="text-base font-semibold mb-3">Riwayat Kebersihan Kelas Ini</h2>
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

      {/* Riwayat Pengisian Guru (for guru only) */}
      {isGuru && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold">Riwayat Pengisian Saya</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Menampilkan {filteredGuruHistory.length} dari {guruHistory.length} catatan
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className={hasActiveFilters ? 'border-[#006837] text-[#006837]' : ''}
              >
                <Filter className="h-3.5 w-3.5 mr-2" />
                Filter {hasActiveFilters && `(${[filterDateStart, filterDateEnd, filterClassHistory !== 'all', filterCondition !== 'all'].filter(Boolean).length})`}
              </Button>
            </div>

            {showFilters && (
              <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">Filter Data</span>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs">
                      <X className="h-3 w-3 mr-1" />
                      Hapus Filter
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <Label className="text-xs">Tanggal Mulai</Label>
                    <Input
                      type="date"
                      value={filterDateStart}
                      onChange={(e) => setFilterDateStart(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Tanggal Akhir</Label>
                    <Input
                      type="date"
                      value={filterDateEnd}
                      onChange={(e) => setFilterDateEnd(e.target.value)}
                      className="text-xs h-8"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Kelas</Label>
                    <Select value={filterClassHistory} onValueChange={setFilterClassHistory}>
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Semua Kelas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kelas</SelectItem>
                        {uniqueClassesInHistory.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Kondisi</Label>
                    <Select value={filterCondition} onValueChange={setFilterCondition}>
                      <SelectTrigger className="text-xs h-8">
                        <SelectValue placeholder="Semua Kondisi" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua Kondisi</SelectItem>
                        {CONDITION_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {loadingGuruHistory ? (
              <div className="py-8 text-center">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
              </div>
            ) : filteredGuruHistory.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                {hasActiveFilters ? 'Tidak ada data sesuai filter' : 'Belum ada riwayat pengisian'}
                {hasActiveFilters && (
                  <Button variant="link" size="sm" onClick={clearFilters} className="block mx-auto mt-2">
                    Hapus filter
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredGuruHistory.map((h) => {
                  const opt = CONDITION_OPTIONS.find((o) => o.value === h.condition) || CONDITION_OPTIONS[0];
                  return (
                    <div key={h.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm hover:bg-slate-50">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                        <div>
                          <div className="font-mono text-xs text-slate-900">{h.date}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {h.recorded_at ? new Date(h.recorded_at).toLocaleString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '-'}
                          </div>
                        </div>
                        <Badge variant="outline" className="bg-slate-50 shrink-0">{h.class_name}</Badge>
                        <Badge className={`${opt.color} shrink-0`}>{opt.label}</Badge>
                        <div className="flex shrink-0">{[1,2,3,4,5].map((n) => <Star key={n} className={`h-3 w-3 ${h.rating >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />)}</div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-slate-500">{h.piket_students?.length || 0} piket</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
