# Cara Menjalankan Seeder dengan MongoDB Atlas

## Langkah-langkah:

### 1. Update Password MongoDB Atlas

Edit file `seed_atlas.py` dan ganti dengan password yang benar:

```python
# Baris 12-13, ganti dengan password yang benar
MONGO_URL = "mongodb+srv://kamaludinzuhri_db_user:<PASSWORD_ANDA>@cluster0.qougudd.mongodb.net/"
```

### 2. Cara Mendapatkan Password yang Benar

1. Login ke [MongoDB Atlas](https://cloud.mongodb.com)
2. Pilih cluster Anda
3. Klik "Database Access" di menu kiri
4. Lihat user `kamaludinzuhri_db_user`
5. Jika lupa password:
   - Klik "Edit" pada user
   - Klik "Edit Password"
   - Generate atau masukkan password baru
   - Simpan

### 3. Jalankan Seeder

```bash
# Opsi 1: Langsung jalankan seed_atlas.py
python C:\super_app_madrasah\super_app_madrasah\backend\seed_atlas.py

# Opsi 2: Atau edit dan jalankan
# 1. Edit seed_atlas.py dengan password yang benar
# 2. Jalankan:
cd C:\super_app_madrasah\super_app_madrasah\backend
python seed_atlas.py
```

### 4. Output yang Diharapkan

```
[SEED] Connecting to MongoDB Atlas...
[SEED] Database: super_app_madrasah
[SEED] MongoDB Atlas connection successful!
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

## Troubleshooting

### Error: "bad auth : authentication failed"

**Penyebab:** Password salah atau user tidak memiliki akses

**Solusi:**
1. Cek password di MongoDB Atlas
2. Pastikan user memiliki role `readWrite` atau `dbAdmin`
3. Update password di `seed_atlas.py`

### Error: "IP whitelist"

**Penyebab:** IP address Anda tidak ada di whitelist

**Solusi:**
1. Login ke MongoDB Atlas
2. Klik "Network Access"
3. Klik "Add IP Address"
4. Pilih "Allow Access from Anywhere" (0.0.0.0/0) untuk testing
   - Atau tambahkan IP spesifik Anda

### Error: "Connection timeout"

**Penyebab:** Jaringan lambat atau firewall

**Solusi:**
1. Cek koneksi internet
2. Coba dengan VPN jika ada firewall
3. Tingkatkan timeout di `seed_atlas.py`:
   ```python
   client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=30000)
   ```

## Alternative: Menggunakan Environment Variable

Jika tidak ingin hardcode password di file:

### Windows:
```cmd
set ATLAS_PASSWORD=your_password_here
python seed_atlas.py
```

### Kemudian update seed_atlas.py:
```python
import os

ATLAS_PASSWORD = os.environ.get('ATLAS_PASSWORD', 'default_password')
MONGO_URL = f"mongodb+srv://kamaludinzuhri_db_user:{ATLAS_PASSWORD}@cluster0.qougudd.mongodb.net/"
```

## Data yang Akan Ditambahkan

Seeder ini akan menambahkan:

- ✅ **10 RKAM Budget Items** (BOS & KOMITE)
- ✅ **3 RKAM Documents**
- ✅ **5 Achievements** (Prestasi)
- ✅ **3 Announcements** (Pengumuman)
- ✅ **4 Holidays** (Hari Libur)

Total: **25 documents** di berbagai collection.

## Setelah Seeding Berhasil

Verifikasi data di aplikasi:

1. **RKAM**:
   - Admin: http://localhost:3000/admin/dana-rkam
   - Public: http://localhost:3000/public/rkam

2. **Prestasi**:
   - Public: http://localhost:3000/public/prestasi

3. **Pengumuman**:
   - User: http://localhost:3000/pengumuman

4. **Holidays**:
   - Admin: http://localhost:3000/admin/holidays

## Kontak

Jika masih ada masalah, silakan hubungi tim developer atau buat issue.
