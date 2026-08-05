# Migrasi ke MongoDB Lokal Docker - Laporan

**Tanggal:** 4 Agustus 2026
**Status:** ✅ SELESAI

## Ringkasan

Aplikasi Super App Madrasah telah berhasil dialihkan dari MongoDB Atlas ke MongoDB lokal menggunakan Docker Desktop. Ini akan menghemat biaya dan menghindari masalah koneksi internet saat development.

## Perubahan Yang Dilakukan

### 1. Docker Compose (docker-compose.yml)

✅ **Mengaktifkan MongoDB service**
- Uncomment dan aktifkan service MongoDB
- Image: `mongo:7.0`
- Port: `27017` (exposed ke host)
- Healthcheck: Menggunakan `mongosh` untuk memastikan container siap
- Volume: `mongodb_data` untuk persistensi data

✅ **Update Backend Dependencies**
- Backend sekarang `depends_on` MongoDB dengan `condition: service_healthy`
- Environment variable `MONGO_URL` sudah dikonfigurasi untuk koneksi lokal

### 2. Environment Variables (.env)

✅ **Update konfigurasi MongoDB**
```env
# SEBELUM (MongoDB Atlas)
MONGO_URL=mongodb+srv://kamaludinzuhri_db_user:...@cluster0.qougudd.mongodb.net/...

# SESUDAH (MongoDB Lokal Docker)
MONGO_URL=mongodb://admin:SuperStrongPassword2024!SecureMongo@mongodb:27017/super_app_madrasah?authSource=admin
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=SuperStrongPassword2024!SecureMongo
```

### 3. Script Seeding Data

✅ **Dibuat 2 script baru:**

1. **`backend/seed_local_mongodb.py`** - Script komprehensif dengan import dari .env
2. **`backend/seed_local.py`** - Script sederhana dengan hardcoded credentials untuk development

Script seeding mencakup data:
- Settings madrasah
- Tahun akademik & semester (2025/2026)
- Users (admin, guru, tendik, siswa)
- Kelas, Ruangan, Mata Pelajaran
- Jadwal pelajaran (265 jadwal)
- Hari libur (15 hari)
- RKAM Budget (8 items + 3 dokumen)
- Prestasi, Pengumuman

### 4. Helper Scripts

✅ **`backend/run_local.bat`** - Batch script untuk menjalankan backend dengan environment variables yang benar

### 5. Dokumentasi

✅ **`QUICK_START_LOCAL.md`** - Panduan lengkap step-by-step untuk development lokal

## Hasil Testing

### ✅ MongoDB Container
```bash
docker-compose up -d mongodb
docker-compose ps
```
Output:
```
NAME                           STATUS                    PORTS
super_app_madrasah-mongodb-1   Up (healthy)             0.0.0.0:27017->27017/tcp
```

### ✅ Data Seeding
```bash
cd backend
python seed_local.py
```
Output:
```
SUCCESS! ALL DATA SEEDING COMPLETED

Login credentials:
  - Admin: username=admin, password=admin123
  - Guru: username=guru1, password=guru123
  - Siswa: username=siswa1, password=siswa123
```

Data yang berhasil di-seed:
- ✅ Settings: 1
- ✅ Academic Years: 1, Semesters: 2
- ✅ Users: 1 admin + 5 guru + 2 tendik
- ✅ Students: 30
- ✅ Classes: 9, Rooms: 12
- ✅ Subjects: 14
- ✅ Schedules: 265
- ✅ Holidays: 15
- ✅ RKAM Items: 8, Documents: 3
- ✅ Achievements: 2
- ✅ Announcements: 2

## Cara Menjalankan Aplikasi Lokal

### Opsi 1: Development Mode (Recommended untuk Development)

#### Terminal 1: MongoDB
```bash
docker-compose up -d mongodb
```

#### Terminal 2: Backend
```bash
cd backend

# Windows PowerShell
$env:MONGO_URL="mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin"
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Atau gunakan batch script
cmd /c run_local.bat
```

#### Terminal 3: Frontend
```bash
cd frontend
npm start
```

Akses:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Opsi 2: Production Mode (Full Docker)

```bash
# Build dan jalankan semua services
docker-compose up -d

# Akses aplikasi
# Frontend: http://localhost:8080
# Backend: http://localhost:8080/api
```

## Keuntungan Migrasi ke MongoDB Lokal

1. ✅ **Hemat Biaya** - Tidak perlu bayar MongoDB Atlas
2. ✅ **Development Offline** - Bisa development tanpa internet
3. ✅ **Performa Lebih Cepat** - Latency lebih rendah (localhost)
4. ✅ **Data Privacy** - Data tidak keluar dari laptop
5. ✅ **Easy Reset** - Mudah reset database untuk testing
6. ✅ **Full Control** - Kontrol penuh atas database

## Troubleshooting

### MongoDB Container Tidak Start
```bash
# Cek logs
docker-compose logs mongodb

# Restart
docker-compose restart mongodb

# Rebuild jika perlu
docker-compose up -d --build mongodb
```

### Connection Refused
Pastikan:
1. Docker Desktop running
2. MongoDB container healthy: `docker-compose ps`
3. Port 27017 tidak dipakai aplikasi lain: `netstat -an | findstr 27017`

### Reset Database
```bash
# Stop dan hapus volume
docker-compose down
docker volume rm super_app_madrasah_mongodb_data

# Jalankan ulang dan seed lagi
docker-compose up -d mongodb
cd backend
python seed_local.py
```

## Backup MongoDB Atlas (Opsional)

Jika suatu saat perlu kembali ke Atlas atau deploy production:

1. File `.env` sudah menyimpan Atlas URL sebagai comment
2. Tinggal uncomment dan comment yang lokal
3. Atau buat `.env.production` khusus untuk production

```env
# Production (MongoDB Atlas)
MONGO_URL=mongodb+srv://kamaludinzuhri_db_user:Mtsn2kotamalang*@cluster0.qougudd.mongodb.net/?retryWrites=true&w=majority

# Development (MongoDB Local)
# MONGO_URL=mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin
```

## File-file Yang Dibuat/Diubah

### Dibuat:
- ✅ `backend/seed_local_mongodb.py`
- ✅ `backend/seed_local.py`
- ✅ `backend/run_local.bat`
- ✅ `backend/.env.local`
- ✅ `QUICK_START_LOCAL.md`
- ✅ `MIGRASI_KE_MONGODB_LOKAL.md` (file ini)

### Diubah:
- ✅ `docker-compose.yml` - Uncomment MongoDB service
- ✅ `.env` - Update MONGO_URL ke lokal

## Next Steps

1. ✅ MongoDB lokal sudah running
2. ✅ Data sudah di-seed
3. 🔄 Jalankan backend dengan `run_local.bat` atau manual uvicorn
4. 🔄 Jalankan frontend dengan `npm start`
5. 🔄 Test semua fitur aplikasi

## Kredensial Login

### Admin
- Username: `admin`
- Password: `admin123`

### Guru (guru1 - guru5)
- Username: `guru1`
- Password: `guru123`

### Siswa (siswa1 - siswa30)
- Username: `siswa1`
- Password: `siswa123`

---

**Catatan:** Migrasi ini hanya untuk development lokal. Untuk production deployment, sebaiknya tetap menggunakan managed database service seperti MongoDB Atlas atau hosting sendiri dengan proper security dan backup.
