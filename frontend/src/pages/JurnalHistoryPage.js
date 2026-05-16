import React, { useEffect, useState, useMemo } from 'react';
import { History, Calendar, Clock, BookOpen, Download, Filter, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

export default function JurnalHistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Filter states
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterQrMode, setFilterQrMode] = useState('all');

  useEffect(() => {
    api.get('/jurnal/my').then(({ data }) => setItems(data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Get unique classes and subjects for filter
  const uniqueClasses = useMemo(() => {
    const classes = [...new Set(items.map(j => j.class_name))].filter(Boolean);
    return classes.sort();
  }, [items]);

  const uniqueSubjects = useMemo(() => {
    const subjects = [...new Set(items.map(j => j.subject_name))].filter(Boolean);
    return subjects.sort();
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    let filtered = [...items];

    // Filter by date range
    if (filterDateStart) {
      filtered = filtered.filter(j => new Date(j.started_at) >= new Date(filterDateStart));
    }
    if (filterDateEnd) {
      const endDate = new Date(filterDateEnd);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(j => new Date(j.started_at) <= endDate);
    }

    // Filter by class
    if (filterClass !== 'all') {
      filtered = filtered.filter(j => j.class_name === filterClass);
    }

    // Filter by subject
    if (filterSubject !== 'all') {
      filtered = filtered.filter(j => j.subject_name === filterSubject);
    }

    // Filter by QR mode
    if (filterQrMode !== 'all') {
      filtered = filtered.filter(j => (j.qr_mode || 'static') === filterQrMode);
    }

    return filtered;
  }, [items, filterDateStart, filterDateEnd, filterClass, filterSubject, filterQrMode]);

  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    try {
      // Prepare data for export
      const exportData = filteredItems.map((j, index) => ({
        'No': index + 1,
        'Tanggal': new Date(j.started_at).toLocaleString('id-ID', {
          dateStyle: 'medium',
          timeStyle: 'short'
        }),
        'Mata Pelajaran': j.subject_name,
        'Kelas': j.class_name,
        'Token Kelas': j.class_token || '-',
        'Ruangan': j.room_name || '-',
        'Mode QR': j.qr_mode || 'static',
        'Materi': j.materi,
        'Catatan': j.catatan || '-',
        'Hadir': j.siswa_hadir || 0,
        'Sakit': j.siswa_sakit || 0,
        'Izin': j.siswa_izin || 0,
        'Alpa': j.siswa_tidak_hadir || 0,
        'Total Siswa': (j.siswa_hadir || 0) + (j.siswa_sakit || 0) + (j.siswa_izin || 0) + (j.siswa_tidak_hadir || 0),
      }));

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Jurnal');

      // Set column widths
      ws['!cols'] = [
        { wch: 5 },  // No
        { wch: 20 }, // Tanggal
        { wch: 20 }, // Mata Pelajaran
        { wch: 15 }, // Kelas
        { wch: 15 }, // Token Kelas
        { wch: 15 }, // Ruangan
        { wch: 12 }, // Mode QR
        { wch: 40 }, // Materi
        { wch: 30 }, // Catatan
        { wch: 8 },  // Hadir
        { wch: 8 },  // Sakit
        { wch: 8 },  // Izin
        { wch: 8 },  // Alpa
        { wch: 12 }, // Total Siswa
      ];

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `Riwayat_Jurnal_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
      toast.success('File Excel berhasil diunduh');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Gagal mengekspor ke Excel');
    }
  };

  const clearFilters = () => {
    setFilterDateStart('');
    setFilterDateEnd('');
    setFilterClass('all');
    setFilterSubject('all');
    setFilterQrMode('all');
  };

  const hasActiveFilters = filterDateStart || filterDateEnd || filterClass !== 'all' ||
                          filterSubject !== 'all' || filterQrMode !== 'all';

  const getQrModeBadge = (mode) => {
    const qrMode = mode || 'static';
    if (qrMode === 'static') {
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">Static QR</Badge>;
    } else if (qrMode === 'dynamic') {
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">Dynamic QR</Badge>;
    } else if (qrMode === 'rotation') {
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Rotation QR</Badge>;
    }
    return <Badge variant="outline">{qrMode}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <History className="h-3 w-3 mr-1" /> Riwayat Jurnal
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Jurnal Mengajar Saya</h1>
          <p className="text-sm text-slate-600 mt-1">
            Menampilkan <span className="font-semibold">{filteredItems.length}</span> dari{' '}
            <span className="font-semibold">{items.length}</span> entri
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={hasActiveFilters ? 'border-[#006837] text-[#006837]' : ''}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filter {hasActiveFilters && `(${Object.values({filterDateStart, filterDateEnd, filterClass, filterSubject, filterQrMode}).filter(v => v && v !== 'all').length})`}
          </Button>
          <Button
            onClick={handleExportExcel}
            disabled={filteredItems.length === 0}
            className="bg-[#006837] hover:bg-[#0B7A3B]"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filter Section */}
      {showFilters && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Filter Data</h3>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Hapus Filter
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs">Tanggal Mulai</Label>
                <Input
                  type="date"
                  value={filterDateStart}
                  onChange={(e) => setFilterDateStart(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Tanggal Akhir</Label>
                <Input
                  type="date"
                  value={filterDateEnd}
                  onChange={(e) => setFilterDateEnd(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Kelas</Label>
                <Select value={filterClass} onValueChange={setFilterClass}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Semua Kelas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kelas</SelectItem>
                    {uniqueClasses.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Mata Pelajaran</Label>
                <Select value={filterSubject} onValueChange={setFilterSubject}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Semua Mapel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Mapel</SelectItem>
                    {uniqueSubjects.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Mode QR</Label>
                <Select value={filterQrMode} onValueChange={setFilterQrMode}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Semua Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Mode</SelectItem>
                    <SelectItem value="static">Static QR</SelectItem>
                    <SelectItem value="dynamic">Dynamic QR</SelectItem>
                    <SelectItem value="rotation">Rotation QR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <div className="animate-pulse">Memuat data...</div>
          </CardContent>
        </Card>
      ) : filteredItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            <History className="h-10 w-10 mx-auto opacity-40 mb-2" />
            <div>{hasActiveFilters ? 'Tidak ada data sesuai filter' : 'Belum ada riwayat jurnal'}</div>
            {hasActiveFilters && (
              <Button variant="link" onClick={clearFilters} className="mt-2">
                Hapus filter
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-[50px]">No</TableHead>
                    <TableHead className="min-w-[150px]">Tanggal & Waktu</TableHead>
                    <TableHead className="min-w-[140px]">Mata Pelajaran</TableHead>
                    <TableHead className="min-w-[100px]">Kelas</TableHead>
                    <TableHead className="min-w-[110px]">Token Kelas</TableHead>
                    <TableHead className="min-w-[100px]">Ruangan</TableHead>
                    <TableHead className="min-w-[100px]">Mode QR</TableHead>
                    <TableHead className="min-w-[250px]">Materi</TableHead>
                    <TableHead className="min-w-[200px]">Catatan</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Sakit</TableHead>
                    <TableHead className="text-center">Izin</TableHead>
                    <TableHead className="text-center">Alpa</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((j, index) => (
                    <TableRow key={j.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-500">{index + 1}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium text-slate-900">
                            {new Date(j.started_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {new Date(j.started_at).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{j.subject_name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-50 font-mono">
                          {j.class_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {j.class_token ? (
                          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 font-mono text-xs">
                            {j.class_token}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-700">{j.room_name || '-'}</span>
                      </TableCell>
                      <TableCell>
                        {getQrModeBadge(j.qr_mode)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-slate-900 max-w-xs">
                          {j.materi}
                        </div>
                      </TableCell>
                      <TableCell>
                        {j.catatan ? (
                          <div className="text-sm text-slate-600 max-w-xs">
                            {j.catatan}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          {j.siswa_hadir || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                          {j.siswa_sakit || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                          {j.siswa_izin || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200">
                          {j.siswa_tidak_hadir || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-semibold text-slate-900">
                          {(j.siswa_hadir || 0) + (j.siswa_sakit || 0) + (j.siswa_izin || 0) + (j.siswa_tidak_hadir || 0)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
