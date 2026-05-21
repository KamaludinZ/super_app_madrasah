# Sistem Hierarkis Pembagian Waktu

## 📋 Struktur Hierarkis

```
Tahun Takwim (Calendar Year)
   └── Tahun Pelajaran (Academic Year)
          └── Semester
```

## 🎯 Tujuan

1. **Pemisahan Data yang Jelas**: Data dibagi berdasarkan konteks waktu yang tepat
2. **Validasi Tanggal Otomatis**: Mencegah kesalahan input data di periode yang salah
3. **Reporting Fleksibel**: Laporan bisa di-filter berdasarkan level waktu yang berbeda
4. **Context Switching**: User bisa memilih periode waktu yang ingin dilihat

## 📊 Struktur Model Database

### 1. Tahun Takwim (TahunTakwimModel)

**Fungsi**: Mengatur kalender umum aplikasi (Januari - Desember)

**Fields**:
- `id`: UUID
- `year`: int (contoh: 2026)
- `start_date`: str (YYYY-MM-DD) - default: "2026-01-01"
- `end_date`: str (YYYY-MM-DD) - default: "2026-12-31"
- `is_active`: bool
- `created_at`: datetime

**Use Cases**:
- Laporan keuangan bulanan (SPP, BOS)
- Anggaran tahunan sekolah
- Agenda libur nasional
- Timestamp riwayat data

---

### 2. Tahun Pelajaran (AcademicYearModel) - UPDATED

**Fungsi**: Mengatur siklus kenaikan kelas

**Fields** (yang ditambahkan):
- `tahun_takwim_id`: str (relasi ke Tahun Takwim)
- `start_date`: str (YYYY-MM-DD) - contoh: "2025-07-01"
- `end_date`: str (YYYY-MM-DD) - contoh: "2026-06-30"

**Fields Existing**:
- `id`, `name`, `is_active`, `created_at`

**Use Cases**:
- Rapor akhir tahun
- Grafik kelulusan
- Kenaikan kelas
- Statistik tahunan

---

### 3. Semester (SemesterModel) - SUDAH BAGUS ✅

**Fungsi**: Pembagian evaluasi nilai

**Fields** (sudah ada):
- `id`, `name`, `code`
- `academic_year_id`: relasi ke Tahun Pelajaran
- `curriculum_id`
- `start_date`, `end_date`
- `is_active`, `semester_type`

**Use Cases**:
- Rapor bayangan
- Nilai UTS/UAS
- Kehadiran jangka pendek

---

## 🔄 Relasi Data

### Contoh Hierarki:
```
[Tahun Takwim: 2026] (1 Jan 2026 - 31 Des 2026)
   └── [Tahun Pelajaran: 2025/2026] (1 Jul 2025 - 30 Jun 2026)
          ├── [Semester: Ganjil] (1 Jul 2025 - 31 Des 2025)
          └── [Semester: Genap] (1 Jan 2026 - 30 Jun 2026)
```

### Validasi Hierarkis:
1. **Semester** harus berada dalam range `AcademicYear`
2. **AcademicYear** bisa melintasi 2 `TahunTakwim` (contoh: 2025/2026)
3. **TahunTakwim** berdiri sendiri, tidak bergantung pada yang lain

---

## 🎨 UI Context Switching

### ViewContextDialog Enhancement

**Level 1: Pilih Tahun Takwim** (opsional, default: tahun saat ini)
- Untuk admin yang ingin lihat data historis
- Dropdown: "2024", "2025", "2026"

**Level 2: Pilih Tahun Pelajaran** (wajib)
- Dropdown: "2024/2025", "2025/2026"
- Auto-filter berdasarkan Tahun Takwim yang dipilih

**Level 3: Pilih Semester** (wajib)
- Dropdown: "Ganjil", "Genap"
- Auto-filter berdasarkan Tahun Pelajaran yang dipilih

### Indicator Aktif
- **Hijau**: Sedang melihat periode aktif saat ini
- **Oranye**: Sedang melihat periode lain (historical/future)
- **Badge**: Menampilkan konteks yang sedang aktif

---

## 📈 Reporting System

### Filter Multi-Level

**1. Laporan Semester** (Default)
- Rapor bayangan
- Nilai UTS/UAS
- Absensi per semester

**2. Laporan Tahun Pelajaran**
- Rapor akhir tahun
- Grafik kenaikan kelas
- Statistik tahunan siswa

**3. Laporan Tahun Takwim**
- Laporan keuangan (SPP, BOS)
- Anggaran tahunan
- Laporan ke Dinas Pendidikan

---

## 🔒 Validasi Tanggal

### Aturan Validasi:

1. **Input Data Nilai**
   - Harus sesuai dengan `start_date` - `end_date` Semester aktif
   - Tidak bisa input nilai Semester Ganjil jika tanggal tidak dalam range

2. **Input Data Absensi**
   - Harus sesuai dengan Semester aktif
   - Warning jika mencoba input data untuk semester yang sudah lewat

3. **Input Data Keuangan**
   - Harus sesuai dengan Tahun Takwim aktif
   - Bisa input di tahun yang berbeda dengan approval khusus

4. **Kenaikan Kelas**
   - Hanya bisa dilakukan di akhir Tahun Pelajaran
   - Validasi: tanggal harus dekat dengan `end_date` Academic Year

---

## 🚀 Implementasi Bertahap

### Phase 1: Model & Database ✅
- [x] Buat TahunTakwimModel
- [x] Update AcademicYearModel (tambah relasi & dates)
- [x] Validasi SemesterModel sudah benar

### Phase 2: Backend API
- [ ] CRUD endpoints untuk Tahun Takwim
- [ ] Update endpoints Academic Year
- [ ] Tambah validasi hierarkis
- [ ] Update `get_active_context()` untuk support tahun takwim

### Phase 3: Frontend UI
- [ ] Admin page untuk manage Tahun Takwim
- [ ] Update ViewContextDialog dengan 3 level
- [ ] Update indicator visual (hijau/oranye)
- [ ] Context badge di sidebar

### Phase 4: Reporting Enhancement
- [ ] Multi-level filter di halaman laporan
- [ ] Export laporan berdasarkan level waktu
- [ ] Dashboard analytics per level

### Phase 5: Validasi & Testing
- [ ] Implementasi date validation
- [ ] Unit test validasi hierarkis
- [ ] E2E testing context switching
- [ ] User acceptance testing

---

## 💡 Keuntungan Sistem Ini

1. **Data Isolation**: Data tidak tercampur antar periode
2. **Historical Analysis**: Mudah lihat tren data tahunan
3. **Compliance**: Mudah generate laporan sesuai kebutuhan Dinas
4. **User Experience**: Context switching yang intuitif
5. **Scalability**: Mudah tambah tahun baru tanpa migrasi data

---

**Status**: 🚧 Draft - Ready for Implementation
**Last Updated**: 2026-05-21
