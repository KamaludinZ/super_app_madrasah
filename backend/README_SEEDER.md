# Comprehensive Data Seeder

Script untuk menambahkan data sample lengkap ke aplikasi Super Apps MATSANDATAMA.

## Data yang Akan Ditambahkan

### 1. **RKAM (Rencana Kegiatan dan Anggaran Madrasah)**
- ✅ **10 Budget Items** dengan breakdown:
  - 6 items dana BOS (Operasional, Pendidikan, Program)
  - 4 items dana KOMITE (Pembangunan, Program)
  - Mencakup semua bidang: Kurikulum, Sarana Prasarana, Kesiswaan, Humas, Tata Usaha
  - Total anggaran BOS: ~Rp 146.000.000
  - Total anggaran KOMITE: ~Rp 88.000.000
  - Dengan data realisasi yang bervariasi (60-100%)

- ✅ **3 Dokumen RKAM**:
  - Laporan Realisasi Q1
  - RKAM Full Document
  - Bukti Realisasi BOS Q2

### 2. **Prestasi (Achievements)**
- ✅ **5 Prestasi** dengan variasi:
  - Prestasi Siswa (Akademik & Non-Akademik)
  - Prestasi Guru
  - Prestasi Madrasah
  - Level: Kota, Provinsi, Nasional

### 3. **Pengumuman (Announcements)**
- ✅ **3 Pengumuman**:
  - Umum (untuk semua)
  - Kesiswaan (khusus siswa)
  - Akademik (khusus guru)
  - Dengan priority: high, normal, urgent

### 4. **Hari Libur (Holidays)**
- ✅ **4 Hari Libur Nasional & Keagamaan**:
  - Tahun Baru 2026
  - Isra Miraj
  - Idul Fitri
  - Cuti Bersama

## Cara Menjalankan Seeder

### Opsi 1: Langsung dengan Python

```bash
cd C:\super_app_madrasah\super_app_madrasah\backend
python seed_comprehensive_data.py
```

### Opsi 2: Dengan Environment Variables

```bash
# Set environment variables (jika perlu)
set MONGO_URL=mongodb://localhost:27017
set MONGO_DB_NAME=super_app_madrasah

# Run seeder
python seed_comprehensive_data.py
```

### Opsi 3: Menggunakan uvicorn (jika server running)

Jika backend server sedang running, Anda bisa memanggil script ini dari terminal terpisah.

## Output yang Diharapkan

```
[SEED] Starting comprehensive data seeding...
[SEED] Creating RKAM budget items...
[SEED] Created 10 RKAM budget items
[SEED] Creating RKAM documents...
[SEED] Created 3 RKAM documents
[SEED] Creating achievements...
[SEED] Created 5 achievements
[SEED] Creating announcements...
[SEED] Created 3 announcements
[SEED] Creating holidays...
[SEED] Created 4 holidays
[SEED] ✅ Comprehensive data seeding completed!
[SEED] You can now test all features in the application.
```

## Verifikasi Data

Setelah menjalankan seeder, Anda dapat memverifikasi data melalui:

### 1. **RKAM**
- Admin: `/admin/dana-rkam`
- Public: `/public/rkam`
- Harus melihat:
  - 6 widget cards (3 BOS + 3 KOMITE)
  - Progress bars dengan persentase
  - Rincian anggaran per kategori
  - 3 dokumen transparansi

### 2. **Prestasi**
- Public: `/public/prestasi`
- Admin: (jika ada menu admin prestasi)
- Harus melihat 5 prestasi dengan filter level dan tahun

### 3. **Pengumuman**
- User dashboard: `/pengumuman`
- Harus melihat 3 pengumuman sesuai role

### 4. **Holidays**
- Admin: `/admin/holidays`
- Harus melihat 4 hari libur

## Catatan Penting

1. **Idempotent**: Script ini akan mengecek data yang sudah ada sebelum insert, jadi aman dijalankan berkali-kali
2. **Fiscal Year**: Semua data menggunakan tahun anggaran `2025/2026`
3. **Data Sample**: Ini adalah data sample untuk testing, bukan data real
4. **URL Dokumen**: URL file menggunakan placeholder `https://example.com`, sesuaikan dengan kebutuhan

## Troubleshooting

### Error: "Module not found: motor"
```bash
pip install motor
```

### Error: "Connection refused"
Pastikan MongoDB server sedang running:
```bash
# Windows
net start MongoDB

# Atau cek service MongoDB di Services
```

### Error: "Database not found"
Pastikan environment variable `MONGO_DB_NAME` sudah sesuai atau database sudah dibuat.

## Reset Data (Opsional)

Jika ingin menghapus semua data seeder dan mulai fresh:

```python
# Jalankan di Python shell atau buat script terpisah
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def reset():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["super_app_madrasah"]

    await db.rkam_budget_items.delete_many({'fiscal_year': '2025/2026'})
    await db.rkam_documents.delete_many({'fiscal_year': '2025/2026'})
    await db.achievements.delete_many({'year': 2025})
    await db.announcements.delete_many({})
    await db.holidays.delete_many({})

    print("Data reset completed")
    client.close()

asyncio.run(reset())
```

## Support

Jika ada masalah atau pertanyaan, silakan buat issue atau hubungi tim developer.
