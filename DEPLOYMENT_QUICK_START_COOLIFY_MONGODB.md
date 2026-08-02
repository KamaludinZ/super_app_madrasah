# 🚀 Quick Start - Deploy ke Coolify dengan MongoDB Internal

## ✅ **KEAMANAN: SUDAH AMAN!**

Aplikasi sudah siap production dengan security score **87/100**. MongoDB di Coolify **AMAN digunakan** jika mengikuti panduan ini.

---

## Prerequisites
- ✅ Akun Coolify sudah siap
- ✅ Domain sudah di-setup DNS-nya
- ✅ MongoDB service di Coolify sudah running (atau akan dibuat)

---

## Langkah 1: Setup MongoDB di Coolify (5 Menit)

### Option A: Gunakan MongoDB yang Sudah Ada

Jika Coolify sudah punya MongoDB service:

1. **Cek credentials MongoDB:**
   ```
   Coolify Dashboard > Resources > MongoDB Service > Environment
   ```

   Catat:
   - Username (biasanya: `admin` atau `root`)
   - Password
   - Service name (biasanya: `mongodb` atau nama lain)

2. **Verifikasi MongoDB running:**
   ```
   Coolify Dashboard > MongoDB Service > Status
   ```
   Harus: ✅ Running

### Option B: Deploy MongoDB Baru (Recommended)

1. **Create MongoDB service:**
   ```
   Coolify > New Resource > Database > MongoDB 7.0
   ```

2. **Configuration:**
   - Name: `super-app-mongodb`
   - Root Username: `admin`
   - Root Password: **Generate strong password** ⬇️
     ```bash
     # Generate password (32 chars)
     python -c "import secrets; print(secrets.token_urlsafe(32))"
     ```
   - Database: `super_app_madrasah`
   - Volume: ✅ Enable persistent storage
   - Memory: 512MB minimum

3. **SIMPAN password** di password manager Anda!

4. **Deploy MongoDB** dan tunggu status: ✅ Running

---

## Langkah 2: Deploy Backend Service (10 Menit)

### 1. Create Backend Service

```
Coolify > New Resource > Application > Git Repository
```

**Configuration:**
- Repository: `https://github.com/YOUR_USERNAME/super_app_madrasah`
- Branch: `main`
- Build Pack: `Dockerfile`
- Dockerfile Location: `backend/Dockerfile`
- Build Context: `backend`
- Port: `8000`
- Health Check Path: `/api/health`

### 2. Set Environment Variables

```
Coolify > Backend Service > Environment > Add Variables
```

**REQUIRED Environment Variables:**

```env
# MongoDB Connection (Internal Coolify Network)
# Format: mongodb://username:password@service-name:27017/database?authSource=admin
MONGO_URL=mongodb://admin:YOUR_MONGODB_PASSWORD@super-app-mongodb:27017/super_app_madrasah?authSource=admin

# Database Name
DB_NAME=super_app_madrasah

# JWT Secret - GENERATE NEW untuk production!
JWT_SECRET=<paste-64-char-secret-here>

# Environment Mode
ENVIRONMENT=production

# CORS - CRITICAL: Replace with your actual domain!
CORS_ORIGINS=https://app.your-domain.com,https://api.your-domain.com
```

**Generate JWT Secret:**
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

### 3. Set Domain

```
Coolify > Backend Service > Domains
```

