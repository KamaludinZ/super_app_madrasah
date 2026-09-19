import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, ShieldAlert, Trophy, ClipboardList, ArrowRight, TrendingDown, TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { KemenagBadge } from '@/components/branding/KemenagBadge';

function StatCard({ icon: Icon, label, value, color, subtitle }) {
  return (
    <div className={`rounded-xl border p-4 transition-shadow hover:shadow-sm ${color}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-80" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      {subtitle && <div className="text-[10px] mt-1 opacity-70">{subtitle}</div>}
    </div>
  );
}

const TATIB_COLORS = ['#dc2626', '#006837'];

export default function GuruTatibDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [recentRecords, setRecentRecords] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryRes, recordsRes] = await Promise.all([
        api.get('/tatib/stats/summary'),
        api.get('/tatib/penanganan'),
      ]);
      setSummary(summaryRes.data);
      const sorted = [...(recordsRes.data || [])].sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
      setRecentRecords(sorted.slice(0, 8));
    } catch (e) {
      // silent — dashboard degrades gracefully
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
        <p className="text-slate-500">Memuat dashboard tata tertib...</p>
      </div>
    );
  }

  const pieData = [
    { name: 'Pelanggaran', value: summary?.total_pelanggaran ?? 0 },
    { name: 'Prestasi', value: summary?.total_prestasi ?? 0 },
  ];
  const hasPieData = pieData.some((d) => d.value > 0);

  const kategoriEntries = Object.entries(summary?.by_kategori || {});
  const kategoriChartData = kategoriEntries.map(([kat, v]) => ({
    kategori: kat,
    Pelanggaran: v.pelanggaran ?? 0,
    Prestasi: v.prestasi ?? 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <KemenagBadge variant="default" className="mb-2" />
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Assalamu'alaikum, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-600 mt-1">Dashboard Tata Tertib Siswa</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={ClipboardList} label="Total Catatan" value={summary?.total_records ?? 0} color="bg-slate-50 border-slate-200 text-slate-700" />
        <StatCard icon={ShieldAlert} label="Pelanggaran" value={summary?.total_pelanggaran ?? 0} color="bg-rose-50 border-rose-200 text-rose-700" />
        <StatCard icon={Trophy} label="Prestasi" value={summary?.total_prestasi ?? 0} color="bg-amber-50 border-amber-200 text-amber-700" />
        <StatCard icon={ClipboardList} label="Kategori Tercatat" value={kategoriEntries.length} color="bg-blue-50 border-blue-200 text-blue-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pelanggaran vs Prestasi</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasPieData ? (
              <p className="text-sm text-slate-500 text-center py-8">Belum ada data tata tertib</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                      {pieData.map((entry, idx) => <Cell key={entry.name} fill={TATIB_COLORS[idx]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Poin per Kategori</CardTitle>
            <Link to="/admin/tatib/data" className="text-xs text-[#006837] font-semibold flex items-center gap-1 hover:underline">
              Lihat Data <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {kategoriChartData.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Belum ada data kategori</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kategoriChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="kategori" fontSize={10} interval={0} angle={-15} textAnchor="end" height={50} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Pelanggaran" fill="#dc2626" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Prestasi" fill="#006837" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-rose-600" /> Siswa dengan Poin Terendah
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary?.top_violators || []).length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada data</p>
            ) : (
              summary.top_violators.slice(0, 5).map((s) => (
                <div key={s.siswa_id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 truncate pr-2">{s.siswa_nama}<span className="text-xs text-slate-500 ml-1.5">{s.siswa_kelas}</span></span>
                  <Badge className="bg-rose-100 text-rose-700 border-rose-200">{s.total_poin} poin</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" /> Siswa dengan Poin Tertinggi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(summary?.top_achievers || []).length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada data</p>
            ) : (
              summary.top_achievers.slice(0, 5).map((s) => (
                <div key={s.siswa_id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 truncate pr-2">{s.siswa_nama}<span className="text-xs text-slate-500 ml-1.5">{s.siswa_kelas}</span></span>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{s.total_poin} poin</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Aktivitas Penanganan Terbaru</CardTitle>
          <Link to="/admin/tatib/data" className="text-xs text-[#006837] font-semibold flex items-center gap-1 hover:underline">
            Lihat Semua <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentRecords.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Belum ada aktivitas penanganan</p>
          ) : (
            recentRecords.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-sm bg-slate-50 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <span className="font-mono text-slate-500 mr-2">{r.tanggal}</span>
                  <span className="font-semibold text-slate-900">{r.siswa_nama}</span>
                  <span className="text-xs text-slate-500 ml-1.5">{r.siswa_kelas}</span>
                  <div className="text-xs text-slate-500 truncate">{r.tatib_nama}</div>
                </div>
                <Badge className={r.tatib_poin < 0 ? 'bg-rose-100 text-rose-700 border-rose-200 shrink-0' : 'bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0'}>
                  {r.tatib_poin > 0 ? '+' : ''}{r.tatib_poin} poin
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
