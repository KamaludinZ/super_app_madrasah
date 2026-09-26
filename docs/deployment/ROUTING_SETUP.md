# Setup Routing untuk Fitur Kelas Digital

## Langkah-langkah Update App.js

Buka file `frontend/src/App.js` dan tambahkan routing berikut:

### 1. Import Components

Tambahkan import di bagian atas file (setelah import component lainnya):

```javascript
// Import Kelas Digital Pages
import KelasLoginPage from '@/pages/KelasLoginPage';
import KelasDataSiswaPage from '@/pages/kelas/KelasDataSiswaPage';
import KelasMateriPage from '@/pages/kelas/KelasMateriPage';
import KelasTugasPage from '@/pages/kelas/KelasTugasPage';
```

### 2. Tambahkan Routes

#### A. Public Route (Login Kelas)

Tambahkan route ini **di luar** `<Route element={<ProtectedRoute />}>` (sejajar dengan `/login`, `/forgot-password`, dll):

```javascript
{/* Kelas Digital Login - Public */}
<Route path="/kelas-login" element={<KelasLoginPage />} />
```

**Contoh lokasi:**
```javascript
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
  <Route path="/reset-password" element={<ResetPasswordPage />} />

  {/* Tambahkan di sini */}
  <Route path="/kelas-login" element={<KelasLoginPage />} />

  {/* Public pages */}
  <Route path="/public/monitoring" element={<PublicMonitoring />} />
  {/* ... dst */}
```

#### B. Protected Routes (Role Kelas)

Tambahkan routes ini **di dalam** `<Route element={<ProtectedRoute />}>`:

```javascript
{/* Kelas Digital - Protected Routes */}
<Route path="/data-siswa" element={<KelasDataSiswaPage />} />
<Route path="/pembelajaran/materi" element={<KelasMateriPage />} />
<Route path="/pembelajaran/tugas" element={<KelasTugasPage />} />
```

**Contoh lokasi:**
```javascript
<Route element={<ProtectedRoute />}>
  <Route element={<AppShell />}>
    <Route path="/dashboard" element={<DashboardRouter />} />
    <Route path="/jurnal-scan" element={<JurnalScanPage />} />
    {/* ... routes lainnya ... */}

    {/* Tambahkan di sini */}
    <Route path="/data-siswa" element={<KelasDataSiswaPage />} />
    <Route path="/pembelajaran/materi" element={<KelasMateriPage />} />
    <Route path="/pembelajaran/tugas" element={<KelasTugasPage />} />

  </Route>
</Route>
```

## Contoh Lengkap App.js (Bagian Routes)

```javascript
import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
// ... imports lainnya ...

// Import Kelas Digital Pages
import KelasLoginPage from '@/pages/KelasLoginPage';
import KelasDataSiswaPage from '@/pages/kelas/KelasDataSiswaPage';
import KelasMateriPage from '@/pages/kelas/KelasMateriPage';
import KelasTugasPage from '@/pages/kelas/KelasTugasPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/kelas-login" element={<KelasLoginPage />} />

          <Route path="/public/monitoring" element={<PublicMonitoring />} />
          <Route path="/public/prestasi" element={<PublicPrestasi />} />
          <Route path="/public/agenda" element={<PublicAgenda />} />
          <Route path="/public/rkam" element={<PublicRKAMPage />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<DashboardRouter />} />
              <Route path="/jurnal-scan" element={<JurnalScanPage />} />
              <Route path="/jadwal" element={<JadwalPage />} />

              {/* Kelas Digital Routes */}
              <Route path="/data-siswa" element={<KelasDataSiswaPage />} />
              <Route path="/pembelajaran/materi" element={<KelasMateriPage />} />
              <Route path="/pembelajaran/tugas" element={<KelasTugasPage />} />

              {/* ... routes lainnya ... */}
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<ErrorPage />} />
        </Routes>
      </BrowserRouter>

      <Toaster />
      <SyncStatusIndicator />
      <InstallPWA />
    </AuthProvider>
  );
}

export default App;
```

## Verifikasi

Setelah update App.js, restart development server:

```bash
# Stop server (Ctrl+C)
# Start ulang
npm start
```

Lalu test:
1. Buka `/kelas-login` - Harus bisa diakses tanpa login
2. Login sebagai kelas
3. Test menu:
   - `/data-siswa` - Harus bisa diakses setelah login kelas
   - `/pembelajaran/materi` - Harus bisa diakses setelah login kelas
   - `/pembelajaran/tugas` - Harus bisa diakses setelah login kelas

## Troubleshooting

### Error: Cannot find module '@/pages/KelasLoginPage'
- Pastikan file sudah dibuat di lokasi yang benar
- Restart development server

### Error: Page not found
- Cek routing sudah ditambahkan dengan benar
- Cek path spelling (case-sensitive)

### Error: Unauthorized saat akses halaman kelas
- Pastikan sudah login sebagai kelas terlebih dahulu
- Cek token di localStorage: `localStorage.getItem('access_token')`
