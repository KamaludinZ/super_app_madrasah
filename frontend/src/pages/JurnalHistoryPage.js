import React, { useEffect, useState, useMemo } from 'react';
import { History, Calendar, Clock, BookOpen, Download, Filter, X, ShieldAlert, Eye, User } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useAuth } from '@/lib/AuthContext';
import { useSearchParams } from 'react-router-dom';

export default function JurnalHistoryPage() {
  const { user, activeRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState(null);

  // Edit dialog states
  const [editOpen, setEditOpen] = useState(false);
  const [editJournal, setEditJournal] = useState(null);
  const [editForm, setEditForm] = useState({ materi: '', catatan: '' });
  const [editSaving, setEditSaving] = useState(false);

  const isPiket = activeRole === 'guru_piket';
  const isAdmin = activeRole === 'admin' || user?.roles?.includes('admin');

  // Filter states
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [filterQrMode, setFilterQrMode] = useState('all');
  const [filterFillMode, setFilterFillMode] = useState('all');

  useEffect(() => {
    let endpoint = '/jurnal/my';
    if (isAdmin) {
      endpoint = '/admin/jurnal';
    } else if (isPiket) {
      endpoint = '/jurnal/piket-filled';
    }

    api.get(endpoint).then(({ data }) => {
      // For admin endpoint, data is in data.items
      const journalData = isAdmin ? data.items : data;
      setItems(journalData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [isPiket, isAdmin, activeRole]);

  // Handle edit parameter from URL
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && items.length > 0) {
      const journal = items.find(j => j.id === editId);
      if (journal) {
        setEditJournal(journal);
        setEditForm({ materi: journal.materi || '', catatan: journal.catatan || '' });
        setEditOpen(true);
        // Remove edit param from URL
        searchParams.delete('edit');
        setSearchParams(searchParams);
      } else if (isAdmin) {
        // If admin and journal not found in list, it might not be loaded yet
        // Wait a bit and check again, or fetch directly
        console.log('Journal not found in loaded items, ID:', editId);
      }
    }
  }, [searchParams, items, setSearchParams, isAdmin]);

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

    // Filter by fill mode
    if (filterFillMode !== 'all') {
      filtered = filtered.filter(j => (j.fill_mode || 'self') === filterFillMode);
    }

    return filtered;
  }, [items, filterDateStart, filterDateEnd, filterClass, filterSubject, filterQrMode, filterFillMode]);

  const handleExportExcel = () => {
    if (filteredItems.length === 0) {
      toast.error('Tidak ada data untuk diekspor');
      return;
    }

    try {
      // Prepare data for export
      const exportData = filteredItems.map((j, index) => {
        const base = {
          'No': index + 1,
          'Tanggal': new Date(j.started_at).toLocaleString('id-ID', {
            dateStyle: 'medium',
            timeStyle: 'short'
          }),
          'Jam Ke': j.jam_ke || '-',
          'JTM': j.jtm_count || 1,
          'Mata Pelajaran': j.subject_name,
          'Kelas': j.class_name,
          'Guru Pengajar': j.teacher_name || '-',
          'Ruangan': j.room_name || '-',
          'Mode QR': j.qr_mode || 'static',
          'Materi': j.materi,
          'Catatan': j.catatan || '-',
        };

        if (isPiket) {
          base['Mode Pengisian'] = j.fill_mode === 'piket' ? 'Piket' : j.fill_mode === 'admin' ? 'Admin' : 'Guru';
          base['Diisi Oleh'] = j.filled_by_name || j.teacher_name || '-';
          base['Catatan Piket'] = j.piket_note || '-';
        }

        base['Hadir'] = j.siswa_hadir || 0;
        base['Sakit'] = j.siswa_sakit || 0;
        base['Izin'] = j.siswa_izin || 0;
        base['Alpa'] = j.siswa_tidak_hadir || 0;
        base['Total Siswa'] = (j.siswa_hadir || 0) + (j.siswa_sakit || 0) + (j.siswa_izin || 0) + (j.siswa_tidak_hadir || 0);

        return base;
      });

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Jurnal');

      // Set column widths
      ws['!cols'] = [
        { wch: 5 },  // No
        { wch: 20 }, // Tanggal
        { wch: 12 }, // Jam Ke
        { wch: 8 },  // JTM
        { wch: 20 }, // Mata Pelajaran
        { wch: 15 }, // Kelas
        { wch: 20 }, // Guru Pengajar
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

  const handleEditSave = async () => {
    if (!editJournal || !editForm.materi.trim()) {
      toast.error('Materi pembelajaran harus diisi');
      return;
    }

    setEditSaving(true);
    try {
      await api.put(`/admin/jurnal/${editJournal.id}`, {
        materi: editForm.materi,
        catatan: editForm.catatan,
      });

      // Update local state
      setItems(prevItems => prevItems.map(item =>
        item.id === editJournal.id
          ? { ...item, materi: editForm.materi, catatan: editForm.catatan }
          : item
      ));

      toast.success('Jurnal berhasil diperbarui');
      setEditOpen(false);
      setEditJournal(null);
      setEditForm({ materi: '', catatan: '' });
    } catch (error) {
      console.error('Error updating journal:', error);
      toast.error(error.response?.data?.detail || 'Gagal memperbarui jurnal');
    } finally {
      setEditSaving(false);
    }
  };

  const clearFilters = () => {
    setFilterDateStart('');
    setFilterDateEnd('');
    setFilterClass('all');
    setFilterSubject('all');
    setFilterQrMode('all');
    setFilterFillMode('all');
  };

  const hasActiveFilters = filterDateStart || filterDateEnd || filterClass !== 'all' ||
                          filterSubject !== 'all' || filterQrMode !== 'all' || filterFillMode !== 'all';

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
            {isPiket ? <ShieldAlert className="h-3 w-3 mr-1" /> : <History className="h-3 w-3 mr-1" />}
            {isPiket ? 'Riwayat Jurnal Piket' : 'Riwayat Jurnal'}
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
            {isPiket ? 'Jurnal yang Saya Isi (Piket)' : 'Jurnal Mengajar Saya'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Menampilkan <span className="font-semibold">{filteredItems.length}</span> dari{' '}
            <span className="font-semibold">{items.length}</span> entri
            {isPiket && <span className="text-blue-600 ml-1">• Jurnal yang diisi sebagai guru piket</span>}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
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
              {isPiket && (
                <div>
                  <Label className="text-xs">Mode Pengisian</Label>
                  <Select value={filterFillMode} onValueChange={setFilterFillMode}>
                    <SelectTrigger className="text-sm">
                      <SelectValue placeholder="Semua Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Mode</SelectItem>
                      <SelectItem value="piket">Piket</SelectItem>
                      <SelectItem value="self">Guru Sendiri</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
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
                    <TableHead className="min-w-[100px]">Jam Ke</TableHead>
                    <TableHead className="min-w-[70px]">JTM</TableHead>
                    <TableHead className="min-w-[140px]">Mata Pelajaran</TableHead>
                    <TableHead className="min-w-[100px]">Kelas</TableHead>
                    {isPiket && <TableHead className="min-w-[140px]">Guru Pengajar</TableHead>}
                    <TableHead className="min-w-[100px]">Ruangan</TableHead>
                    <TableHead className="min-w-[100px]">Mode QR</TableHead>
                    <TableHead className="min-w-[250px]">Materi</TableHead>
                    <TableHead className="min-w-[200px]">Catatan</TableHead>
                    {isPiket && (
                      <>
                        <TableHead className="min-w-[120px]">Mode Pengisian</TableHead>
                        <TableHead className="min-w-[200px]">Catatan Piket</TableHead>
                      </>
                    )}
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Sakit</TableHead>
                    <TableHead className="text-center">Izin</TableHead>
                    <TableHead className="text-center">Alpa</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-right w-[100px]">Aksi</TableHead>
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
                        <div className="text-xs font-medium text-slate-700">
                          {j.jam_ke || '-'}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-semibold">
                          {j.jtm_count || 1} JTM
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900">{j.subject_name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-slate-50 font-mono">
                          {j.class_name}
                        </Badge>
                      </TableCell>
                      {isPiket && (
                        <TableCell>
                          <span className="text-sm text-slate-700">{j.teacher_name || '-'}</span>
                        </TableCell>
                      )}
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
                      {isPiket && (
                        <>
                          <TableCell>
                            {j.fill_mode === 'piket' ? (
                              <Badge className="bg-blue-50 text-blue-700 border-blue-200">
                                <ShieldAlert className="h-3 w-3 mr-1" />
                                Piket
                              </Badge>
                            ) : j.fill_mode === 'admin' ? (
                              <Badge className="bg-purple-50 text-purple-700 border-purple-200">Admin</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-50">Guru</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {j.piket_note ? (
                              <div className="text-sm text-blue-600 italic max-w-xs">
                                {j.piket_note}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </TableCell>
                        </>
                      )}
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
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setSelectedJournal(j); setDetailOpen(true); }}
                          className="h-8 px-3"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Detail
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Detail Jurnal Mengajar</DialogTitle>
          </DialogHeader>
          {selectedJournal && (
            <div className="space-y-6">
              {/* Informasi Umum */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-3 text-[#006837]">Informasi Jurnal</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <div className="text-xs text-slate-500 mb-1">Tanggal & Waktu</div>
                      <div className="font-medium">
                        {new Date(selectedJournal.started_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                        {' '}
                        <span className="text-slate-600">
                          {new Date(selectedJournal.started_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Jam Ke</div>
                      <div className="font-medium text-slate-700">
                        {selectedJournal.jam_ke || '-'}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-xs text-slate-500 mb-1">Mata Pelajaran</div>
                      <div className="font-medium">{selectedJournal.subject_name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">JTM</div>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300">
                        {selectedJournal.jtm_count || 1} JTM
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Kelas</div>
                      <Badge variant="outline" className="bg-slate-50 font-mono">
                        {selectedJournal.class_name}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Ruangan</div>
                      <div className="font-medium">{selectedJournal.room_name || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Mode QR</div>
                      {getQrModeBadge(selectedJournal.qr_mode)}
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs text-slate-500 mb-1">Materi</div>
                    <div className="p-3 bg-slate-50 rounded border text-sm">
                      {selectedJournal.materi}
                    </div>
                  </div>
                  {selectedJournal.catatan && (
                    <div className="mt-3">
                      <div className="text-xs text-slate-500 mb-1">Catatan</div>
                      <div className="p-3 bg-slate-50 rounded border text-sm text-slate-600">
                        {selectedJournal.catatan}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Daftar Kehadiran Siswa */}
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-lg mb-3 text-[#006837]">Daftar Kehadiran Siswa</h3>

                  {/* Ringkasan */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded">
                      <div className="text-xs text-emerald-600 mb-1">Hadir</div>
                      <div className="text-2xl font-bold text-emerald-700">
                        {selectedJournal.siswa_hadir || 0}
                      </div>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded">
                      <div className="text-xs text-amber-600 mb-1">Sakit</div>
                      <div className="text-2xl font-bold text-amber-700">
                        {selectedJournal.siswa_sakit || 0}
                      </div>
                    </div>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                      <div className="text-xs text-blue-600 mb-1">Izin</div>
                      <div className="text-2xl font-bold text-blue-700">
                        {selectedJournal.siswa_izin || 0}
                      </div>
                    </div>
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded">
                      <div className="text-xs text-rose-600 mb-1">Alpa</div>
                      <div className="text-2xl font-bold text-rose-700">
                        {selectedJournal.siswa_tidak_hadir || 0}
                      </div>
                    </div>
                  </div>

                  {/* Detail Per Siswa */}
                  {selectedJournal.attendance_details && selectedJournal.attendance_details.length > 0 ? (
                    <div className="border rounded">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50">
                            <TableHead className="w-[50px]">No</TableHead>
                            <TableHead>Nama Siswa</TableHead>
                            <TableHead className="text-center w-[100px]">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedJournal.attendance_details.map((att, idx) => {
                            const statusBadge = {
                              'hadir': <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 font-semibold">H - Hadir</Badge>,
                              'sakit': <Badge className="bg-amber-100 text-amber-700 border-amber-300 font-semibold">S - Sakit</Badge>,
                              'izin': <Badge className="bg-blue-100 text-blue-700 border-blue-300 font-semibold">I - Izin</Badge>,
                              'alpa': <Badge className="bg-rose-100 text-rose-700 border-rose-300 font-semibold">A - Alpa</Badge>,
                            };
                            return (
                              <TableRow key={idx}>
                                <TableCell className="text-slate-500">{idx + 1}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-slate-400" />
                                    <span className="font-medium">{att.student_name || '-'}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {statusBadge[att.status] || <Badge variant="outline">{att.status}</Badge>}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 text-sm">
                      Detail kehadiran siswa tidak tersedia
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) {
          setEditJournal(null);
          setEditForm({ materi: '', catatan: '' });
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Jurnal Mengajar</DialogTitle>
          </DialogHeader>
          {editJournal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded">
                <div>
                  <div className="text-xs text-slate-500">Tanggal & Waktu</div>
                  <div className="font-semibold text-sm">
                    {new Date(editJournal.started_at).toLocaleString('id-ID', {
                      dateStyle: 'long',
                      timeStyle: 'short'
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Kelas</div>
                  <Badge variant="outline" className="font-mono">{editJournal.class_name}</Badge>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-slate-500">Mata Pelajaran</div>
                  <div className="font-semibold text-sm">{editJournal.subject_name}</div>
                </div>
              </div>

              <div>
                <Label htmlFor="edit-materi">Materi Pembelajaran *</Label>
                <Textarea
                  id="edit-materi"
                  value={editForm.materi}
                  onChange={(e) => setEditForm({ ...editForm, materi: e.target.value })}
                  placeholder="Masukkan materi pembelajaran yang diajarkan..."
                  rows={5}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="edit-catatan">Catatan (Opsional)</Label>
                <Textarea
                  id="edit-catatan"
                  value={editForm.catatan}
                  onChange={(e) => setEditForm({ ...editForm, catatan: e.target.value })}
                  placeholder="Catatan tambahan (opsional)..."
                  rows={3}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editSaving}
            >
              Batal
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editSaving || !editForm.materi.trim()}
              className="bg-[#006837] hover:bg-[#0B7A3B]"
            >
              {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
