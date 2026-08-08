import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sparkles, Calendar, Loader2, ChevronRight, X, Star, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

export default function WaliKelasCleanlinessReportPage() {
  const { user } = useAuth();
  const homeroomClassId = user?.homeroom_class_id;

  const [classInfo, setClassInfo] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateDetails, setDateDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Generate month options (last 12 months)
  const monthOptions = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
    monthOptions.push({ value, label });
  }

  useEffect(() => {
    (async () => {
      if (!homeroomClassId) return;
      try {
        const { data } = await api.get('/wali-kelas/my-class');
        setClassInfo(data.class);
      } catch (e) {
        console.error('Error loading class:', e);
      }
    })();
  }, [homeroomClassId]);

  useEffect(() => {
    if (!homeroomClassId || !selectedMonth) return;
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeroomClassId, selectedMonth]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/wali-kelas/cleanliness-report', {
        params: {
          class_id: homeroomClassId,
          month: selectedMonth
        }
      });
      setReportData(data);
    } catch (e) {
      console.error('Error loading report:', e);
    } finally {
      setLoading(false);
    }
  };

  const openDateDetails = async (dateRecord) => {
    setSelectedDate(dateRecord);
    setLoadingDetails(true);
    try {
      const { data } = await api.get('/wali-kelas/cleanliness-details', {
        params: {
          class_id: homeroomClassId,
          date: dateRecord.date
        }
      });
      setDateDetails(data);
    } catch (e) {
      console.error('Error loading details:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetails = () => {
    setSelectedDate(null);
    setDateDetails(null);
  };

  // Calculate summary stats
  const totalDays = reportData.length;
  const totalRating = reportData.reduce((sum, day) => sum + (day.rating || 0), 0);
  const averageRating = totalDays > 0 ? (totalRating / totalDays).toFixed(1) : 0;

  const conditionCounts = reportData.reduce((acc, day) => {
    const condition = day.condition || 'unknown';
    acc[condition] = (acc[condition] || 0) + 1;
    return acc;
  }, {});

  if (!homeroomClassId || !classInfo) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">
          <Sparkles className="h-10 w-10 mx-auto opacity-40 mb-2" />
          <div>Anda tidak terdaftar sebagai wali kelas pada tahun pelajaran aktif</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <Sparkles className="h-3 w-3 mr-1" /> Laporan Kebersihan
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Laporan Kebersihan Kelas {classInfo.name}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Rekapitulasi penilaian kebersihan kelas per hari
        </p>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Bulan</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih bulan..." />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border p-4 bg-gradient-to-br from-[#006837] to-[#0B7A3B] text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-90">Rata-rata</span>
            <Star className="h-4 w-4 opacity-80" />
          </div>
          <div className="flex items-baseline gap-1">
            <div className="text-4xl font-extrabold tabular-nums">{averageRating}</div>
            <div className="text-xl opacity-80">/ 5</div>
          </div>
          <div className="text-xs mt-2 opacity-80">{totalDays} hari dinilai</div>
        </div>

        <div className="rounded-xl border p-4 bg-emerald-50 border-emerald-200 text-emerald-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Bersih</span>
            <Sparkles className="h-4 w-4 opacity-70" />
          </div>
          <div className="text-2xl font-extrabold tabular-nums mt-1">{conditionCounts.bersih || 0}</div>
        </div>

        <div className="rounded-xl border p-4 bg-amber-50 border-amber-200 text-amber-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Cukup</span>
            <Sparkles className="h-4 w-4 opacity-70" />
          </div>
          <div className="text-2xl font-extrabold tabular-nums mt-1">{conditionCounts.cukup || 0}</div>
        </div>

        <div className="rounded-xl border p-4 bg-rose-50 border-rose-200 text-rose-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Kotor</span>
            <Sparkles className="h-4 w-4 opacity-70" />
          </div>
          <div className="text-2xl font-extrabold tabular-nums mt-1">{conditionCounts.kotor || 0}</div>
        </div>

        <div className="rounded-xl border p-4 bg-slate-50 border-slate-200 text-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Total Hari</span>
            <Calendar className="h-4 w-4 opacity-70" />
          </div>
          <div className="text-2xl font-extrabold tabular-nums mt-1">{totalDays}</div>
        </div>
      </div>

      {/* Daily Report Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
              Memuat data kebersihan...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">NO</TableHead>
                    <TableHead>TANGGAL</TableHead>
                    <TableHead className="text-center">BINTANG</TableHead>
                    <TableHead className="text-center">KONDISI</TableHead>
                    <TableHead>PENILAI</TableHead>
                    <TableHead>CATATAN</TableHead>
                    <TableHead className="text-right">AKSI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((record, idx) => (
                    <TableRow key={record.date}>
                      <TableCell className="text-center text-slate-500 font-mono">{idx + 1}</TableCell>
                      <TableCell className="font-semibold">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          {new Date(record.date).toLocaleDateString('id-ID', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < record.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300'
                              }`}
                            />
                          ))}
                          <span className="ml-1 font-bold text-sm">({record.rating})</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={
                            record.condition === 'bersih'
                              ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              : record.condition === 'cukup'
                              ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : 'bg-rose-100 text-rose-700 border-rose-200'
                          }
                        >
                          {record.condition === 'bersih' ? 'Bersih' : record.condition === 'cukup' ? 'Cukup' : 'Kotor'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{record.assessor_name || '-'}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {record.notes || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDateDetails(record)}
                          className="gap-1 border-[#006837]/40 text-[#006837] hover:bg-[#006837]/5"
                        >
                          Lihat Detail <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {reportData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                        <Sparkles className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Belum ada data penilaian kebersihan</div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && closeDetails()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div>
                <div className="text-lg">Detail Penilaian Kebersihan</div>
                <div className="text-sm font-normal text-slate-600 mt-1">
                  {selectedDate && new Date(selectedDate.date).toLocaleDateString('id-ID', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={closeDetails}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          {loadingDetails ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
              Memuat detail...
            </div>
          ) : dateDetails ? (
            <div className="space-y-4">
              {/* Rating & Condition */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-4 bg-amber-50 border-amber-200">
                  <div className="text-xs text-amber-700 font-semibold mb-2">Penilaian Bintang</div>
                  <div className="flex items-center gap-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${
                          i < dateDetails.rating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-300'
                        }`}
                      />
                    ))}
                    <span className="ml-1 font-bold">({dateDetails.rating})</span>
                  </div>
                </div>
                <div className="rounded-lg border p-4 bg-slate-50 border-slate-200">
                  <div className="text-xs text-slate-600 font-semibold mb-2">Kondisi</div>
                  <Badge
                    className={
                      dateDetails.condition === 'bersih'
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : dateDetails.condition === 'cukup'
                        ? 'bg-amber-100 text-amber-700 border-amber-200'
                        : 'bg-rose-100 text-rose-700 border-rose-200'
                    }
                  >
                    {dateDetails.condition === 'bersih' ? 'Bersih' : dateDetails.condition === 'cukup' ? 'Cukup' : 'Kotor'}
                  </Badge>
                </div>
              </div>

              {/* Assessor Info */}
              <div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
                <div className="text-xs text-blue-700 font-semibold mb-2">Penilai</div>
                <div className="font-semibold">{dateDetails.assessor_name}</div>
                <div className="text-xs text-blue-600 mt-1">
                  Dinilai pada: {new Date(dateDetails.assessed_at).toLocaleString('id-ID')}
                </div>
              </div>

              {/* Notes */}
              {dateDetails.notes && (
                <div className="rounded-lg border p-4 bg-slate-50 border-slate-200">
                  <div className="text-xs text-slate-600 font-semibold mb-2">Catatan</div>
                  <div className="text-sm">{dateDetails.notes}</div>
                </div>
              )}

              {/* Piket Students */}
              <div className="rounded-lg border p-4 bg-emerald-50 border-emerald-200">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-emerald-700" />
                  <div className="text-xs text-emerald-700 font-semibold">
                    Petugas Piket ({dateDetails.piket_students?.length || 0} siswa)
                  </div>
                </div>
                {dateDetails.piket_students && dateDetails.piket_students.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {dateDetails.piket_students.map((student, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded bg-white border border-emerald-200">
                        <div className="h-8 w-8 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                          {student.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="text-sm font-medium">{student}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic">Tidak ada petugas piket tercatat</div>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
