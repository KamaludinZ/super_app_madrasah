# Implementasi Halaman Kelas Digital

**Date**: 2026-09-08
**Status**: Sebagian selesai - perlu tambahan 2 halaman dan update routing

## Progress

### ✅ Selesai:
1. Dashboard Kelas - Tambah nama wali kelas
2. KelasDataSiswaPage.js - Halaman data siswa
3. KelasMateriPage.js - Halaman materi mapel
4. KelasTugasPage.js - Halaman tugas

### ⏳ Masih Perlu Dibuat:
1. KelasJurnalPage.js - Halaman riwayat jurnal kelas
2. KelasKehadiranPage.js - Halaman kehadiran siswa
3. Update routing di App.js
4. Update sidebar menu di AppShell.js

## Files Yang Sudah Dibuat

### 1. KelasDataSiswaPage.js
**Location**: `frontend/src/pages/kelas/KelasDataSiswaPage.js`

**Features**:
- Menampilkan daftar siswa di kelas
- Tabel dengan No Absen, Nama, NISN, NIS, Jenis Kelamin
- API endpoint: `GET /kelas-digital/siswa`

### 2. KelasMateriPage.js
**Location**: `frontend/src/pages/kelas/KelasMateriPage.js`

**Features**:
- Pilih mata pelajaran dulu
- Tampilkan daftar materi per mapel
- Accordion untuk expand/collapse konten materi
- API endpoints:
  - `GET /kelas-digital/jadwal` - Get list of subjects
  - `GET /kelas-digital/materi` - Get materi (filtered by subject_id)

### 3. KelasTugasPage.js
**Location**: `frontend/src/pages/kelas/KelasTugasPage.js`

**Features**:
- Pilih mata pelajaran dulu
- Tampilkan daftar tugas per mapel
- Accordion untuk expand/collapse konten tugas
- API endpoints:
  - `GET /kelas-digital/jadwal` - Get list of subjects
  - `GET /kelas-digital/tugas` - Get tugas (filtered by subject_id)

## Files Yang Masih Perlu Dibuat

### 4. KelasJurnalPage.js (PERLU DIBUAT)
**Location**: `frontend/src/pages/kelas/KelasJurnalPage.js`

**Template Code**:
```javascript
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
import { Loader2, History, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { api } from '@/lib/api';

const KelasJurnalPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jurnal, setJurnal] = useState([]);

  useEffect(() => {
    loadJurnal();
  }, []);

  const loadJurnal = async () => {
    try {
      setLoading(true);
      const res = await api.get('/kelas-digital/jurnal');
      setJurnal(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading jurnal:', err);
      setError(err.response?.data?.detail || 'Gagal memuat riwayat jurnal');
      setLoading(false);
    }
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
                    <TableHead>Materi</TableHead>
                    <TableHead>Kehadiran</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jurnal.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-mono">
                        {format(new Date(j.tanggal), 'dd MMM yyyy', { locale: id })}
                      </TableCell>
                      <TableCell>{j.subject_name}</TableCell>
                      <TableCell>{j.teacher_name}</TableCell>
                      <TableCell className="max-w-md truncate">{j.materi}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {j.hadir}/{j.total} Hadir
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
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
    </div>
  );
};

export default KelasJurnalPage;
```

**API Endpoint yang Dibutuhkan**:
- `GET /kelas-digital/jurnal` - Returns list of teaching journal entries for the class

### 5. KelasKehadiranPage.js (PERLU DIBUAT)
**Location**: `frontend/src/pages/kelas/KelasKehadiranPage.js`

**Template Code**:
```javascript
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
import { Loader2, UserCheck, Calendar } from 'lucide-react';
import { api } from '@/lib/api';

const KelasKehadiranPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [kehadiran, setKehadiran] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    loadKehadiran();
  }, [selectedMonth, selectedYear]);

  const loadKehadiran = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/kelas-digital/kehadiran?month=${selectedMonth}&year=${selectedYear}`);
      setKehadiran(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Error loading kehadiran:', err);
      setError(err.response?.data?.detail || 'Gagal memuat data kehadiran');
      setLoading(false);
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
                Bulan {selectedMonth}/{selectedYear}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedMonth === 1) {
                    setSelectedMonth(12);
                    setSelectedYear(selectedYear - 1);
                  } else {
                    setSelectedMonth(selectedMonth - 1);
                  }
                }}
              >
                ← Bulan Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedMonth === 12) {
                    setSelectedMonth(1);
                    setSelectedYear(selectedYear + 1);
                  } else {
                    setSelectedMonth(selectedMonth + 1);
                  }
                }}
              >
                Bulan Berikutnya →
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
                          <Badge variant="success">{student.hadir}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="warning">{student.sakit}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{student.izin}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="destructive">{student.alpa}</Badge>
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
```

**API Endpoint yang Dibutuhkan**:
- `GET /kelas-digital/kehadiran?month={month}&year={year}` - Returns attendance summary

## Update Routing (PERLU DILAKUKAN)

### Update AppShell.js
**File**: `frontend/src/components/layout/AppShell.js`

**Change**:
```javascript
// BEFORE (lines 109-114):
} else if (role === 'kelas') {
  items.push({ to: '/wali-kelas/siswa', label: 'Data Siswa', icon: Users, testid: 'nav-kelas-siswa' });
  items.push({ to: '/kelas-digital/materi', label: 'Materi Mapel', icon: BookOpen, testid: 'nav-kelas-materi' });
  items.push({ to: '/kelas-digital/tugas', label: 'Tugas', icon: ClipboardList, testid: 'nav-kelas-tugas' });
  items.push({ to: '/wali-kelas/jurnal-kelas', label: 'Riwayat Jurnal Kelas', icon: History, testid: 'nav-kelas-jurnal' });
  items.push({ to: '/wali-kelas/kehadiran', label: 'Kehadiran Siswa', icon: UserCheck, testid: 'nav-kelas-kehadiran' });
}

