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
import { Loader2, Users } from 'lucide-react';
import { api } from '@/lib/api';

const KelasDataSiswaPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/kelas/siswa');
      setData(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.response?.data?.detail || 'Gagal memuat data siswa');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          <p className="text-sm text-gray-600">Memuat data siswa...</p>
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
        <h1 className="text-3xl font-bold">Data Siswa</h1>
        <p className="text-gray-600 mt-2">
          Daftar siswa di kelas {data?.class_name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-600" />
            <div>
              <CardTitle>Daftar Siswa Kelas {data?.class_name}</CardTitle>
              <CardDescription>
                Total {data?.total_siswa} siswa
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">No. Absen</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>NISN</TableHead>
                  <TableHead>NIS</TableHead>
                  <TableHead>Jenis Kelamin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.siswa && data.siswa.length > 0 ? (
                  data.siswa.map((siswa) => (
                    <TableRow key={siswa.nisn || siswa.no_absen}>
                      <TableCell className="font-medium">{siswa.no_absen}</TableCell>
                      <TableCell>{siswa.nama}</TableCell>
                      <TableCell>{siswa.nisn || '-'}</TableCell>
                      <TableCell>{siswa.nis || '-'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          siswa.jenis_kelamin === 'L' || siswa.jenis_kelamin === 'Laki-laki'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-pink-100 text-pink-800'
                        }`}>
                          {siswa.jenis_kelamin === 'L' || siswa.jenis_kelamin === 'Laki-laki' ? 'Laki-laki' : 'Perempuan'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      Tidak ada data siswa
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KelasDataSiswaPage;
