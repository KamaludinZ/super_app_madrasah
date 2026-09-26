# 🚀 Quick Production Deployment Guide
## Super Apps MATSANDATAMA v1.1.2

Panduan cepat untuk deploy ke production. Untuk detail lengkap, lihat `PRODUCTION_DEPLOYMENT_CHECKLIST.md`.

---

## ⚡ Quick Start (5 Steps)

### 1. Configure Environment

```bash
# Backend
cd backend
cp .env.production.template .env
nano .env  # Edit dengan credentials production
```

**Minimal Configuration:**
```bash
ENVIRONMENT=production
LOG_LEVEL=WARNING
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
JWT_SECRET=[generate dengan: python -c "import secrets; print(secrets.token_urlsafe(32))"]
CORS_ORIGINS=https://super.mtsn2kotamalang.sch.id
```

### 2. Build Frontend

```bash
cd frontend
cp .env.production.template .env.production
nano .env.production  # Set REACT_APP_BACKEND_URL

# Build
NODE_ENV=production npm run build

# Output di: frontend/build/
```

### 3. Deploy Backend

```bash
# Upload ke server
rsync -av backend/ user@server:/app/backend/

# SSH ke server
ssh user@server
cd /app/backend

# Setup environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Start dengan Gunicorn
gunicorn server:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --daemon
```

### 4. Deploy Frontend

```bash
# Upload build ke server
rsync -av frontend/build/ user@server:/var/www/matsandatama/

# Configure Nginx (minimal)
server {
    listen 80;
    server_name super.mtsn2kotamalang.sch.id;
    root /var/www/matsandatama;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
    }
}

# Restart Nginx
sudo systemctl reload nginx
```

### 5. Verify Deployment

```bash
# Health check
curl http://localhost:8000/api/health

# Test frontend
curl http://localhost:80

# Check logs
tail -f /var/log/backend/error.log
```

---

## 🔒 Security Checklist (Quick)

- [ ] `ENVIRONMENT=production` in backend/.env
- [ ] `NODE_ENV=production` saat build frontend
- [ ] CORS tidak `allow_origins=["*"]`
- [ ] JWT_SECRET minimal 32 karakter random
- [ ] MongoDB credentials aman
- [ ] .env files TIDAK di commit ke git
- [ ] HTTPS enabled (untuk production)

---

## ✅ Post-Deploy Verification

```bash
# 1. Backend health
curl https://api.mtsn2kotamalang.sch.id/api/health

# 2. Security headers
curl -I https://super.mtsn2kotamalang.sch.id
# Check for: X-Frame-Options, X-Content-Type-Options

# 3. No console logs
# Open browser → DevTools → Console
# Navigate around app → Should see NO debug logs

# 4. Login test
# Visit site → Try login → Should work
```

---

## 🆘 Troubleshooting

### Backend tidak start
```bash
# Check logs
tail -f /var/log/backend/error.log

# Check process
ps aux | grep uvicorn

# Check port
netstat -tlnp | grep 8000
```

### Frontend 404 errors
```bash
# Check Nginx config
sudo nginx -t

# Check files exist
ls -la /var/www/matsandatama/

# Check Nginx logs
tail -f /var/log/nginx/error.log
```

### CORS errors
```bash
# Check backend/.env
cat backend/.env | grep CORS_ORIGINS

# Should NOT be '*'
# Should include frontend domain
```

### Database connection failed
```bash
# Test MongoDB connection
python3 << EOF
from pymongo import MongoClient
import os
client = MongoClient(os.environ['MONGODB_URI'])
print(client.server_info())
EOF
```

---

## 📊 Monitoring

```bash
# Backend logs
tail -f /var/log/backend/error.log
tail -f /var/log/backend/access.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# System resources
htop
df -h
```

---

## 🔄 Update Deployment

```bash
# 1. Pull latest code
cd /app/super_app_madrasah
git pull origin main

# 2. Rebuild frontend
cd frontend
NODE_ENV=production npm run build

# 3. Upload build
rsync -av build/ user@server:/var/www/matsandatama/

# 4. Restart backend
sudo systemctl restart matsandatama-backend

# 5. Reload nginx
sudo systemctl reload nginx
```

---

## 📚 Full Documentation

- **SECURITY_AUDIT.md** - Security audit lengkap
- **SECURITY_SUMMARY.md** - Ringkasan security
- **PRODUCTION_DEPLOYMENT_CHECKLIST.md** - Checklist lengkap
- **backend/.env.production.template** - Backend config guide
- **frontend/.env.production.template** - Frontend config guide

---

## 🎯 One-Liner Commands

```bash
# Generate JWT secret
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Check console.log in build
grep -r "console.log" frontend/build/static/js/ 2>/dev/null | wc -l

# Test API health
curl -s http://localhost:8000/api/health | jq

# Check security headers
curl -sI https://super.mtsn2kotamalang.sch.id | grep -E "X-|Strict"

# Backend process status
ps aux | grep -E "uvicorn|gunicorn" | grep -v grep
```

---

**Quick Deploy Time:** ~30 minutes (first time)
**Update Deploy Time:** ~5 minutes

✅ Ready untuk production!
