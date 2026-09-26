# Cara Menjalankan Aplikasi Lokal dengan MongoDB Docker

## Status Saat Ini

✅ MongoDB Docker: **RUNNING dan HEALTHY**
✅ Data Sudah Di-seed: **41 users, 265 schedules, 8 RKAM items, dll**
✅ Login Test: **Password verification BERHASIL**

## Masalah Yang Ditemukan

Backend server yang sedang running masih menggunakan **MongoDB Atlas**, bukan MongoDB lokal. Kita perlu restart backend dengan environment variable yang benar.

## Solusi: Jalankan Backend dengan Benar

### Langkah 1: Stop Backend Yang Lama

Buka Task Manager (`Ctrl+Shift+Esc`), cari process "python.exe" yang menggunakan banyak memory (sekitar 30-70 MB), kemudian End Task.

Atau via command line:
```cmd
tasklist | findstr python
# Cari PID yang besar (misal 28788)
taskkill /F /PID <nomor_pid>
```

### Langkah 2: Aktifkan Virtual Environment

Buka Command Prompt atau PowerShell **BARU**, lalu:

```cmd
cd C:\super_app_madrasah\super_app_madrasah\backend

# Aktifkan virtual environment
..\.venv\Scripts\activate

# Pastikan prompt berubah jadi (.venv)
```

### Langkah 3: Set Environment Variables

Masih di terminal yang sama:

```cmd
set MONGO_URL=mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin
set DB_NAME=super_app_madrasah
set ENV=development
set CORS_ORIGINS=http://localhost:3000,http://localhost,http://localhost:80
```

### Langkah 4: Jalankan Backend

```cmd
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Anda harus melihat output seperti:
```
INFO:     Will watch for changes in these directories: ['C:\\super_app_madrasah\\super_app_madrasah\\backend']
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [xxxx] using StatReload
MongoDB URL: mongodb://****@localhost:27017   <--- PENTING: Harus localhost, bukan Atlas!
MongoDB client initialized for database: super_app_madrasah
INFO:     Started server process [xxxx]
INFO:     Application startup complete.
```

### Langkah 5: Test Backend

Buka browser atau terminal baru:
```cmd
curl http://localhost:8000/api/health
```

Harus keluar: `{"status":"healthy","time_wib":"..."}`

### Langkah 6: Jalankan Frontend

Buka terminal **BARU**:
```cmd
cd C:\super_app_madrasah\super_app_madrasah\frontend
npm start
```

Frontend akan membuka browser otomatis di `http://localhost:3000`

### Langkah 7: Login

Buka `http://localhost:3000` di browser:

**Kredensial Admin:**
- Username: `admin`
- Password: `admin123`

**Kredensial Guru:**
- Username: `guru1` (atau guru2-guru5)
- Password: `guru123`

**Kredensial Siswa:**
- Username: `siswa1` (atau siswa2-siswa30)
- Password: `siswa123`

## Troubleshooting

### Backend masih pakai MongoDB Atlas

Cek log backend saat startup. Jika masih muncul:
```
MongoDB URL: mongodb://****@ac-dc9r8u8-shard-00-00.qougudd.mongodb.net...
```

Berarti environment variable belum di-set. Ulangi Langkah 3.

### Login Gagal

1. **Cek backend sedang running:**
   ```cmd
   curl http://localhost:8000/api/health
   ```

2. **Cek backend menggunakan MongoDB lokal:**
   ```cmd
   cd backend
   ..\.venv\Scripts\python.exe test_login.py
   ```

   Harus keluar: `[OK] Password is CORRECT! Login should work.`

3. **Cek MongoDB container running:**
   ```cmd
   docker-compose ps
   ```

   Harus ada `mongodb` dengan status `Up (healthy)`

### Port 8000 Already in Use

```cmd
# Cari process yang pakai port 8000
netstat -ano | findstr :8000

# Kill process
taskkill /F /PID <nomor_pid>
```

### Virtual Environment Tidak Bisa Diaktifkan

Gunakan absolute path:
```cmd
C:\super_app_madrasah\super_app_madrasah\.venv\Scripts\activate.bat
```

Atau di PowerShell:
```powershell
C:\super_app_madrasah\super_app_madrasah\.venv\Scripts\Activate.ps1
```

## Verifikasi Sukses

✅ MongoDB Docker running: `docker-compose ps` shows "Up (healthy)"
✅ Backend running: `curl http://localhost:8000/api/health` returns JSON
✅ Backend URL lokal: Log backend shows "mongodb://****@localhost:27017"
✅ Frontend running: Browser buka `http://localhost:3000`
✅ Login berhasil: Bisa login dengan admin/admin123

## Data Yang Tersedia

Setelah login, Anda bisa test:

- **Dashboard Admin** - Lihat statistik
- **Data Siswa** - 30 siswa dari kelas 7A-9C
- **Jadwal Pelajaran** - 265 jadwal untuk semua kelas
- **RKAM Budget** - 8 items budget dengan total Rp 212 juta
- **Prestasi** - 2 prestasi siswa
- **Pengumuman** - 2 pengumuman aktif
- **Guru** - 5 guru dan 2 tendik

## Quick Commands

### Reset MongoDB Data
```cmd
docker-compose down
docker volume rm super_app_madrasah_mongodb_data
docker-compose up -d mongodb
cd backend
..\.venv\Scripts\python.exe seed_local.py
```

### Check Data
```cmd
cd backend
..\.venv\Scripts\python.exe check_users.py
```

### Test Login
```cmd
cd backend
..\.venv\Scripts\python.exe test_login.py
```

---

**Catatan:** Pastikan selalu menggunakan terminal dengan virtual environment yang sudah diaktifkan untuk menjalankan backend!
