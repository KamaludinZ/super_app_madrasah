import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, CalendarDays, Clock, MapPin, Users, RefreshCw, LogIn, ChevronLeft, ChevronRight, LayoutDashboard, User, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import PublicFooter from '@/components/layout/PublicFooter';
import axios from 'axios';

const REFRESH_INTERVAL = 30000; // 30s
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const MONTH_LABELS = {
  1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April',
  5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus',
  9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember',
};

const STATUS_COLORS = {
  upcoming: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', label: 'Mendatang' },
  ongoing: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Berlangsung' },
  completed: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', label: 'Selesai' },
};

export default function PublicAgenda() {
  const { user } = useAuth();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  // State for madrasah events
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);

  // State for staff events
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [staffPage, setStaffPage] = useState(1);
  const staffPerPage = 10;

  const fetchData = async () => {
    try {
      const params = {
        year: currentYear,
        month: currentMonth,
        page: currentPage,
        per_page: 10
      };

      const { data: agendaData } = await axios.get(`${BACKEND_URL}/api/public/agenda`, { params });
      setData(agendaData);
    } catch (e) {
      console.error('Error fetching agenda:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, REFRESH_INTERVAL);
    const t2 = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(t); clearInterval(t2); };
  }, [currentYear, currentMonth, currentPage]);

  const madrasahEvents = data?.madrasah_events || [];
  const staffEvents = data?.staff_events || [];
  const pagination = data?.pagination || { page: 1, per_page: 10, total: 0, total_pages: 1 };

  // Navigate month
  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setCurrentPage(1);
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setCurrentPage(1);
  };

  // Filter staff events by selected date
  const filteredStaffEvents = staffEvents.filter(e => e.date === selectedDate);

  // Pagination for staff events
  const totalStaffEvents = filteredStaffEvents.length;
  const totalStaffPages = Math.ceil(totalStaffEvents / staffPerPage);
  const staffStartIndex = (staffPage - 1) * staffPerPage;
  const staffEndIndex = staffStartIndex + staffPerPage;
  const paginatedStaffEvents = filteredStaffEvents.slice(staffStartIndex, staffEndIndex);

  // Generate date buttons (7 days before and after today)
  const generateDateButtons = () => {
    const dates = [];
    const today = new Date();
    for (let i = -7; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const dateButtons = generateDateButtons();

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
              <div className="text-sm font-bold text-[#006837] leading-tight">AGENDA KEGIATAN</div>
              <div className="text-xs text-slate-600">{data?.school_name || 'MTsN 2 Kota Malang'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-base sm:text-lg font-bold text-slate-900">
                {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} WIB
              </div>
              <div className="text-xs text-slate-500">{now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
            </div>
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200">
                  <Calendar className="h-3 w-3 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-700">{user.full_name}</span>
                </div>
                <Link to="/dashboard">
                  <Button variant="outline" size="sm" className="gap-2">
                    <LayoutDashboard className="h-4 w-4" /> <span className="hidden sm:inline">Dashboard</span>
                  </Button>
                </Link>
              </div>
            ) : (
              <Link to="/login">
                <Button variant="outline" size="sm" className="gap-2">
                  <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">Login</span>
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <div className="border-t border-slate-200 bg-white/95">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex items-center gap-1 overflow-x-auto py-2">
              <Link to="/public/monitoring" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-colors whitespace-nowrap">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                Monitoring Jurnal
              </Link>
              <Link to="/public/prestasi" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-amber-50 hover:text-amber-700 transition-colors whitespace-nowrap">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Prestasi
              </Link>
              <Link to="/public/agenda" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-purple-50 text-purple-700 font-semibold transition-colors whitespace-nowrap">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Agenda
              </Link>
              <Link to="/public/rkam" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors whitespace-nowrap">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                RKAM & Keuangan
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Title */}
        <div className="mb-6">
          <Badge className="bg-emerald-100 text-emerald-900 border border-emerald-200 mb-2">
            <CalendarDays className="h-3 w-3 mr-1" /> Transparansi Publik
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Agenda Kegiatan Madrasah
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Informasi kegiatan madrasah dan agenda pegawai {data?.school_name || 'MTsN 2 Kota Malang'}
          </p>
        </div>

        <Tabs defaultValue="madrasah" className="w-full">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <TabsList>
              <TabsTrigger value="madrasah" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Kegiatan Madrasah
              </TabsTrigger>
              <TabsTrigger value="staff" className="gap-2">
                <Briefcase className="h-4 w-4" />
                Kegiatan Pegawai
              </TabsTrigger>
            </TabsList>

            <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
          </div>

          {/* Kegiatan Madrasah Tab */}
          <TabsContent value="madrasah" className="mt-0">
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-4 bg-white rounded-lg border border-slate-200 p-3">
              <Button variant="ghost" size="sm" onClick={goToPrevMonth}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Bulan Sebelumnya
              </Button>
              <div className="text-center">
                <div className="text-lg font-bold text-[#006837]">
                  {MONTH_LABELS[currentMonth]} {currentYear}
                </div>
                <div className="text-xs text-slate-500">
                  Menampilkan {madrasahEvents.length} dari {pagination.total} kegiatan
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={goToNextMonth}>
                Bulan Berikutnya
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            {/* Events List */}
            {loading ? (
              <div className="text-center py-12 text-slate-500">Memuat data...</div>
            ) : madrasahEvents.length === 0 ? (
              <Card className="surface-ivory">
                <CardContent className="py-12 text-center">
                  <CalendarDays className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <div className="text-slate-700 font-semibold">Tidak ada kegiatan</div>
                  <div className="text-sm text-slate-500 mt-1">
                    Belum ada kegiatan terjadwal untuk bulan ini
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="space-y-3">
                  {madrasahEvents.map((event, idx) => (
                    <MadrasahEventCard key={event.id || idx} event={event} />
                  ))}
                </div>

                {/* Pagination */}
                {pagination.total_pages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: pagination.total_pages }, (_, i) => i + 1).map(p => (
                        <Button
                          key={p}
                          variant={p === currentPage ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(p)}
                          className={p === currentPage ? 'bg-[#006837] hover:bg-[#0B7A3B]' : ''}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(pagination.total_pages, p + 1))}
                      disabled={currentPage === pagination.total_pages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* Kegiatan Pegawai Tab */}
          <TabsContent value="staff" className="mt-0">
            {/* Date Selector */}
            <div className="mb-4 bg-white rounded-lg border border-slate-200 p-3">
              <div className="text-sm font-semibold text-slate-700 mb-3">Pilih Tanggal:</div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dateButtons.map(d => {
                  const date = new Date(d + 'T00:00:00');
                  const isSelected = d === selectedDate;
                  const isToday = d === new Date().toISOString().split('T')[0];

                  return (
                    <button
                      key={d}
                      onClick={() => {
                        setSelectedDate(d);
                        setStaffPage(1); // Reset to page 1 when changing date
                      }}
                      className={`flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-lg border-2 transition-all ${
                        isSelected
                          ? 'bg-[#006837] border-[#006837] text-white'
                          : isToday
                          ? 'bg-amber-50 border-amber-300 text-amber-900'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-medium uppercase">
                        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'][date.getDay()]}
                      </div>
                      <div className="text-lg font-bold">{date.getDate()}</div>
                      <div className="text-[10px]">{MONTH_LABELS[date.getMonth() + 1].substring(0, 3)}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Staff Events List */}
            {loading ? (
              <div className="text-center py-12 text-slate-500">Memuat data...</div>
            ) : filteredStaffEvents.length === 0 ? (
              <Card className="surface-ivory">
                <CardContent className="py-12 text-center">
                  <Briefcase className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <div className="text-slate-700 font-semibold">Tidak ada kegiatan pegawai</div>
                  <div className="text-sm text-slate-500 mt-1">
                    Tidak ada kegiatan pegawai untuk tanggal {new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Info showing current range */}
                <div className="text-sm text-slate-600 mb-3">
                  Menampilkan {staffStartIndex + 1}-{Math.min(staffEndIndex, totalStaffEvents)} dari {totalStaffEvents} kegiatan
                </div>

                <div className="space-y-3">
                  {paginatedStaffEvents.map((event, idx) => (
                    <StaffEventCard key={event.id || idx} event={event} now={now} />
                  ))}
                </div>

                {/* Pagination */}
                {totalStaffPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStaffPage(p => Math.max(1, p - 1))}
                      disabled={staffPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalStaffPages }, (_, i) => i + 1).map(p => (
                        <Button
                          key={p}
                          variant={p === staffPage ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setStaffPage(p)}
                          className={p === staffPage ? 'bg-[#006837] hover:bg-[#0B7A3B]' : ''}
                        >
                          {p}
                        </Button>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setStaffPage(p => Math.min(totalStaffPages, p + 1))}
                      disabled={staffPage === totalStaffPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <div className="text-center text-xs text-slate-500 mt-8">
          Data diperbarui otomatis setiap {REFRESH_INTERVAL / 1000} detik
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

function MadrasahEventCard({ event }) {
  const date = event.date ? new Date(event.date + 'T00:00:00') : null;
  const dayName = date ? ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][date.getDay()] : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        {/* Date Badge */}
        <div className="flex flex-col items-center justify-center w-16 h-16 rounded-lg bg-gradient-to-br from-[#006837] to-[#0B7A3B] text-white shrink-0">
          <div className="text-2xl font-extrabold leading-none">
            {date ? date.getDate() : '-'}
          </div>
          <div className="text-[10px] uppercase font-semibold opacity-90">
            {date ? MONTH_LABELS[date.getMonth() + 1].substring(0, 3) : ''}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-bold text-slate-900 text-lg leading-tight">{event.name}</h3>
            {date && (
              <Badge className="bg-slate-100 text-slate-700 text-xs shrink-0">
                {dayName}
              </Badge>
            )}
          </div>

          {event.description && (
            <p className="text-sm text-slate-600 mb-3">{event.description}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="h-4 w-4 text-[#006837]" />
              <span className="font-medium">{event.start_time} - {event.end_time} WIB</span>
            </div>

            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="h-4 w-4 text-[#006837]" />
              <span>{event.location}</span>
            </div>

            <div className="flex items-center gap-2 text-slate-600">
              <Users className="h-4 w-4 text-[#006837]" />
              <span>{event.participants_count} Peserta</span>
            </div>

            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="h-4 w-4 text-[#006837]" />
              <span>
                {date ? date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : event.date}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StaffEventCard({ event, now }) {
  // Calculate status in real-time on the client side
  const calculateStatus = () => {
    const eventDate = event.date;
    const startTime = event.start_time || '00:00';
    const endTime = event.end_time || '23:59';

    try {
      const eventStart = new Date(`${eventDate}T${startTime}:00`);
      const eventEnd = new Date(`${eventDate}T${endTime}:00`);

      if (now < eventStart) {
        return 'upcoming';
      } else if (now >= eventStart && now <= eventEnd) {
        return 'ongoing';
      } else {
        return 'completed';
      }
    } catch (e) {
      return 'upcoming';
    }
  };

  const currentStatus = calculateStatus();
  const statusConfig = STATUS_COLORS[currentStatus] || STATUS_COLORS.upcoming;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white rounded-lg border border-slate-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        {/* Status Badge */}
        <div className={`flex items-center justify-center w-16 h-16 rounded-lg ${statusConfig.bg} border-2 ${statusConfig.border} shrink-0`}>
          <Clock className={`h-8 w-8 ${statusConfig.text}`} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h3 className="font-bold text-slate-900 text-lg leading-tight">{event.event_name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={`${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border} text-xs`}>
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
          </div>

          {event.description && (
            <p className="text-sm text-slate-600 mb-3">{event.description}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 text-slate-700">
              <User className="h-4 w-4 text-[#006837]" />
              <div>
                <span className="font-semibold">{event.user_name || '-'}</span>
                {event.nip && <span className="text-xs text-slate-500 ml-1">({event.nip})</span>}
              </div>
            </div>

            <div className="flex items-center gap-2 text-slate-600">
              <Briefcase className="h-4 w-4 text-[#006837]" />
              <span>{event.jabatan || '-'}</span>
            </div>

            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="h-4 w-4 text-[#006837]" />
              <span className="font-medium">{event.start_time} - {event.end_time} WIB</span>
            </div>

            {event.location && (
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="h-4 w-4 text-[#006837]" />
                <span>{event.location}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
