import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Award, Medal, Star, Search, User, Calendar, Target } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const LEVEL_ICONS = {
  'sekolah': { icon: Target, color: 'text-slate-600', bg: 'bg-slate-50' },
  'kecamatan': { icon: Target, color: 'text-blue-600', bg: 'bg-blue-50' },
  'kab_kota': { icon: Award, color: 'text-green-600', bg: 'bg-green-50' },
  'kabupaten': { icon: Award, color: 'text-green-600', bg: 'bg-green-50' },
  'kota': { icon: Award, color: 'text-green-600', bg: 'bg-green-50' },
  'provinsi': { icon: Medal, color: 'text-amber-600', bg: 'bg-amber-50' },
  'nasional': { icon: Trophy, color: 'text-rose-600', bg: 'bg-rose-50' },
  'internasional': { icon: Star, color: 'text-purple-600', bg: 'bg-purple-50' },
};

const LEVEL_LABELS = {
  'sekolah': 'Sekolah',
  'kecamatan': 'Kecamatan',
  'kab_kota': 'Kab/Kota',
  'kabupaten': 'Kabupaten',
  'kota': 'Kota',
  'provinsi': 'Provinsi',
  'nasional': 'Nasional',
  'internasional': 'Internasional',
};

const HOLDER_TYPE_LABELS = {
  'siswa': 'Siswa',
  'guru': 'Guru',
  'tendik': 'Tendik',
  'madrasah': 'Madrasah',
};

export default function WakaKurPrestasiPage() {
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterHolderType, setFilterHolderType] = useState('all');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchData();
    fetchStats();
  }, [filterYear, filterLevel, filterHolderType]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params = { only_verified: false };
      if (filterYear !== 'all') params.year = parseInt(filterYear);
      if (filterLevel !== 'all') params.level = filterLevel;
      if (filterHolderType !== 'all') params.holder_type = filterHolderType;

      const { data } = await api.get('/achievements', { params });
      setAchievements(data);
    } catch (e) {
      toast.error('Gagal memuat data prestasi');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data } = await api.get('/wakakur/stats/achievements');
      setStats(data);
    } catch (e) {
      console.error('Error fetching stats:', e);
    }
  };

  const filtered = achievements.filter((a) => {
    if (search) {
      const s = search.toLowerCase();
      return (
        (a.title || '').toLowerCase().includes(s) ||
        (a.student_name || '').toLowerCase().includes(s) ||
        (a.teacher_name || '').toLowerCase().includes(s) ||
        (a.organizer || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const years = [...new Set(achievements.map(a => a.year).filter(Boolean))].sort((a, b) => b - a);

  const clearFilters = () => {
    setFilterYear('all');
    setFilterLevel('all');
    setFilterHolderType('all');
    setSearch('');
  };

  const getLevelIcon = (level) => {
    const config = LEVEL_ICONS[level] || LEVEL_ICONS['sekolah'];
    const Icon = config.icon;
    return { Icon, ...config };
  };

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <Trophy className="h-3 w-3 mr-1" /> Prestasi (Waka Kurikulum)
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold">Prestasi Siswa & GTK</h1>
        <p className="text-sm text-slate-600 mt-1">
          {filtered.length} prestasi (Read-Only)
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">Total Prestasi</div>
              <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">Terverifikasi</div>
              <div className="text-2xl font-bold text-green-600">{stats.verified}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">Nasional</div>
              <div className="text-2xl font-bold text-rose-600">{stats.nasional || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-500">Internasional</div>
              <div className="text-2xl font-bold text-purple-600">{stats.internasional || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Cari judul, nama, penyelenggara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger><SelectValue placeholder="Semua Tahun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tahun</SelectItem>
                {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger><SelectValue placeholder="Semua Tingkat" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tingkat</SelectItem>
                {Object.entries(LEVEL_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterHolderType} onValueChange={setFilterHolderType}>
              <SelectTrigger><SelectValue placeholder="Semua Pemilik" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Pemilik</SelectItem>
                {Object.entries(HOLDER_TYPE_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(search || filterYear !== 'all' || filterLevel !== 'all' || filterHolderType !== 'all') && (
            <Button variant="outline" size="sm" onClick={clearFilters} className="mt-3">
              Clear Filter
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-slate-500">Memuat data...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <Trophy className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="font-medium">
                {search || filterYear !== 'all' || filterLevel !== 'all' || filterHolderType !== 'all'
                  ? 'Tidak ada prestasi yang sesuai filter'
                  : 'Belum ada data prestasi'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Judul Lomba</TableHead>
                    <TableHead>Pemilik</TableHead>
                    <TableHead>Tingkat</TableHead>
                    <TableHead>Peringkat</TableHead>
                    <TableHead>Penyelenggara</TableHead>
                    <TableHead>Tahun</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const { Icon, color, bg } = getLevelIcon(a.level);
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.title || '-'}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {a.student_name || a.teacher_name || '-'}
                            </span>
                            <Badge variant="outline" className="text-[10px] w-fit mt-1">
                              {HOLDER_TYPE_LABELS[a.holder_type] || a.holder_type}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-2 px-2 py-1 rounded-lg ${bg} w-fit`}>
                            <Icon className={`h-4 w-4 ${color}`} />
                            <span className={`text-xs font-semibold ${color}`}>
                              {LEVEL_LABELS[a.level] || a.level}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{a.rank || '-'}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {a.organizer || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {a.year || '-'}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {a.is_verified ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              Terverifikasi
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Belum</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
