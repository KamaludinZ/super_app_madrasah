import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClipboardList, Filter, RefreshCw, BarChart3, Loader2, ChevronDown, Eye, Edit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

export default function AdminJurnalRekapPage() {
  const navigate = useNavigate();
  const [data, setData] = useState({ items: [], total: 0, summary: {} });
  const [statsByTeacher, setStatsByTeacher] = useState([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({
    class_id: 'all', teacher_id: 'all', subject_id: 'all',
    start_date: '', end_date: '',
  });
  const [detailDialog, setDetailDialog] = useState({ open: false, journal: null });

  const buildParams = () => {
    const p = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'all') p[k] = v;
    });
    return p;
  };

  const load = async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        api.get('/admin/jurnal', { params: buildParams() }),
        api.get('/admin/jurnal/stats-by-teacher'),
      ]);
      setData(r.data); setStatsByTeacher(s.data);
    } catch (e) { /* */ } finally { setLoading(false); }
  };

  useEffect(() => {
    (async () => {
      const [c, sub, u] = await Promise.all([
        api.get('/classes'), api.get('/subjects'), api.get('/users'),
      ]);
      setClasses(c.data); setSubjects(sub.data);
      setTeachers(u.data.filter((x) => x.roles?.some((rr) => ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'].includes(rr))));
      await load();
    })();
    // eslint-disable-next-line
  }, []);

  const reset = () => {
    setFilters({ class_id: 'all', teacher_id: 'all', subject_id: 'all', start_date: '', end_date: '' });
    setTimeout(() => load(), 50);
  };

  const exportCSV = () => {
    if (!data.items.length) return;
    const headers = ['Tanggal', 'JTM', 'Kelas', 'Mapel', 'Guru', 'Ruang', 'Materi', 'Catatan', 'Hadir', 'Sakit', 'Izin', 'Alpa'];
    const rows = data.items.map((j) => [
      new Date(j.started_at).toLocaleString('id-ID'), j.jtm_count || 1, j.class_name, j.subject_name, j.teacher_name, j.room_name,
      JSON.stringify(j.materi), JSON.stringify(j.catatan || ''), j.siswa_hadir, j.siswa_sakit, j.siswa_izin, j.siswa_tidak_hadir,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `rekap-jurnal-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2"><ClipboardList className="h-3 w-3 mr-1" /> Data Jurnal</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Rekap Jurnal Mengajar</h1>
        <p className="text-sm text-slate-600 mt-1">{data.total} entri jurnal {filters.class_id !== 'all' || filters.teacher_id !== 'all' || filters.subject_id !== 'all' || filters.start_date || filters.end_date ? '(terfilter)' : ''}</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-[#006837]" />
            <h2 className="text-sm font-semibold">Filter Data</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">Kelas</Label>
              <Select value={filters.class_id} onValueChange={(v) => setFilters({...filters, class_id: v})}>
                <SelectTrigger data-testid="rekap-filter-class"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Guru</Label>
              <Select value={filters.teacher_id} onValueChange={(v) => setFilters({...filters, teacher_id: v})}>
                <SelectTrigger data-testid="rekap-filter-teacher"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Guru</SelectItem>
                  {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Mata Pelajaran</Label>
              <Select value={filters.subject_id} onValueChange={(v) => setFilters({...filters, subject_id: v})}>
                <SelectTrigger data-testid="rekap-filter-subject"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Mapel</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Dari Tanggal</Label><Input type="date" value={filters.start_date} onChange={(e) => setFilters({...filters, start_date: e.target.value})} data-testid="rekap-filter-start" /></div>
            <div><Label className="text-xs">Sampai Tanggal</Label><Input type="date" value={filters.end_date} onChange={(e) => setFilters({...filters, end_date: e.target.value})} data-testid="rekap-filter-end" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={reset} data-testid="rekap-reset">Reset</Button>
            <Button onClick={load} className="bg-[#006837] hover:bg-[#0B7A3B] gap-1" size="sm" data-testid="rekap-apply"><RefreshCw className="h-3.5 w-3.5" /> Terapkan Filter</Button>
            <Button onClick={exportCSV} variant="outline" size="sm" disabled={!data.items.length} data-testid="rekap-export">Export CSV</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryCard label="Total Jurnal" value={data.total} color="slate" testid="rekap-stat-total" />
        <SummaryCard label="Total Hadir" value={data.summary?.total_hadir || 0} color="emerald" testid="rekap-stat-hadir" />
        <SummaryCard label="Total Sakit" value={data.summary?.total_sakit || 0} color="amber" testid="rekap-stat-sakit" />
        <SummaryCard label="Total Izin" value={data.summary?.total_izin || 0} color="blue" testid="rekap-stat-izin" />
        <SummaryCard label="Total Alpa" value={data.summary?.total_alpa || 0} color="rose" testid="rekap-stat-alpa" />
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items" data-testid="rekap-tab-items">Daftar Jurnal ({data.total})</TabsTrigger>
          <TabsTrigger value="by-teacher" data-testid="rekap-tab-teacher"><BarChart3 className="h-4 w-4 mr-1" /> Per Guru</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4">
          {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (
            <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table data-testid="admin-jurnal-rekap-table">
              <TableHeader><TableRow>
                <TableHead>Tanggal</TableHead><TableHead className="text-center">JTM</TableHead><TableHead>Kelas</TableHead><TableHead>Mapel</TableHead><TableHead>Guru</TableHead><TableHead>Ruang</TableHead><TableHead>Materi</TableHead><TableHead>Jenis Izin</TableHead><TableHead>Catatan</TableHead><TableHead className="text-center">Hadir</TableHead><TableHead className="text-center">S/I/A</TableHead><TableHead>Diisi oleh</TableHead><TableHead className="text-center">Aksi</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.items.length === 0 ? <TableRow><TableCell colSpan={13} className="text-center py-8 text-slate-500">Tidak ada data</TableCell></TableRow> :
                  data.items.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(j.started_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold">
                          {j.jtm_count || 1} JTM
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{j.class_name}</TableCell>
                      <TableCell><span className="text-xs font-mono bg-slate-100 rounded px-1">{j.subject_code}</span> {j.subject_name}</TableCell>
                      <TableCell className="text-sm">{j.teacher_name}</TableCell>
                      <TableCell className="font-mono text-xs">{j.room_name}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate" title={j.materi}>{j.materi}</TableCell>
                      <TableCell className="text-sm">
                        {j.jenis_izin ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs">
                            {j.jenis_izin}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate" title={j.catatan || '-'}>
                        {j.catatan || <span className="text-slate-400">-</span>}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-emerald-700">{j.siswa_hadir}</TableCell>
                      <TableCell className="text-center text-xs">
                        <span className="text-amber-600">{j.siswa_sakit}</span>/<span className="text-blue-600">{j.siswa_izin}</span>/<span className="text-rose-600">{j.siswa_tidak_hadir}</span>
                      </TableCell>
                      <TableCell>
                        {j.fill_mode === 'piket' ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1 text-xs" data-testid={`fill-badge-piket-${j.id}`}>
                            ✋ Piket{j.filled_by_name ? `: ${j.filled_by_name}` : ''}
                          </Badge>
                        ) : j.fill_mode === 'admin' ? (
                          <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">Admin</Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Pengajar</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDetailDialog({ open: true, journal: j })}
                            className="h-7 px-2"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/jurnal-history?edit=${j.id}`)}
                            className="h-7 px-2"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table></div></CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="by-teacher" className="mt-4">
          <Card><CardContent className="p-5">
            <h2 className="text-base font-semibold mb-3">Statistik Pengisian Jurnal per Guru (TP Aktif)</h2>
            {statsByTeacher.length === 0 ? <div className="text-sm text-slate-500">Belum ada data jurnal</div> : (
              <div className="space-y-2" data-testid="rekap-by-teacher">
                {(() => {
                  const max = Math.max(...statsByTeacher.map((s) => s.count || 0), 1);
                  return statsByTeacher.map((s, idx) => (
                    <div key={s.teacher_id || idx} className="flex items-center gap-3">
                      <div className="w-48 truncate text-sm font-semibold">{s.teacher_name}</div>
                      <div className="flex-1 bg-slate-100 rounded-full h-6 overflow-hidden">
                        <div className="bg-gradient-to-r from-[#006837] to-[#0B7A3B] h-full flex items-center justify-end pr-2 text-xs font-bold text-white"
                          style={{ width: `${(s.count / max) * 100}%`, minWidth: '36px' }}>
                          {s.count}
                        </div>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog({ open, journal: null })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Jurnal Mengajar</DialogTitle>
          </DialogHeader>
          {detailDialog.journal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Tanggal & Waktu</Label>
                  <div className="font-semibold">{new Date(detailDialog.journal.started_at).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}</div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">JTM</Label>
                  <div className="font-semibold">{detailDialog.journal.jtm_count || 1} Jam Tugas Mengajar</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Kelas</Label>
                  <div className="font-semibold">{detailDialog.journal.class_name}</div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Mata Pelajaran</Label>
                  <div className="font-semibold">
                    <Badge variant="outline" className="mr-1">{detailDialog.journal.subject_code}</Badge>
                    {detailDialog.journal.subject_name}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-500">Guru Pengajar</Label>
                  <div className="font-semibold">{detailDialog.journal.teacher_name}</div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Ruangan</Label>
                  <div className="font-semibold font-mono">{detailDialog.journal.room_name}</div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-500">Materi Pembelajaran</Label>
                <Card className="mt-1">
                  <CardContent className="p-3">
                    <div className="text-sm whitespace-pre-wrap">{detailDialog.journal.materi || '-'}</div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Label className="text-xs text-slate-500">Jenis Izin</Label>
                <div className="mt-1">
                  {detailDialog.journal.jenis_izin ? (
                    <Badge className="bg-blue-50 text-blue-700 border-blue-300">{detailDialog.journal.jenis_izin}</Badge>
                  ) : (
                    <span className="text-slate-400 text-sm">Tidak ada izin</span>
                  )}
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-500">Catatan</Label>
                <Card className="mt-1">
                  <CardContent className="p-3">
                    <div className="text-sm whitespace-pre-wrap">{detailDialog.journal.catatan || '-'}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs text-slate-500">Hadir</Label>
                  <div className="text-2xl font-bold text-emerald-700">{detailDialog.journal.siswa_hadir}</div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Sakit</Label>
                  <div className="text-2xl font-bold text-amber-600">{detailDialog.journal.siswa_sakit}</div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Izin</Label>
                  <div className="text-2xl font-bold text-blue-600">{detailDialog.journal.siswa_izin}</div>
                </div>
                <div>
                  <Label className="text-xs text-slate-500">Alpa</Label>
                  <div className="text-2xl font-bold text-rose-600">{detailDialog.journal.siswa_tidak_hadir}</div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-500">Diisi Oleh</Label>
                <div className="mt-1">
                  {detailDialog.journal.fill_mode === 'piket' ? (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                      ✋ Piket{detailDialog.journal.filled_by_name ? `: ${detailDialog.journal.filled_by_name}` : ''}
                    </Badge>
                  ) : detailDialog.journal.fill_mode === 'admin' ? (
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200">Admin</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Pengajar</Badge>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setDetailDialog({ open: false, journal: null })}>
                  Tutup
                </Button>
                <Button onClick={() => {
                  setDetailDialog({ open: false, journal: null });
                  navigate(`/jurnal-history?edit=${detailDialog.journal.id}`);
                }} className="bg-[#006837] hover:bg-[#0B7A3B]">
                  <Edit className="h-4 w-4 mr-1" /> Edit Jurnal
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, color, testid }) {
  const colors = {
    slate: 'bg-white border-slate-200 text-slate-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    rose: 'bg-rose-50 border-rose-200 text-rose-700',
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-extrabold tabular-nums" data-testid={testid}>{value}</div>
    </div>
  );
}
