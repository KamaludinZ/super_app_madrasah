# 🚀 Panduan Production Deployment (VPS Docker & Coolify)
## Super App Madrasah - Arsitektur Terpisah: MongoDB + Backend + Frontend

Dokumen ini menyiapkan repo agar **siap deploy production** dengan komponen terpisah:
1. **MongoDB**
2. **Backend FastAPI**
3. **Frontend React + Nginx**

Bisa dipakai di:
- VPS biasa (Docker Compose)
- Coolify (Docker Compose Stack / Services terpisah)

---

## 1) Arsitektur Deployment

```text
Internet
   │
   ▼
[Reverse Proxy / Coolify SSL]
   │
   ├── Frontend (Nginx, port 80)
   │      └── proxy /api/* ke Backend
   │
   └── Backend (FastAPI, port 8000)
          └── MongoDB (port 27017, internal/private)
```

Prinsip production:
- Frontend dan backend dipisah service.
- MongoDB tidak perlu diekspos publik (kecuali memang diperlukan).
- Koneksi frontend→backend lewat reverse proxy (/api).
- Semua credential disimpan sebagai environment variable.

---

## 2) File Konfigurasi yang Sudah Disiapkan

- `docker-compose.yml` → 3 service: `mongodb`, `backend`, `frontend`
- `backend/Dockerfile` → image backend production
- `frontend/Dockerfile` → build React + serve via Nginx
- `frontend/nginx.conf` → proxy `/api/` ke `http://backend:8000/api/`
- `.env.example` → env gabungan untuk docker compose
- `backend/.env.example` → env backend
- `frontend/.env.example` → env frontend

---

## 3) Deploy di VPS dengan Docker Compose

## 3.1 Prasyarat VPS
- Ubuntu 22.04+/Debian terbaru
- Docker + Docker Compose plugin sudah terinstall
- Port minimal: `80`, `443` (jika pakai reverse proxy), optional `8000` untuk debug

## 3.2 Clone Repo
```bash
git clone <repo-anda>.git
cd super_app_madrasah
```

## 3.3 Siapkan Environment
```bash
cp .env.example .env
```

Edit `.env`:
- Ganti `MONGO_ROOT_PASSWORD`
- Ganti `JWT_SECRET` (min 32 karakter random)
- Sesuaikan `CORS_ORIGINS`
- Sesuaikan `SERVICE_URL_*` dan `SERVICE_FQDN_*`

Contoh penting:
```env
MONGO_ROOT_PASSWORD=PASSWORD_KUAT_PRODUCTION
JWT_SECRET=RANDOM_64_CHAR_HEX_OR_MORE
CORS_ORIGINS=https://app.domainanda.com
SERVICE_URL_FRONTEND=https://app.domainanda.com
SERVICE_URL_BACKEND=https://api.domainanda.com
```

## 3.4 Jalankan Stack
```bash
docker compose up -d --build
```

## 3.5 Verifikasi
```bash
docker compose ps
docker compose logs -f backend
curl http://localhost:8000/api/health
```

Jika frontend dibuka dari domain/IP server, aplikasi harus bisa akses API via `/api`.

---

## 4) Deploy di Coolify

Ada 2 opsi yang disarankan:

## Opsi A (paling mudah): 1 Stack Docker Compose
1. Add Resource → **Docker Compose**
2. Hubungkan repo
3. Pilih file: `docker-compose.yml`
4. Tambahkan environment variables sesuai `.env.example`
5. Atur domain untuk service frontend
6. Deploy

Catatan:
- Untuk production, idealnya service MongoDB tidak dipublish keluar.
- Jika perlu, hapus mapping port MongoDB dari compose di environment production.

## Opsi B: Service terpisah di Coolify
1. Buat resource MongoDB (managed / docker image `mongo:7`)
2. Buat resource backend (build dari `backend/Dockerfile`)
3. Buat resource frontend (build dari `frontend/Dockerfile`)
4. Set network internal agar frontend bisa reach backend by service name
5. Domain publik diarahkan ke frontend
6. Backend domain opsional (misal `api.domainanda.com`) bila ingin akses langsung

Env backend wajib:
- `MONGO_URL`
- `DB_NAME`
- `JWT_SECRET`
- `CORS_ORIGINS`

Env frontend:
- Umumnya kosongkan `REACT_APP_BACKEND_URL` jika pakai proxy `/api`.
- Isi URL backend jika frontend & backend beda domain dan tidak pakai reverse-proxy path.

---

## 5) Konfigurasi MongoDB

