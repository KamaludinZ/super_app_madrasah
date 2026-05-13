import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BookOpen, Building2, Calendar, ClipboardCheck, ShieldCheck, GraduationCap, Settings, QrCode, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  useEffect(() => {
    api.get('/admin/stats').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">Dashboard Admin</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Selamat datang, {user?.full_name?.split(' ')[0] || 'Admin'}</h1>
        <p className="text-sm text-slate-600 mt-1">Tahun Pelajaran Aktif: <span className="font-mono font-semibold">{stats?.active_academic_year || '-'}</span></p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KPI label="Total Pengguna" value={stats?.total_users || 0} icon={Users} />
        <KPI label="Total Kelas" value={stats?.total_classes || 0} icon={BookOpen} />
        <KPI label="Total Ruangan" value={stats?.total_rooms || 0} icon={Building2} />
        <KPI label="Jadwal Hari Ini" value={stats?.total_schedules_today || 0} icon={Calendar} />
        <KPI label="Jurnal Hari Ini" value={stats?.total_journals_today || 0} icon={ClipboardCheck} color="emerald" />
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Aksi Cepat</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <QuickAction to="/admin/users" icon={Users} label="Kelola Pengguna" testid="qa-users" />
            <QuickAction to="/admin/schedules" icon={Calendar} label="Atur Jadwal" testid="qa-schedules" />
            <QuickAction to="/admin/qr-generator" icon={QrCode} label="Generate QR Kelas" testid="qa-qr" />
            <QuickAction to="/admin/audit-logs" icon={ShieldCheck} label="Log Aktivitas" testid="qa-audit" />
            <QuickAction to="/admin/rooms" icon={Building2} label="Kelola Ruangan" testid="qa-rooms" />
            <QuickAction to="/admin/classes" icon={BookOpen} label="Kelola Kelas" testid="qa-classes" />
            <QuickAction to="/admin/academic-year" icon={GraduationCap} label="Tahun Pelajaran" testid="qa-ay" />
            <QuickAction to="/admin/settings" icon={Settings} label="Pengaturan" testid="qa-settings" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-3">Halaman Publik</h2>
          <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-4">
            <div>
              <div className="font-semibold text-emerald-900">Monitoring Jurnal Realtime</div>
              <div className="text-xs text-emerald-800/80">Halaman transparansi publik tanpa login — dapat dibagikan ke wali murid</div>
            </div>
            <Link to="/public/monitoring" target="_blank" rel="noopener" className="text-emerald-700 font-semibold flex items-center gap-1 hover:underline" data-testid="public-monitoring-link">
              Lihat <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ label, value, icon: Icon, color = 'slate' }) {
  const cls = color === 'emerald' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white border-slate-200 text-slate-700';
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</span>
        <Icon className="h-4 w-4 opacity-60" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label, testid }) {
  return (
    <Link to={to} data-testid={testid} className="group rounded-xl border border-slate-200 bg-white hover:border-[#006837]/40 hover:shadow-sm transition-all p-4 flex flex-col items-start gap-2">
      <div className="h-10 w-10 rounded-lg bg-[#006837]/10 flex items-center justify-center group-hover:bg-[#006837]/20">
        <Icon className="h-5 w-5 text-[#006837]" />
      </div>
      <div className="text-sm font-semibold text-slate-900">{label}</div>
    </Link>
  );
}
