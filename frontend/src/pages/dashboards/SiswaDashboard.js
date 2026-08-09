import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle2, Globe, ExternalLink, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

const HOLIDAY_CATEGORIES = {
  libur_nasional: {
    label: 'Libur Nasional',
    color: 'bg-rose-50 border-rose-200 text-rose-700',
    dotColor: 'bg-rose-500'
  },
  libur_keagamaan: {
    label: 'Libur Keagamaan',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    dotColor: 'bg-emerald-500'
  },
  libur_semester: {
    label: 'Libur Semester',
    color: 'bg-blue-50 border-blue-200 text-blue-700',
    dotColor: 'bg-blue-500'
  },
  kegiatan_akademik: {
    label: 'Kegiatan Akademik',
    color: 'bg-amber-50 border-amber-200 text-amber-700',
    dotColor: 'bg-amber-500'
  },
};

export default function SiswaDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    api.get(`/student/${user.id}/today`).then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false));
    loadApps();
    loadHolidays();
  }, [user.id]);

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

  const getHolidaysForDate = (day) => {
    if (!day) return [];
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return holidays.filter(h => {
      // Check if date falls within range
      if (h.end_date && h.end_date > h.date) {
        return dateStr >= h.date && dateStr <= h.end_date;
      }
      return h.date === dateStr;
    });
  };

  const isHoliday = (day) => {
    return getHolidaysForDate(day).length > 0;
  };

  const getHolidayCategory = (day) => {
    const dayHolidays = getHolidaysForDate(day);
    if (dayHolidays.length === 0) return null;
    // Return first holiday's category
    return dayHolidays[0].category || 'libur_nasional';
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

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">Dashboard Siswa</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Assalamu'alaikum, {user?.full_name?.split(' ')[0]}</h1>
        <p className="text-sm text-slate-600 mt-1">Kelas: <span className="font-semibold">{data?.class?.name || '-'}</span></p>
      </div>

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
              const category = getHolidayCategory(day);
              const categoryStyle = category ? HOLIDAY_CATEGORIES[category] : null;
              const dayHolidays = getHolidaysForDate(day);

              return (
                <div
                  key={idx}
                  className={`aspect-square flex flex-col items-center justify-center text-sm rounded-lg border ${
                    !day
                      ? 'bg-slate-50 border-slate-100'
                      : today
                      ? 'bg-blue-100 border-blue-300 font-bold text-blue-900'
                      : holiday && categoryStyle
                      ? `${categoryStyle.color} font-semibold`
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                  title={dayHolidays.map(h => h.name).join(', ')}
                >
                  {day && (
                    <>
                      <span>{day}</span>
                      {holiday && categoryStyle && <div className={`h-1 w-1 rounded-full ${categoryStyle.dotColor} mt-0.5`}></div>}
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
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Kalender Bulan Ini:</p>
              <div className="space-y-2">
                {holidays
                  .filter(h => {
                    const holidayDate = new Date(h.date);
                    return (
                      holidayDate.getMonth() === currentMonth.getMonth() &&
                      holidayDate.getFullYear() === currentMonth.getFullYear()
                    );
                  })
                  .map((h) => {
                    const category = h.category || 'libur_nasional';
                    const categoryStyle = HOLIDAY_CATEGORIES[category];
                    const startDate = new Date(h.date);
                    const endDate = h.end_date ? new Date(h.end_date) : null;
                    const dateRange = endDate && endDate > startDate
                      ? `${startDate.getDate()}-${endDate.getDate()}`
                      : `${startDate.getDate()}`;

                    return (
                      <div key={h.id} className={`flex items-start gap-2 p-2 rounded-lg border ${categoryStyle.color}`}>
                        <Badge variant="outline" className={`shrink-0 ${categoryStyle.color} border-0 font-bold`}>
                          {dateRange}
                        </Badge>
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{h.name}</div>
                          <div className="text-xs opacity-75">{categoryStyle.label}</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
