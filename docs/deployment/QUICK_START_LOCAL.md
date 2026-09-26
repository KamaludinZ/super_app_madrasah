# Quick Start - Development Lokal dengan MongoDB Docker

Panduan cepat untuk menjalankan aplikasi Super App Madrasah di lokal menggunakan MongoDB Docker Desktop.

## Prasyarat

1. **Docker Desktop** terinstal dan berjalan
2. **Python 3.9+** terinstal
3. **Node.js 16+** dan npm terinstal

## Langkah-langkah

### 1. Pastikan Docker Desktop Berjalan

Buka Docker Desktop dan pastikan statusnya "Running"

### 2. Jalankan MongoDB Docker Container

```bash
# Jalankan hanya MongoDB container
docker-compose up -d mongodb

# Cek status MongoDB
docker-compose ps
```

Output yang diharapkan:
```
NAME                        STATUS              PORTS
super_app_madrasah-mongodb  running (healthy)   0.0.0.0:27017->27017/tcp
```

### 3. Seed Data ke MongoDB Lokal

```bash
# Masuk ke folder backend
cd backend

# Install dependencies Python (jika belum)
pip install -r requirements.txt

# Jalankan script seeding
python seed_local_mongodb.py
```

Output sukses akan menampilkan:
```
SUCCESS! ALL DATA SEEDING COMPLETED
Login credentials:
  - Admin: username=admin, password=admin123
  - Guru: username=guru1, password=guru123
  - Siswa: username=siswa1, password=siswa123
```

### 4. Jalankan Backend (Development Mode)

```bash
# Tetap di folder backend
# Pastikan MONGO_URL sudah benar di .env
python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Backend akan berjalan di: `http://localhost:8000`

### 5. Jalankan Frontend (Development Mode)

Buka terminal baru:

```bash
# Masuk ke folder frontend
cd frontend

# Install dependencies (jika belum)
npm install

# Jalankan development server
npm start
```

Frontend akan berjalan di: `http://localhost:3000`

## Verifikasi

1. **Cek Backend Health:**
   ```bash
   curl http://localhost:8000/api/health
   ```

   Output:
   ```json
   {"status":"healthy","version":"1.1.0"}
   ```

2. **Login ke Aplikasi:**
   - Buka browser: `http://localhost:3000`
   - Login dengan:
     - Username: `admin`
     - Password: `admin123`

3. **Test Fitur RKAM:**
   - Login sebagai admin
   - Masuk menu "RKAM Budget"
   - Seharusnya muncul 8 items budget

## Konfigurasi Environment

File `.env` sudah dikonfigurasi untuk MongoDB lokal:

```env
DB_NAME=super_app_madrasah
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=SuperStrongPassword2024!SecureMongo
MONGO_URL=mongodb://admin:SuperStrongPassword2024!SecureMongo@mongodb:27017/super_app_madrasah?authSource=admin

# Untuk development mode (tanpa Docker)
# Gunakan localhost:27017
# MONGO_URL=mongodb://admin:SuperStrongPassword2024!SecureMongo@localhost:27017/super_app_madrasah?authSource=admin
```

## Troubleshooting

### MongoDB Container Tidak Bisa Start

```bash
# Cek logs MongoDB
docker-compose logs mongodb

# Restart MongoDB
docker-compose restart mongodb
```

### Connection Refused saat Seeding

1. Pastikan MongoDB container running dan healthy:
   ```bash
   docker-compose ps
   ```

2. Test koneksi MongoDB:
   ```bash
   docker exec -it super_app_madrasah-mongodb mongosh -u admin -p SuperStrongPassword2024!SecureMongo --authenticationDatabase admin
   ```

### Backend Error: Module not found

```bash
cd backend
pip install -r requirements.txt
```

### Frontend Error: Module not found

```bash
cd frontend
npm install
```

## Mode Production (Opsional)

Untuk menjalankan full stack dengan Docker:

```bash
# Build dan jalankan semua services
docker-compose up -d

# Cek status semua containers
docker-compose ps

# Akses aplikasi
# Frontend: http://localhost:8080
# Backend: http://localhost:8080/api (via Nginx)
```

## Stop Services

### Development Mode
- Backend: Ctrl+C di terminal backend
- Frontend: Ctrl+C di terminal frontend
- MongoDB: `docker-compose stop mongodb`

### Production Mode (Docker)
```bash
docker-compose down
```

## Reset Database

Jika ingin reset database dan mulai dari awal:

```bash
# Stop MongoDB
docker-compose down mongodb

# Hapus volume MongoDB
docker volume rm super_app_madrasah_mongodb_data

# Jalankan ulang dan seed lagi
docker-compose up -d mongodb
cd backend
python seed_local_mongodb.py
```

## Kredensial Login

### Admin
- Username: `admin`
- Password: `admin123`

### Guru
- Username: `guru1` sampai `guru5`
- Password: `guru123`

### Siswa
- Username: `siswa1` sampai `siswa30`
- Password: `siswa123`

## Fitur yang Tersedia

Data yang sudah di-seed meliputi:
- ✅ Settings madrasah
- ✅ Tahun akademik & semester (2025/2026)
- ✅ Users (1 admin, 5 guru, 2 tendik, 30 siswa)
- ✅ Kelas (7A-7C, 8A-8C, 9A-9C) & Ruangan
- ✅ Mata pelajaran (14 mapel)
- ✅ Jadwal pelajaran
- ✅ Hari libur
- ✅ RKAM Budget (8 items) & Dokumen (3 items)
- ✅ Prestasi (2 items)
- ✅ Pengumuman (2 items)

## Support

Jika ada masalah, cek:
1. Docker Desktop berjalan dengan baik
2. Port 27017 (MongoDB), 8000 (Backend), 3000 (Frontend) tidak dipakai aplikasi lain
3. File .env sudah benar
4. Logs: `docker-compose logs -f mongodb`
