import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserCheck, Search, FileText, Link as LinkIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { toast } from 'sonner';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthISO() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

const IZIN_LABELS = { sakit: 'Sakit', cuti: 'Cuti', dinas_luar: 'Dinas Luar', lainnya: 'Lainnya' };
const IZIN_COLORS = {
  sakit: 'bg-amber-100 text-amber-700', cuti: 'bg-blue-100 text-blue-700',
  dinas_luar: 'bg-purple-100 text-purple-700', lainnya: 'bg-slate-100 text-slate-700',
};

export default function AdminLaporanAbsensiPage() {
  const [activeTab, setActiveTab] = useState('rekap');

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <UserCheck className="h-3 w-3 mr-1" /> Laporan Absensi GTK
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Laporan Absensi GTK</h1>
          <p className="text-sm text-slate-600 mt-1">Rekap kehadiran otomatis dari keterisian jurnal, dan data perizinan</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-white border border-slate-200">
          <TabsTrigger value="rekap" className="gap-2"><UserCheck className="h-4 w-4" /> Rekap Absensi</TabsTrigger>
          <TabsTrigger value="perizinan" className="gap-2"><FileText className="h-4 w-4" /> Perizinan</TabsTrigger>
        </TabsList>

        <TabsContent value="rekap" className="mt-4">
          <RekapAbsensiTab />
        </TabsContent>
        <TabsContent value="perizinan" className="mt-4">
          <PerizinanAdminTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RekapAbsensiTab() {
  const [dateFrom, setDateFrom] = useState(firstOfMonthISO());
  const [dateTo, setDateTo] = useState(todayISO());
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { gtk_id, gtk_name } drill-down

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/gtk/absensi/rekap', { params: { date_from: dateFrom, date_to: dateTo } });
      setRows(data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat rekap absensi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [dateFrom, dateTo]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    return (r.gtk_name || '').toLowerCase().includes(search.toLowerCase());
  });

  if (selected) {
    return <RekapDetailView gtkId={selected.gtk_id} gtkName={selected.gtk_name} dateFrom={dateFrom} dateTo={dateTo} onBack={() => setSelected(null)} />;
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <Label className="text-xs">Cari GTK</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Nama..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Dari Tanggal</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Sampai Tanggal</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead className="text-center">Hadir</TableHead>
                <TableHead className="text-center">Sakit</TableHead>
                <TableHead className="text-center">Cuti</TableHead>
                <TableHead className="text-center">Dinas Luar</TableHead>
                <TableHead className="text-center">Lainnya</TableHead>
                <TableHead className="text-center">Alpha</TableHead>
                <TableHead className="text-center">%</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500">Memuat data...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-slate-500">Tidak ada data GTK untuk rentang tanggal ini.</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.gtk_id}>
                    <TableCell className="font-medium">{r.gtk_name}</TableCell>
                    <TableCell className="text-center">{r.hadir}</TableCell>
                    <TableCell className="text-center">{r.sakit}</TableCell>
                    <TableCell className="text-center">{r.cuti}</TableCell>
                    <TableCell className="text-center">{r.dinas_luar}</TableCell>
                    <TableCell className="text-center">{r.lainnya}</TableCell>
                    <TableCell className="text-center">
                      {r.alpha > 0 ? <span className="text-rose-600 font-semibold">{r.alpha}</span> : r.alpha}
                    </TableCell>
                    <TableCell className="text-center">
                      {r.persentase_hadir !== null ? `${r.persentase_hadir}%` : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelected({ gtk_id: r.gtk_id, gtk_name: r.gtk_name })}>Lihat Detail</Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
          Hadir dihitung otomatis dari keterisian jurnal (jurnal mengajar untuk guru, Jurnal Harian E-Kinerja untuk tenaga kependidikan) sesuai jadwal/hari kerja. Hari libur (mingguan & akademik) tidak dihitung. Tanpa jurnal dan tanpa data perizinan pada hari kerja &rarr; dianggap Alpha.
        </div>
      </CardContent>
    </Card>
  );
}

function RekapDetailView({ gtkId, gtkName, dateFrom, dateTo, onBack }) {
  const [days, setDays] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/gtk/absensi/rekap', { params: { date_from: dateFrom, date_to: dateTo, gtk_id: gtkId } })
      .then(({ data }) => setDays(data.days || []))
      .catch(() => toast.error('Gagal memuat detail absensi'))
      .finally(() => setLoading(false));
  }, [gtkId, dateFrom, dateTo]);

  const statusBadge = (status) => {
    if (status === 'hadir') return <Badge className="bg-emerald-100 text-emerald-700">Hadir</Badge>;
    if (status === 'alpha') return <Badge className="bg-rose-100 text-rose-700">Alpha</Badge>;
    if (status === 'libur') return <Badge variant="outline" className="text-slate-500">Libur</Badge>;
    return <Badge className={IZIN_COLORS[status] || 'bg-slate-100 text-slate-700'}>{IZIN_LABELS[status] || status}</Badge>;
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Detail Absensi: {gtkName}</h3>
          <Button variant="outline" size="sm" onClick={onBack}>&larr; Kembali ke Rekap</Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={2} className="text-center py-8 text-slate-500">Memuat data...</TableCell></TableRow>
              ) : days.length === 0 ? (
                <TableRow><TableCell colSpan={2} className="text-center py-8 text-slate-500">Tidak ada hari kerja pada rentang ini.</TableCell></TableRow>
              ) : (
                days.map((d) => (
                  <TableRow key={d.date}>
                    <TableCell className="text-sm font-medium">{d.date}</TableCell>
                    <TableCell>{statusBadge(d.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function PerizinanAdminTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterJenis, setFilterJenis] = useState('all');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/gtk/izin');
      setItems(data || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat data perizinan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((i) => {
    if (filterJenis !== 'all' && i.jenis !== filterJenis) return false;
    if (!search) return true;
    return (i.gtk_name || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <Label className="text-xs">Cari GTK</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Nama..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Jenis Izin</Label>
            <Select value={filterJenis} onValueChange={setFilterJenis}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                {Object.entries(IZIN_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>GTK</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead>Dokumen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Memuat data...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada data perizinan.</TableCell></TableRow>
              ) : (
                filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.gtk_name}</TableCell>
                    <TableCell><Badge className={IZIN_COLORS[i.jenis]}>{IZIN_LABELS[i.jenis] || i.jenis}</Badge></TableCell>
                    <TableCell className="text-xs">{i.tanggal_mulai}{i.tanggal_mulai !== i.tanggal_selesai && ` s/d ${i.tanggal_selesai}`}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{i.keterangan || '-'}</TableCell>
                    <TableCell>
                      {i.dokumen_url ? (
                        <a href={i.dokumen_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <LinkIcon className="h-3 w-3" /> Sudah Upload
                        </a>
                      ) : (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Belum Upload</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
