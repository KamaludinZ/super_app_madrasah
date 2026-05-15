import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles, TrendingUp, Star, Calendar, Filter, X } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const CONDITION_OPTIONS = [
  { value: 'bersih', label: 'Bersih', color: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
  { value: 'cukup', label: 'Cukup', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { value: 'kotor', label: 'Kotor', color: 'bg-rose-100 text-rose-700 border-rose-300' },
];

export default function AdminKebersihanPage() {
  const [allData, setAllData] = useState([]);
  const [data, setData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [filterClass, setFilterClass] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [allData, filterClass, filterStartDate, filterEndDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recapRes, classesRes] = await Promise.all([
        api.get('/cleanliness/admin/recap'),
        api.get('/classes'),
      ]);
      setAllData(recapRes.data);
      setData(recapRes.data);
      setClasses(classesRes.data);
    } catch (e) {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allData];

    // Filter by class
    if (filterClass) {
      filtered = filtered.filter((item) => item.class.id === filterClass);
    }

    // Filter by date range (check if latest record is within range)
    if (filterStartDate || filterEndDate) {
      filtered = filtered.filter((item) => {
        if (!item.latest || !item.latest.date) return false;

        const recordDate = new Date(item.latest.date);

        if (filterStartDate) {
          const startDate = new Date(filterStartDate);
          if (recordDate < startDate) return false;
        }

        if (filterEndDate) {
          const endDate = new Date(filterEndDate);
          if (recordDate > endDate) return false;
        }

        return true;
      });
    }

    setData(filtered);
  };

  const resetFilters = () => {
    setFilterClass('');
    setFilterStartDate('');
    setFilterEndDate('');
  };

  const hasActiveFilters = filterClass || filterStartDate || filterEndDate;

  const getConditionBadge = (condition) => {
    const opt = CONDITION_OPTIONS.find((o) => o.value === condition) || CONDITION_OPTIONS[0];
    return <Badge className={opt.color}>{opt.label}</Badge>;
  };

  const getRatingStars = (rating) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`h-4 w-4 ${rating >= n ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <Sparkles className="h-3 w-3 mr-1" /> Rekapitulasi Kebersihan
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Rekapitulasi Kebersihan Kelas</h1>
        <p className="text-sm text-slate-600 mt-1">
          Ringkasan penilaian kebersihan semua kelas (7 hari terakhir)
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Filter className="h-4 w-4" />
              <span>Filter Data</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Class Filter */}
              <div>
                <Label className="text-xs">Kelas</Label>
                <Select value={filterClass || undefined} onValueChange={(val) => setFilterClass(val || '')}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Semua Kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date Filter */}
              <div>
                <Label className="text-xs">Dari Tanggal</Label>
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* End Date Filter */}
              <div>
                <Label className="text-xs">Sampai Tanggal</Label>
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={resetFilters}
                  className="gap-2"
                >
                  <X className="h-3.5 w-3.5" />
                  Reset Filter
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      {hasActiveFilters && (
        <div className="text-sm text-slate-600">
          Menampilkan {data.length} dari {allData.length} kelas
        </div>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            Memuat data...
          </CardContent>
        </Card>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-slate-500">
            Belum ada data kebersihan
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((item) => (
            <Card key={item.class.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5 space-y-3">
                {/* Class Name */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900">{item.class.name}</h3>
                  {item.latest && getConditionBadge(item.latest.condition)}
                </div>

                {/* Latest Record */}
                {item.latest ? (
                  <div className="space-y-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-slate-500">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="font-mono">{item.latest.date}</span>
                      </div>
                      {getRatingStars(item.latest.rating)}
                    </div>
                    {item.latest.notes && (
                      <p className="text-xs text-slate-600 italic line-clamp-2">
                        "{item.latest.notes}"
                      </p>
                    )}
                    <div className="text-xs text-slate-500">
                      {item.latest.piket_students?.length || 0} siswa piket
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 py-2 border-b border-slate-100">
                    Belum ada catatan
                  </div>
                )}

                {/* 7-Day Stats */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <TrendingUp className="h-4 w-4 text-[#006837]" />
                    <span>Statistik 7 Hari</span>
                  </div>

                  {/* Average Rating */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">Rata-rata:</span>
                    <div className="flex items-center gap-2">
                      {getRatingStars(Math.round(item.avg_rating_7days))}
                      <span className="font-mono text-xs text-slate-500">
                        ({item.avg_rating_7days.toFixed(1)})
                      </span>
                    </div>
                  </div>

                  {/* Condition Count */}
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-1.5 text-center">
                      <div className="font-bold text-emerald-700">
                        {item.condition_count_7days.bersih}
                      </div>
                      <div className="text-emerald-600">Bersih</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-1.5 text-center">
                      <div className="font-bold text-amber-700">
                        {item.condition_count_7days.cukup}
                      </div>
                      <div className="text-amber-600">Cukup</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-1.5 text-center">
                      <div className="font-bold text-rose-700">
                        {item.condition_count_7days.kotor}
                      </div>
                      <div className="text-rose-600">Kotor</div>
                    </div>
                  </div>

                  {/* Total Records */}
                  <div className="text-xs text-slate-500 text-center pt-1">
                    Total catatan: {item.total_records}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
