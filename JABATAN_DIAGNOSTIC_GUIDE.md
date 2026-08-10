# Jabatan Diagnostic Guide

## Masalah yang Ditemukan

Di halaman `/public/agenda` pada tab "Kegiatan Pegawai", sistem masih menampilkan nama role (seperti "Guru Mata Pelajaran", "Wali Kelas") padahal seharusnya menampilkan jabatan (posisi) dari field jabatan.

## Root Cause

Setelah analisis mendalam, ditemukan bahwa:

1. **Kode Backend SUDAH BENAR** ✅
   - Backend sekarang sudah query dari collection `jabatan` berdasarkan `jabatan_ids`
   - Tidak lagi menggunakan field `roles` atau `ROLE_LABELS`

2. **Data Master Jabatan Bermasalah** ❌
   - Di collection `jabatan`, ada entry dengan nama seperti:
     - "Guru Mata Pelajaran"
     - "Wali Kelas"
     - "Guru BK"
     - dll.
   - Nama-nama ini sebenarnya adalah ROLE, bukan JABATAN/posisi
   - Users punya `jabatan_ids` yang menunjuk ke entry jabatan dengan nama role tersebut

## Perbedaan Role vs Jabatan

### Role (Peran Sistem)
Role adalah peran dalam sistem untuk akses kontrol:
- Administrator
- Guru Mata Pelajaran
- Wali Kelas
- Guru BK
- Tenaga Kependidikan
- Kepala Sekolah
- Wakil Kepala Sekolah
- Siswa

### Jabatan (Posisi Organisasi)
Jabatan adalah posisi struktural/fungsional di organisasi:
- Kepala Madrasah
- Wakil Kepala Kurikulum
- Wakil Kepala Kesiswaan
- Wakil Kepala Sarana Prasarana
- Bendahara
- Staff TU
- Kepala Perpustakaan
- Koordinator Mata Pelajaran Bahasa
- dst.

## Cara Menggunakan Diagnostic Tool

### 1. Akses Halaman Diagnostic
```
http://localhost:3000/admin/jabatan-diagnostic
```

### 2. Lihat Hasil Analisis

Halaman diagnostic akan menampilkan:

#### A. Status Overview (3 Cards)
- **Total Jabatan**: Jumlah total entry di master data jabatan
- **Jabatan dengan Nama Role**: Jumlah entry yang bermasalah (menggunakan nama role)
- **User Tanpa Jabatan**: Jumlah user yang belum di-assign jabatan

#### B. Rekomendasi
Langkah-langkah yang harus dilakukan untuk memperbaiki

#### C. Jabatan dengan Nama Role (Bagian Merah)
Menampilkan semua jabatan yang menggunakan nama role, dengan detail:
- Nama jabatan (yang sebenarnya adalah nama role)
- Deskripsi
- Jumlah user yang menggunakan jabatan ini
- Contoh 3 user pertama
- Solusi step-by-step untuk setiap entry

#### D. Jabatan yang Sudah Benar (Bagian Hijau)
Menampilkan jabatan dengan nama posisi yang tepat

#### E. Pengguna Tanpa Jabatan (Bagian Kuning)
User yang belum di-assign jabatan (akan tampil "Jabatan belum ditentukan" di public page)

## Langkah Perbaikan

### Step 1: Buat Master Data Jabatan yang Benar

1. Buka menu **Admin → Jabatan**
2. Buat entry jabatan baru dengan nama POSISI, bukan role:
   - Kepala Madrasah
   - Wakil Kepala Kurikulum
   - Wakil Kepala Kesiswaan
   - Wakil Kepala Sarana Prasarana
   - Bendahara
   - Staff TU
   - Koordinator Ekstrakurikuler
   - Wali Kelas 7A, 7B, 8A, dst. (jika ingin detail per kelas)
   - dll. sesuai struktur organisasi madrasah

### Step 2: Edit Users untuk Menggunakan Jabatan Baru

