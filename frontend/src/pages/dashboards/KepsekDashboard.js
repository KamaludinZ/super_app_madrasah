import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, UserCheck, ClipboardList, ShieldAlert, Trophy, HeartHandshake,
  Stethoscope, BookOpen, AlertOctagon, ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
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

export default function KepsekDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kehadiran, setKehadiran] = useState(null);
  const [jurnalStats, setJurnalStats] = useState([]);
  const [tatibSummary, setTatibSummary] = useState(null);
  const [bkSummary, setBkSummary] = useState(null);
  const [uksRekap, setUksRekap] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const bulan = new Date().toISOString().slice(0, 7);
      const [kehadiranRes, jurnalRes, tatibRes, bkRes, uksRes] = await Promise.all([
        api.get('/bk/laporan/kehadiran-summary'),
        api.get('/admin/jurnal/stats-by-teacher'),
        api.get('/tatib/stats/summary'),
        api.get('/bk/laporan/summary'),
        api.get('/uks/laporan/rekap-kunjungan', { params: { period: 'bulan', bulan } }),
      ]);
      setKehadiran(kehadiranRes.data);
      setJurnalStats(jurnalRes.data || []);
      setTatibSummary(tatibRes.data);
      setBkSummary(bkRes.data);
      setUksRekap(uksRes.data);
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
        <p className="text-slate-500">Memuat dashboard...</p>
      </div>
    );
  }

  const teachersWithRate = jurnalStats.filter((t) => t.fill_rate_pct != null);
  const avgFillRate = teachersWithRate.length
    ? Math.round(teachersWithRate.reduce((sum, t) => sum + t.fill_rate_pct, 0) / teachersWithRate.length)
    : null;

  const jurnalChartData = jurnalStats
    .filter((t) => t.fill_rate_pct != null)
    .sort((a, b) => a.fill_rate_pct - b.fill_rate_pct)
    .slice(0, 10)
    .map((t) => ({ nama: t.teacher_name?.split(' ').slice(0, 2).join(' '), 'Pengisian (%)': t.fill_rate_pct }));

  return (
    <div className="space-y-6">
      <div>
        <KemenagBadge variant="default" className="mb-2" />
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Assalamu'alaikum, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-600 mt-1">Dashboard Kepala Madrasah — Ringkasan Operasional</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={UserCheck} label="Kehadiran Siswa" value={`${kehadiran?.percentage_hadir ?? 0}%`} color="bg-emerald-50 border-emerald-200 text-emerald-700" subtitle="Semester aktif" />
        <StatCard icon={ClipboardList} label="Rata-rata Pengisian Jurnal" value={avgFillRate != null ? `${avgFillRate}%` : '-'} color="bg-blue-50 border-blue-200 text-blue-700" subtitle="Estimasi relatif per guru" />
        <StatCard icon={ShieldAlert} label="Pelanggaran Tatib" value={tatibSummary?.total_pelanggaran ?? 0} color="bg-rose-50 border-rose-200 text-rose-700" />
        <StatCard icon={Trophy} label="Prestasi Tatib" value={tatibSummary?.total_prestasi ?? 0} color="bg-amber-50 border-amber-200 text-amber-700" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon={HeartHandshake} label="Kunjungan Konseling" value={bkSummary?.total_kunjungan ?? 0} color="bg-violet-50 border-violet-200 text-violet-700" />
        <StatCard icon={BookOpen} label="Home Visit" value={bkSummary?.total_home_visit ?? 0} color="bg-cyan-50 border-cyan-200 text-cyan-700" />
        <StatCard icon={Stethoscope} label="Kunjungan UKS Bulan Ini" value={uksRekap?.total ?? 0} color="bg-teal-50 border-teal-200 text-teal-700" subtitle={uksRekap?.label} />
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-[#006837]" /> Persentase Pengisian Jurnal per Guru (10 Terendah)
          </CardTitle>
          <Link to="/admin/jurnal" className="text-xs text-[#006837] font-semibold flex items-center gap-1 hover:underline">
            Lihat Data Jurnal <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-slate-500 mb-3">Rasio jurnal terisi terhadap jumlah jadwal mengajar mingguan — indikator relatif, bukan persentase presisi (belum memperhitungkan hari libur).</p>
          {jurnalChartData.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Belum ada data jurnal</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={jurnalChartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} fontSize={11} unit="%" />
                  <YAxis type="category" dataKey="nama" fontSize={11} width={110} />
                  <Tooltip />
                  <Bar dataKey="Pengisian (%)" fill="#006837" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rekap Kehadiran Siswa</CardTitle>
          </CardHeader>
          <CardContent>
            {(kehadiran?.total_records ?? 0) === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">Belum ada data kehadiran semester ini</p>
            ) : (
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 py-2"><div className="font-bold text-emerald-700">{kehadiran.hadir}</div><div className="text-xs text-emerald-600">Hadir</div></div>
                <div className="rounded-lg bg-blue-50 border border-blue-200 py-2"><div className="font-bold text-blue-700">{kehadiran.sakit}</div><div className="text-xs text-blue-600">Sakit</div></div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 py-2"><div className="font-bold text-amber-700">{kehadiran.izin}</div><div className="text-xs text-amber-600">Izin</div></div>
                <div className="rounded-lg bg-rose-50 border border-rose-200 py-2"><div className="font-bold text-rose-700">{kehadiran.alpa}</div><div className="text-xs text-rose-600">Alpa</div></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-[#006837]" /> CLKB & PCL
            </CardTitle>
            <Link to="/admin/bk/laporan" className="text-xs text-[#006837] font-semibold flex items-center gap-1 hover:underline">
              Detail <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700">CLKB Terisi</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{bkSummary?.total_clkb ?? 0} total</Badge>
                <Badge className={bkSummary?.clkb_belum_ditanggapi > 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}>
                  {bkSummary?.clkb_belum_ditanggapi ?? 0} belum ditanggapi
                </Badge>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700">PCL Terisi</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{bkSummary?.total_pcl ?? 0} total</Badge>
                <Badge className={bkSummary?.pcl_belum_ditanggapi > 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}>
                  {bkSummary?.pcl_belum_ditanggapi ?? 0} belum ditanggapi
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
