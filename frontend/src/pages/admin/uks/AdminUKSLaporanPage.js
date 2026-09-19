import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileBarChart, Stethoscope, Pill, AlertTriangle, Loader2, FileSpreadsheet, FileDown, Users, GraduationCap } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownList({ title, data }) {
  const entries = Object.entries(data || {});
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada data</p>
        ) : (
          entries.map(([key, count]) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">{key}</span>
              <Badge variant="outline">{count}</Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

const PERIOD_OPTIONS = [
  { value: 'bulan', label: 'Per Bulan' },
  { value: 'semester', label: 'Per Semester' },
  { value: 'tahun', label: 'Per Tahun' },
];

function RekapKunjunganCard() {
  const [periodType, setPeriodType] = useState('bulan');
  const [bulan, setBulan] = useState(new Date().toISOString().slice(0, 7));
  const [semesters, setSemesters] = useState([]);
  const [semesterId, setSemesterId] = useState('');
  const [tahun, setTahun] = useState(String(new Date().getFullYear()));
  const [rekap, setRekap] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(null); // 'excel' | 'pdf' | null

  useEffect(() => {
    api.get('/semesters').then(({ data }) => {
      setSemesters(data || []);
      if (data?.length && !semesterId) setSemesterId(data[0].id);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildParams = () => {
    if (periodType === 'bulan') return { period: 'bulan', bulan };
    if (periodType === 'semester') return { period: 'semester', semester_id: semesterId };
    return { period: 'tahun', tahun };
  };

  const canLoad = periodType === 'bulan' ? !!bulan : periodType === 'semester' ? !!semesterId : !!tahun;

  const loadRekap = async () => {
    if (!canLoad) return;
    setLoading(true);
    try {
      const { data } = await api.get('/uks/laporan/rekap-kunjungan', { params: buildParams() });
      setRekap(data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Gagal memuat rekap kunjungan');
      setRekap(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRekap(); }, [periodType, bulan, semesterId, tahun]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExport = async (format) => {
    if (!canLoad) return;
    setExporting(format);
    try {
      const response = await api.get(`/uks/laporan/rekap-kunjungan/export-${format}`, {
        params: buildParams(),
        responseType: 'blob',
      });
      const ext = format === 'excel' ? 'xlsx' : 'pdf';
      const filename = `Rekap_Kunjungan_UKS_${(rekap?.label || periodType).replace(/\s+/g, '_')}.${ext}`;
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Export berhasil');
    } catch (e) {
      toast.error('Gagal export rekap');
    } finally {
      setExporting(null);
    }
  };

  const rowLabelHeader = rekap?.group_by === 'hari' ? 'Tanggal' : 'Bulan';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Rekap Kunjungan (Siswa vs GTK)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Periode</label>
            <Select value={periodType} onValueChange={setPeriodType}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {periodType === 'bulan' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Bulan</label>
              <input type="month" value={bulan} onChange={(e) => setBulan(e.target.value)}
                className="h-10 rounded-md border border-slate-200 px-3 text-sm" />
            </div>
          )}

          {periodType === 'semester' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Semester</label>
              <Select value={semesterId} onValueChange={setSemesterId}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Pilih Semester" /></SelectTrigger>
                <SelectContent>
                  {semesters.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} {s.academic_year_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {periodType === 'tahun' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Tahun</label>
              <input type="number" value={tahun} onChange={(e) => setTahun(e.target.value)}
                className="h-10 rounded-md border border-slate-200 px-3 text-sm w-28" placeholder="2026" />
            </div>
          )}

          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => handleExport('excel')} disabled={!rekap || exporting} className="gap-1.5">
              {exporting === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={!rekap || exporting} className="gap-1.5">
              {exporting === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              PDF
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>
        ) : rekap ? (
          <>
            <div className="text-sm font-semibold text-slate-700">{rekap.label}</div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-600" />
                <div><div className="text-lg font-bold text-blue-700">{rekap.total_siswa}</div><div className="text-xs text-blue-600">Kunjungan Siswa</div></div>
              </div>
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-600" />
                <div><div className="text-lg font-bold text-violet-700">{rekap.total_gtk}</div><div className="text-xs text-violet-600">Kunjungan GTK</div></div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex items-center gap-2">
                <Stethoscope className="h-4 w-4 text-slate-600" />
                <div><div className="text-lg font-bold text-slate-700">{rekap.total}</div><div className="text-xs text-slate-600">Total Kunjungan</div></div>
              </div>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{rowLabelHeader}</TableHead>
                    <TableHead className="text-center">Siswa</TableHead>
                    <TableHead className="text-center">GTK</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rekap.rows.map((row) => (
                    <TableRow key={row.label}>
                      <TableCell className="font-mono">{row.label}</TableCell>
                      <TableCell className="text-center">{row.siswa}</TableCell>
                      <TableCell className="text-center">{row.gtk}</TableCell>
                      <TableCell className="text-center font-semibold">{row.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500 text-center py-6">Pilih periode untuk menampilkan rekap</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminUKSLaporanPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => { loadSummary(); }, []);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get('/uks/laporan/summary');
      setSummary(res.data);
    } catch (e) {
      toast.error('Gagal memuat laporan UKS');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-uks-laporan-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <FileBarChart className="h-3 w-3 mr-1" /> Menu UKS
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Laporan UKS</h1>
        <p className="text-sm text-slate-600 mt-1">Rekapitulasi kunjungan, penggunaan obat-obatan, dan penanganan</p>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
          <p className="text-slate-500">Memuat laporan...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Stethoscope} label="Total Kunjungan" value={summary?.total_kunjungan ?? 0} accent="bg-emerald-100 text-emerald-700" />
            <StatCard icon={Pill} label="Transaksi Obat Keluar" value={summary?.total_obat_keluar_transaksi ?? 0} accent="bg-blue-100 text-blue-700" />
            <StatCard icon={Pill} label="Jenis Obat Terdaftar" value={summary?.total_jenis_obat ?? 0} accent="bg-violet-100 text-violet-700" />
            <StatCard icon={AlertTriangle} label="Obat Stok Menipis" value={(summary?.obat_stok_menipis || []).length} accent="bg-amber-100 text-amber-700" />
          </div>

          <RekapKunjunganCard />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BreakdownList title="Kunjungan per Jenis Penanganan" data={summary?.kunjungan_by_jenis_penanganan} />
            <BreakdownList title="Kunjungan per Kondisi Pulang" data={summary?.kunjungan_by_kondisi_pulang} />
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Obat Paling Sering Digunakan</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(summary?.most_used_obat || []).length === 0 ? (
                  <p className="text-sm text-slate-500">Belum ada data</p>
                ) : (
                  summary.most_used_obat.map((item) => (
                    <div key={item.nama_obat} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700 truncate pr-2">{item.nama_obat}</span>
                      <Badge variant="outline">{item.jumlah}x</Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {(summary?.obat_stok_menipis || []).length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Obat dengan Stok Menipis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary.obat_stok_menipis.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{o.nama_obat}</span>
                    <Badge className="bg-rose-100 text-rose-700 border-rose-200">{o.stok_tersisa ?? 0} {o.satuan} (min: {o.stok_minimum})</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
