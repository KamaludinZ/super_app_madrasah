# Dokumentasi Routes Terpisah untuk Role Management

## Overview

Sistem ini menggunakan **route terpisah** untuk setiap role management demi meningkatkan keamanan dan maintainability. Setiap role memiliki namespace endpoint sendiri:

- **Waka Kurikulum**: `/wakakur/*` (Backend) dan `/wakakur/*` (Frontend)
- **Kepala Sekolah**: `/kepsek/*` (Backend) dan `/kepsek/*` (Frontend)
- **Kepala Tata Usaha**: `/katu/*` (Backend) dan `/katu/*` (Frontend)
- **Admin**: `/admin/*` (Backend) dan `/admin/*` (Frontend) - tetap seperti sekarang

## Keuntungan Pendekatan Ini

1. ✅ **Security**: Permission checking lebih ketat per role
2. ✅ **Isolation**: Perubahan di satu role tidak affect role lain
3. ✅ **Auditability**: Lebih mudah track aktivitas per role
4. ✅ **Scalability**: Mudah menambah fitur spesifik per role

---

## 1. Waka Kurikulum Routes

### Backend Endpoints (`backend/routers/waka_kurikulum.py`)

**Status**: ✅ SUDAH DIBUAT

Endpoints yang tersedia:
- `GET /wakakur/stats` - Dashboard statistics
- `GET /wakakur/stats/students` - Student statistics
- `GET /wakakur/stats/achievements` - Achievement statistics
- `GET /wakakur/siswa` - List students
- `GET /wakakur/siswa/{id}/detail` - Student detail
- `GET /wakakur/kehadiran/by-class` - Attendance by class
- `GET /wakakur/kehadiran/by-grade` - Attendance by grade
- `GET /wakakur/kehadiran/overall` - Overall attendance
- `GET /wakakur/jurnal` - Teaching journals
- `GET /wakakur/jurnal/stats-by-teacher` - Journal stats by teacher
- `GET /wakakur/jadwal` - Schedules
- `GET /wakakur/users` - Users/teachers list
- `GET /wakakur/classes` - Classes list
- `GET /wakakur/subjects` - Subjects list
- `GET /wakakur/materi` - Learning materials
- `GET /wakakur/tugas` - Assignments
- `GET /wakakur/tugas/{id}/submissions` - Assignment submissions

### Frontend Pages

**Status**: 🟡 PARTIALLY IMPLEMENTED

#### Sudah Dibuat:
1. ✅ `WakaKurSiswaPage.js` - Data Siswa
2. ✅ `WakaKurSchedulesPage.js` - Jadwal Pelajaran
3. ✅ `WakaKurJurnalPage.js` - Data Jurnal

#### Belum Dibuat (Perlu Implementasi):
4. ❌ `WakaKurKehadiranPage.js` - Kehadiran Siswa
5. ❌ `WakaKurBukuIndukPage.js` - Buku Induk Siswa
6. ❌ `WakaKurCetakAbsensiPage.js` - Cetak Absensi Manual
7. ❌ `WakaKurAlumniPage.js` - Data Alumni
8. ❌ `WakaKurNaikKelasPage.js` - Naik Kelas & Kelulusan
9. ❌ `WakaKurJadwalPiketPage.js` - Jadwal Piket
10. ❌ `WakaKurIndikatorMateriPage.js` - Data Indikator & Materi
11. ❌ `WakaKurMateriPage.js` - Materi Mapel
12. ❌ `WakaKurTugasPage.js` - Tugas Mapel
13. ❌ `WakaKurNilaiPage.js` - Input Nilai
14. ❌ `WakaKurRaporPage.js` - E-Rapor Digital
15. ❌ `WakaKurKegiatanPage.js` - Kegiatan Madrasah
16. ❌ `WakaKurPrestasiPage.js` - Data Prestasi
17. ❌ `WakaKurPiketPage.js` - Tugas & Piket
18. ❌ `WakaKurPengumumanPage.js` - Pengumuman

### Frontend Routes (App.js)

Tambahkan di `App.js`:

```javascript
// Waka Kurikulum Routes
import WakaKurSiswaPage from '@/pages/wakakur/WakaKurSiswaPage';
import WakaKurSchedulesPage from '@/pages/wakakur/WakaKurSchedulesPage';
import WakaKurJurnalPage from '@/pages/wakakur/WakaKurJurnalPage';
// ... import pages lainnya

// Di dalam <Routes>
<Route path="/wakakur/siswa" element={<WakaKurSiswaPage />} />
<Route path="/wakakur/jadwal" element={<WakaKurSchedulesPage />} />
<Route path="/wakakur/jurnal" element={<WakaKurJurnalPage />} />
// ... routes lainnya
```

