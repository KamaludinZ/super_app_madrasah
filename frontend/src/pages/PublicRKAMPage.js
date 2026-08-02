import React, { useEffect, useState } from 'react';
import { FileText, Download, DollarSign, Calendar, TrendingUp, PieChart, BarChart3, LogIn, LayoutDashboard, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import axios from 'axios';
import PublicHeader from '@/components/layout/PublicHeader';
import PublicFooter from '@/components/layout/PublicFooter';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000/api';

const BIDANG_OPTIONS = [
  { value: 'sarana_prasarana', label: 'Sarana & Prasarana' },
  { value: 'humas', label: 'Humas' },
  { value: 'kesiswaan', label: 'Kesiswaan' },
  { value: 'kurikulum', label: 'Kurikulum' },
  { value: 'tata_usaha', label: 'Tata Usaha' },
];

export default function PublicRKAMPage() {
  const { user } = useAuth();
  const [budgetData, setBudgetData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [fiscalYear, setFiscalYear] = useState('');
  const [filterBidang, setFilterBidang] = useState('');
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [now, setNow] = useState(new Date());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const month = now.getMonth() + 1;
    const defaultFiscalYear = month >= 7 ? `${currentYear}/${currentYear + 1}` : `${currentYear - 1}/${currentYear}`;
    setFiscalYear(defaultFiscalYear);

    // Fetch settings for logo and school name
    fetchSettings();

    // Update clock
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API_BASE}/public/settings`);
      setSettings(res.data);
    } catch (e) {
      console.error('Error fetching settings:', e);
    }
  };

  useEffect(() => {
    if (fiscalYear) {
      fetchData();
    }
  }, [fiscalYear, filterBidang]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const budgetRes = await axios.get(`${API_BASE}/public/rkam/budget-summary`, {
        params: {
          fiscal_year: fiscalYear,
          bidang: filterBidang || undefined
        }
      });
      setBudgetData(budgetRes.data);

      const docsRes = await axios.get(`${API_BASE}/public/rkam/documents`, {
        params: { fiscal_year: fiscalYear }
      });
      setDocuments(docsRes.data);

      const years = new Set([fiscalYear]);
      budgetRes.data.categories?.forEach(cat => {
        cat.items?.forEach(item => {
          if (item.fiscal_year) years.add(item.fiscal_year);
        });
      });
      setAvailableYears([...years].sort((a, b) => b.localeCompare(a)));

      // Reset to first page when filters change
      setCurrentPage(1);

    } catch (error) {
      console.error('Error fetching RKAM data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Get BOS and KOMITE data
  const bosData = budgetData?.sumber_dana_groups?.find(g => g.sumber_dana === 'BOS') || {
    allocated: 0,
    realized: 0,
    remaining: 0
  };

  const komiteData = budgetData?.sumber_dana_groups?.find(g => g.sumber_dana === 'KOMITE') || {
    allocated: 0,
    realized: 0,
    remaining: 0
  };

  const bosPercentage = bosData.allocated > 0 ? (bosData.realized / bosData.allocated * 100) : 0;
  const komitePercentage = komiteData.allocated > 0 ? (komiteData.realized / komiteData.allocated * 100) : 0;

  // Flatten all items from categories for table display
  const allItems = budgetData?.categories?.flatMap(cat => cat.items || []) || [];

  // Pagination calculations
  const totalItems = allItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = allItems.slice(startIndex, endIndex);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Scroll to top of table
      window.scrollTo({ top: 600, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <div className="absolute inset-x-0 top-0 h-64 bg-hero-wash pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt="Logo" className="h-10 w-10 object-contain" />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-[#006837] flex items-center justify-center text-white font-bold">MS</div>
            )}
            <div>
              <div className="text-sm font-bold text-[#006837] leading-tight">TRANSPARANSI RKAM</div>
              <div className="text-xs text-slate-600">{settings?.school_name || 'MTsN 2 Kota Malang'}</div>
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
              <Link to="/public/prestasi" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-amber-50 hover:text-amber-700 transition-colors whitespace-nowrap">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                Prestasi
              </Link>
              <Link to="/public/agenda" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-purple-50 hover:text-purple-700 transition-colors whitespace-nowrap">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Agenda
              </Link>
              <Link to="/public/rkam" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-emerald-50 text-emerald-700 font-semibold transition-colors whitespace-nowrap">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                RKAM & Keuangan
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <Card className="mb-6 border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                  Tahun Anggaran
                </label>
                <Select value={fiscalYear} onValueChange={setFiscalYear}>
                  <SelectTrigger className="border-slate-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.length > 0 ? (
                      availableYears.map(year => (
                        <SelectItem key={year} value={year}>{year}</SelectItem>
                      ))
                    ) : (
                      <SelectItem value={fiscalYear}>{fiscalYear}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                  Filter Bidang
                </label>
                <Select value={filterBidang || undefined} onValueChange={(v) => setFilterBidang(v === 'all' ? '' : v)}>
                  <SelectTrigger className="border-slate-300">
                    <SelectValue placeholder="Semua Bidang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Bidang</SelectItem>
                    {BIDANG_OPTIONS.map((bidang) => (
                      <SelectItem key={bidang.value} value={bidang.value}>
                        {bidang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#006837] mx-auto"></div>
            <p className="text-slate-600 mt-4 font-medium">Memuat data...</p>
          </div>
        ) : (
          <>
            {/* Sumber Dana Cards with Progress - BOS & KOMITE */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* BOS Card */}
              <Card className="border-l-4 border-l-blue-600 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-slate-800">Dana BOS</CardTitle>
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                      {bosPercentage.toFixed(1)}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Anggaran</span>
                      <span className="font-bold text-slate-900">{formatRupiah(bosData.allocated)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Realisasi</span>
                      <span className="font-bold text-green-600">{formatRupiah(bosData.realized)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Sisa</span>
                      <span className="font-bold text-amber-600">{formatRupiah(bosData.remaining)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-medium text-slate-600">
                      <span>Progress Realisasi</span>
                      <span className="text-blue-600">{bosPercentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={bosPercentage} className="h-3 bg-slate-200" />
                  </div>
                </CardContent>
              </Card>

              {/* KOMITE Card */}
              <Card className="border-l-4 border-l-purple-600 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-slate-800">Dana KOMITE</CardTitle>
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                      {komitePercentage.toFixed(1)}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Anggaran</span>
                      <span className="font-bold text-slate-900">{formatRupiah(komiteData.allocated)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Realisasi</span>
                      <span className="font-bold text-green-600">{formatRupiah(komiteData.realized)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Sisa</span>
                      <span className="font-bold text-amber-600">{formatRupiah(komiteData.remaining)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-xs font-medium text-slate-600">
                      <span>Progress Realisasi</span>
                      <span className="text-purple-600">{komitePercentage.toFixed(1)}%</span>
                    </div>
                    <Progress value={komitePercentage} className="h-3 bg-slate-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Total Summary */}
            {budgetData && (
              <Card className="mb-6 border-[#006837] border-2 shadow-md">
                <CardHeader className="bg-gradient-to-r from-[#006837]/5 to-[#0B7A3B]/5">
                  <CardTitle className="text-xl font-bold text-[#006837] flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Total Keseluruhan
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
                    <div className="text-center">
                      <p className="text-sm text-slate-600 mb-1">Total Anggaran</p>
                      <p className="text-2xl font-bold text-slate-900">{formatRupiah(budgetData.total_allocated)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600 mb-1">Total Realisasi</p>
                      <p className="text-2xl font-bold text-green-600">{formatRupiah(budgetData.total_realized)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600 mb-1">Sisa Anggaran</p>
                      <p className="text-2xl font-bold text-amber-600">{formatRupiah(budgetData.total_remaining)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-700">Tingkat Serapan Anggaran</span>
                      <span className="text-lg font-bold text-[#006837]">{budgetData.percentage_realized.toFixed(2)}%</span>
                    </div>
                    <Progress value={budgetData.percentage_realized} className="h-4 bg-slate-200" />
                    <p className="text-xs text-slate-500 text-right">
                      Dari total anggaran {formatRupiah(budgetData.total_allocated)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rincian Anggaran Table */}
            <Card className="mb-6 shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-[#006837]" />
                      Rincian Anggaran
                    </CardTitle>
                    <p className="text-sm text-slate-600 mt-1">
                      Menampilkan {startIndex + 1}-{Math.min(endIndex, totalItems)} dari {totalItems} item anggaran
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {allItems.length > 0 ? (
                  <>
                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                              No
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                              Kode
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                              Nama Item
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                              Kategori
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                              Sumber Dana
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                              Anggaran
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                              Realisasi
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 uppercase tracking-wider">
                              Sisa
                            </th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 uppercase tracking-wider">
                              %
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {currentItems.map((item, idx) => {
                            const percentage = item.allocated > 0 ? (item.realized / item.allocated * 100) : 0;
                            const globalIdx = startIndex + idx + 1;

                            // Find category for this item
                            const category = budgetData?.categories?.find(cat =>
                              cat.items?.some(i => i.id === item.id)
                            );

                            return (
                              <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-sm text-slate-900">
                                  {globalIdx}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant="outline" className="font-mono text-xs">
                                    {item.code || '-'}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                  {item.name}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {category?.category || '-'}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className={
                                    item.sumber_dana === 'BOS'
                                      ? 'bg-blue-100 text-blue-700 border-blue-200'
                                      : 'bg-purple-100 text-purple-700 border-purple-200'
                                  }>
                                    {item.sumber_dana}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-right text-slate-900">
                                  {formatRupiah(item.allocated)}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-right text-green-600">
                                  {formatRupiah(item.realized)}
                                </td>
                                <td className="px-4 py-3 text-sm font-semibold text-right text-amber-600">
                                  {formatRupiah(item.remaining)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-xs font-bold ${
                                    percentage >= 80 ? 'text-green-600' :
                                    percentage >= 50 ? 'text-amber-600' :
                                    'text-slate-600'
                                  }`}>
                                    {percentage.toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-4 border-t border-slate-200 bg-slate-50">
                        <div className="text-sm text-slate-600">
                          Halaman <span className="font-semibold">{currentPage}</span> dari <span className="font-semibold">{totalPages}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="gap-1"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="hidden sm:inline">Sebelumnya</span>
                          </Button>

                          <div className="hidden sm:flex items-center gap-1">
                            {[...Array(totalPages)].map((_, idx) => {
                              const pageNum = idx + 1;
                              // Show first page, last page, current page, and pages around current
                              const showPage = pageNum === 1 ||
                                             pageNum === totalPages ||
                                             Math.abs(pageNum - currentPage) <= 1;

                              if (!showPage) {
                                if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                                  return <span key={pageNum} className="px-2 text-slate-400">...</span>;
                                }
                                return null;
                              }

                              return (
                                <Button
                                  key={pageNum}
                                  variant={pageNum === currentPage ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => handlePageChange(pageNum)}
                                  className="w-10"
                                >
                                  {pageNum}
                                </Button>
                              );
                            })}
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="gap-1"
                          >
                            <span className="hidden sm:inline">Selanjutnya</span>
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-12">
                    <div className="text-center">
                      <BarChart3 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-600 font-medium">Belum ada data anggaran untuk tahun {fiscalYear}</p>
                      <p className="text-sm text-slate-500 mt-1">Rincian anggaran akan ditampilkan di sini setelah data diinput</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents */}
            <Card className="shadow-md border-slate-200">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-[#006837]" />
                  Dokumen Transparansi
                </CardTitle>
                <p className="text-sm text-slate-600 mt-1">Arsip dokumen laporan keuangan dan RKAM</p>
              </CardHeader>
              <CardContent className="pt-6">
                {documents && documents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {documents.map((doc) => (
                      <Card key={doc.id} className="hover:shadow-lg transition-shadow border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="p-3 bg-[#006837]/10 rounded-lg shrink-0">
                              <FileText className="h-6 w-6 text-[#006837]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-slate-900 line-clamp-2 mb-2">
                                {doc.title}
                              </h4>
                              {doc.description && (
                                <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                                  {doc.description}
                                </p>
                              )}
                              <div className="flex items-center gap-2 flex-wrap mb-3">
                                <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 text-xs">
                                  {doc.document_type}
                                </Badge>
                                {doc.quarter && (
                                  <Badge variant="outline" className="text-xs">
                                    {doc.quarter}
                                  </Badge>
                                )}
                                <span className="text-xs text-slate-500">
                                  {formatDate(doc.upload_date)}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                className="w-full gap-2 bg-[#006837] hover:bg-[#0B7A3B]"
                                onClick={() => window.open(doc.file_url, '_blank')}
                              >
                                <Download className="h-4 w-4" />
                                Download Dokumen
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Belum ada dokumen untuk tahun {fiscalYear}</p>
                    <p className="text-sm text-slate-500 mt-1">Dokumen transparansi akan ditampilkan di sini</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
