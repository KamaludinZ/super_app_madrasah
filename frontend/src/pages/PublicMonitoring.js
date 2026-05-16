import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, AlertCircle, Circle, Radio, RefreshCw, Calendar, LogIn, CalendarDays, Star, LayoutDashboard, User } from 'lucide-react';
import { api, DAY_LABELS, STATUS_COLORS, STATUS_LABELS } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import axios from 'axios';

const REFRESH_INTERVAL = 15000; // 15s
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

export default function PublicMonitoring() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('aktif');
  const [now, setNow] = useState(new Date());
  const [holiday, setHoliday] = useState(null);

  const fetchData = async () => {
    try {
      const { data } = await api.get('/public/monitoring');
      setData(data);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchHoliday = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/public/holidays/today`);
      setHoliday(data);
    } catch (e) { /* ignore */ }
  };

  useEffect(() => {
    fetchData();
    fetchHoliday();
    const t = setInterval(fetchData, REFRESH_INTERVAL);
    const t2 = setInterval(() => setNow(new Date()), 1000);
    const t3 = setInterval(fetchHoliday, 5 * 60 * 1000); // 5 min
    return () => { clearInterval(t); clearInterval(t2); clearInterval(t3); };
  }, []);

  // Helper function to check if schedule is ongoing based on time
  const isOngoing = (item) => {
    if (!item.start_time || !item.end_time) return false;
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    return currentTime >= item.start_time && currentTime <= item.end_time;
  };

  // Helper function to check if schedule is upcoming
  const isUpcoming = (item) => {
    if (!item.start_time) return false;
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM
    return currentTime < item.start_time;
  };

  const filteredItems = (data?.classes || []).filter((c) => {
    if (filter === 'aktif') return true; // Show all for the day
    if (filter === 'akan-datang') return isUpcoming(c);
    if (filter === 'berlangsung') return isOngoing(c); // Show ongoing regardless of filled status
    if (filter === 'terisi') return c.jurnal_status === 'filled';
    if (filter === 'belum-terisi') return c.jurnal_status === 'missing' || c.jurnal_status === 'pending';
    return true;
  });

  const dayLabel = DAY_LABELS[data?.day] || data?.day || '';

  // Calculate stats based on current time
  const allClasses = data?.classes || [];
  const stats = {
    total: allClasses.length,
    filled: allClasses.filter(c => c.jurnal_status === 'filled').length,
    berlangsung: allClasses.filter(c => isOngoing(c)).length,
    belum_terisi: allClasses.filter(c => c.jurnal_status === 'missing' || c.jurnal_status === 'pending').length,
    akan_datang: allClasses.filter(c => isUpcoming(c)).length,
  };

  // Find current ongoing session numbers
  const ongoingClasses = allClasses.filter(c => isOngoing(c));
  const sessionNumbers = [...new Set(ongoingClasses.map(c => c.session_number).filter(Boolean))].sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <div className="absolute inset-x-0 top-0 h-64 bg-hero-wash pointer-events-none" />
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {data?.logo_url ? (
              <img src={data.logo_url} alt="Logo" className="h-10 w-10 object-contain" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-[#006837] flex items-center justify-center text-white font-bold">MS</div>
            )}
            <div>
              <div className="text-sm font-bold text-[#006837] leading-tight">MONITORING JURNAL PRESISI</div>
              <div className="text-xs text-slate-600">{data?.school_name || 'MTsN 2 Kota Malang'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 live-dot" data-testid="public-monitoring-live-indicator" />
              <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">LIVE</span>
            </div>
            <div className="text-right">
              <div className="font-mono text-base sm:text-lg font-bold text-slate-900" data-testid="public-monitoring-clock">
                {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
              </div>
              <div className="text-xs text-slate-500">{dayLabel}, {now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200">
                  <User className="h-3 w-3 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-700">{user.full_name}</span>
                </div>
                <Link to="/dashboard">
                  <Button variant="outline" size="sm" className="gap-2" data-testid="link-to-dashboard">
                    <LayoutDashboard className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
                  </Button>
                </Link>
              </div>
            ) : (
              <Link to="/login">
                <Button variant="outline" size="sm" className="gap-2" data-testid="link-back-to-login">
                  <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">Login</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Holiday Banner */}
        {(holiday?.is_academic_holiday || holiday?.is_weekly_holiday) && (
          <div className="mb-4 rounded-2xl bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-200 p-4 flex items-start gap-3" data-testid="holiday-banner">
            {holiday?.is_academic_holiday ? <Star className="h-6 w-6 text-rose-600 mt-0.5 shrink-0" /> : <CalendarDays className="h-6 w-6 text-amber-600 mt-0.5 shrink-0" />}
            <div className="flex-1">
              {holiday?.is_academic_holiday ? (
                <>
                  <div className="font-bold text-rose-900">
                    HARI INI LIBUR — {holiday.academic_holiday?.name || '-'}
                  </div>
                  <div className="text-xs text-rose-700 mt-0.5">
                    <span className="capitalize">{holiday.academic_holiday?.category?.replace('_', ' ')}</span>
                    {holiday.academic_holiday?.description && ` — ${holiday.academic_holiday.description}`}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold text-amber-900">
                    HARI INI {DAY_LABELS[holiday?.day] || holiday?.day?.toUpperCase()} — {holiday.weekly_holiday?.description || 'Libur Mingguan'}
                  </div>
                  <div className="text-xs text-amber-700 mt-0.5">Tidak ada kegiatan pembelajaran rutin</div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Title */}
        <div className="mb-6">
          <Badge className="bg-amber-100 text-amber-900 border border-amber-200 mb-2">Transparansi Publik</Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Pengisian Jurnal Mengajar
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Pantau status pengisian jurnal seluruh kelas {data?.school_name || 'MTsN 2 Kota Malang'} secara realtime. Tahun Pelajaran: <span className="font-mono font-semibold">{data?.academic_year || '-'}</span>
          </p>
        </div>

        {/* Current Session Indicator */}
        {sessionNumbers.length > 0 && (
          <div className="mb-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 p-4" data-testid="current-session-indicator">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-amber-500 text-white shrink-0">
                <Radio className="h-6 w-6 animate-pulse" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-amber-900 text-lg">
                  SEDANG BERLANGSUNG: Jam Ke-{sessionNumbers.join(', ')}
                </div>
                <div className="text-sm text-amber-700 mt-0.5">
                  {stats.berlangsung} kelas sedang dalam proses pembelajaran
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total Jadwal" value={stats.total} color="slate" icon={Calendar} />
          <StatCard label="Terisi" value={stats.filled} color="emerald" icon={CheckCircle2} />
          <StatCard label="Berlangsung" value={stats.berlangsung} color="amber" icon={Clock} />
          <StatCard label="Belum Diisi" value={stats.belum_terisi} color="rose" icon={AlertCircle} />
          <StatCard label="Akan Datang" value={stats.akan_datang} color="slate" icon={Circle} />
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <Tabs value={filter} onValueChange={setFilter} data-testid="public-monitoring-filter-tabs">
            <TabsList className="bg-white border border-slate-200">
              <TabsTrigger value="aktif" data-testid="filter-aktif">Aktif ({stats.total})</TabsTrigger>
              <TabsTrigger value="akan-datang" data-testid="filter-akan-datang">Akan Datang ({stats.akan_datang})</TabsTrigger>
              <TabsTrigger value="berlangsung" data-testid="filter-berlangsung">Berlangsung ({stats.berlangsung})</TabsTrigger>
              <TabsTrigger value="terisi" data-testid="filter-terisi">Terisi ({stats.filled})</TabsTrigger>
              <TabsTrigger value="belum-terisi" data-testid="filter-belum-terisi">Belum Terisi ({stats.belum_terisi})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2" data-testid="refresh-monitoring">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Memuat data...</div>
        ) : filteredItems.length === 0 ? (
          <Card className="surface-ivory">
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <div className="text-slate-700 font-semibold">Tidak ada jadwal</div>
              <div className="text-sm text-slate-500 mt-1">Belum ada jadwal pelajaran untuk hari ini atau filter yang dipilih</div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" data-testid="public-monitoring-grid">
            {filteredItems.map((c, idx) => <ScheduleCard key={`${c.schedule_id}-${idx}`} item={c} now={now} />)}
          </div>
        )}

        <div className="text-center text-xs text-slate-500 mt-8">
          Data diperbarui otomatis setiap {REFRESH_INTERVAL / 1000} detik &middot; © {new Date().getFullYear()} {data?.school_name}
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon }) {
  const colors = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        <Icon className="h-4 w-4 opacity-70" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}>{value}</div>
    </div>
  );
}

function ScheduleCard({ item, now }) {
  const statusBg = STATUS_COLORS[item.jurnal_status] || 'bg-slate-50 border-slate-200';

  // Check if currently ongoing
  const currentTime = now.toTimeString().slice(0, 5);
  const isOngoing = item.start_time && item.end_time && currentTime >= item.start_time && currentTime <= item.end_time;

  // Legacy support for old 'active' status
  const isActive = item.status === 'active' || isOngoing;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`relative rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow ${isActive ? 'ring-2 ring-amber-300' : ''}`}
    >
      {isActive && (
        <div className="absolute -top-2 left-3 flex items-center gap-1 bg-amber-500 text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-white live-dot" />
          {item.session_number ? `JAM KE-${item.session_number}` : 'SEDANG BERJALAN'}
        </div>
      )}
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-lg font-bold text-slate-900">{item.class_name}</div>
          <div className="text-xs text-slate-500 font-mono">{item.room_name}</div>
        </div>
        <Badge className={`text-[10px] ${statusBg}`}>
          {STATUS_LABELS[item.jurnal_status]}
        </Badge>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="font-semibold text-slate-900">{item.subject_name}</div>
        <div className="text-slate-600 text-xs">{item.teacher_name}</div>
        <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
          <Clock className="h-3 w-3" /> {item.start_time} — {item.end_time}
          {item.session_number && (
            <span className="ml-auto px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
              Jam {item.session_number}
            </span>
          )}
        </div>
        {item.jurnal_materi && (
          <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-slate-700 line-clamp-2">
            <span className="font-semibold">Materi: </span>{item.jurnal_materi}
          </div>
        )}
      </div>
    </motion.div>
  );
}