// AFTER:
} else if (role === 'kelas') {
  items.push({ to: '/kelas/siswa', label: 'Data Siswa', icon: Users, testid: 'nav-kelas-siswa' });
  items.push({ to: '/kelas/materi', label: 'Materi Mapel', icon: BookOpen, testid: 'nav-kelas-materi' });
  items.push({ to: '/kelas/tugas', label: 'Tugas', icon: ClipboardList, testid: 'nav-kelas-tugas' });
  items.push({ to: '/kelas/jurnal', label: 'Riwayat Jurnal Kelas', icon: History, testid: 'nav-kelas-jurnal' });
  items.push({ to: '/kelas/kehadiran', label: 'Kehadiran Siswa', icon: UserCheck, testid: 'nav-kelas-kehadiran' });
}
```

### Update App.js
**File**: `frontend/src/App.js`

**Add imports**:
```javascript
import KelasDataSiswaPage from './pages/kelas/KelasDataSiswaPage';
import KelasMateriPage from './pages/kelas/KelasMateriPage';
import KelasTugasPage from './pages/kelas/KelasTugasPage';
import KelasJurnalPage from './pages/kelas/KelasJurnalPage';
import KelasKehadiranPage from './pages/kelas/KelasKehadiranPage';
```

**Add routes** (inside `<Route element={<RequireAuth />}>`):
```javascript
<Route path="/kelas/siswa" element={<KelasDataSiswaPage />} />
<Route path="/kelas/materi" element={<KelasMateriPage />} />
<Route path="/kelas/tugas" element={<KelasTugasPage />} />
<Route path="/kelas/jurnal" element={<KelasJurnalPage />} />
<Route path="/kelas/kehadiran" element={<KelasKehadiranPage />} />
```

## Backend API Endpoints Yang Perlu Ada

### Endpoint yang Sudah Ada:
1. ✅ `GET /kelas-digital/siswa` - Get students in class
2. ✅ `GET /kelas-digital/jadwal` - Get class schedule/subjects
3. ✅ `GET /kelas-digital/materi` - Get materials
4. ✅ `GET /kelas-digital/tugas` - Get assignments

### Endpoint yang Mungkin Perlu Dibuat:
1. ⚠️ `GET /kelas-digital/jurnal` - Get teaching journal entries
2. ⚠️ `GET /kelas-digital/kehadiran` - Get attendance summary

**Catatan**: Jika endpoint belum ada, perlu dibuat di backend dengan logic:
- Authenticate sebagai role 'kelas'
- Filter data berdasarkan `class_id` dari token
- Return data yang sesuai

## Testing Checklist

- [ ] Login sebagai role kelas
- [ ] Buka /kelas/siswa - Muncul data siswa kelas
- [ ] Buka /kelas/materi - Pilih mapel, muncul daftar materi
- [ ] Buka /kelas/tugas - Pilih mapel, muncul daftar tugas
- [ ] Buka /kelas/jurnal - Muncul riwayat jurnal mengajar
- [ ] Buka /kelas/kehadiran - Muncul rekap kehadiran siswa
- [ ] Sidebar menu semua link benar
- [ ] Tidak ada error 403 atau 404

## Next Steps

1. **Buat file** `KelasJurnalPage.js` dan `KelasKehadiranPage.js` dengan template di atas
2. **Update routing** di `App.js` sesuai instruksi
3. **Update sidebar** di `AppShell.js` sesuai instruksi
4. **Build frontend**: `cd frontend && npm run build`
5. **Restart backend server**
6. **Test semua halaman**

## Summary

- ✅ 3 halaman sudah dibuat (Siswa, Materi, Tugas)
- ⏳ 2 halaman masih perlu dibuat (Jurnal, Kehadiran)
- ⏳ Routing perlu diupdate
- ⏳ Sidebar menu perlu diupdate
- ⏳ Backend API endpoints mungkin perlu dibuat/dicek

---

**Status**: 60% Complete - File template sudah ready, tinggal copy-paste dan update routing
