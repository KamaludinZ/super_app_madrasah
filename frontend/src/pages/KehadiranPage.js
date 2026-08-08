import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, Users, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { toast } from 'sonner';

const KehadiranPage = () => {
  const [viewMode, setViewMode] = useState('overall'); // overall, by-grade, by-class
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(true);

  // Data states
  const [overallData, setOverallData] = useState(null);
  const [gradeData, setGradeData] = useState(null);
  const [classData, setClassData] = useState(null);
  const [classes, setClasses] = useState([]);
  const [gradeLevels, setGradeLevels] = useState([]);

  // Detail dialog
  const [detailDialog, setDetailDialog] = useState({ open: false, student: null, records: [] });

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

  // Load classes on mount
  useEffect(() => {
    const loadClasses = async () => {
      try {
        const { data } = await api.get('/classes');
        setClasses(data);

        // Extract unique grade levels
        const grades = [...new Set(data.map(c => c.grade_level))].filter(Boolean).sort();
        setGradeLevels(grades);
      } catch (error) {
        console.error('Error loading classes:', error);
        toast.error('Gagal memuat data kelas');
      }
    };
    loadClasses();
  }, []);

  // Fetch data based on view mode
  useEffect(() => {
    fetchData();
  }, [viewMode, selectedMonth, selectedYear, selectedGrade, selectedClass]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (viewMode === 'overall') {
        const { data } = await api.get('/admin/attendance/overall', {
          params: { month: selectedMonth, year: selectedYear }
        });
        setOverallData(data);
      } else if (viewMode === 'by-grade' && selectedGrade) {
        const { data } = await api.get('/admin/attendance/by-grade', {
          params: {
            grade_level: selectedGrade,
            month: selectedMonth,
            year: selectedYear
          }
        });
        setGradeData(data);
      } else if (viewMode === 'by-class' && selectedClass) {
        const { data } = await api.get('/admin/attendance/by-class', {
          params: {
            class_id: selectedClass,
            month: selectedMonth,
            year: selectedYear
          }
        });
        setClassData(data);
      }
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      toast.error('Gagal memuat data kehadiran');
    } finally {
      setLoading(false);
    }
  };

  const openDetailDialog = (student, records) => {
    setDetailDialog({
      open: true,
      student: student,
      records: records || []
    });
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

  // Statistics Cards Component
  const StatsCards = ({ stats, period = 'monthly' }) => {
    if (!stats) return null;

    const getTitle = () => {
      switch (period) {
        case 'daily': return 'Statistik Hari Ini';
        case 'weekly': return 'Statistik 7 Hari Terakhir';
        case 'monthly': return 'Statistik Bulanan';
        default: return 'Statistik';
      }
    };

    const getBadgeColor = () => {
      switch (period) {
        case 'daily': return 'bg-amber-50 text-amber-700 border-amber-300';
        case 'weekly': return 'bg-blue-50 text-blue-700 border-blue-300';
        case 'monthly': return 'bg-purple-50 text-purple-700 border-purple-300';
        default: return 'bg-gray-50 text-gray-700 border-gray-300';
      }
    };

    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">{getTitle()}</span>
            <Badge variant="outline" className={getBadgeColor()}>
              {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Total Kehadiran:</span>
              <span className="font-semibold">{stats.total || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-emerald-600">Hadir:</span>
              <span className="font-semibold text-emerald-700">{stats.hadir || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-yellow-600">Sakit:</span>
              <span className="font-semibold text-yellow-700">{stats.sakit || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-600">Izin:</span>
              <span className="font-semibold text-blue-700">{stats.izin || 0}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-red-600">Alpa:</span>
              <span className="font-semibold text-red-700">{stats.alpa || 0}</span>
            </div>
            <div className="pt-2 mt-2 border-t">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-600">{stats.percentage || 0}%</div>
                <div className="text-xs text-gray-500">Persentase Kehadiran</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Overall View
  const renderOverallView = () => {
    if (!overallData) return null;

    return (
      <div className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatsCards stats={overallData.daily} period="daily" />
          <StatsCards stats={overallData.weekly} period="weekly" />
          <StatsCards stats={overallData.monthly} period="monthly" />
        </div>

        {/* By Grade Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Breakdown Per Jenjang</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Statistik kehadiran per tingkatan kelas
                </p>
              </div>
              <Badge variant="outline">
                {overallData.by_grade?.length || 0} Jenjang
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jenjang</TableHead>
                    <TableHead className="text-center">Jumlah Kelas</TableHead>
                    <TableHead className="text-center">Total Kehadiran</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Sakit</TableHead>
                    <TableHead className="text-center">Izin</TableHead>
                    <TableHead className="text-center">Alpa</TableHead>
                    <TableHead className="text-center">Persentase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overallData.by_grade?.map((grade, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{grade.grade_level}</TableCell>
                      <TableCell className="text-center">{grade.class_count}</TableCell>
                      <TableCell className="text-center">{grade.total}</TableCell>
                      <TableCell className="text-center text-emerald-700 font-semibold">{grade.hadir}</TableCell>
                      <TableCell className="text-center text-yellow-700">{grade.sakit}</TableCell>
                      <TableCell className="text-center text-blue-700">{grade.izin}</TableCell>
                      <TableCell className="text-center text-red-700">{grade.alpa}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                          {grade.percentage}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // By Grade View
  const renderByGradeView = () => {
    if (!gradeData) return null;

    return (
      <div className="space-y-6">
        {/* Grade Statistics */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Statistik Jenjang {gradeData.grade_level}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Total keseluruhan untuk jenjang ini
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 rounded-lg border">
                <div className="text-2xl font-bold">{gradeData.grade_statistics?.total || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Total</div>
              </div>
              <div className="text-center p-4 rounded-lg border bg-emerald-50">
                <div className="text-2xl font-bold text-emerald-700">{gradeData.grade_statistics?.hadir || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Hadir</div>
              </div>
              <div className="text-center p-4 rounded-lg border bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-700">{gradeData.grade_statistics?.sakit || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Sakit</div>
              </div>
              <div className="text-center p-4 rounded-lg border bg-blue-50">
                <div className="text-2xl font-bold text-blue-700">{gradeData.grade_statistics?.izin || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Izin</div>
              </div>
              <div className="text-center p-4 rounded-lg border bg-red-50">
                <div className="text-2xl font-bold text-red-700">{gradeData.grade_statistics?.alpa || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Alpa</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Classes in this grade */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Breakdown Per Kelas</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Statistik kehadiran per kelas
                </p>
              </div>
              <Badge variant="outline">
                {gradeData.classes?.length || 0} Kelas
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Kelas</TableHead>
                    <TableHead className="text-center">Jumlah Siswa</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Sakit</TableHead>
                    <TableHead className="text-center">Izin</TableHead>
                    <TableHead className="text-center">Alpa</TableHead>
                    <TableHead className="text-center">Persentase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gradeData.classes?.map((cls, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{cls.class_name}</TableCell>
                      <TableCell className="text-center">{cls.student_count}</TableCell>
                      <TableCell className="text-center">{cls.total}</TableCell>
                      <TableCell className="text-center text-emerald-700 font-semibold">{cls.hadir}</TableCell>
                      <TableCell className="text-center text-yellow-700">{cls.sakit}</TableCell>
                      <TableCell className="text-center text-blue-700">{cls.izin}</TableCell>
                      <TableCell className="text-center text-red-700">{cls.alpa}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                          {cls.percentage}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // By Class View
  const renderByClassView = () => {
    if (!classData) return null;

    return (
      <div className="space-y-6">
        {/* Class Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Kelas {classData.class?.name}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Jenjang: {classData.class?.grade_level} | Wali Kelas: {classData.class?.homeroom_teacher_name || '-'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 rounded-lg border">
                <div className="text-2xl font-bold">{classData.class_statistics?.total || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Total</div>
              </div>
              <div className="text-center p-4 rounded-lg border bg-emerald-50">
                <div className="text-2xl font-bold text-emerald-700">{classData.class_statistics?.hadir || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Hadir</div>
              </div>
              <div className="text-center p-4 rounded-lg border bg-yellow-50">
                <div className="text-2xl font-bold text-yellow-700">{classData.class_statistics?.sakit || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Sakit</div>
              </div>
              <div className="text-center p-4 rounded-lg border bg-blue-50">
                <div className="text-2xl font-bold text-blue-700">{classData.class_statistics?.izin || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Izin</div>
              </div>
              <div className="text-center p-4 rounded-lg border bg-red-50">
                <div className="text-2xl font-bold text-red-700">{classData.class_statistics?.alpa || 0}</div>
                <div className="text-xs text-gray-600 mt-1">Alpa</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Students Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Daftar Siswa</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Statistik kehadiran per siswa
                </p>
              </div>
              <Badge variant="outline">
                {classData.students?.length || 0} Siswa
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead className="text-center">NISN</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Sakit</TableHead>
                    <TableHead className="text-center">Izin</TableHead>
                    <TableHead className="text-center">Alpa</TableHead>
                    <TableHead className="text-center">Persentase</TableHead>
                    <TableHead className="text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classData.students?.map((student, idx) => (
                    <TableRow key={student.student_id}>
                      <TableCell className="font-medium">{idx + 1}</TableCell>
                      <TableCell>{student.student_name}</TableCell>
                      <TableCell className="text-center text-xs font-mono">{student.nisn || '-'}</TableCell>
                      <TableCell className="text-center">{student.summary?.total || 0}</TableCell>
                      <TableCell className="text-center text-emerald-700 font-semibold">{student.summary?.hadir || 0}</TableCell>
                      <TableCell className="text-center text-yellow-700">{student.summary?.sakit || 0}</TableCell>
                      <TableCell className="text-center text-blue-700">{student.summary?.izin || 0}</TableCell>
                      <TableCell className="text-center text-red-700">{student.summary?.alpa || 0}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                          {student.percentage || 0}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetailDialog(student, student.records)}
                        >
                          <Eye className="h-3 w-3 mr-1" />
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
      </div>
    );
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
          <h1 className="text-2xl font-bold">Kehadiran Siswa</h1>
          <p className="text-sm text-gray-500 mt-1">
            Statistik kehadiran siswa per kelas, jenjang, dan keseluruhan
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

      {/* View Mode Tabs */}
      <Tabs value={viewMode} onValueChange={setViewMode}>
        <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-3 gap-2">
          <TabsTrigger value="overall" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Keseluruhan
          </TabsTrigger>
          <TabsTrigger value="by-grade" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Per Jenjang
          </TabsTrigger>
          <TabsTrigger value="by-class" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Per Kelas
          </TabsTrigger>
        </TabsList>

        {/* Selectors for each view mode */}
        <div className="mt-4">
          {viewMode === 'by-grade' && (
            <div className="flex items-center gap-3">
              <Label>Pilih Jenjang:</Label>
              <Select value={selectedGrade} onValueChange={setSelectedGrade}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Pilih jenjang..." />
                </SelectTrigger>
                <SelectContent>
                  {gradeLevels.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {viewMode === 'by-class' && (
            <div className="flex items-center gap-3">
              <Label>Pilih Kelas:</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Pilih kelas..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} - {cls.grade_level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Content for each tab */}
        <TabsContent value="overall" className="mt-6">
          {renderOverallView()}
        </TabsContent>

        <TabsContent value="by-grade" className="mt-6">
          {selectedGrade ? renderByGradeView() : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <p className="text-lg font-medium">Pilih jenjang untuk melihat statistik</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="by-class" className="mt-6">
          {selectedClass ? renderByClassView() : (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <p className="text-lg font-medium">Pilih kelas untuk melihat statistik</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => setDetailDialog({ ...detailDialog, open })}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detail Kehadiran - {detailDialog.student?.student_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Student Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center p-3 rounded-lg border bg-gray-50">
                <div className="text-xl font-bold">{detailDialog.student?.summary?.total || 0}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
              <div className="text-center p-3 rounded-lg border bg-emerald-50">
                <div className="text-xl font-bold text-emerald-700">{detailDialog.student?.summary?.hadir || 0}</div>
                <div className="text-xs text-gray-600">Hadir</div>
              </div>
              <div className="text-center p-3 rounded-lg border bg-yellow-50">
                <div className="text-xl font-bold text-yellow-700">{detailDialog.student?.summary?.sakit || 0}</div>
                <div className="text-xs text-gray-600">Sakit</div>
              </div>
              <div className="text-center p-3 rounded-lg border bg-blue-50">
                <div className="text-xl font-bold text-blue-700">{detailDialog.student?.summary?.izin || 0}</div>
                <div className="text-xs text-gray-600">Izin</div>
              </div>
              <div className="text-center p-3 rounded-lg border bg-red-50">
                <div className="text-xl font-bold text-red-700">{detailDialog.student?.summary?.alpa || 0}</div>
                <div className="text-xs text-gray-600">Alpa</div>
              </div>
            </div>

            {/* Detailed Records */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Riwayat Kehadiran Detail</h3>
              {detailDialog.records && detailDialog.records.length > 0 ? (
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
                      {detailDialog.records.map((record, idx) => (
                        <TableRow key={record.id || idx}>
                          <TableCell className="font-medium">{idx + 1}</TableCell>
                          <TableCell className="text-sm">{formatDate(record.date)}</TableCell>
                          <TableCell>
                            <div className="font-medium text-sm">{record.subject_name || '-'}</div>
                            {record.subject_code && (
                              <div className="text-xs text-gray-500">{record.subject_code}</div>
                            )}
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
                <div className="text-center py-8 text-gray-500">
                  <p>Tidak ada riwayat kehadiran</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KehadiranPage;