1. Buka **Admin → Manajemen Pengguna**
2. Untuk setiap user yang di diagnostic tool ditampilkan menggunakan jabatan dengan nama role:
   - Klik Edit
   - Di bagian **Jabatan**, pilih jabatan yang sesuai dari list yang baru dibuat
   - Simpan

### Step 3: Hapus Jabatan dengan Nama Role

Setelah semua user sudah dipindah ke jabatan yang benar:

1. Buka **Admin → Jabatan**
2. Hapus entry dengan nama role seperti:
   - "Guru Mata Pelajaran"
   - "Wali Kelas"
   - "Guru BK"
   - dll.

**CATATAN**: Sistem akan mencegah penghapusan jika masih ada user yang menggunakan jabatan tersebut.

### Step 4: Verifikasi

1. Buka kembali `/admin/jabatan-diagnostic`
2. Pastikan tidak ada lagi entry di bagian "Jabatan dengan Nama Role"
3. Buka `/public/agenda` tab "Kegiatan Pegawai"
4. Verifikasi bahwa sekarang menampilkan jabatan yang benar, bukan role

## API Endpoint Diagnostic

Backend menyediakan endpoint untuk diagnostic (admin only):

```http
GET /api/jabatan/diagnostic/check-role-names
Authorization: Bearer <admin_token>
```

Response:
```json
{
  "total_jabatan": 15,
  "role_based_jabatan": {
    "count": 3,
    "items": [...]
  },
  "proper_jabatan": {
    "count": 12,
    "items": [...]
  },
  "users_without_jabatan": {
    "count": 5,
    "sample": [...]
  },
  "has_issues": true,
  "recommendations": [...]
}
```

## Contoh Data yang Benar

### Master Data Jabatan (Collection: `jabatan`)
```javascript
[
  {
    id: "jab_001",
    name: "Kepala Madrasah",
    description: "Pimpinan tertinggi madrasah",
    is_active: true
  },
  {
    id: "jab_002",
    name: "Wakil Kepala Kurikulum",
    description: "Wakil kepala bidang kurikulum",
    is_active: true
  },
  {
    id: "jab_003",
    name: "Bendahara",
    description: "Pengelola keuangan madrasah",
    is_active: true
  }
  // dst...
]
```

### User Document (Collection: `users`)
```javascript
{
  id: "user_123",
  full_name: "Dra. Siti Aminah, M.Pd",
  nip: "197512312006042001",
  roles: ["guru", "wali_kelas"],  // Role untuk akses sistem
  jabatan_ids: ["jab_002"],        // Jabatan struktural (Wakil Kepala Kurikulum)
  // ...
}
```

### Public Agenda Display
Dengan data di atas, di `/public/agenda` akan tampil:
- Nama: Dra. Siti Aminah, M.Pd
- NIP: 197512312006042001
- Jabatan: **Wakil Kepala Kurikulum** ✅ (bukan "Guru Mata Pelajaran")

## Files yang Sudah Diperbaiki

### Backend
- ✅ `backend/routers/public.py:322-344` - Query jabatan dari collection berdasarkan jabatan_ids
- ✅ `backend/routers/jabatan.py:100-189` - Endpoint diagnostic

### Frontend
- ✅ `frontend/src/pages/PublicAgenda.js:553` - Display jabatan dengan fallback
- ✅ `frontend/src/pages/JabatanDiagnostic.js` - Halaman diagnostic (NEW)
- ✅ `frontend/src/App.js:244` - Route untuk diagnostic page

## Kesimpulan

**Kode sudah benar, yang perlu diperbaiki adalah DATA.**

Sistem sekarang sudah menggunakan jabatan dari master data jabatan collection, bukan dari role. Silakan:

1. Akses `/admin/jabatan-diagnostic` untuk melihat masalah data
2. Buat master data jabatan yang benar (nama posisi, bukan role)
3. Edit users untuk menggunakan jabatan yang baru
4. Hapus jabatan dengan nama role
5. Verifikasi di `/public/agenda`

---

**Created**: 2026-08-10
**Version**: 1.2.1
