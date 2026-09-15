# Dokumentasi Fitur Kelas Digital

## Overview
Fitur **Kelas Digital** adalah sistem pembelajaran digital yang memungkinkan akses materi dan tugas melalui akun kelas. Fitur ini menambahkan role baru `kelas` yang dapat login menggunakan token khusus.

## Fitur yang Diimplementasikan

### 1. **Role Kelas**
- Role baru `kelas` ditambahkan ke sistem
- Login menggunakan kombinasi: Tahun Pelajaran + Semester + Nama Kelas + Token
- Token disimpan di database `classes` collection

### 2. **Backend API** (`backend/routers/kelas_digital.py`)

#### Endpoints yang Tersedia:

##### Authentication
- **POST** `/api/kelas-digital/auth/login`
  - Login untuk akun kelas
  - Body: `academic_year_id`, `semester`, `class_name`, `token`, `captcha_id`, `captcha_answer`
  - Response: Access token + informasi kelas

##### Data Siswa
- **GET** `/api/kelas-digital/siswa`
  - Mendapatkan daftar siswa di kelas (role: kelas)
  - Return: List siswa dengan No. Absen, Nama, NISN, NIS, Jenis Kelamin

##### Materi Mapel
- **POST** `/api/kelas-digital/materi` - Buat materi (guru/admin)
- **GET** `/api/kelas-digital/materi` - List materi (filtered by role)
- **GET** `/api/kelas-digital/materi/{id}` - Detail materi
- **PUT** `/api/kelas-digital/materi/{id}` - Update materi (guru/admin)
- **DELETE** `/api/kelas-digital/materi/{id}` - Hapus materi (soft delete)

##### Tugas
- **POST** `/api/kelas-digital/tugas` - Buat tugas (guru/admin)
- **GET** `/api/kelas-digital/tugas` - List tugas (filtered by role)
- **GET** `/api/kelas-digital/tugas/{id}` - Detail tugas
- **PUT** `/api/kelas-digital/tugas/{id}` - Update tugas (guru/admin)
- **DELETE** `/api/kelas-digital/tugas/{id}` - Hapus tugas (soft delete)

##### Jadwal
- **GET** `/api/kelas-digital/jadwal`
  - Mendapatkan daftar mata pelajaran dengan guru pengajar
  - Untuk role kelas

### 3. **Frontend Pages**

#### Login Page (`frontend/src/pages/KelasLoginPage.js`)
- Halaman login khusus untuk akun kelas
- Form dengan dropdown: Tahun Pelajaran, Semester, Nama Kelas
- Input token (password)
- Captcha verification
- Accessible via: `/kelas-login`

#### Dashboard Kelas (`frontend/src/pages/dashboards/KelasDashboard.js`)
- Dashboard khusus untuk role kelas
- Menampilkan informasi kelas
- Quick access ke: Data Siswa, Materi Mapel, Tugas

#### Data Siswa (`frontend/src/pages/kelas/KelasDataSiswaPage.js`)
- Tabel daftar siswa
- Kolom: No. Absen, Nama, NISN, NIS, Jenis Kelamin
- Accessible via: `/data-siswa` (role: kelas)

#### Materi Mapel (`frontend/src/pages/kelas/KelasMateriPage.js`)
- Pilih mata pelajaran dari jadwal mengajar
- Materi ditampilkan dalam accordion
- Header: Judul + Waktu dibuat
- Content: Rich text HTML
- Accessible via: `/pembelajaran/materi` (role: kelas)

#### Tugas (`frontend/src/pages/kelas/KelasTugasPage.js`)
- Pilih mata pelajaran dari jadwal mengajar
- Tugas ditampilkan dalam accordion
- Header: Judul + Waktu dibuat
- Content: Rich text HTML
- Accessible via: `/pembelajaran/tugas` (role: kelas)

### 4. **Database Models** (`backend/models.py`)