---

## 2. Kepala Sekolah Routes

### Backend Endpoints (`backend/routers/kepala_sekolah.py`)

**Status**: ❌ BELUM DIBUAT

Endpoints yang perlu dibuat:
- `GET /kepsek/stats` - Dashboard statistics
- `GET /kepsek/stats/students` - Student statistics
- `GET /kepsek/stats/achievements` - Achievement statistics
- `GET /kepsek/kehadiran/*` - All attendance endpoints
- `GET /kepsek/jurnal` - Teaching journals
- `GET /kepsek/prestasi` - Achievements
- `GET /kepsek/rkam` - RKAM data
- `GET /kepsek/kegiatan` - School events
- `GET /kepsek/agenda` - Personal agenda

### Frontend Pages

**Status**: ❌ BELUM DIBUAT

Pages yang perlu dibuat:
1. `KepsekDashboard.js` - Custom dashboard (already using AdminDashboard)
2. `KepsekKehadiranPage.js` - Attendance monitoring
3. `KepsekJurnalPage.js` - Journal monitoring
4. `KepsekPrestasiPage.js` - Achievement data
5. `KepsekRKAMPage.js` - RKAM monitoring
6. `KepsekKegiatanPage.js` - School events
7. `KepsekAgendaPage.js` - Personal agenda

---

## 3. Kepala Tata Usaha Routes

### Backend Endpoints (`backend/routers/kepala_tata_usaha.py`)

**Status**: ❌ BELUM DIBUAT

Endpoints yang perlu dibuat:
- `GET /katu/stats` - Dashboard statistics
- `GET /katu/users` - All users (GTK)
- `GET /katu/siswa` - All students
- `GET /katu/gtk` - GTK data
- `GET /katu/rkam` - RKAM data
- `GET /katu/prestasi` - Achievement data
- `GET /katu/kegiatan` - School events

### Frontend Pages

**Status**: ❌ BELUM DIBUAT

Pages yang perlu dibuat:
1. `KatuDashboard.js` - Custom dashboard
2. `KatuUsersPage.js` - User management (read-only)
3. `KatuSiswaPage.js` - Student data
4. `KatuGTKPage.js` - GTK data
5. `KatuRKAMPage.js` - RKAM data
6. `KatuPrestasiPage.js` - Achievement data
7. `KatuKegiatanPage.js` - School events

---

## 4. Waka Lainnya (Kesiswaan, Sarpras, Humas)

### Status: ❌ BELUM DIBUAT

Routes yang perlu dibuat:
- `/wakasis/*` - Waka Kesiswaan
- `/wakasarpras/*` - Waka Sarana Prasarana
- `/wakahumas/*` - Waka Humas

---

## Implementation Strategy

### Phase 1: Waka Kurikulum (CURRENT)
- ✅ Backend router created
- ✅ Basic pages created (Siswa, Schedules, Jurnal)
- 🟡 Remaining pages needed
- ❌ App.js routing needed

### Phase 2: Kepala Sekolah (NEXT)
- ❌ Backend router
- ❌ Frontend pages
- ❌ App.js routing

### Phase 3: Kepala Tata Usaha
- ❌ Backend router
- ❌ Frontend pages
- ❌ App.js routing

### Phase 4: Waka Lainnya
- ❌ Backend routers
- ❌ Frontend pages
- ❌ App.js routing

---

## Template untuk Membuat Page Baru

### Backend Router Template:

```python
@router.get("/[ROLE]/[FEATURE]")
async def [role]_[feature](
    user: Dict = Depends(require_role('[ROLE]'))
):
    """[Description]"""
    # Implementation here
    pass
```

### Frontend Page Template:

```javascript
import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
// ... other imports

export default function [Role][Feature]Page() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/[role]/[endpoint]');
      setData(res.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  // Render implementation
}
```

---

## Next Steps

1. **Immediate**: Add remaining Waka Kurikulum pages
2. **Short-term**: Implement Kepala Sekolah routes
3. **Medium-term**: Implement Kepala Tata Usaha routes
4. **Long-term**: Implement other Waka routes

---

## Notes

- Semua endpoint menggunakan **read-only access** untuk non-admin roles
- Backend sudah include permission checking via `require_role()`
- Frontend pages bisa re-use components dari admin pages dengan minor modifications
- Setiap page harus menampilkan badge "Read-Only" untuk clarity
