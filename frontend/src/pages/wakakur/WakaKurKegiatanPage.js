import React, { useEffect, useState } from 'react';
import { Calendar, CalendarDays, Clock, MapPin, Users, Search, Filter, X, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';

const MONTH_LABELS = {
  1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April',
  5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus',
  9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember',
};

export default function WakaKurKegiatanPage() {
  const [events, setEvents] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Set default filter to current month and year
  const now = new Date();
  const [filterYear, setFilterYear] = useState(now.getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState((now.getMonth() + 1).toString());

  useEffect(() => {
    fetchEvents();
    fetchStats();
  }, [filterYear, filterMonth]);

  const fetchEvents = async () => {
    try {
      const params = {};
      if (filterYear) params.year = parseInt(filterYear);
      if (filterMonth) params.month = parseInt(filterMonth);

      const { data } = await api.get('/madrasah-events', { params });
      setEvents(data);
    } catch (e) {
      toast.error('Gagal memuat data kegiatan');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = {};
      if (filterYear) params.year = parseInt(filterYear);
      if (filterMonth) params.month = parseInt(filterMonth);

      const { data } = await api.get('/madrasah-events/stats/duration', { params });
      setStats(data);
    } catch (e) {
      console.error('Failed to load stats', e);
    }
  };

  const clearFilters = () => {
    setFilterYear('');
    setFilterMonth('');
    setSearchQuery('');
  };

  const filteredEvents = events.filter(e => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.name?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.location?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const availableYears = [...new Set(events.map(e => e.date?.substring(0, 4)))].sort((a, b) => b - a);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
              <Calendar className="h-3 w-3 mr-1" /> Kegiatan Madrasah (Waka Kurikulum)
            </Badge>
            <h1 className="text-3xl font-bold text-slate-900">Kegiatan Madrasah</h1>
            <p className="text-sm text-slate-600 mt-1">
              Lihat kegiatan dan acara madrasah (Read-Only)
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Cari</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Cari kegiatan..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Tahun</Label>
                <Select value={filterYear || undefined} onValueChange={(v) => setFilterYear(v === 'all' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Tahun</SelectItem>
                    {availableYears.map(y => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Bulan</Label>
                <Select value={filterMonth || undefined} onValueChange={(v) => setFilterMonth(v === 'all' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Bulan</SelectItem>
                    {Object.entries(MONTH_LABELS).map(([num, label]) => (
                      <SelectItem key={num} value={num}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters} className="w-full gap-2">
                  <X className="h-4 w-4" />
                  Clear Filter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statistics Widget */}
      {stats && stats.total_events > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Rata-rata Durasi</p>
                  <p className="text-lg font-bold text-slate-900">{stats.avg_duration_days} Hari</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50">
                  <Clock className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Rata-rata Jam/Hari</p>
                  <p className="text-lg font-bold text-slate-900">{stats.avg_duration_hours} Jam</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50">
                  <Calendar className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Multi-Hari</p>
                  <p className="text-lg font-bold text-slate-900">{stats.multi_day_count} Kegiatan</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50">
                  <Calendar className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Single-Hari</p>
                  <p className="text-lg font-bold text-slate-900">{stats.single_day_count} Kegiatan</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Events List */}
      {loading ? (
        <div className="text-center py-12">Memuat data...</div>
      ) : filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <div className="text-slate-700 font-semibold">Tidak ada kegiatan</div>
            <div className="text-sm text-slate-500 mt-1">
              {searchQuery || filterYear || filterMonth
                ? 'Tidak ada kegiatan sesuai filter'
                : 'Belum ada kegiatan yang ditambahkan'}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredEvents.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ event }) {
  const startDate = event.date ? new Date(event.date + 'T00:00:00') : null;
  const endDate = event.end_date ? new Date(event.end_date + 'T00:00:00') : null;
  const displayDate = startDate;
  const dayName = displayDate ? ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][displayDate.getDay()] : '';

  // Check if it's a multi-day event
  const isMultiDay = endDate && startDate && endDate.getTime() !== startDate.getTime();

  // Format date range string
  const getDateRangeText = () => {
    if (!startDate) return '';
    if (!isMultiDay) {
      return `${dayName}, ${startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
    // Multi-day format
    return `${startDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Date Badge */}
          <div className="flex flex-col items-center justify-center w-16 h-16 rounded-lg bg-gradient-to-br from-[#006837] to-[#0B7A3B] text-white shrink-0">
            <div className="text-2xl font-extrabold leading-none">
              {displayDate ? displayDate.getDate() : '-'}
            </div>
            <div className="text-[10px] uppercase font-semibold opacity-90">
              {displayDate ? MONTH_LABELS[displayDate.getMonth() + 1].substring(0, 3) : ''}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h3 className="font-bold text-slate-900 text-lg leading-tight">{event.name}</h3>
                {displayDate && (
                  <Badge className="bg-slate-100 text-slate-700 text-xs mt-1">
                    {getDateRangeText()}
                  </Badge>
                )}
              </div>
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

              {event.created_by_name && (
                <div className="text-xs text-slate-500">
                  Dibuat oleh: {event.created_by_name}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
