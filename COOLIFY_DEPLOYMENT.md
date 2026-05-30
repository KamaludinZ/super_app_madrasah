# 🚀 Panduan Deployment Coolify - Super Apps MATSANDATAMA

Dokumentasi lengkap untuk deploy aplikasi ini di Coolify menggunakan **Single Deployment** (Frontend + Backend dalam 1 container).

---

## 📋 Table of Contents

1. [Persiapan MongoDB](#1-persiapan-mongodb)
2. [Setup di Coolify](#2-setup-di-coolify)
3. [Konfigurasi Environment Variables](#3-konfigurasi-environment-variables)
4. [Deploy Aplikasi](#4-deploy-aplikasi)
5. [Verifikasi Deployment](#5-verifikasi-deployment)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Persiapan MongoDB

### Opsi A: MongoDB Atlas (Cloud - Rekomendasi)

1. **Buat Akun MongoDB Atlas**
   - Kunjungi: https://www.mongodb.com/cloud/atlas
   - Sign up gratis (Free Tier M0)

2. **Buat Cluster Baru**
   - Pilih region terdekat (Singapore/Jakarta)
   - Pilih tier: **M0 Sandbox (FREE)**
   - Nama cluster: `super-app-cluster`

3. **Konfigurasi Database Access**
   - Go to: Database Access
   - Add New Database User
   - Username: `admin_madrasah`
   - Password: `<generate-strong-password>` (simpan password ini!)
   - Database User Privileges: **Atlas Admin** atau **Read and write to any database**

4. **Konfigurasi Network Access**
   - Go to: Network Access
   - Add IP Address
   - **PENTING:** Pilih "Allow Access from Anywhere" (`0.0.0.0/0`)
   - Atau masukkan IP server Coolify Anda

5. **Dapatkan Connection String**
   - Go to: Database → Connect
   - Pilih: **Connect your application**
   - Driver: Python / Version: 3.11 or later
   - Copy connection string:
   ```
   mongodb+srv://admin_madrasah:<password>@super-app-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   - **Replace `<password>`** dengan password yang Anda buat di step 3

### Opsi B: MongoDB Self-Hosted (Docker)

Jika ingin host MongoDB sendiri:

```bash
# Di server yang sama dengan Coolify
docker run -d \
  --name mongodb \
  --network coolify \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=<strong-password> \
  -v mongodb_data:/data/db \
  mongo:7.0

# Connection string:
# mongodb://admin:<password>@mongodb:27017/super_app_madrasah?authSource=admin
```

---

## 2. Setup di Coolify

### Step 1: Hapus Deployment Lama (Jika Ada)

Jika sebelumnya Anda deploy frontend dan backend terpisah:

1. Go to Coolify Dashboard
2. **Delete** deployment frontend (yang pakai nginx)
3. **Delete** deployment backend (jika ada terpisah)
4. Kita akan buat deployment baru yang single

### Step 2: Buat Application Baru

1. **Go to Coolify Dashboard**
2. Klik **"+ New"** atau **"Add Resource"**
3. Pilih **"Application"**

### Step 3: Konfigurasi Source

- **Source Type:** Git Repository
- **Git Provider:** GitHub
- **Repository:** `KamaludinZ/super_app_madrasah`
- **Branch:** `main`
- **Auto Deploy:** ✅ Enable (optional, untuk auto-deploy saat push)

### Step 4: Konfigurasi Build

- **Build Pack:** Docker Compose
- **Docker Compose Location:** `/docker-compose.yml` (root folder)
- **Dockerfile Location:** `/Dockerfile`

### Step 5: Konfigurasi Network & Domain

- **Port:** 8000 (container internal port)
- **Public Port:** 80/443 (akan di-handle Coolify)
- **Domain:**
  - Pilih domain Anda, contoh: `super-app.your-domain.com`
  - Atau gunakan default Coolify: `xxxxx.coolify.yourserver.com`
- **SSL:** ✅ Enable (Coolify auto-generate Let's Encrypt)

---

## 3. Konfigurasi Environment Variables

Di Coolify Dashboard, masuk ke aplikasi → **Environment Variables** → Add Variable

### 🔴 REQUIRED (WAJIB)

#### **MONGO_URL**
```bash
# Untuk MongoDB Atlas:
mongodb+srv://admin_madrasah:YOUR_PASSWORD@super-app-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority

# Untuk MongoDB Self-Hosted:
mongodb://admin:YOUR_PASSWORD@mongodb:27017/super_app_madrasah?authSource=admin
```
**PENTING:**
- Replace `YOUR_PASSWORD` dengan password asli
- Replace `xxxxx` dengan cluster ID Anda
- Jangan ada spasi atau karakter aneh

**Testing Connection String:**
```bash
# Test apakah connection string valid
mongo "mongodb+srv://admin_madrasah:PASSWORD@cluster.xxxxx.mongodb.net/" --eval "db.adminCommand('ping')"
```

#### **JWT_SECRET**
Secret key untuk generate JWT tokens (min 32 karakter)

**Generate dengan salah satu cara:**
```bash
# Cara 1: OpenSSL
openssl rand -hex 32

# Cara 2: Python
python3 -c "import secrets; print(secrets.token_hex(32))"

# Cara 3: Online
# https://www.uuidgenerator.net/guid (ambil 2x dan gabung)
```

**Contoh hasil:**
```
a8f5f167f44f4964e6c998dee827110c3a8c724f8f6b3a1b3f5f0e9e7c8d6a5b
```

### 🟡 OPTIONAL (Punya Default Value)

#### **DB_NAME**
```bash
super_app_madrasah
```
Default: `super_app_madrasah`

#### **CORS_ORIGINS**
```bash
# Development (allow all):
*

# Production (specify domain):
https://super-app.your-domain.com,https://www.your-domain.com
```
Default: `*`

#### **SERVICE_URL_BACKEND**
```bash
https://super-app.your-domain.com
```
URL backend Anda (untuk keperluan email, notifikasi, dll)

#### **SERVICE_FQDN_BACKEND**
```bash
super-app.your-domain.com
```
Fully Qualified Domain Name backend

#### **SERVICE_URL_FRONTEND**
```bash
https://super-app.your-domain.com
```
URL frontend (dalam single deployment, sama dengan backend)

#### **SERVICE_FQDN_FRONTEND**
```bash
super-app.your-domain.com
```

---

## 4. Deploy Aplikasi

### Step 1: Trigger Deployment

1. Go to aplikasi di Coolify
2. Klik **"Deploy"** atau **"Redeploy"**
3. Monitor build logs

### Step 2: Monitor Build Process

Logs yang diharapkan:

```
✅ Cloning repository
✅ Checking out branch: main
✅ Building docker image started
   ├─ Stage 1: Building Frontend
   │  ├─ Installing node dependencies
   │  ├─ npm install --legacy-peer-deps
   │  └─ npm run build ✓
   └─ Stage 2: Building Backend
      ├─ Installing system dependencies
      ├─ pip install requirements.txt
      └─ Copying frontend build
✅ Building docker image completed
✅ Starting new container
✅ MongoDB client initialized for database: super_app_madrasah
✅ INFO: Uvicorn running on http://0.0.0.0:8000
✅ Healthcheck: starting → healthy (after ~40s)
✅ Deployment successful
```

### Step 3: Waktu Build

- **First build:** ~8-12 menit (download dependencies)
- **Subsequent builds:** ~5-7 menit (cache terpakai)

---

## 5. Verifikasi Deployment

### A. Cek Health Endpoint

```bash
# Replace dengan domain Anda
curl https://super-app.your-domain.com/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "time_wib": "2026-05-30T17:30:00+07:00"
}
```

### B. Cek Frontend

Buka browser:
```
https://super-app.your-domain.com
```

Harus muncul halaman login aplikasi.

### C. Cek Container Logs

Di Coolify:
1. Go to aplikasi → **Logs**
2. Pastikan tidak ada error

Expected logs:
```
INFO - MongoDB client initialized for database: super_app_madrasah
INFO:     Started server process [1]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### D. Test Login

1. Buka aplikasi di browser
2. Default admin credentials (jika sudah ada seed data):
   ```
   Email: admin@matsandatama.sch.id
   Password: <sesuai seed data>
   ```

---

## 6. Troubleshooting

### Error: "MONGO_URL environment variable is required"

**Penyebab:** Environment variable tidak di-set atau salah nama

**Solusi:**
1. Masuk ke Coolify → Environment Variables
2. Pastikan nama variable **PERSIS**: `MONGO_URL` (case-sensitive)
3. Redeploy

### Error: "Empty host (or extra comma in host list)"

**Penyebab:** MongoDB connection string tidak valid

**Solusi:**
1. Cek format connection string:
   ```bash
   # Harus seperti ini (no space, no newline):
   mongodb+srv://user:pass@cluster.mongodb.net/?options
   ```
2. Test connection string di terminal:
   ```bash
   mongosh "YOUR_CONNECTION_STRING"
   ```

### Error: Container terus restart

**Penyebab:** Healthcheck gagal atau app crash

**Solusi:**
1. Cek logs di Coolify
2. Pastikan MongoDB accessible dari container
3. Test MongoDB connection:
   ```bash
   # Di container
   docker exec -it <container-id> python3 -c "
   from pymongo import MongoClient
   client = MongoClient('YOUR_MONGO_URL')
   print(client.admin.command('ping'))
   "
   ```

### Error: "host not found in upstream backend"

**Penyebab:** Anda masih deploy frontend terpisah

**Solusi:**
1. Hapus deployment frontend yang pakai nginx
2. Gunakan hanya **1 deployment** dengan Dockerfile kita
3. Akses aplikasi langsung dari domain yang di-assign ke deployment ini

### Frontend 404 atau blank page

**Penyebab:** Frontend tidak ter-build atau tidak ter-copy

**Solusi:**
1. Cek build logs, pastikan `npm run build` success
2. Cek Dockerfile line 51: `COPY --from=frontend-builder`
3. Rebuild: Clean cache di Coolify → Redeploy

### MongoDB Atlas Connection Timeout

**Penyebab:** IP tidak di-whitelist

**Solusi:**
1. MongoDB Atlas → Network Access
2. Add IP: `0.0.0.0/0` (allow all)
3. Atau dapatkan IP server Coolify dan whitelist

---

## 📊 Environment Variables Summary

| Variable | Required | Default | Example |
|----------|----------|---------|---------|
| `MONGO_URL` | ✅ YES | - | `mongodb+srv://user:pass@...` |
| `JWT_SECRET` | ✅ YES | - | `a8f5f167f44f4964e6c9...` |
| `DB_NAME` | ⚪ No | `super_app_madrasah` | `super_app_madrasah` |
| `CORS_ORIGINS` | ⚪ No | `*` | `https://app.domain.com` |
| `SERVICE_URL_BACKEND` | ⚪ No | - | `https://api.domain.com` |
| `SERVICE_FQDN_BACKEND` | ⚪ No | - | `api.domain.com` |
| `SERVICE_URL_FRONTEND` | ⚪ No | - | `https://app.domain.com` |
| `SERVICE_FQDN_FRONTEND` | ⚪ No | - | `app.domain.com` |

---

## 🎯 Quick Start Checklist

- [ ] MongoDB siap (Atlas atau Self-hosted)
- [ ] Dapatkan MongoDB connection string
- [ ] Generate JWT secret (32+ chars)
- [ ] Hapus deployment frontend/backend lama
- [ ] Buat application baru di Coolify
- [ ] Set Git repository: `KamaludinZ/super_app_madrasah`
- [ ] Set branch: `main`
- [ ] Set build pack: Docker Compose
- [ ] Konfigurasi domain
- [ ] **Set environment variables:**
  - [ ] `MONGO_URL`
  - [ ] `JWT_SECRET`
  - [ ] `DB_NAME` (optional)
- [ ] Deploy aplikasi
- [ ] Monitor build logs (~8-12 menit)
- [ ] Verify health endpoint: `/api/health`
- [ ] Test login di browser
- [ ] ✅ Done!

---

## 📞 Support

Jika ada masalah:
1. Cek Coolify logs
2. Cek container logs: `docker logs <container-id>`
3. Test MongoDB connection
4. Verify environment variables

---

**Deployment Architecture:**

```
┌─────────────────────────────────────────┐
│         Coolify Reverse Proxy           │
│      (Traefik/Caddy with SSL)           │
└────────────────┬────────────────────────┘
                 │ HTTPS
                 ↓
┌─────────────────────────────────────────┐
│         Docker Container                │
│  ┌─────────────────────────────────┐   │
│  │  Frontend (React Build)         │   │
│  │  Served from: /app/static       │   │
│  └─────────────────────────────────┘   │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  Backend (FastAPI + Uvicorn)    │   │
│  │  Running on: 0.0.0.0:8000       │   │
│  │  - API: /api/*                  │   │
│  │  - Static: /app/static          │   │
│  └─────────────────────────────────┘   │
└────────────────┬────────────────────────┘
                 │
                 ↓
        ┌────────────────┐
        │  MongoDB Atlas │
        │  or Self-hosted│
        └────────────────┘
```

**Created:** 2026-05-30
**Last Updated:** 2026-05-30
**Version:** 1.0
