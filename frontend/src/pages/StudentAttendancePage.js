import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';

const StudentAttendancePage = () => {
  const [attendanceData, setAttendanceData] = useState({ records: [] });
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const months = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const statusColors = {
    hadir: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    sakit: 'bg-yellow-50 text-yellow-700 border-yellow-300',
    izin: 'bg-blue-50 text-blue-700 border-blue-300',
    alpa: 'bg-red-50 text-red-700 border-red-300',
  };

  const statusLabels = {
    hadir: 'Hadir',
    sakit: 'Sakit',
    izin: 'Izin',
    alpa: 'Alpa',
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [attendanceRes, statsRes] = await Promise.all([
        api.get('/students/my-attendance', {
          params: { month: selectedMonth, year: selectedYear }
        }),
        api.get('/students/my-attendance/stats', {
          params: { month: selectedMonth, year: selectedYear }
        })
      ]);

      setAttendanceData(attendanceRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Kehadiran Saya</h1>
          <p className="text-sm text-gray-500 mt-1">
            Riwayat kehadiran dan statistik pribadi
          </p>
        </div>

        {/* Month and Year Selector */}
        <div className="flex items-center gap-3">
          <div>
            <Label className="text-xs text-gray-600">Bulan</Label>
            <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs text-gray-600">Tahun</Label>
            <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Monthly Stats */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Statistik Bulanan</span>
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                  {months.find(m => m.value === selectedMonth)?.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total Kehadiran:</span>
                  <span className="font-semibold">{stats.monthly.total}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-600">Hadir:</span>
                  <span className="font-semibold text-emerald-700">{stats.monthly.hadir}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-yellow-600">Sakit:</span>
                  <span className="font-semibold text-yellow-700">{stats.monthly.sakit}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-blue-600">Izin:</span>
                  <span className="font-semibold text-blue-700">{stats.monthly.izin}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-red-600">Alpa:</span>
                  <span className="font-semibold text-red-700">{stats.monthly.alpa}</span>
                </div>
                <div className="pt-2 mt-2 border-t">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-emerald-600">{stats.monthly.percentage}%</div>
                    <div className="text-xs text-gray-500">Persentase Kehadiran</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Stats */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Statistik Mingguan</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                  7 Hari Terakhir
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total Kehadiran:</span>
                  <span className="font-semibold">{stats.weekly.total}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-600">Hadir:</span>
                  <span className="font-semibold text-emerald-700">{stats.weekly.hadir}</span>
                </div>
                <div className="pt-2 mt-2 border-t">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{stats.weekly.percentage}%</div>
                    <div className="text-xs text-gray-500">Persentase Kehadiran</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Stats */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Statistik Harian</span>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                  Hari Ini
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Total Kehadiran:</span>
                  <span className="font-semibold">{stats.daily.total}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-emerald-600">Hadir:</span>
                  <span className="font-semibold text-emerald-700">{stats.daily.hadir}</span>
                </div>
                <div className="pt-2 mt-2 border-t">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-amber-600">{stats.daily.percentage}%</div>
                    <div className="text-xs text-gray-500">Persentase Kehadiran</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Records Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Riwayat Kehadiran</h2>
              <p className="text-sm text-gray-500 mt-1">
                Daftar kehadiran per mata pelajaran
              </p>
            </div>
            <Badge variant="outline">
              {attendanceData.records?.length || 0} Record
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {attendanceData.records && attendanceData.records.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Tanggal & Waktu</TableHead>
                    <TableHead>Mata Pelajaran</TableHead>
                    <TableHead>Guru Pengajar</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.records.map((record, idx) => (
                    <TableRow key={record.id || idx}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(record.date)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{record.subject_name || '-'}</div>
                          {record.subject_code && (
                            <div className="text-xs text-gray-500">{record.subject_code}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{record.teacher_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[record.status] || ''}>
                          {statusLabels[record.status] || record.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">Tidak ada data kehadiran</p>
              <p className="text-sm mt-1">
                Belum ada catatan kehadiran untuk bulan {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentAttendancePage;
