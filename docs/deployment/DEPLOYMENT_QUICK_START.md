# 🚀 Quick Start - Production Deployment ke Coolify

## Prerequisites
- ✅ Akun Coolify sudah siap
- ✅ MongoDB Atlas cluster sudah dibuat
- ✅ Domain sudah di-setup DNS-nya

## Langkah Deploy (5 Menit)

### 1. Clone Repository ke Coolify
```
Coolify > New Resource > Git Repository
Repository: https://github.com/YOUR_USERNAME/super_app_madrasah
Branch: main
```

### 2. Setup Backend Service

**Service Configuration:**
- Dockerfile: `backend/Dockerfile`
- Build Context: `backend`
- Port: `8000`
- Health Check: `/api/health`

**Environment Variables:**
```env
MONGO_URL=mongodb+srv://USER:PASS@cluster.mongodb.net/
DB_NAME=super_app_madrasah
JWT_SECRET=<generate-64-char-random-secret>
ENVIRONMENT=production
CORS_ORIGINS=https://app.your-domain.com,https://api.your-domain.com
```

**Generate JWT Secret:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

**Domain:**
- Set: `api.your-domain.com`
- Enable "Force HTTPS"

### 3. Setup Frontend Service

**Service Configuration:**
- Dockerfile: `frontend/Dockerfile`
- Build Context: `frontend`
- Port: `80`

**Build Arguments:**
```env
REACT_APP_BACKEND_URL=""
```

**Environment Variables:**
```env
BACKEND_UPSTREAM=https://api.your-domain.com/api/
```

**Domain:**
- Set: `app.your-domain.com` atau `www.your-domain.com`
- Enable "Force HTTPS"

### 4. Deploy!

1. **Deploy Backend First**
   - Click "Deploy" di backend service
   - Tunggu sampai status "Running" dan health check ✅

2. **Deploy Frontend**
   - Click "Deploy" di frontend service
   - Tunggu sampai status "Running"

3. **Seed Database (Sekali Saja)**
   ```bash
   # SSH ke backend container
   docker exec -it <backend-container-name> bash
   python seed_all_data.py
   exit
   ```

### 5. Test!

1. **Buka aplikasi:** https://app.your-domain.com
2. **Login dengan akun default:**
   - Username: `admin`
   - Password: (sesuai seed data)

## Troubleshooting Cepat

**Backend tidak start?**
- Cek environment variables sudah di-set semua
- Cek MongoDB Atlas IP whitelist (tambahkan Coolify server IP)
- Lihat logs: Coolify Dashboard > Backend > Logs

**Frontend error "Failed to fetch"?**
- Cek `BACKEND_UPSTREAM` sudah benar
- Cek `CORS_ORIGINS` di backend includes frontend domain
- Cek backend sudah running dan healthy

**Tidak bisa login?**
- Cek JWT_SECRET sudah di-set
- Cek database sudah di-seed (`python seed_all_data.py`)
- Cek CAPTCHA endpoint: `https://api.your-domain.com/api/auth/captcha`

## Dokumentasi Lengkap

- **Security Audit Report:** `SECURITY_AUDIT_REPORT.md`
- **Full Deployment Checklist:** `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
- **Backend .env template:** `backend/.env.production.example`
- **Frontend .env template:** `frontend/.env.production.example`

## Status Keamanan

✅ **PRODUCTION READY** - Skor 87/100

Aplikasi sudah siap production dengan security best practices:
- JWT authentication dengan bcrypt
- Rate limiting & CAPTCHA
- Security headers (HSTS, CSP, X-Frame-Options, dll)
- Audit logging lengkap
- RBAC (Role-Based Access Control)

---

**Happy Deploying! 🎉**
