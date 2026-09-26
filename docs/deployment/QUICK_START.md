# ⚡ Quick Start Guide

## Pilih Metode Deployment Anda

### 🎯 **Saya Deploy ke Coolify**
```bash
# 1. Push ke Git
git add .
git commit -m "Ready for Coolify deployment"
git push

# 2. Di Coolify:
# - Add Resource → Docker Compose
# - Pilih file: docker-compose.traefik.yml (atau biarkan default)
# - Set Environment Variables (lihat .env.example)
# - Assign domain
# - Deploy!

# 3. Environment Variables penting:
DOMAIN=yourdomain.com
MONGO_ROOT_PASSWORD=<strong-password>
JWT_SECRET=<random-64-chars>
CORS_ORIGINS=https://yourdomain.com
```

**Baca lengkap**: `DEPLOYMENT_TRAEFIK.md`

---

### 🖥️ **Saya Deploy ke VPS dengan Traefik**
```bash
# 1. Clone repo
git clone <repo-url>
cd super_app_madrasah

# 2. Setup environment
cp .env.example .env
nano .env  # Edit: DOMAIN, passwords, JWT_SECRET

# 3. Deploy
docker compose -f docker-compose.traefik.yml up -d --build

# 4. Monitor
docker compose -f docker-compose.traefik.yml logs -f
```

**Baca lengkap**: `DEPLOYMENT_TRAEFIK.md`

---

### 🐳 **Saya Deploy ke VPS tanpa Traefik (Nginx saja)**
```bash
# 1. Clone repo
git clone <repo-url>
cd super_app_madrasah

# 2. Setup environment
cp .env.example .env
nano .env  # Edit: passwords, JWT_SECRET, CORS_ORIGINS

# 3. Deploy
docker compose up -d --build

# 4. Monitor
docker compose logs -f

# 5. Akses
http://your-server-ip  # Frontend
http://your-server-ip:8000/api/health  # Backend
```

**Baca lengkap**: `COOLIFY_DEPLOYMENT.md`

---

## 🔑 File Penting untuk Setiap Metode

| Metode | Docker Compose File | Frontend Dockerfile | Nginx Config |
|--------|-------------------|-------------------|--------------|
| **Coolify (Traefik)** | `docker-compose.traefik.yml` | `frontend/Dockerfile.traefik` | `frontend/nginx-traefik.conf` |
| **VPS + Traefik** | `docker-compose.traefik.yml` | `frontend/Dockerfile.traefik` | `frontend/nginx-traefik.conf` |
| **VPS + Nginx** | `docker-compose.yml` | `frontend/Dockerfile` | `frontend/nginx.conf` |

---

## ❓ FAQ

**Q: Kenapa ada 2 setup berbeda?**
A: Coolify menggunakan Traefik sebagai reverse proxy. Jika pakai Nginx proxy di dalam container, akan conflict. Setup Traefik menggunakan Nginx hanya untuk serve static files.

**Q: Mana yang lebih baik?**
A:
- **Coolify/Traefik**: Auto SSL, simpler, recommended untuk production
- **Nginx Proxy**: Lebih control, cocok untuk VPS standalone atau custom setup

**Q: Bisa pakai MongoDB Atlas?**
A: Ya! Ganti `MONGO_URL` di environment variables dengan Atlas connection string.

**Q: Kenapa frontend tidak terbuild?**
A: Pastikan:
1. Frontend Dockerfile yang benar digunakan
2. Build args di-pass dari docker-compose
3. Cek logs: `docker compose logs frontend`

**Q: CORS error saat production?**
A: Update `CORS_ORIGINS` di backend environment dengan domain production Anda:
```env
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## 🆘 Troubleshooting

### Build Error
```bash
# Lihat logs detail
docker compose logs frontend
docker compose logs backend

# Rebuild dari scratch
docker compose down
docker compose up -d --build --force-recreate
```

### Frontend tidak bisa akses Backend
```bash
# Cek apakah backend running
curl http://localhost:8000/api/health  # Lokal
curl http://backend:8000/api/health    # Dari container

# Cek network
docker network inspect superapp-network
```

### MongoDB Connection Error
```bash
# Cek MongoDB logs
docker compose logs mongodb

# Cek koneksi
docker compose exec backend ping mongodb
```

---

## 📚 Dokumentasi Lengkap

1. **COOLIFY_DEPLOYMENT.md** - Deployment dengan Nginx proxy (original)
2. **DEPLOYMENT_TRAEFIK.md** - Deployment dengan Traefik (Coolify compatible)
3. **README.md** - Project overview dan development guide

---

## 🚀 Next Steps Setelah Deploy

1. ✅ Akses aplikasi di browser
2. ✅ Login dengan user default (lihat seed data)
3. ✅ Setup backup MongoDB (cron job atau Coolify auto-backup)
4. ✅ Monitor logs dan performance
5. ✅ Setup custom domain dan SSL (otomatis di Coolify/Traefik)

---

Butuh bantuan? Open issue di GitHub atau hubungi tim development.