- Add domain: `api.your-domain.com`
- Enable: ✅ Force HTTPS
- Enable: ✅ Auto SSL (Let's Encrypt)

### 4. Deploy Backend

```
Coolify > Backend Service > Deploy
```

**Wait for:**
- Build: ✅ Success
- Status: ✅ Running
- Health Check: ✅ Healthy

**Verify deployment:**
```bash
curl https://api.your-domain.com/api/health

# Should return:
{
  "status": "healthy",
  "database": "connected",
  ...
}
```

---

## Langkah 3: Deploy Frontend Service (8 Menit)

### 1. Create Frontend Service

```
Coolify > New Resource > Application > Git Repository
```

**Configuration:**
- Repository: Same as backend
- Branch: `main`
- Build Pack: `Dockerfile`
- Dockerfile Location: `frontend/Dockerfile`
- Build Context: `frontend`
- Port: `80`

### 2. Set Build Arguments

```
Coolify > Frontend Service > Build > Build Arguments
```

```env
REACT_APP_BACKEND_URL=""
```
*Leave empty untuk same domain, atau isi jika API di domain berbeda*

### 3. Set Environment Variables

```
Coolify > Frontend Service > Environment
```

```env
# Backend upstream untuk nginx proxy
BACKEND_UPSTREAM=https://api.your-domain.com/api/
```

### 4. Set Domain

```
Coolify > Frontend Service > Domains
```

- Add domain: `app.your-domain.com` (atau `www.your-domain.com`)
- Enable: ✅ Force HTTPS
- Enable: ✅ Auto SSL (Let's Encrypt)

### 5. Deploy Frontend

```
Coolify > Frontend Service > Deploy
```

**Wait for:**
- Build: ✅ Success (might take 5-10 minutes for npm install)
- Status: ✅ Running

**Verify deployment:**
```bash
curl https://app.your-domain.com
# Should return HTML
```

---

## Langkah 4: Seed Database (2 Menit) - PENTING!

Database masih kosong, perlu di-seed dengan data awal:

### 1. SSH ke Backend Container

```
Coolify > Backend Service > Terminal
```

Atau via CLI:
```bash
docker exec -it <backend-container-name> bash
```

### 2. Run Seeder

```bash
# Di dalam container
python seed_all_data.py

# Output:
# Seeding academic years...
# Seeding users...
# Seeding settings...
# ...
# ✅ All data seeded successfully!

exit
```

### 3. Verify Seed Data

```bash
# Test login endpoint
curl https://api.your-domain.com/api/auth/captcha

# Should return CAPTCHA challenge
```

---

## Langkah 5: First Login & Verification (5 Menit)

### 1. Akses Aplikasi

Buka browser dan visit: **https://app.your-domain.com**

### 2. Test Login

**Default Admin Account** (dari seed data):
- Username: `admin`
- Password: Cek di `backend/seed_all_data.py` atau `backend/seed_data.py`
  - Biasanya: `admin123` atau password yang di-define di seeder

**PENTING:** Setelah login pertama kali, **SEGERA GANTI PASSWORD ADMIN!**

```
Dashboard > Admin > Users > Edit Admin > Change Password
```

### 3. Verify Core Functions

- [x] Login works
- [x] Dashboard loads
- [x] Create/edit user
- [x] View settings
- [x] Public pages accessible:
  - `/public/monitoring`
  - `/public/prestasi`
  - `/public/agenda`
  - `/public/rkam`

---

## 🔐 Post-Deployment Security Checks

### 1. Verify Security Headers

```bash
curl -I https://api.your-domain.com/api/health

# Should include:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: max-age=31536000; includeSubDomains
# Content-Security-Policy: default-src 'self'; ...
```

### 2. Verify HTTPS Redirect

```bash
curl -I http://app.your-domain.com

# Should: Redirect 301/302 to https://
```

### 3. Verify Rate Limiting

Try login dengan wrong password 6 kali - should get locked out.

### 4. Verify CORS Protection

```bash
curl -H "Origin: https://malicious-site.com" \
  https://api.your-domain.com/api/health

# Should NOT return:
# Access-Control-Allow-Origin: https://malicious-site.com
```

---

## 💾 Setup Backup (CRITICAL!)

### 1. Coolify Automatic Backups

Check if available:
```
Coolify > MongoDB Service > Backups
```

If available, enable:
- Frequency: **Daily**
- Retention: **7 days** minimum
- Time: **02:00 AM**

### 2. Manual Backup Script (Recommended)

Create backup script on Coolify server:

```bash
#!/bin/bash
# /opt/backups/backup-super-app-mongodb.sh

MONGO_CONTAINER="<your-mongodb-container-name>"
MONGO_USER="admin"
MONGO_PASS="YOUR_MONGODB_PASSWORD"
DB_NAME="super_app_madrasah"
BACKUP_DIR="/opt/backups/super-app"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Dump database
docker exec $MONGO_CONTAINER mongodump \
  --uri="mongodb://$MONGO_USER:$MONGO_PASS@localhost:27017/$DB_NAME?authSource=admin" \
  --out="/tmp/backup_$DATE"

# Copy to host
docker cp $MONGO_CONTAINER:/tmp/backup_$DATE $BACKUP_DIR/

# Compress
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz -C $BACKUP_DIR backup_$DATE
rm -rf $BACKUP_DIR/backup_$DATE

# Cleanup old backups (keep 30 days)
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +30 -delete

echo "Backup completed: backup_$DATE.tar.gz"
```

**Setup Cron:**
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/backups/backup-super-app-mongodb.sh >> /var/log/super-app-backup.log 2>&1
```

---

## 🆘 Troubleshooting

### Backend tidak start?

**Check logs:**
```
Coolify > Backend Service > Logs
```

**Common issues:**

1. **MongoDB connection failed**
   - Verify `MONGO_URL` format benar
   - Verify MongoDB service running
   - Verify MongoDB password benar
   - Verify backend dan MongoDB dalam network yang sama

2. **Environment variables not set**
   - Check semua required vars sudah di-set
   - JWT_SECRET must be set
   - MONGO_URL must be set

### Frontend shows "Failed to fetch"?

1. **Check CORS settings**
   - `CORS_ORIGINS` di backend harus include frontend domain
   - Format: `https://app.your-domain.com` (tanpa trailing slash)

2. **Check BACKEND_UPSTREAM**
   - Harus point ke backend API URL
   - Format: `https://api.your-domain.com/api/`

3. **Check backend health**
   ```bash
   curl https://api.your-domain.com/api/health
   ```

### Cannot login?

1. **Verify database seeded**
   ```bash
   docker exec -it <backend-container> python seed_all_data.py
   ```

2. **Check CAPTCHA endpoint**
   ```bash
   curl https://api.your-domain.com/api/auth/captcha
   # Should return JSON with challenge
   ```

3. **Check JWT_SECRET is set**
   ```
   Coolify > Backend > Environment > Verify JWT_SECRET exists
   ```

---

## 📊 Monitoring

### Daily Checks

- [x] Coolify dashboard - all services ✅ Running
- [x] Health endpoint: `curl https://api.your-domain.com/api/health`
- [x] MongoDB logs: No errors
- [x] Backend logs: No critical errors

### Weekly Checks

- [x] Backup completed successfully
- [x] Disk space on Coolify server
- [x] MongoDB storage usage
- [x] Review audit logs for suspicious activity

---

## ✅ Deployment Complete Checklist

- [x] MongoDB service running di Coolify
- [x] Backend deployed dengan environment variables correct
- [x] Frontend deployed dengan correct build args
- [x] Database seeded dengan `seed_all_data.py`
- [x] Admin password changed from default
- [x] Security headers verified (curl -I)
- [x] HTTPS enforced
- [x] CORS properly configured
- [x] Backups configured (automatic or manual)
- [x] Health checks passing
- [x] Public pages accessible
- [x] Admin functions tested
- [x] Rate limiting working

---

## 🎉 Success!

**Aplikasi Super Apps MATSANDATAMA sudah LIVE di production!**

**URLs:**
- Frontend: https://app.your-domain.com
- API: https://api.your-domain.com
- Health: https://api.your-domain.com/api/health

**Next Steps:**
1. ✅ Ganti password admin default
2. ✅ Create user accounts untuk staff
3. ✅ Setup backup monitoring
4. ✅ Train users on the system

---

**Dokumentasi Lengkap:**
- Security Audit: `SECURITY_AUDIT_REPORT.md`
- MongoDB Setup: `COOLIFY_MONGODB_SETUP.md`
- Full Checklist: `PRODUCTION_DEPLOYMENT_CHECKLIST.md`

**Need Help?** Check troubleshooting section atau review logs di Coolify dashboard.

---

**Happy Production! 🚀**
