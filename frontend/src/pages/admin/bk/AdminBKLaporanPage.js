import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileBarChart, HeartHandshake, ClipboardCheck, AlertTriangle, Home, Loader2 } from 'lucide-react';
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

export default function AdminBKLaporanPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bk/laporan/summary');
      setSummary(res.data);
    } catch (e) {
      toast.error('Gagal memuat laporan BK');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-bk-laporan-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <FileBarChart className="h-3 w-3 mr-1" /> Menu BK
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Laporan BK</h1>
        <p className="text-sm text-slate-600 mt-1">Rekapitulasi kunjungan, CLKB, PCL, dan home visit</p>
      </div>

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
          <p className="text-slate-500">Memuat laporan...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={HeartHandshake} label="Total Kunjungan Konseling" value={summary?.total_kunjungan ?? 0} accent="bg-emerald-100 text-emerald-700" />
            <StatCard icon={ClipboardCheck} label="Total Pengisian CLKB" value={summary?.total_clkb ?? 0} accent="bg-blue-100 text-blue-700" />
            <StatCard icon={AlertTriangle} label="Total Pengisian PCL" value={summary?.total_pcl ?? 0} accent="bg-amber-100 text-amber-700" />
            <StatCard icon={Home} label="Total Home Visit" value={summary?.total_home_visit ?? 0} accent="bg-violet-100 text-violet-700" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BreakdownList title="Kunjungan per Jenis Layanan" data={summary?.kunjungan_by_jenis} />
            <StatCard icon={ClipboardCheck} label="CLKB Belum Ditanggapi" value={summary?.clkb_belum_ditanggapi ?? 0} accent="bg-blue-100 text-blue-700" />
            <StatCard icon={AlertTriangle} label="PCL Belum Ditanggapi" value={summary?.pcl_belum_ditanggapi ?? 0} accent="bg-amber-100 text-amber-700" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Jadwal Pengisian CLKB</span>
                <Badge className={summary?.clkb_schedule_open ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>
                  {summary?.clkb_schedule_open ? 'Sedang Dibuka' : 'Ditutup'}
                </Badge>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Jadwal Pengisian PCL</span>
                <Badge className={summary?.pcl_schedule_open ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>
                  {summary?.pcl_schedule_open ? 'Sedang Dibuka' : 'Ditutup'}
                </Badge>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
