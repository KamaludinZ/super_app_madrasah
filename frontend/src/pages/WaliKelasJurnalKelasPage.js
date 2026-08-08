import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClipboardList, RefreshCw, BarChart3, Eye, FileSpreadsheet } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import * as XLSX from 'xlsx';

export default function WaliKelasJurnalKelasPage() {
  const { user } = useAuth();
  const myClassId = user?.homeroom_class_id;
  const myClassName = user?.homeroom_class_name;

  const [data, setData] = useState({ items: [], total: 0, summary: {} });
  const [statsByTeacher, setStatsByTeacher] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState({
    teacher_id: 'all', subject_id: 'all',
    start_date: '', end_date: '',
  });
  const [detailDialog, setDetailDialog] = useState({ open: false, journal: null });

  const buildParams = () => {
    const p = { class_id: myClassId }; // Always filter by wali kelas's class
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== 'all') p[k] = v;
    });
    return p;
  };

  const load = async () => {
    if (!myClassId) {
      toast.error('Anda belum ditugaskan sebagai wali kelas');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        api.get('/admin/jurnal', { params: buildParams() }),
        api.get('/admin/jurnal/stats-by-teacher', { params: { class_id: myClassId } }),
      ]);
      setData(r.data);
      setStatsByTeacher(s.data);
    } catch (e) {
      toast.error('Gagal memuat data jurnal');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      const [sub, u] = await Promise.all([
        api.get('/subjects'),
        api.get('/users'),
      ]);
      setSubjects(sub.data);
      setTeachers(u.data.filter((x) => x.roles?.some((rr) => ['guru', 'wali_kelas', 'guru_piket', 'guru_bk', 'guru_tata_tertib', 'guru_ekstrakurikuler'].includes(rr))));
      await load();
    })();
    // eslint-disable-next-line
  }, []);

  const reset = () => {
    setFilters({ teacher_id: 'all', subject_id: 'all', start_date: '', end_date: '' });
    setTimeout(() => load(), 50);
  };

  const exportExcel = () => {
    if (!data.items.length) return;

    const excelData = data.items.map((j) => ({
      'Tanggal': new Date(j.started_at).toLocaleString('id-ID'),
      'JTM': j.jtm_count || 1,
      'Mapel': j.subject_name || '-',
      'Guru': j.teacher_name || '-',
      'Ruang': j.room_name || '-',
      'Materi': j.materi || '-',
      'Catatan': j.catatan || '-',
      'Hadir': j.siswa_hadir || 0,
      'Sakit': j.siswa_sakit || 0,
      'Izin': j.siswa_izin || 0,
      'Alpa': j.siswa_tidak_hadir || 0,
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Jurnal ${myClassName}`);

    const colWidths = [
      { wch: 20 }, // Tanggal
      { wch: 5 },  // JTM
      { wch: 25 }, // Mapel
      { wch: 25 }, // Guru
      { wch: 15 }, // Ruang
      { wch: 40 }, // Materi
      { wch: 40 }, // Catatan
      { wch: 8 },  // Hadir
      { wch: 8 },  // Sakit
      { wch: 8 },  // Izin
      { wch: 8 },  // Alpa
    ];
    ws['!cols'] = colWidths;

    XLSX.writeFile(wb, `jurnal-kelas-${myClassName}-${Date.now()}.xlsx`);
    toast.success('File Excel berhasil diunduh');
  };

  const exportCSV = () => {
    if (!data.items.length) return;
    const headers = ['Tanggal', 'JTM', 'Mapel', 'Guru', 'Ruang', 'Materi', 'Catatan', 'Hadir', 'Sakit', 'Izin', 'Alpa'];
    const rows = data.items.map((j) => [
      new Date(j.started_at).toLocaleString('id-ID'), j.jtm_count || 1, j.subject_name, j.teacher_name, j.room_name,
      JSON.stringify(j.materi), JSON.stringify(j.catatan || ''), j.siswa_hadir, j.siswa_sakit, j.siswa_izin, j.siswa_tidak_hadir,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `jurnal-kelas-${myClassName}-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const openDetail = async (journal) => {
    try {
      const { data: fullJournal } = await api.get(`/jurnal/${journal.id}`);
      setDetailDialog({ open: true, journal: fullJournal });
    } catch (e) {
      toast.error('Gagal memuat detail jurnal');
    }
  };

  if (!myClassId) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <div className="text-slate-700 font-semibold">Anda belum ditugaskan sebagai wali kelas</div>
            <div className="text-sm text-slate-500 mt-1">
              Silakan hubungi admin untuk penugasan wali kelas
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <ClipboardList className="h-3 w-3 mr-1" /> Jurnal Kelas
          </Badge>
          <h1 className="text-3xl font-bold text-slate-900">Jurnal Kelas {myClassName}</h1>
          <p className="text-sm text-slate-600 mt-1">Jurnal mengajar dari semua guru di kelas Anda</p>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Guru</Label>
              <Select value={filters.teacher_id} onValueChange={(v) => setFilters({ ...filters, teacher_id: v })}>
                <SelectTrigger><SelectValue placeholder="Semua Guru" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Guru</SelectItem>
                  {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Mapel</Label>
              <Select value={filters.subject_id} onValueChange={(v) => setFilters({ ...filters, subject_id: v })}>
                <SelectTrigger><SelectValue placeholder="Semua Mapel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Mapel</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Dari Tanggal</Label><Input type="date" value={filters.start_date} onChange={(e) => setFilters({ ...filters, start_date: e.target.value })} /></div>
            <div><Label className="text-xs">Sampai Tanggal</Label><Input type="date" value={filters.end_date} onChange={(e) => setFilters({ ...filters, end_date: e.target.value })} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={reset}>Reset</Button>
            <Button onClick={load} className="bg-[#006837] hover:bg-[#0B7A3B] gap-1" size="sm"><RefreshCw className="h-3.5 w-3.5" /> Terapkan Filter</Button>
            <Button onClick={exportExcel} variant="outline" size="sm" disabled={!data.items.length} className="gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel</Button>
            <Button onClick={exportCSV} variant="outline" size="sm" disabled={!data.items.length}>CSV</Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <SummaryCard label="Total Jurnal" value={data.total} color="slate" />
        <SummaryCard label="Total Hadir" value={data.summary?.total_hadir || 0} color="emerald" />
        <SummaryCard label="Total Sakit" value={data.summary?.total_sakit || 0} color="amber" />
        <SummaryCard label="Total Izin" value={data.summary?.total_izin || 0} color="blue" />
        <SummaryCard label="Total Alpa" value={data.summary?.total_alpa || 0} color="rose" />
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Daftar Jurnal ({data.total})</TabsTrigger>
          <TabsTrigger value="by-teacher"><BarChart3 className="h-4 w-4 mr-1" /> Per Guru</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>JTM</TableHead>
                      <TableHead>Mapel</TableHead>
                      <TableHead>Guru</TableHead>
                      <TableHead>Ruang</TableHead>
                      <TableHead>Materi</TableHead>
                      <TableHead className="text-center">Hadir</TableHead>
                      <TableHead className="text-center">Sakit</TableHead>
                      <TableHead className="text-center">Izin</TableHead>
                      <TableHead className="text-center">Alpa</TableHead>
                      <TableHead className="text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={11} className="text-center py-8 text-slate-500">Memuat data...</TableCell></TableRow>
                    ) : data.items.length === 0 ? (
                      <TableRow><TableCell colSpan={11} className="text-center py-8 text-slate-500">Belum ada jurnal untuk kelas ini</TableCell></TableRow>
                    ) : (
                      data.items.map((j) => (
                        <TableRow key={j.id}>
                          <TableCell className="text-xs">{new Date(j.started_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell className="text-center">{j.jtm_count || 1}</TableCell>
                          <TableCell className="text-sm">{j.subject_name}</TableCell>
                          <TableCell className="text-sm">{j.teacher_name}</TableCell>
                          <TableCell className="text-sm">{j.room_name}</TableCell>
                          <TableCell className="max-w-xs truncate text-sm">{j.materi}</TableCell>
                          <TableCell className="text-center"><Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">{j.siswa_hadir || 0}</Badge></TableCell>
                          <TableCell className="text-center"><Badge className="bg-amber-50 text-amber-700 border-amber-200">{j.siswa_sakit || 0}</Badge></TableCell>
                          <TableCell className="text-center"><Badge className="bg-blue-50 text-blue-700 border-blue-200">{j.siswa_izin || 0}</Badge></TableCell>
                          <TableCell className="text-center"><Badge className="bg-rose-50 text-rose-700 border-rose-200">{j.siswa_tidak_hadir || 0}</Badge></TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="sm" onClick={() => openDetail(j)}><Eye className="h-3 w-3" /></Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by-teacher">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Guru</TableHead>
                      <TableHead className="text-center">Total Jurnal</TableHead>
                      <TableHead className="text-center">Total JTM</TableHead>
                      <TableHead className="text-center">Total Hadir</TableHead>
                      <TableHead className="text-center">Total Sakit</TableHead>
                      <TableHead className="text-center">Total Izin</TableHead>
                      <TableHead className="text-center">Total Alpa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statsByTeacher.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-slate-500">Belum ada data</TableCell></TableRow>
                    ) : (
                      statsByTeacher.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{s.teacher_name}</TableCell>
                          <TableCell className="text-center">{s.total_jurnal}</TableCell>
                          <TableCell className="text-center">{s.total_jtm}</TableCell>
                          <TableCell className="text-center"><Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">{s.total_hadir}</Badge></TableCell>
                          <TableCell className="text-center"><Badge className="bg-amber-50 text-amber-700 border-amber-200">{s.total_sakit}</Badge></TableCell>
                          <TableCell className="text-center"><Badge className="bg-blue-50 text-blue-700 border-blue-200">{s.total_izin}</Badge></TableCell>
                          <TableCell className="text-center"><Badge className="bg-rose-50 text-rose-700 border-rose-200">{s.total_alpa}</Badge></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog({ ...detailDialog, open })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Jurnal Mengajar</DialogTitle>
          </DialogHeader>
          {detailDialog.journal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-xs text-slate-500">Tanggal & Waktu</Label><div className="font-medium">{new Date(detailDialog.journal.started_at).toLocaleString('id-ID')}</div></div>
                <div><Label className="text-xs text-slate-500">JTM</Label><div className="font-medium">{detailDialog.journal.jtm_count || 1}</div></div>
                <div><Label className="text-xs text-slate-500">Kelas</Label><div className="font-medium">{detailDialog.journal.class_name}</div></div>
                <div><Label className="text-xs text-slate-500">Mapel</Label><div className="font-medium">{detailDialog.journal.subject_name}</div></div>
                <div><Label className="text-xs text-slate-500">Guru</Label><div className="font-medium">{detailDialog.journal.teacher_name}</div></div>
                <div><Label className="text-xs text-slate-500">Ruang</Label><div className="font-medium">{detailDialog.journal.room_name}</div></div>
              </div>
              <div><Label className="text-xs text-slate-500">Materi</Label><div className="font-medium whitespace-pre-wrap">{detailDialog.journal.materi}</div></div>
              {detailDialog.journal.catatan && <div><Label className="text-xs text-slate-500">Catatan</Label><div className="font-medium whitespace-pre-wrap">{detailDialog.journal.catatan}</div></div>}
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-3 bg-emerald-50 rounded-lg"><div className="text-2xl font-bold text-emerald-700">{detailDialog.journal.siswa_hadir || 0}</div><div className="text-xs text-emerald-600">Hadir</div></div>
                <div className="text-center p-3 bg-amber-50 rounded-lg"><div className="text-2xl font-bold text-amber-700">{detailDialog.journal.siswa_sakit || 0}</div><div className="text-xs text-amber-600">Sakit</div></div>
                <div className="text-center p-3 bg-blue-50 rounded-lg"><div className="text-2xl font-bold text-blue-700">{detailDialog.journal.siswa_izin || 0}</div><div className="text-xs text-blue-600">Izin</div></div>
                <div className="text-center p-3 bg-rose-50 rounded-lg"><div className="text-2xl font-bold text-rose-700">{detailDialog.journal.siswa_tidak_hadir || 0}</div><div className="text-xs text-rose-600">Alpa</div></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ label, value, color }) {
  const colorClasses = {
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return (
    <Card className={`border ${colorClasses[color]}`}>
      <CardContent className="p-3">
        <div className="text-xs opacity-75 mb-1">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
