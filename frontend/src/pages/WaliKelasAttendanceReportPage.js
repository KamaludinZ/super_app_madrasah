import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UserCheck, Calendar, Loader2, ChevronRight, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

export default function WaliKelasAttendanceReportPage() {
  const { user } = useAuth();
  const homeroomClassId = user?.homeroom_class_id;

  const [classInfo, setClassInfo] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentDetails, setStudentDetails] = useState(null);
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
      const { data } = await api.get('/wali-kelas/attendance-report', {
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

  const openStudentDetails = async (student) => {
    setSelectedStudent(student);
    setLoadingDetails(true);
    try {
      const { data } = await api.get('/wali-kelas/attendance-details', {
        params: {
          student_id: student.student_id,
          month: selectedMonth
        }
      });
      setStudentDetails(data);
    } catch (e) {
      console.error('Error loading details:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeDetails = () => {
    setSelectedStudent(null);
    setStudentDetails(null);
  };

  const totalStats = reportData.reduce((acc, student) => {
    acc.hadir += student.hadir || 0;
    acc.sakit += student.sakit || 0;
    acc.izin += student.izin || 0;
    acc.alpa += student.alpa || 0;
    acc.total += (student.hadir || 0) + (student.sakit || 0) + (student.izin || 0) + (student.alpa || 0);
    return acc;
  }, { hadir: 0, sakit: 0, izin: 0, alpa: 0, total: 0 });

  // Calculate overall attendance percentage
  const overallPercentage = totalStats.total > 0
    ? Math.round((totalStats.hadir / totalStats.total) * 100)
    : 0;

  if (!homeroomClassId || !classInfo) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-500">
          <UserCheck className="h-10 w-10 mx-auto opacity-40 mb-2" />
          <div>Anda tidak terdaftar sebagai wali kelas pada tahun pelajaran aktif</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <UserCheck className="h-3 w-3 mr-1" /> Laporan Kehadiran
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
          Laporan Kehadiran Kelas {classInfo.name}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Rekapitulasi kehadiran siswa berdasarkan absensi jurnal guru
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
        <div className="rounded-xl border p-4 bg-gradient-to-br from-[#006837] to-[#0B7A3B] text-white col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-90">% Kehadiran</span>
            <UserCheck className="h-4 w-4 opacity-80" />
          </div>
          <div className="text-4xl font-extrabold tabular-nums">{overallPercentage}%</div>
          <div className="text-xs mt-2 opacity-80">
            {totalStats.hadir} dari {totalStats.total} catatan
          </div>
        </div>
        <div className="rounded-xl border p-4 bg-emerald-50 border-emerald-200 text-emerald-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Hadir</span>
            <UserCheck className="h-4 w-4 opacity-70" />
          </div>
          <div className="text-2xl font-extrabold tabular-nums mt-1">{totalStats.hadir}</div>
        </div>
        <div className="rounded-xl border p-4 bg-amber-50 border-amber-200 text-amber-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Sakit</span>
            <UserCheck className="h-4 w-4 opacity-70" />
          </div>
          <div className="text-2xl font-extrabold tabular-nums mt-1">{totalStats.sakit}</div>
        </div>
        <div className="rounded-xl border p-4 bg-blue-50 border-blue-200 text-blue-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Izin</span>
            <UserCheck className="h-4 w-4 opacity-70" />
          </div>
          <div className="text-2xl font-extrabold tabular-nums mt-1">{totalStats.izin}</div>
        </div>
        <div className="rounded-xl border p-4 bg-rose-50 border-rose-200 text-rose-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide opacity-80">Alpa</span>
            <UserCheck className="h-4 w-4 opacity-70" />
          </div>
          <div className="text-2xl font-extrabold tabular-nums mt-1">{totalStats.alpa}</div>
        </div>
      </div>

      {/* Student List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
              Memuat data kehadiran...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">NO</TableHead>
                    <TableHead>NAMA SISWA</TableHead>
                    <TableHead>NISN</TableHead>
                    <TableHead className="text-center">H</TableHead>
                    <TableHead className="text-center">S</TableHead>
                    <TableHead className="text-center">I</TableHead>
                    <TableHead className="text-center">A</TableHead>
                    <TableHead className="text-center">% HADIR</TableHead>
                    <TableHead className="text-right">AKSI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((student, idx) => {
                    const totalRecords = (student.hadir || 0) + (student.sakit || 0) + (student.izin || 0) + (student.alpa || 0);
                    const attendancePercentage = totalRecords > 0
                      ? Math.round(((student.hadir || 0) / totalRecords) * 100)
                      : 0;

                    return (
                      <TableRow key={student.student_id}>
                        <TableCell className="text-center text-slate-500 font-mono">{idx + 1}</TableCell>
                        <TableCell className="font-semibold">{student.student_name}</TableCell>
                        <TableCell className="font-mono text-xs">{student.nisn || '-'}</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-bold">
                            {student.hadir || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 font-bold">
                            {student.sakit || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-blue-100 text-blue-700 border-blue-200 font-bold">
                            {student.izin || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-rose-100 text-rose-700 border-rose-200 font-bold">
                            {student.alpa || 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className={`font-bold text-sm ${
                              attendancePercentage >= 80 ? 'text-emerald-700' :
                              attendancePercentage >= 60 ? 'text-amber-700' :
                              'text-rose-700'
                            }`}>
                              {attendancePercentage}%
                            </div>
                            <div className="flex-1 bg-slate-200 rounded-full h-2 w-16">
                              <div
                                className={`h-2 rounded-full ${
                                  attendancePercentage >= 80 ? 'bg-emerald-500' :
                                  attendancePercentage >= 60 ? 'bg-amber-500' :
                                  'bg-rose-500'
                                }`}
                                style={{ width: `${attendancePercentage}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openStudentDetails(student)}
                            className="gap-1 border-[#006837]/40 text-[#006837] hover:bg-[#006837]/5"
                          >
                            Lihat Detail <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {reportData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-slate-500">
                        <UserCheck className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                        <div className="font-semibold">Belum ada data kehadiran</div>
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
      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && closeDetails()}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div>
                <div className="text-lg">Detail Kehadiran</div>
                <div className="text-sm font-normal text-slate-600 mt-1">
                  {selectedStudent?.student_name} - {monthOptions.find(m => m.value === selectedMonth)?.label}
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
              Memuat detail kehadiran...
            </div>
          ) : studentDetails ? (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3">
                <div className="rounded-lg border p-3 bg-emerald-50 border-emerald-200">
                  <div className="text-xs text-emerald-700 font-semibold">Hadir</div>
                  <div className="text-xl font-bold text-emerald-700">{selectedStudent?.hadir || 0}</div>
                </div>
                <div className="rounded-lg border p-3 bg-amber-50 border-amber-200">
                  <div className="text-xs text-amber-700 font-semibold">Sakit</div>
                  <div className="text-xl font-bold text-amber-700">{selectedStudent?.sakit || 0}</div>
                </div>
                <div className="rounded-lg border p-3 bg-blue-50 border-blue-200">
                  <div className="text-xs text-blue-700 font-semibold">Izin</div>
                  <div className="text-xl font-bold text-blue-700">{selectedStudent?.izin || 0}</div>
                </div>
                <div className="rounded-lg border p-3 bg-rose-50 border-rose-200">
                  <div className="text-xs text-rose-700 font-semibold">Alpa</div>
                  <div className="text-xl font-bold text-rose-700">{selectedStudent?.alpa || 0}</div>
                </div>
              </div>

              {/* Daily Details */}
              <div>
                <h3 className="font-semibold mb-3">Detail Per Hari</h3>
                <div className="space-y-2">
                  {studentDetails.daily_records?.map((record) => (
                    <div
                      key={record.date}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <div>
                          <div className="font-mono text-sm font-semibold">
                            {new Date(record.date).toLocaleDateString('id-ID', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </div>
                          {record.subject && (
                            <div className="text-xs text-slate-600 mt-1">
                              {record.subject} • {record.teacher}
                            </div>
                          )}
                        </div>
                      </div>
                      <Badge
                        className={
                          record.status === 'hadir'
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                            : record.status === 'sakit'
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : record.status === 'izin'
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-rose-100 text-rose-700 border-rose-200'
                        }
                      >
                        {record.status === 'hadir'
                          ? 'Hadir'
                          : record.status === 'sakit'
                          ? 'Sakit'
                          : record.status === 'izin'
                          ? 'Izin'
                          : 'Alpa'}
                      </Badge>
                    </div>
                  ))}
                  {(!studentDetails.daily_records || studentDetails.daily_records.length === 0) && (
                    <div className="text-center py-8 text-slate-500">
                      <Calendar className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                      <div className="text-sm">Belum ada catatan kehadiran</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
