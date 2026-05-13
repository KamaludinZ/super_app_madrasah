import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanLine, Calendar, Clock, CheckCircle2, Circle, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api, ROLE_LABELS } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

export default function GuruDashboard() {
  const { user, activeRole } = useAuth();
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/schedules/my-today').then(({ data }) => setSchedule(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filled = schedule.filter((s) => s.journal_filled).length;
  const total = schedule.length;
  const roleLabel = ROLE_LABELS[activeRole] || 'Guru';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2" data-testid="dashboard-role-badge">Dashboard {roleLabel}</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Assalamu'alaikum, {user?.full_name?.split(' ')[0] || 'Bapak/Ibu'}</h1>
          <p className="text-sm text-slate-600 mt-1">Berikut ringkasan mengajar Anda hari ini</p>
        </div>
        <Link to="/jurnal/scan">
          <Button size="lg" className="bg-[#006837] hover:bg-[#0B7A3B] gap-2 shadow-md" data-testid="dashboard-scan-button">
            <ScanLine className="h-5 w-5" /> Scan QR & Isi Jurnal
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPI label="Jadwal Hari Ini" value={total} icon={Calendar} />
        <KPI label="Jurnal Terisi" value={filled} icon={CheckCircle2} color="emerald" />
        <KPI label="Belum Diisi" value={total - filled} icon={Circle} color="amber" />
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Jadwal Mengajar Hari Ini</h2>
          {loading ? (
            <div className="text-sm text-slate-500">Memuat...</div>
          ) : schedule.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Calendar className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <div className="text-sm">Tidak ada jadwal mengajar hari ini</div>
            </div>
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
    </div>
  );
}

function KPI({ label, value, icon: Icon, color = 'slate' }) {
  const cls = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
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
