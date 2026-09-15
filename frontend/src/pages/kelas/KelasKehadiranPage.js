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
import { Loader2, UserCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';

const KelasKehadiranPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kehadiran, setKehadiran] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  useEffect(() => {
    loadKehadiran();
  }, [selectedMonth, selectedYear]);

  const loadKehadiran = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/kelas/kehadiran?month=${selectedMonth}&year=${selectedYear}`);
      setKehadiran(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading kehadiran:', err);
      setError(err.response?.data?.detail || 'Gagal memuat data kehadiran');
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          <p className="text-sm text-gray-600">Memuat data kehadiran...</p>
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
          <UserCheck className="h-8 w-8" />
          Kehadiran Siswa
        </h1>
        <p className="text-gray-600 mt-2">
          Rekap kehadiran siswa di kelas
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rekap Kehadiran</CardTitle>
              <CardDescription>
                {monthNames[selectedMonth - 1]} {selectedYear}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevMonth}
              >
                <ChevronLeft className="h-4 w-4" />
                Bulan Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
              >
                Bulan Berikutnya
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {kehadiran?.students && kehadiran.students.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead className="text-center">Hadir</TableHead>
                    <TableHead className="text-center">Sakit</TableHead>
                    <TableHead className="text-center">Izin</TableHead>
                    <TableHead className="text-center">Alpa</TableHead>
                    <TableHead className="text-center">% Kehadiran</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kehadiran.students.map((student, idx) => {
                    const totalHari = kehadiran.total_hari || 1;
                    const persentase = ((student.hadir / totalHari) * 100).toFixed(1);
                    return (
                      <TableRow key={student.id}>
                        <TableCell>{idx + 1}</TableCell>
                        <TableCell className="font-semibold">{student.nama}</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            {student.hadir}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                            {student.sakit}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                            {student.izin}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-red-100 text-red-800 border-red-200">
                            {student.alpa}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {persentase}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Tidak ada data kehadiran untuk bulan ini
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default KelasKehadiranPage;
