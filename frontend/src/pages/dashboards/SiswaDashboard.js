import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Calendar, CheckCircle2, Megaphone, Globe, ExternalLink, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function SiswaDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [apps, setApps] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    api.get(`/student/${user.id}/today`).then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
    loadAnnouncements();
    loadApps();
    loadHolidays();
  }, [user.id]);

  const loadAnnouncements = async () => {
    try {
      const { data } = await api.get('/announcements');
      setAnnouncements(data.slice(0, 3)); // Show only 3 latest
    } catch (e) {}
  };

  const loadApps = async () => {
    try {
      const { data } = await api.get('/school-apps');
      setApps(data);
    } catch (e) {}
  };

  const loadHolidays = async () => {
    try {
      const { data } = await api.get('/academic-holidays');
      setHolidays(data);
    } catch (e) {}
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const isHoliday = (day) => {
    if (!day) return false;
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return holidays.some(h => h.date === dateStr);
  };

  const getHolidayName = (day) => {
    if (!day) return '';
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const holiday = holidays.find(h => h.date === dateStr);
    return holiday?.name || '';
  };

  const isToday = (day) => {
    if (!day) return false;
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const days = getDaysInMonth(currentMonth);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'success': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default: return 'bg-sky-100 text-sky-800 border-sky-200';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">Dashboard Siswa</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Assalamu'alaikum, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-600 mt-1">Kelas: <span className="font-semibold">{data?.class?.name || '-'}</span></p>
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

      {/* Aplikasi Madrasah Section */}
      {apps.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-lg">Aplikasi Madrasah</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {apps.map((app) => (
                <a
                  key={app.id}
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50 transition-all group"
                >
                  {app.icon_url ? (
                    <img src={app.icon_url} alt={app.name} className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                      <Globe className="h-6 w-6 text-purple-600" />
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-sm font-semibold text-slate-900 flex items-center justify-center gap-1">
                      {app.name}
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {app.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 mt-1">{app.description}</p>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Jadwal Hari Ini */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-base font-semibold text-slate-900 mb-4">Jadwal Pelajaran Hari Ini</h2>
          {loading ? (
            <div className="text-slate-500 text-sm">Memuat...</div>
          ) : !data?.today_schedule?.length ? (
            <div className="text-center py-8 text-slate-500">
              <Calendar className="h-10 w-10 mx-auto opacity-40 mb-2" />
              <div className="text-sm">Tidak ada jadwal hari ini</div>
            </div>
          ) : (
            <div className="space-y-2">
              {data.today_schedule.map((s, idx) => (
                <div key={s.id || idx} className={`rounded-xl border p-3 ${s.journal ? 'bg-emerald-50/50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-sm font-semibold text-slate-900">{s.start_time}-{s.end_time}</div>
                      <div className="font-semibold text-slate-900">{s.subject_name}</div>
                    </div>
                    {s.journal ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Sudah Mengajar</Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-600">Belum</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 ml-0">{s.teacher_name} • {s.room_name}</div>
                  {s.journal && (
                    <div className="mt-2 pt-2 border-t border-emerald-200 text-sm">
                      <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-0.5">Materi:</div>
                      <div className="text-slate-800">{s.journal.materi}</div>
                      {s.journal.catatan && <div className="text-xs text-slate-600 mt-1">{s.journal.catatan}</div>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kalender Akademik */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Kalender Akademik</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold min-w-[140px] text-center">
                {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </span>
              <Button variant="outline" size="sm" onClick={nextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {DAY_NAMES.map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-slate-600 py-2">
                {day}
              </div>
            ))}
            {days.map((day, idx) => {
              const holiday = isHoliday(day);
              const today = isToday(day);
              return (
                <div
                  key={idx}
                  className={`aspect-square flex flex-col items-center justify-center text-sm rounded-lg border ${
                    !day
                      ? 'bg-slate-50 border-slate-100'
                      : today
                      ? 'bg-blue-100 border-blue-300 font-bold text-blue-900'
                      : holiday
                      ? 'bg-red-50 border-red-200 text-red-700 font-semibold'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                  title={holiday ? getHolidayName(day) : ''}
                >
                  {day && (
                    <>
                      <span>{day}</span>
                      {holiday && <div className="h-1 w-1 rounded-full bg-red-500 mt-0.5"></div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {holidays.filter(h => {
            const holidayDate = new Date(h.date);
            return (
              holidayDate.getMonth() === currentMonth.getMonth() &&
              holidayDate.getFullYear() === currentMonth.getFullYear()
            );
          }).length > 0 && (
            <div className="mt-4 pt-4 border-t space-y-2">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Libur Bulan Ini:</p>
              {holidays
                .filter(h => {
                  const holidayDate = new Date(h.date);
                  return (
                    holidayDate.getMonth() === currentMonth.getMonth() &&
                    holidayDate.getFullYear() === currentMonth.getFullYear()
                  );
                })
                .map((h) => (
                  <div key={h.id} className="flex items-start gap-2 text-sm">
                    <Badge variant="outline" className="text-red-600 border-red-300 shrink-0">
                      {new Date(h.date).getDate()}
                    </Badge>
                    <span className="text-slate-700">{h.name}</span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
