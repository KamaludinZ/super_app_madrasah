import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, HeartHandshake, Home, ClipboardCheck, AlertTriangle,
  Trophy, ShieldAlert, UserCheck, ArrowRight,
} from 'lucide-react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
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

export default function GuruBkDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bkSummary, setBkSummary] = useState(null);
  const [tatibSummary, setTatibSummary] = useState(null);
  const [kehadiran, setKehadiran] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bkRes, tatibRes, kehadiranRes] = await Promise.all([
        api.get('/bk/laporan/summary'),
        api.get('/tatib/stats/summary'),
        api.get('/bk/laporan/kehadiran-summary'),
      ]);
      setBkSummary(bkRes.data);
      setTatibSummary(tatibRes.data);
      setKehadiran(kehadiranRes.data);
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
        <p className="text-slate-500">Memuat dashboard BK...</p>
      </div>
    );
  }

  const tatibChartData = [
    { name: 'Pelanggaran', value: tatibSummary?.total_pelanggaran ?? 0 },
    { name: 'Prestasi', value: tatibSummary?.total_prestasi ?? 0 },
  ];
  const hasTatibData = tatibChartData.some((d) => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <KemenagBadge variant="default" className="mb-2" />
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Assalamu'alaikum, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-600 mt-1">Dashboard Bimbingan Konseling (BK)</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={HeartHandshake} label="Kunjungan Konseling" value={bkSummary?.total_kunjungan ?? 0} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <StatCard icon={Home} label="Home Visit" value={bkSummary?.total_home_visit ?? 0} color="bg-blue-50 border-blue-200 text-blue-700" />
        <StatCard icon={ShieldAlert} label="Pelanggaran Tatib" value={tatibSummary?.total_pelanggaran ?? 0} color="bg-rose-50 border-rose-200 text-rose-700" />
        <StatCard icon={Trophy} label="Prestasi Tatib" value={tatibSummary?.total_prestasi ?? 0} color="bg-amber-50 border-amber-200 text-amber-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-[#006837]" /> Pengisian CLKB & PCL
            </CardTitle>
            <Link to="/admin/bk/laporan" className="text-xs text-[#006837] font-semibold flex items-center gap-1 hover:underline">
              Lihat Laporan <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div>
                <div className="font-semibold text-slate-900">CLKB</div>
                <div className="text-xs text-slate-500">Total pengisian: {bkSummary?.total_clkb ?? 0}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className={bkSummary?.clkb_belum_ditanggapi > 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}>
                  {bkSummary?.clkb_belum_ditanggapi ?? 0} belum ditanggapi
                </Badge>
                <Badge variant="outline" className="text-[10px]">{bkSummary?.clkb_schedule_open ? 'Jadwal Aktif' : 'Jadwal Tutup'}</Badge>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
              <div>
                <div className="font-semibold text-slate-900">PCL</div>
                <div className="text-xs text-slate-500">Total pengisian: {bkSummary?.total_pcl ?? 0}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge className={bkSummary?.pcl_belum_ditanggapi > 0 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}>
                  {bkSummary?.pcl_belum_ditanggapi ?? 0} belum ditanggapi
                </Badge>
                <Badge variant="outline" className="text-[10px]">{bkSummary?.pcl_schedule_open ? 'Jadwal Aktif' : 'Jadwal Tutup'}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tata Tertib — Pelanggaran vs Prestasi</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasTatibData ? (
              <p className="text-sm text-slate-500 text-center py-8">Belum ada data tata tertib</p>
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={tatibChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label>
                      {tatibChartData.map((entry, idx) => <Cell key={entry.name} fill={TATIB_COLORS[idx]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-[#006837]" /> Kehadiran Siswa (Semester Aktif)
          </CardTitle>
          <Link to="/admin/kehadiran" className="text-xs text-[#006837] font-semibold flex items-center gap-1 hover:underline">
            Lihat Detail <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          {(kehadiran?.total_records ?? 0) === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Belum ada data kehadiran semester ini</p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-extrabold text-emerald-700 tabular-nums">{kehadiran.percentage_hadir}%</div>
                <div className="text-sm text-slate-600">Persentase kehadiran keseluruhan siswa</div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 py-2"><div className="font-bold text-emerald-700">{kehadiran.hadir}</div><div className="text-xs text-emerald-600">Hadir</div></div>
                <div className="rounded-lg bg-blue-50 border border-blue-200 py-2"><div className="font-bold text-blue-700">{kehadiran.sakit}</div><div className="text-xs text-blue-600">Sakit</div></div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 py-2"><div className="font-bold text-amber-700">{kehadiran.izin}</div><div className="text-xs text-amber-600">Izin</div></div>
                <div className="rounded-lg bg-rose-50 border border-rose-200 py-2"><div className="font-bold text-rose-700">{kehadiran.alpa}</div><div className="text-xs text-rose-600">Alpa</div></div>
              </div>
              {kehadiran.top_alpa?.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Siswa dengan Alpa Terbanyak
                  </div>
                  <div className="space-y-1.5">
                    {kehadiran.top_alpa.slice(0, 5).map((s) => (
                      <div key={s.siswa_id} className="flex items-center justify-between text-sm bg-rose-50/50 rounded-lg px-3 py-1.5">
                        <span className="text-slate-700">{s.siswa_nama || '-'}<span className="text-xs text-slate-500 ml-1.5">{s.siswa_kelas}</span></span>
                        <Badge className="bg-rose-100 text-rose-700 border-rose-200">{s.count_alpa}x alpa</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
