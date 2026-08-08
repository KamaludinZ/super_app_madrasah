import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Award, Medal, Star, Calendar, User, Users, School, Target, RefreshCw, LogIn, Filter, X, LayoutDashboard, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import PublicFooter from '@/components/layout/PublicFooter';
import axios from 'axios';

const REFRESH_INTERVAL = 30000; // 30s
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

const LEVEL_ICONS = {
  'Kabupaten/Kota': { icon: Award, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  'Provinsi': { icon: Medal, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  'Nasional': { icon: Trophy, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
  'Internasional': { icon: Star, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
};

const HOLDER_TYPE_LABELS = {
  'siswa': 'Siswa',
  'guru': 'Guru',
  'tendik': 'Tendik',
  'madrasah': 'Madrasah',
};

export default function PublicPrestasi() {
  const { user } = useAuth();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState('all');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterHolderType, setFilterHolderType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [now, setNow] = useState(new Date());

  // Sorting and pagination state
  const [sortColumn, setSortColumn] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchData = async () => {
    try {
      const params = {};
      if (filterYear !== 'all') params.year = parseInt(filterYear);
      if (filterLevel !== 'all') params.level = filterLevel;
      if (filterHolderType !== 'all') params.holder_type = filterHolderType;

      const { data } = await axios.get(`${BACKEND_URL}/api/public/achievements`, { params });
      setData(data);
    } catch (e) {
      console.error('Error fetching achievements:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, REFRESH_INTERVAL);
    const t2 = setInterval(() => setNow(new Date()), 1000);
    return () => { clearInterval(t); clearInterval(t2); };
  }, [filterYear, filterLevel, filterHolderType]);

  const stats = data?.stats || { total: 0, by_level: {}, by_holder_type: {}, by_year: {} };
  const achievements = data?.achievements || [];

  const availableYears = Object.keys(stats.by_year || {}).sort((a, b) => b - a);

  const clearFilters = () => {
    setFilterYear('all');
    setFilterLevel('all');
    setFilterHolderType('all');
  };

  const hasActiveFilters = filterYear !== 'all' || filterLevel !== 'all' || filterHolderType !== 'all';

  // Handle sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  // Sort achievements
  const sortedAchievements = [...achievements].sort((a, b) => {
    let aVal, bVal;

    switch (sortColumn) {
      case 'date':
        aVal = a.date || a.year || '';
        bVal = b.date || b.year || '';
        break;
      case 'title':
        aVal = (a.title || '').toLowerCase();
        bVal = (b.title || '').toLowerCase();
        break;
      case 'level':
        const levelOrder = ['Kabupaten/Kota', 'Provinsi', 'Nasional', 'Internasional'];
        aVal = levelOrder.indexOf(a.level || '');
        bVal = levelOrder.indexOf(b.level || '');
        break;
      case 'holder':
        aVal = (a.student_name || a.teacher_name || '').toLowerCase();
        bVal = (b.student_name || b.teacher_name || '').toLowerCase();
        break;
      case 'rank':
        aVal = a.rank || '';
        bVal = b.rank || '';
        break;
      default:
        return 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedAchievements.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAchievements = sortedAchievements.slice(startIndex, endIndex);

  // Reset to first page when items per page changes
  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(parseInt(value));
    setCurrentPage(1);
  };

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
              <div className="text-sm font-bold text-[#006837] leading-tight">PRESTASI MADRASAH</div>
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
                  <User className="h-3 w-3 text-blue-600" />
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
              <Link to="/public/prestasi" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-amber-50 text-amber-700 font-semibold transition-colors whitespace-nowrap">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Prestasi
              </Link>
              <Link to="/public/agenda" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-purple-50 hover:text-purple-700 transition-colors whitespace-nowrap">
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
          <Badge className="bg-amber-100 text-amber-900 border border-amber-200 mb-2">
            <Trophy className="h-3 w-3 mr-1" /> Transparansi Publik
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Prestasi & Penghargaan
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Koleksi prestasi dan penghargaan yang diraih oleh {data?.school_name || 'MTsN 2 Kota Malang'}
          </p>
        </div>

        {/* Stats by Level */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {/* Total Prestasi */}
          <div className="rounded-xl border p-3 bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wide">Total Prestasi</span>
              <Target className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-2xl font-extrabold tabular-nums">{stats.total || 0}</div>
          </div>

          {/* Stats by Level */}
          {Object.entries(LEVEL_ICONS).map(([level, config]) => {
            const Icon = config.icon;
            const count = stats.by_level[level] || 0;
            return (
              <div key={level} className={`rounded-xl border p-3 ${config.bg} ${config.border}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide">{level}</span>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="text-2xl font-extrabold tabular-nums">{count}</div>
              </div>
            );
          })}
        </div>

        {/* Stats by Holder Type */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {Object.entries(HOLDER_TYPE_LABELS).map(([type, label]) => {
            const count = stats.by_holder_type[type] || 0;
            const icons = {
              siswa: User,
              guru: Users,
              tendik: Users,
              madrasah: School,
            };
            const Icon = icons[type];
            return (
              <div key={type} className="rounded-xl border p-3 bg-slate-50 border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
                  <Icon className="h-4 w-4 text-slate-600" />
                </div>
                <div className="text-2xl font-extrabold tabular-nums">{count}</div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className={hasActiveFilters ? 'border-[#006837] text-[#006837]' : ''}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter {hasActiveFilters && `(${[filterYear !== 'all', filterLevel !== 'all', filterHolderType !== 'all'].filter(Boolean).length})`}
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">Filter Prestasi</h3>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Hapus Filter
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Tahun</Label>
                  <Select value={filterYear} onValueChange={setFilterYear}>
                    <SelectTrigger className="text-sm">
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
                  <Label className="text-xs">Tingkat</Label>
                  <Select value={filterLevel} onValueChange={setFilterLevel}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Semua Tingkat" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Tingkat</SelectItem>
                      {Object.keys(LEVEL_ICONS).map(lvl => (
                        <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Penerima</Label>
                  <Select value={filterHolderType} onValueChange={setFilterHolderType}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Semua Penerima" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Penerima</SelectItem>
                      {Object.entries(HOLDER_TYPE_LABELS).map(([type, label]) => (
                        <SelectItem key={type} value={type}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-12 text-slate-500">Memuat data...</div>
        ) : achievements.length === 0 ? (
          <Card className="surface-ivory">
            <CardContent className="py-12 text-center">
              <Trophy className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <div className="text-slate-700 font-semibold">Tidak ada prestasi</div>
              <div className="text-sm text-slate-500 mt-1">
                {hasActiveFilters ? 'Tidak ada prestasi sesuai filter yang dipilih' : 'Belum ada prestasi yang diverifikasi'}
              </div>
              {hasActiveFilters && (
                <Button variant="link" onClick={clearFilters} className="mt-2">
                  Hapus filter
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Items per page selector */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-slate-600">Tampilkan:</Label>
                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                  <SelectTrigger className="w-20 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-slate-600">per halaman</span>
              </div>
              <div className="text-sm text-slate-600">
                Menampilkan {startIndex + 1}-{Math.min(endIndex, sortedAchievements.length)} dari {sortedAchievements.length} prestasi
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">No</TableHead>
                        <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('date')}>
                          <div className="flex items-center gap-1">
                            Tahun
                            {sortColumn === 'date' ? (
                              sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                            ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('title')}>
                          <div className="flex items-center gap-1">
                            Nama Lomba
                            {sortColumn === 'title' ? (
                              sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                            ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </div>
                        </TableHead>
                        <TableHead>Bidang Lomba</TableHead>
                        <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('holder')}>
                          <div className="flex items-center gap-1">
                            Pemegang
                            {sortColumn === 'holder' ? (
                              sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                            ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </div>
                        </TableHead>
                        <TableHead>Penyelenggara</TableHead>
                        <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('level')}>
                          <div className="flex items-center gap-1">
                            Tingkat Lomba
                            {sortColumn === 'level' ? (
                              sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                            ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </div>
                        </TableHead>
                        <TableHead className="cursor-pointer hover:bg-slate-50" onClick={() => handleSort('rank')}>
                          <div className="flex items-center gap-1">
                            Peringkat
                            {sortColumn === 'rank' ? (
                              sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                            ) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                          </div>
                        </TableHead>
                        <TableHead>Kategori Lomba</TableHead>
                        <TableHead>Kategori Penerima</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedAchievements.map((achievement, idx) => {
                        const levelConfig = LEVEL_ICONS[achievement.level] || { icon: Award, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
                        const Icon = levelConfig.icon;
                        const rowNumber = startIndex + idx + 1;

                        return (
                          <TableRow key={achievement.id || idx}>
                            <TableCell className="text-center text-sm text-slate-600">
                              {rowNumber}
                            </TableCell>
                            <TableCell className="font-mono text-sm whitespace-nowrap">
                              {achievement.year || (achievement.date ? new Date(achievement.date).getFullYear() : '-')}
                            </TableCell>
                            <TableCell className="font-semibold">
                              {achievement.title || '-'}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {achievement.field || '-'}
                            </TableCell>
                            <TableCell>
                              {achievement.student_name && (
                                <div>
                                  {achievement.student_name}
                                  {achievement.student_nisn && (
                                    <span className="text-xs text-slate-500 ml-1">({achievement.student_nisn})</span>
                                  )}
                                </div>
                              )}
                              {achievement.teacher_name && !achievement.student_name && (
                                <div>{achievement.teacher_name}</div>
                              )}
                              {achievement.holder_type === 'madrasah' && (
                                <Badge variant="outline" className="text-[#006837] border-[#006837]">Madrasah</Badge>
                              )}
                              {!achievement.student_name && !achievement.teacher_name && achievement.holder_type !== 'madrasah' && '-'}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {achievement.organizer || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${levelConfig.bg} ${levelConfig.color} border-0 gap-1`}>
                                <Icon className="h-3 w-3" />
                                {achievement.level}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {achievement.rank ? (
                                <Badge className="bg-amber-500 text-white">{achievement.rank}</Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-sm text-slate-600">
                              {achievement.competition_category || '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              <Badge variant="outline" className={
                                achievement.holder_type === 'siswa' ? 'text-blue-700 border-blue-300 bg-blue-50' :
                                achievement.holder_type === 'guru' ? 'text-green-700 border-green-300 bg-green-50' :
                                achievement.holder_type === 'tendik' ? 'text-purple-700 border-purple-300 bg-purple-50' :
                                achievement.holder_type === 'madrasah' ? 'text-[#006837] border-[#006837] bg-green-50' : ''
                              }>
                                {HOLDER_TYPE_LABELS[achievement.holder_type] || '-'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                    // Show first page, last page, current page, and pages around current
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-10"
                        >
                          {page}
                        </Button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="px-1">...</span>;
                    }
                    return null;
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}

        <div className="text-center text-xs text-slate-500 mt-8">
          Data diperbarui otomatis setiap {REFRESH_INTERVAL / 1000} detik &middot; Total Prestasi: {stats.total}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

function AchievementCard({ achievement }) {
  const levelConfig = LEVEL_ICONS[achievement.level] || { icon: Award, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
  const Icon = levelConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="relative rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`flex items-center justify-center h-12 w-12 rounded-full ${levelConfig.bg} ${levelConfig.border} border shrink-0`}>
          <Icon className={`h-6 w-6 ${levelConfig.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <Badge className={`text-[10px] mb-1 ${levelConfig.bg} ${levelConfig.color} border-0`}>
            {achievement.level}
          </Badge>
          <h3 className="font-bold text-slate-900 leading-tight line-clamp-2">{achievement.title}</h3>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {achievement.competition_name && (
          <div className="text-slate-600">
            <span className="font-semibold">Lomba:</span> {achievement.competition_name}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="h-3 w-3" />
          <span>{achievement.date ? new Date(achievement.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : `Tahun ${achievement.year}`}</span>
        </div>

        {(achievement.student_name || achievement.teacher_name || achievement.holder_type === 'madrasah' || achievement.holder_type === 'tendik') && (
          <div className="pt-2 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-500 mb-1">Penerima:</div>
            {achievement.student_name && (
              <div className="text-sm text-slate-900">
                {achievement.student_name}
                {achievement.student_nisn && <span className="text-xs text-slate-500 ml-1">({achievement.student_nisn})</span>}
              </div>
            )}
            {achievement.teacher_name && (
              <div className="text-sm text-slate-900">{achievement.teacher_name}</div>
            )}
            {achievement.holder_type === 'madrasah' && (
              <div className="text-sm font-semibold text-[#006837]">Prestasi Madrasah</div>
            )}
            {achievement.holder_type === 'tendik' && achievement.teacher_name && (
              <div className="text-xs text-slate-600">Tenaga Kependidikan</div>
            )}
          </div>
        )}

        {achievement.description && (
          <div className="text-xs text-slate-600 line-clamp-2 pt-2 border-t border-slate-100">
            {achievement.description}
          </div>
        )}
      </div>

      {achievement.rank && (
        <div className="absolute top-3 right-3">
          <Badge className="bg-amber-500 text-white font-bold">
            {achievement.rank}
          </Badge>
        </div>
      )}
    </motion.div>
  );
}
