import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, History, Calendar, Eye, Users } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { api } from '@/lib/api';

const KelasJurnalPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jurnal, setJurnal] = useState([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState(null);
  const [attendanceDetail, setAttendanceDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadJurnal();
  }, []);

  const loadJurnal = async () => {
    try {
      setLoading(true);
      const res = await api.get('/kelas/jurnal');
      console.log('[JURNAL] API Response:', res.data);
      console.log('[JURNAL] Journals array:', res.data.journals);
      console.log('[JURNAL] Number of journals:', res.data.journals?.length);
      if (res.data.journals?.length > 0) {
        console.log('[JURNAL] First journal object:', res.data.journals[0]);
      }
      setJurnal(res.data.journals || []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading jurnal:', err);
      setError(err.response?.data?.detail || 'Gagal memuat riwayat jurnal');
      setLoading(false);
    }
  };

  const loadAttendanceDetail = async (journalId) => {
    try {
      setLoadingDetail(true);
      console.log('[KELAS-ATTENDANCE] Loading attendance for journal:', journalId);
      const res = await api.get(`/journals/${journalId}/attendance`);
      console.log('[KELAS-ATTENDANCE] Response data:', res.data);
      console.log('[KELAS-ATTENDANCE] attendance object:', res.data?.attendance);
      console.log('[KELAS-ATTENDANCE] summary:', res.data?.summary);
      setAttendanceDetail(res.data);
      setLoadingDetail(false);
    } catch (err) {
      console.error('[KELAS-ATTENDANCE] Error loading attendance detail:', err);
      console.error('[KELAS-ATTENDANCE] Error response:', err.response?.data);
      setLoadingDetail(false);
      alert('Gagal memuat detail kehadiran');
    }
  };

  const handleShowDetail = (journal) => {
    setSelectedJournal(journal);
    setDetailOpen(true);
    loadAttendanceDetail(journal.id);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          <p className="text-sm text-gray-600">Memuat data jurnal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <History className="h-8 w-8" />
          Riwayat Jurnal Kelas
        </h1>
        <p className="text-gray-600 mt-2">
          Catatan jurnal mengajar yang sudah diisi oleh guru
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Jurnal Mengajar</CardTitle>
          <CardDescription>
            Riwayat pembelajaran yang tercatat
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jurnal.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Mapel</TableHead>
                    <TableHead>Guru</TableHead>
                    <TableHead>Diisi Oleh</TableHead>
                    <TableHead>Materi</TableHead>
                    <TableHead>Kehadiran</TableHead>
                    <TableHead className="w-[100px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jurnal.map((j) => {
                    // Safe date formatting - use started_at or created_at
                    let formattedDate = '-';
                    try {
                      const dateValue = j.started_at || j.created_at;
                      if (dateValue) {
                        const dateObj = new Date(dateValue);
                        if (!isNaN(dateObj.getTime())) {
                          formattedDate = format(dateObj, 'dd MMM yyyy', { locale: id });
                        }
                      }
                    } catch (err) {
                      console.error('Date format error:', err, j);
                    }

                    // Calculate total students
                    const totalStudents = (j.siswa_hadir || 0) + (j.siswa_izin || 0) +
                                         (j.siswa_sakit || 0) + (j.siswa_tidak_hadir || 0);

                    return (
                      <TableRow key={j.id}>
                        <TableCell className="font-mono">
                          {formattedDate}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-semibold">{j.subject_name || '-'}</div>
                            {j.subject_code && (
                              <div className="text-xs text-gray-500">{j.subject_code}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{j.teacher_name || '-'}</TableCell>
                        <TableCell>
                          {j.fill_mode === 'piket' ? (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                              ✋ Piket{j.filled_by_name ? `: ${j.filled_by_name}` : ''}
                            </Badge>
                          ) : j.fill_mode === 'admin' ? (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200">Admin</Badge>
                          ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Pengajar</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="truncate" title={j.materi}>
                            {j.materi || '-'}
                          </div>
                          {j.catatan && (
                            <div className="text-xs text-gray-500 mt-1 truncate" title={j.catatan}>
                              Catatan: {j.catatan}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant="outline" className="bg-green-50">
                              <span className="text-green-700">{j.siswa_hadir || 0}/{totalStudents}</span> Hadir
                            </Badge>
                            {(j.siswa_sakit > 0 || j.siswa_izin > 0 || j.siswa_tidak_hadir > 0) && (
                              <div className="text-xs text-gray-600">
                                {j.siswa_sakit > 0 && <span className="mr-2">Sakit: {j.siswa_sakit}</span>}
                                {j.siswa_izin > 0 && <span className="mr-2">Izin: {j.siswa_izin}</span>}
                                {j.siswa_tidak_hadir > 0 && <span>Alfa: {j.siswa_tidak_hadir}</span>}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowDetail(j)}
                            className="gap-1"
                          >
                            <Eye className="h-4 w-4" />
                            Detail
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Belum ada riwayat jurnal
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Attendance Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Detail Kehadiran Siswa
            </DialogTitle>
            <DialogDescription>
              Daftar siswa berdasarkan status kehadiran
            </DialogDescription>
          </DialogHeader>

          {loadingDetail ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
            </div>
          ) : attendanceDetail && (
            <div className="space-y-4">
              {/* Journal Info */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Tanggal:</span>
                    <span className="ml-2 font-semibold">
                      {attendanceDetail.date ? format(new Date(attendanceDetail.date), 'dd MMMM yyyy', { locale: id }) : '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Mata Pelajaran:</span>
                    <span className="ml-2 font-semibold">{attendanceDetail.subject || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Guru:</span>
                    <span className="ml-2 font-semibold">{attendanceDetail.teacher_name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Kelas:</span>
                    <span className="ml-2 font-semibold">{attendanceDetail.class_name || '-'}</span>
                  </div>
                </div>
                {attendanceDetail.materi && (
                  <div className="text-sm">
                    <span className="text-gray-600">Materi:</span>
                    <span className="ml-2">{attendanceDetail.materi}</span>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                  <div className="text-2xl font-bold text-emerald-700">{attendanceDetail.summary.hadir}</div>
                  <div className="text-xs text-emerald-600">Hadir</div>
                </div>
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                  <div className="text-2xl font-bold text-amber-700">{attendanceDetail.summary.sakit}</div>
                  <div className="text-xs text-amber-600">Sakit</div>
                </div>
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <div className="text-2xl font-bold text-blue-700">{attendanceDetail.summary.izin}</div>
                  <div className="text-xs text-blue-600">Izin</div>
                </div>
                <div className="bg-rose-50 p-3 rounded-lg border border-rose-200">
                  <div className="text-2xl font-bold text-rose-700">{attendanceDetail.summary.alpha}</div>
                  <div className="text-xs text-rose-600">Alpha</div>
                </div>
              </div>

              {/* Student Lists - Grouped by Status with Cards */}
              <div>
                <div className="text-sm font-semibold mb-2">Detail Kehadiran Siswa</div>
                <div className="grid grid-cols-1 gap-3">
                  {/* Hadir */}
                  {attendanceDetail.attendance.hadir.length > 0 && (
                    <Card className="border-emerald-200">
                      <CardHeader className="bg-emerald-50 py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="text-sm font-semibold text-emerald-700">
                            Hadir ({attendanceDetail.attendance.hadir.length})
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="grid grid-cols-2 gap-2">
                          {attendanceDetail.attendance.hadir.map((student, idx) => (
                            <div key={idx} className="text-sm bg-emerald-50 p-2 rounded border border-emerald-200">
                              {student.student_name}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Sakit */}
                  {attendanceDetail.attendance.sakit.length > 0 && (
                    <Card className="border-amber-200">
                      <CardHeader className="bg-amber-50 py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                          <span className="text-sm font-semibold text-amber-700">
                            Sakit ({attendanceDetail.attendance.sakit.length})
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="grid grid-cols-2 gap-2">
                          {attendanceDetail.attendance.sakit.map((student, idx) => (
                            <div key={idx} className="text-sm bg-amber-50 p-2 rounded border border-amber-200">
                              {student.student_name}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Izin */}
                  {attendanceDetail.attendance.izin.length > 0 && (
                    <Card className="border-blue-200">
                      <CardHeader className="bg-blue-50 py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className="text-sm font-semibold text-blue-700">
                            Izin ({attendanceDetail.attendance.izin.length})
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="grid grid-cols-2 gap-2">
                          {attendanceDetail.attendance.izin.map((student, idx) => (
                            <div key={idx} className="text-sm bg-blue-50 p-2 rounded border border-blue-200">
                              {student.student_name}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Alpha */}
                  {attendanceDetail.attendance.alpha.length > 0 && (
                    <Card className="border-rose-200">
                      <CardHeader className="bg-rose-50 py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                          <span className="text-sm font-semibold text-rose-700">
                            Alpha ({attendanceDetail.attendance.alpha.length})
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-3">
                        <div className="grid grid-cols-2 gap-2">
                          {attendanceDetail.attendance.alpha.map((student, idx) => (
                            <div key={idx} className="text-sm bg-rose-50 p-2 rounded border border-rose-200">
                              {student.student_name}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KelasJurnalPage;
