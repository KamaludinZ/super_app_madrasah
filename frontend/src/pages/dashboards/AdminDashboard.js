import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, Building2, Calendar, ClipboardCheck, ShieldCheck,
  GraduationCap, Settings, QrCode, Trophy, UserMinus, UserPlus,
  Award, Globe, Flag, MapPin, School, Megaphone,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import PublicPagesSection from '@/components/PublicPagesSection';

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [studStats, setStudStats] = useState(null);
  const [achStats, setAchStats] = useState(null);
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => {
    api.get('/admin/stats').then(({ data }) => setStats(data)).catch(() => {});
    api.get('/admin/stats/students').then(({ data }) => setStudStats(data)).catch(() => {});
    api.get('/admin/stats/achievements').then(({ data }) => setAchStats(data)).catch(() => {});
    loadAnnouncements();
  }, []);

  const loadAnnouncements = async () => {
    try {
      const { data } = await api.get('/announcements');
      setAnnouncements(data.slice(0, 3)); // Show only 3 latest
    } catch (e) {}
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'success': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-sky-100 text-sky-800 border-sky-200';
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-dashboard">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">Dashboard Admin</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Selamat datang, {user?.full_name?.split(' ')[0] || 'Admin'}</h1>
        <p className="text-sm text-slate-600 mt-1">Tahun Pelajaran Aktif: <span className="font-mono font-semibold">{stats?.active_academic_year || '-'}</span></p>
      </div>

      {/* Pengumuman Section */}
      {announcements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Pengumuman</CardTitle>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/pengumuman">Lihat Semua</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {announcements.map((ann) => (
              <div
                key={ann.id}
                className={`p-3 rounded-lg border ${getSeverityColor(ann.severity)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{ann.title}</h3>
                    <p className="text-xs mt-1 line-clamp-2">{ann.body}</p>
                  </div>
                  {ann.is_pinned && (
                    <Badge variant="outline" className="text-xs">Pinned</Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* KPI Stats - General */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" data-testid="general-stats">
        <KPI label="Total Pengguna" value={stats?.total_users || 0} icon={Users} />
        <KPI label="Total Kelas" value={stats?.total_classes || 0} icon={BookOpen} />
        <KPI label="Total Ruangan" value={stats?.total_rooms || 0} icon={Building2} />
        <KPI label="Jadwal Hari Ini" value={stats?.total_schedules_today || 0} icon={Calendar} />
        <KPI label="Jurnal Hari Ini" value={stats?.total_journals_today || 0} icon={ClipboardCheck} color="emerald" />
      </div>

      {/* Stats Siswa */}
      <Card data-testid="students-stats-overview">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-[#006837]/10 flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-[#006837]" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Statistik Siswa</h2>
                <p className="text-xs text-slate-500">Distribusi siswa pada TP {studStats?.academic_year || '-'}</p>
              </div>
            </div>
            <Link to="/admin/siswa" className="text-xs text-[#006837] hover:underline font-semibold" data-testid="link-data-siswa">
              Lihat semua →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              icon={Users}
              label="Total Siswa"
              value={studStats?.total ?? 0}
              testid="stat-total-siswa"
              color="bg-[#006837] text-white border-[#006837]"
              accent
            />
            <StatCard
              icon={School}
              label="Kelas 7"
              value={studStats?.kelas_7 ?? 0}
              testid="stat-kelas-7"
              color="bg-blue-50 text-blue-800 border-blue-200"
            />
            <StatCard
              icon={School}
              label="Kelas 8"
              value={studStats?.kelas_8 ?? 0}
              testid="stat-kelas-8"
              color="bg-purple-50 text-purple-800 border-purple-200"
            />
            <StatCard
              icon={School}
              label="Kelas 9"
              value={studStats?.kelas_9 ?? 0}
              testid="stat-kelas-9"
              color="bg-amber-50 text-amber-800 border-amber-200"
            />
            <StatCard
              icon={UserPlus}
              label="Mutasi (TP Aktif)"
              value={studStats?.mutasi_total ?? 0}
              testid="stat-mutasi"
              color="bg-rose-50 text-rose-800 border-rose-200"
              subtitle={studStats?.mutasi_total > 0
                ? `+${studStats?.mutasi_masuk ?? 0} masuk / -${studStats?.mutasi_keluar ?? 0} keluar`
                : 'Belum ada mutasi'}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats Prestasi */}
      <Card data-testid="achievements-stats-overview">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">Statistik Prestasi</h2>
                <p className="text-xs text-slate-500">{achStats?.verified ?? 0} dari {achStats?.total ?? 0} prestasi terverifikasi</p>
              </div>
            </div>
            <Link to="/prestasi" className="text-xs text-[#006837] hover:underline font-semibold" data-testid="link-data-prestasi">
              Lihat semua →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatCard
              icon={Trophy}
              label="Total Prestasi"
              value={achStats?.total ?? 0}
              testid="stat-total-prestasi"
              color="bg-amber-600 text-white border-amber-600"
              accent
            />
            <StatCard
              icon={MapPin}
              label="Tingkat Kab/Kota"
              value={achStats?.kab_kota ?? 0}
              testid="stat-prestasi-kab-kota"
              color="bg-blue-50 text-blue-800 border-blue-200"
            />
            <StatCard
              icon={Flag}
              label="Tingkat Provinsi"
              value={achStats?.provinsi ?? 0}
              testid="stat-prestasi-provinsi"
              color="bg-emerald-50 text-emerald-800 border-emerald-200"
            />
            <StatCard
              icon={Award}
              label="Tingkat Nasional"
              value={achStats?.nasional ?? 0}
              testid="stat-prestasi-nasional"
              color="bg-rose-50 text-rose-800 border-rose-200"
            />
            <StatCard
              icon={Globe}
              label="Tingkat Internasional"
              value={achStats?.internasional ?? 0}
              testid="stat-prestasi-internasional"
              color="bg-purple-50 text-purple-800 border-purple-200"
            />
          </div>
          {achStats?.by_holder && (
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Distribusi per Kategori Holder</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <HolderBadge label="Siswa" count={achStats.by_holder?.siswa || 0} color="bg-[#006837]/10 text-[#006837]" />
                <HolderBadge label="Guru" count={achStats.by_holder?.guru || 0} color="bg-blue-100 text-blue-800" />
                <HolderBadge label="Tendik" count={achStats.by_holder?.tendik || 0} color="bg-purple-100 text-purple-800" />
                <HolderBadge label="Madrasah" count={achStats.by_holder?.madrasah || 0} color="bg-amber-100 text-amber-800" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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

      <PublicPagesSection />
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

function StatCard({ icon: Icon, label, value, color, subtitle, accent, testid }) {
  return (
    <div className={`rounded-xl border p-4 transition-shadow hover:shadow-sm ${color}`} data-testid={testid}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-semibold uppercase tracking-wide ${accent ? 'opacity-90' : 'opacity-70'}`}>{label}</span>
        <Icon className={`h-4 w-4 ${accent ? 'opacity-90' : 'opacity-70'}`} />
      </div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      {subtitle && <div className={`text-[10px] mt-1 ${accent ? 'opacity-85' : 'opacity-70'}`}>{subtitle}</div>}
    </div>
  );
}

function HolderBadge({ label, count, color }) {
  return (
    <div className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${color}`}>
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-sm font-bold font-mono">{count}</span>
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
