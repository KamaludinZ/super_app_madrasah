import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ScanLine, Calendar, CheckCircle2, Circle, ClipboardList, UserCircle,
  CalendarDays, History, ShieldAlert, FileText, ClipboardEdit, BookOpen, Clock,
  ListChecks, Sparkles, Trophy,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { api, ROLE_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { KemenagBadge } from '@/components/branding/KemenagBadge';
import { IslamicBackground } from '@/components/patterns/IslamicPatterns';
import { NoJurnalEmptyState } from '@/components/ui/EmptyState';

// This dashboard is shared by roles whose sidebar menus differ significantly —
// each Menu Cepat set below mirrors exactly what that role sees in AppShell.js,
// so it never links somewhere the role doesn't actually have access to.
const SUBJECT_TEACHER_ROLES = ['guru', 'guru_ipa', 'guru_ips', 'guru_bahasa', 'guru_seni', 'guru_agama', 'guru_tik'];

const QUICK_MENU_BY_ROLE = {
  guru_piket: [
    { to: '/piket/tugas', label: 'Tugas Hari Ini', icon: ListChecks },
    { to: '/admin/jadwal-piket', label: 'Jadwal Piket', icon: ShieldAlert },
    { to: '/jurnal/riwayat', label: 'Riwayat Jurnal Piket', icon: History },
    { to: '/guru/kebersihan', label: 'Kebersihan Kelas', icon: Sparkles },
  ],
  guru_ekstrakurikuler: [
    { to: '/ekstrakurikuler', label: 'Ekstrakurikuler Saya', icon: Sparkles },
    { to: '/prestasi', label: 'Data Prestasi', icon: Trophy },
  ],
};

const SUBJECT_TEACHER_QUICK_MENU = [
  { to: '/profile/guru', label: 'Profil Saya', icon: UserCircle },
  { to: '/my-agenda', label: 'Agenda Saya', icon: CalendarDays },
  { to: '/jurnal/riwayat', label: 'Riwayat Jurnal', icon: History },
  { to: '/nilai/input', label: 'Input Nilai', icon: ClipboardEdit },
  { to: '/admin/jadwal-piket', label: 'Jadwal Piket', icon: ShieldAlert },
  { to: '/piket/tugas', label: 'Titipkan Tugas', icon: FileText },
  { to: '/guru/materi', label: 'Materi Mapel', icon: BookOpen },
  { to: '/guru/tugas', label: 'Tugas', icon: ClipboardList },
];

export default function GuruDashboard() {
  const { user, activeRole } = useAuth();
  const isSubjectTeacher = SUBJECT_TEACHER_ROLES.includes(activeRole);
  const quickMenu = isSubjectTeacher ? SUBJECT_TEACHER_QUICK_MENU : (QUICK_MENU_BY_ROLE[activeRole] || []);

  const [schedule, setSchedule] = useState([]);
  const [totalJtm, setTotalJtm] = useState(0);
  const [timeliness, setTimeliness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSubjectTeacher) { setLoading(false); return; }
    Promise.all([
      api.get('/schedules/my-today').then(({ data }) => setSchedule(data)).catch(() => {}),
      api.get('/schedules/grouped', { params: { teacher_id: user?.id } })
        .then(({ data }) => setTotalJtm((data || []).reduce((sum, s) => sum + (s.jtm_count || 1), 0)))
        .catch(() => {}),
      api.get('/jurnal/my-timeliness').then(({ data }) => setTimeliness(data)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [user?.id, isSubjectTeacher]);

  const filled = schedule.filter((s) => s.journal_filled).length;
  const total = schedule.length;
  const roleLabel = ROLE_LABELS[activeRole] || 'Guru';

  const chartData = (timeliness?.daily || []).map((d) => ({
    tanggal: d.date.slice(-5),
    'Tepat Waktu': d.on_time,
    Terlambat: d.late,
  }));

  return (
    <div className="section-spacing">
      <IslamicBackground pattern="star" opacity={0.02} />
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <KemenagBadge variant="default" className="mb-2" data-testid="dashboard-role-badge" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Assalamu'alaikum, {user?.full_name?.split(' ')[0] || 'Bapak/Ibu'}</h1>
          <p className="text-sm text-slate-600 mt-1">Berikut ringkasan mengajar Anda hari ini</p>
        </div>
        <Link to="/jurnal/scan">
          <Button size="lg" className="bg-[#006837] hover:bg-[#0B7A3B] gap-2 shadow-md" data-testid="dashboard-scan-button">
            <ScanLine className="h-5 w-5" /> Scan QR & Isi Jurnal
          </Button>
        </Link>
      </div>

      {isSubjectTeacher && (
        <div className="grid grid-cols-2 sm:grid-cols-4 grid-spacing-dense">
          <KPI label="Jadwal Hari Ini" value={total} icon={Calendar} />
          <KPI label="Jurnal Terisi" value={filled} icon={CheckCircle2} color="emerald" />
          <KPI label="Belum Diisi" value={total - filled} icon={Circle} color="amber" />
          <KPI label="Total JTM" value={totalJtm} icon={ClipboardList} color="blue" />
        </div>
      )}

      {isSubjectTeacher && (
        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Jadwal Mengajar Hari Ini</h2>
            {loading ? (
              <div className="text-sm text-slate-500">Memuat...</div>
            ) : schedule.length === 0 ? (
              <NoJurnalEmptyState />
            ) : (
              <div className="space-y-2" data-testid="guru-schedule-list">
                {schedule.map((s, idx) => (
                  <motion.div
                    key={s.id || idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${s.journal_filled ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200'}`}
                  >
                    <div className="font-mono text-sm font-semibold text-slate-900 w-20 shrink-0">{s.start_time}<br /><span className="text-xs text-slate-500">{s.end_time}</span></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 truncate">{s.subject_name}</div>
                      <div className="text-xs text-slate-600">{s.class_name} • {s.room_name}</div>
                    </div>
                    {s.journal_filled ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Terisi</Badge>
                    ) : (
                      <Link to="/jurnal/scan">
                        <Button size="sm" variant="outline" className="gap-1" data-testid={`scan-now-${idx}`}><ScanLine className="h-3.5 w-3.5" /> Isi</Button>
                      </Link>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {quickMenu.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-semibold text-slate-900 mb-4">Menu Cepat</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {quickMenu.map((item) => (
                <Link key={item.to} to={item.to}>
                  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center hover:border-[#006837]/40 hover:bg-[#006837]/5 transition-colors h-full">
                    <div className="h-9 w-9 rounded-lg bg-[#006837]/10 flex items-center justify-center">
                      <item.icon className="h-4.5 w-4.5 text-[#006837]" />
                    </div>
                    <span className="text-xs font-medium text-slate-700">{item.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isSubjectTeacher && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#006837]" /> Ketepatan Waktu Mengisi Jurnal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timeliness && timeliness.total_jurnal > 0 && (
              <div className="flex items-center gap-4 mb-4">
                <div className="text-3xl font-extrabold text-emerald-700 tabular-nums">{timeliness.on_time_percentage}%</div>
                <div className="text-sm text-slate-600">
                  Tepat waktu dari {timeliness.total_jurnal} jurnal semester ini
                  <span className="block text-xs text-slate-400">Toleransi {timeliness.grace_minutes} menit dari jadwal</span>
                </div>
              </div>
            )}
            {chartData.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Belum ada data jurnal untuk ditampilkan</p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="tanggal" fontSize={11} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Tepat Waktu" stackId="a" fill="#006837" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Terlambat" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KPI({ label, value, icon: Icon, color = 'slate' }) {
  const cls = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    slate: 'bg-white border-slate-200 text-slate-700',
  }[color];
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
