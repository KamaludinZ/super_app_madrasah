import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Stethoscope, Pill, AlertTriangle, GraduationCap, Users, ArrowRight } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
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

export default function UnitKesehatanDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [rekap, setRekap] = useState(null);
  const [obatList, setObatList] = useState([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const bulan = new Date().toISOString().slice(0, 7);
      const [summaryRes, rekapRes, obatRes] = await Promise.all([
        api.get('/uks/laporan/summary'),
        api.get('/uks/laporan/rekap-kunjungan', { params: { period: 'bulan', bulan } }),
        api.get('/uks/obat'),
      ]);
      setSummary(summaryRes.data);
      setRekap(rekapRes.data);
      setObatList(obatRes.data || []);
    } catch (e) {
      // silent — dashboard degrades gracefully if UKS data isn't reachable
    } finally {
      setLoading(false);
    }
  };

  const stokMenipis = obatList.filter((o) => o.stok_menipis);

  // Last 14 days of the current month's rekap for a readable chart
  const chartData = (rekap?.rows || []).slice(-14).map((r) => ({
    tanggal: r.label.slice(-2),
    Siswa: r.siswa,
    GTK: r.gtk,
  }));

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
        <p className="text-slate-500">Memuat dashboard UKS...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <KemenagBadge variant="default" className="mb-2" />
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Assalamu'alaikum, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-600 mt-1">Dashboard Unit Kesehatan Sekolah (UKS) — {rekap?.label}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Stethoscope} label="Kunjungan Bulan Ini" value={rekap?.total ?? 0} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
        <StatCard icon={GraduationCap} label="Kunjungan Siswa" value={rekap?.total_siswa ?? 0} color="bg-blue-50 border-blue-200 text-blue-700" />
        <StatCard icon={Users} label="Kunjungan GTK" value={rekap?.total_gtk ?? 0} color="bg-violet-50 border-violet-200 text-violet-700" />
        <StatCard icon={AlertTriangle} label="Obat Stok Menipis" value={stokMenipis.length} color="bg-amber-50 border-amber-200 text-amber-700" />
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Tren Kunjungan Harian — {rekap?.label}</CardTitle>
          <Link to="/admin/uks/laporan" className="text-xs text-[#006837] font-semibold flex items-center gap-1 hover:underline">
            Lihat Laporan Lengkap <ArrowRight className="h-3 w-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Belum ada data kunjungan bulan ini</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="tanggal" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Siswa" fill="#006837" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="GTK" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Kunjungan per Kondisi Pulang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(summary?.kunjungan_by_kondisi_pulang || {}).length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada data</p>
            ) : (
              Object.entries(summary.kunjungan_by_kondisi_pulang).map(([key, count]) => (
                <div key={key} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{key}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Pill className="h-4 w-4 text-[#006837]" /> Data Stok Obat
            </CardTitle>
            <Link to="/admin/uks/obat" className="text-xs text-[#006837] font-semibold flex items-center gap-1 hover:underline">
              Kelola Obat <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm pb-2 border-b border-slate-100">
              <span className="text-slate-500">Total Jenis Obat Terdaftar</span>
              <span className="font-semibold">{obatList.length}</span>
            </div>
            {stokMenipis.length === 0 ? (
              <p className="text-sm text-emerald-600 flex items-center gap-1.5 pt-1">Semua stok obat dalam kondisi aman</p>
            ) : (
              <>
                <div className="text-xs font-semibold text-amber-600 uppercase pt-1">Perlu Restock</div>
                {stokMenipis.slice(0, 6).map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 truncate pr-2">{o.nama_obat}</span>
                    <Badge className="bg-rose-100 text-rose-700 border-rose-200 shrink-0">{o.stok_tersisa ?? 0} {o.satuan} (min: {o.stok_minimum})</Badge>
                  </div>
                ))}
                {stokMenipis.length > 6 && (
                  <p className="text-xs text-slate-500 pt-1">+{stokMenipis.length - 6} obat lainnya juga menipis</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Obat Paling Sering Digunakan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(summary?.most_used_obat || []).length === 0 ? (
            <p className="text-sm text-slate-500">Belum ada data</p>
          ) : (
            summary.most_used_obat.slice(0, 5).map((item) => (
              <div key={item.nama_obat} className="flex items-center justify-between text-sm">
                <span className="text-slate-700 truncate pr-2">{item.nama_obat}</span>
                <Badge variant="outline">{item.jumlah}x</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