#### MateriMapelModel
```python
{
  "id": "uuid",
  "judul": "string",
  "konten": "string (HTML)",
  "target_role": ["kelas" | "siswa"],
  "target_kelas_ids": ["class_id1", "class_id2"],
  "target_siswa": [
    {
      "class_id": "xxx",
      "student_ids": ["s1", "s2"] | "all"
    }
  ],
  "teacher_id": "string",
  "subject_id": "string",
  "semester_id": "string",
  "academic_year_id": "string",
  "created_at": "datetime",
  "updated_at": "datetime",
  "is_active": true
}
```

#### TugasModel
Struktur sama dengan MateriMapelModel

## Cara Menggunakan

### Setup untuk Admin

1. **Generate Token Kelas**
   - Setiap kelas harus memiliki token unik
   - Token disimpan di field `token` pada collection `classes`
   - Format token bebas (contoh: `7A-2025-ABC123`)

2. **MongoDB Collections**
   - `materi_mapel` - Menyimpan semua materi
   - `tugas` - Menyimpan semua tugas

### Untuk Guru

#### Membuat Materi/Tugas
1. Login sebagai guru
2. Navigasi ke menu "Pembelajaran" > "Materi" atau "Tugas"
3. Klik "Tambah Materi" atau "Tambah Tugas"
4. Isi form:
   - Judul
   - Konten (rich text editor)
   - Pilih target: Kelas atau Siswa (bisa keduanya)
   - Jika target kelas: Pilih kelas yang diajar
   - Jika target siswa: Pilih kelas, lalu pilih siswa (individual/semua)
5. Simpan

#### Melihat/Edit/Hapus Materi/Tugas
- Guru hanya bisa edit/hapus materi/tugas yang dibuatnya sendiri
- Admin bisa edit/hapus semua materi/tugas

### Untuk Akun Kelas

1. **Login**
   - Buka `/kelas-login`
   - Pilih Tahun Pelajaran
   - Pilih Semester
   - Pilih Nama Kelas
   - Masukkan Token Kelas (dari wali kelas)
   - Selesaikan captcha
   - Klik "Masuk ke Kelas Digital"

2. **Akses Menu**
   - **Data Siswa**: Melihat daftar siswa di kelas
   - **Materi Mapel**:
     - Pilih mata pelajaran
     - Lihat materi dalam accordion
   - **Tugas**:
     - Pilih mata pelajaran
     - Lihat tugas dalam accordion

### Untuk Siswa
(Belum diimplementasikan dalam scope ini)
- Siswa akan melihat materi/tugas di menu "Pembelajaran"
- Tab "Kelas": Materi/tugas yang ditujukan untuk kelas
- Tab "Siswa": Materi/tugas yang ditujukan khusus untuk siswa tersebut

### Untuk Admin
(Belum diimplementasikan dalam scope ini)
- Admin memiliki akses penuh CRUD untuk semua materi dan tugas
- Bisa melihat semua materi/tugas dari semua guru
- Bisa edit/hapus materi/tugas

## Routing yang Perlu Ditambahkan di App.js

Tambahkan routes berikut di `frontend/src/App.js`:

```javascript
// Di luar ProtectedRoute (public)
<Route path="/kelas-login" element={<KelasLoginPage />} />

// Di dalam ProtectedRoute (authenticated)
// Untuk role: kelas
<Route path="/data-siswa" element={<KelasDataSiswaPage />} />
<Route path="/pembelajaran/materi" element={<KelasMateriPage />} />
<Route path="/pembelajaran/tugas" element={<KelasTugasPage />} />
```

## Database Setup

### Menambahkan Token ke Kelas
Jalankan query MongoDB untuk menambahkan token ke kelas:

```javascript
db.classes.updateOne(
  { name: "7A", academic_year_id: "...", semester_id: "..." },
  { $set: { token: "7A-2025-ABC123" } }
)
```

Atau buat script untuk generate token otomatis untuk semua kelas.

## Catatan Penting

1. **Security**
   - Token kelas harus unik dan kompleks
   - Jangan share token di tempat public
   - Token dapat diganti jika bocor

2. **Permission**
   - Role kelas hanya bisa READ (tidak bisa create/update/delete)
   - Guru hanya bisa edit materi/tugas miliknya sendiri
   - Admin memiliki akses penuh