## 5.1 Self-hosted (dari compose ini)
Default connection string internal:
```env
MONGO_URL=mongodb://admin:<password>@mongodb:27017/super_app_madrasah?authSource=admin
```

## 5.2 MongoDB Atlas (opsional)
Jika pakai Atlas:
1. Buat cluster + user + whitelist IP server
2. Ambil URI Atlas
3. Set `MONGO_URL` ke URI Atlas di env backend
4. Service `mongodb` lokal bisa dinonaktifkan (hapus dari compose production)

---

## 6) Menghubungkan Ketiganya (Frontend, Backend, MongoDB)

1. **Backend ↔ MongoDB**:
   - lewat `MONGO_URL`
   - backend harus bisa resolve host mongodb/atlas

2. **Frontend ↔ Backend**:
   - lewat Nginx `location /api/` di `frontend/nginx.conf`
   - `proxy_pass http://backend:8000/api/;`

3. **Browser ↔ Frontend**:
   - user akses domain frontend
   - request API otomatis ke path `/api/*` domain yang sama

Ini membuat deployment lebih simpel dan minim masalah CORS.

---

## 7) Auto-Update Production dari `/admin/app-info`

Fitur ini memungkinkan admin memicu proses update langsung dari UI admin.

### 7.1 Environment Variable yang Dibutuhkan (Backend)
Tambahkan env berikut di production (Coolify/VPS):

```env
# Enable/disable auto-update trigger dari panel admin
AUTO_UPDATE_ENABLED=false

# Branch repo yang dipakai untuk update
AUTO_UPDATE_BRANCH=main

# Repo GitHub sumber update
GITHUB_REPO=KamaludinZ/super_app_madrasah

# Opsional (disarankan) untuk private repo / rate-limit tinggi
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxx
```

Catatan:
- Default aman: `AUTO_UPDATE_ENABLED=false`.
- Aktifkan menjadi `true` hanya jika Anda siap dengan alur operasional update.

### 7.2 Endpoint Operasional
Endpoint ini hanya untuk role admin:

- `GET /api/app-info/update-status`  
  Untuk melihat status proses update (`idle/running/success/failed`).

- `POST /api/app-info/apply-update`  
  Untuk memulai proses update otomatis.

### 7.3 Alur Operasional Aman di Production
1. Login sebagai admin → buka `/admin/app-info`.
2. Klik **Cek Update**.
3. Jika update tersedia dan `AUTO_UPDATE_ENABLED=true`, klik **Update Sekarang**.
4. Pantau status pada panel auto-update.
5. Setelah status `success`, lakukan restart service/redeploy stack agar seluruh perubahan aktif sempurna.

### 7.4 Rollback / Emergency Disable
Jika perlu menonaktifkan cepat:
1. Set `AUTO_UPDATE_ENABLED=false`
2. Redeploy/restart backend
3. Tombol update tetap tampil, tetapi eksekusi akan ditolak aman oleh backend

### 7.5 Catatan Keamanan Penting
- Jangan hardcode `GITHUB_TOKEN` di repository.
- Simpan token di secret manager Coolify / environment host.
- Batasi akses admin dan aktifkan HTTPS.
- Audit log perubahan deployment secara berkala.

---

## 8) Hardening Production (Wajib Disarankan)

- Gunakan password kuat untuk Mongo root/user
- Jangan expose port MongoDB ke internet publik
- Batasi `CORS_ORIGINS` ke domain resmi
- Gunakan HTTPS (Let’s Encrypt via Coolify/Nginx Proxy Manager/Traefik)
- Simpan backup MongoDB rutin (harian)
- Tambahkan monitoring log container (`docker compose logs`, Loki/ELK opsional)

---

## 9) Checklist Go-Live

- [ ] `.env` production terisi aman
- [ ] `JWT_SECRET` random kuat
- [ ] `CORS_ORIGINS` tidak wildcard `*`
- [ ] Domain frontend aktif + HTTPS valid
- [ ] Health backend `GET /api/health` OK
- [ ] Login aplikasi berhasil
- [ ] Data CRUD tersimpan ke MongoDB
- [ ] Backup MongoDB berjalan

---

## 10) Command Operasional Penting

```bash
# Build ulang dan jalankan
docker compose up -d --build

# Lihat status
docker compose ps

# Lihat logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongodb

# Restart service tertentu
docker compose restart backend

# Stop semua
docker compose down
```

---

Dokumen ini dibuat agar deployment **mudah, normal, dan siap production** untuk skenario pemisahan MongoDB, backend, dan frontend.