3. **Rich Text Editor**
   - Konten materi dan tugas support HTML
   - Frontend perlu rich text editor (seperti Quill, TinyMCE, atau React-Quill)
   - Pastikan sanitize HTML untuk keamanan

4. **Target Distribution**
   - Materi/tugas bisa ditargetkan ke:
     - Kelas (semua siswa di kelas tertentu)
     - Siswa (individual atau subset siswa di kelas)
   - Satu materi/tugas bisa ditargetkan ke multiple kelas atau multiple siswa

## TODO / Future Enhancements

### Yang Belum Diimplementasikan:
1. **Halaman Guru untuk Materi & Tugas**
   - Form dengan rich text editor
   - Filter kelas dengan dropdown jenjang dan kelas
   - Tab Kelas dan Tab Siswa
   - Hirarki siswa untuk target selection

2. **Halaman Siswa untuk Materi & Tugas**
   - Tab Kelas: Materi yang ditujukan ke kelas
   - Tab Siswa: Materi yang ditujukan khusus untuk siswa

3. **Halaman Admin untuk Materi & Tugas**
   - CRUD lengkap semua materi/tugas
   - Tab Kelas dan Tab Siswa

4. **Rich Text Editor Integration**
   - Install: `npm install react-quill quill`
   - Integrate di form create/edit materi dan tugas

5. **Token Management**
   - UI untuk admin/wali kelas generate dan manage token kelas
   - Auto-generate token dengan format tertentu
   - History token (untuk audit)

6. **Public Access untuk Link Kelas**
   - Tambahkan link "Akses Kelas Digital" di halaman public/login
   - Redirect ke `/kelas-login`

7. **Submission System untuk Tugas**
   - Siswa bisa upload jawaban tugas
   - Guru bisa review dan beri nilai

8. **Notification**
   - Notifikasi saat ada materi/tugas baru

## File Structure

```
backend/
├── models.py                           # ✅ Updated (added Kelas models)
├── server.py                           # ✅ Updated (registered router)
└── routers/
    └── kelas_digital.py                # ✅ New file

frontend/
└── src/
    └── pages/
        ├── KelasLoginPage.js           # ✅ New file
        ├── DashboardRouter.js          # ✅ Updated
        ├── dashboards/
        │   └── KelasDashboard.js       # ✅ New file
        └── kelas/
            ├── KelasDataSiswaPage.js   # ✅ New file
            ├── KelasMateriPage.js      # ✅ New file
            └── KelasTugasPage.js       # ✅ New file
```

## Testing

### Test Login Kelas
1. Buat kelas di database dengan token
2. Buka `/kelas-login`
3. Login dengan credentials kelas
4. Verify dashboard muncul dengan benar

### Test CRUD Materi/Tugas
1. Login sebagai guru
2. Buat materi/tugas baru
3. Verify materi/tugas muncul di kelas yang ditarget
4. Login sebagai kelas, verify materi/tugas bisa dilihat

### Test Permission
1. Coba edit materi guru lain (should fail)
2. Coba delete materi sebagai kelas (should fail)
3. Admin should be able to edit/delete all

## Akses ke Halaman Login Kelas

Link "Akses Kelas Digital" telah ditambahkan di:

1. **Halaman Login Utama** (`/login`)
   - Link berada di bawah tombol "Masuk", setelah link "Lupa password?"
   - Icon buku dengan teks "Akses Kelas Digital"

2. **Semua Halaman Public**:
   - `/public/monitoring` - Monitoring Jurnal Publik
   - `/public/prestasi` - Prestasi Madrasah
   - `/public/agenda` - Agenda Kegiatan
   - `/public/rkam` - RKAM & Transparansi Keuangan

   Link berada di navigation menu, setelah menu RKAM dengan separator (garis vertikal)

## Support & Contact

Untuk pertanyaan atau issue, silakan hubungi tim development.

---

**Last Updated**: 2026-09-08
**Version**: 1.0.0
**Status**: ✅ Core Features Implemented (Role Kelas Complete + Navigation Links Added)
