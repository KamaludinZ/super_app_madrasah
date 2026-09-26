# 🎉 Production Setup - Implementasi Berhasil

> **Dokumentasi ini berdasarkan deployment production yang SUDAH BERHASIL**

## 📊 Arsitektur Production

```
Internet (HTTPS/HTTP)
   │
   ▼
Traefik (Port 80, 443)
   │ ├─ SSL/TLS Termination (Let's Encrypt)
   │ └─ Reverse Proxy
   │
   ├─── https://madrasah.srv1721481.hstgr.cloud/*
   │      └──> Frontend Container (Port 80 internal)
   │             └─ Nginx serve static React files
   │
   ├─── Server:8000 (Host Port)
   │      └──> Backend Container (Port 8000)
   │             └─ FastAPI + Uvicorn
   │                   │
   │                   ▼
   └─── Server:27017 (Host Port)
          └──> MongoDB Container (Port 27017)
                 └─ Database local
```

---

## 🔧 Port Mapping Production

| Service | Container Port | Host Port | Public Access |
|---------|---------------|-----------|---------------|
| **Traefik** | 80, 443 | 80, 443 | ✅ Public (Internet) |
| **Frontend** | 80 | - | ❌ Via Traefik only |
| **Backend** | 8000 | 8000 | ⚠️ Internal/Server-side |
| **MongoDB** | 27017 | 27017 | ❌ Internal only |

---

## 🌐 Domain & URL

### ✅ **Yang Berhasil:**
- **Frontend**: https://madrasah.srv1721481.hstgr.cloud
  - Diakses publik via Traefik
  - SSL otomatis dari Let's Encrypt
  - Router Traefik: `Host(madrasah.srv1721481.hstgr.cloud)`

### ⚠️ **Yang Tidak Bekerja (dan Alasannya):**

1. **super.kzsolusindo.com**
   - ❌ Tidak masuk rule frontend di Traefik
   - Solusi: Tambahkan domain ini ke Traefik router labels

2. **https://145.79.10.110** (IP langsung)
   - ❌ Sertifikat TLS untuk domain, bukan IP
   - ❌ Traefik router match by Host domain
   - Result: 404 / TLS warning

---

## 🚀 Alur Akses yang Benar

### **1. User Akses Frontend:**
```
User Browser
  → https://madrasah.srv1721481.hstgr.cloud/login
    → Traefik (port 443)
      → Frontend Container (port 80)
        → Nginx serve index.html
```

### **2. Frontend Fetch API:**
```
Frontend (Browser)
  → fetch('/api/auth/login')
    → Traefik routing /api/*
      → Backend Container (port 8000)
        → FastAPI endpoint
          → MongoDB (port 27017)
```

### **3. Internal Service Communication:**
```
Backend Container
  → mongodb://mongodb:27017
    → MongoDB Container
      (via Docker network)
```

---

## 📝 Konfigurasi Docker Compose Production

Berdasarkan setup yang berhasil, ini konfigurasi yang sesuai:

### **docker-compose.yml** (Production)

```yaml
services:
  mongodb:
    image: mongo:7.0
    container_name: superapp-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"  # Exposed untuk backup/admin
    environment:
      MONGO_INITDB_ROOT_USERNAME: ${MONGO_ROOT_USERNAME}
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}
      MONGO_INITDB_DATABASE: ${DB_NAME}
    volumes:
      - mongodb_data:/data/db
    networks:
      - superapp-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: superapp-backend
    restart: unless-stopped
    depends_on:
      - mongodb
    ports:
      - "8000:8000"  # Exposed untuk internal server access
    environment:
      MONGO_URL: ${MONGO_URL}
      DB_NAME: ${DB_NAME}
      JWT_SECRET: ${JWT_SECRET}
      CORS_ORIGINS: ${CORS_ORIGINS}
    volumes:
      - ./uploads:/app/uploads
    networks:
      - superapp-network
    labels:
      # Traefik routing untuk /api/*
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`madrasah.srv1721481.hstgr.cloud`) && PathPrefix(`/api`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls=true"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=8000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.traefik
      args:
        REACT_APP_BACKEND_URL: ""  # Kosong, pakai Traefik proxy
    container_name: superapp-frontend
    restart: unless-stopped
    depends_on:
      - backend
    # TIDAK ada port mapping ke host
    # Hanya diakses lewat Traefik
    networks:
      - superapp-network
    labels:
      # Traefik routing untuk frontend
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`madrasah.srv1721481.hstgr.cloud`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls=true"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=80"
      # Priority lebih rendah dari backend agar /api/* match dulu
      - "traefik.http.routers.frontend.priority=1"
      - "traefik.http.routers.backend.priority=10"

volumes:
  mongodb_data:
  uploads:

networks:
  superapp-network:
    external: true
    name: traefik-network  # atau sesuai network Traefik di server
```

---

## 🔑 Environment Variables Production

File `.env` (di server):

```env
# Domain Production
DOMAIN=madrasah.srv1721481.hstgr.cloud

# MongoDB
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=<strong-password-production>
DB_NAME=super_app_madrasah
MONGO_URL=mongodb://admin:<password>@mongodb:27017/super_app_madrasah?authSource=admin

# Security
JWT_SECRET=<random-64-characters>

# CORS - PENTING: Harus include domain production
CORS_ORIGINS=https://madrasah.srv1721481.hstgr.cloud,https://www.madrasah.srv1721481.hstgr.cloud

# Service URLs
SERVICE_URL_BACKEND=https://madrasah.srv1721481.hstgr.cloud
SERVICE_FQDN_BACKEND=madrasah.srv1721481.hstgr.cloud
SERVICE_URL_FRONTEND=https://madrasah.srv1721481.hstgr.cloud
SERVICE_FQDN_FRONTEND=madrasah.srv1721481.hstgr.cloud
```

---

## 🎯 Menambahkan Domain Baru (super.kzsolusindo.com)

Jika ingin menambahkan domain `super.kzsolusindo.com`:

### **1. Update DNS:**
```
A Record: super.kzsolusindo.com → 145.79.10.110
```

### **2. Update Traefik Labels:**

Ubah label frontend dan backend menjadi multi-domain:

```yaml
# Frontend labels
- "traefik.http.routers.frontend.rule=Host(`madrasah.srv1721481.hstgr.cloud`) || Host(`super.kzsolusindo.com`)"

# Backend labels
- "traefik.http.routers.backend.rule=(Host(`madrasah.srv1721481.hstgr.cloud`) || Host(`super.kzsolusindo.com`)) && PathPrefix(`/api`)"
```

### **3. Update CORS:**
```env
CORS_ORIGINS=https://madrasah.srv1721481.hstgr.cloud,https://super.kzsolusindo.com
```

### **4. Restart Services:**
```bash
docker compose down
docker compose up -d
```

Traefik akan otomatis generate SSL certificate untuk domain baru.

---

## 📊 Monitoring & Troubleshooting

### **Cek Status Container:**
```bash
docker ps
# Harus ada: traefik, superapp-frontend, superapp-backend, superapp-mongodb
```

### **Cek Logs:**
```bash
# Frontend
docker logs superapp-frontend -f

# Backend
docker logs superapp-backend -f

# MongoDB
docker logs superapp-mongodb -f

# Traefik
docker logs traefik -f
```

### **Test Health Endpoints:**
```bash
# Backend (dari server)
curl http://localhost:8000/api/health

# Frontend (dari server)
curl http://localhost:80/

# Public URL
curl https://madrasah.srv1721481.hstgr.cloud/api/health
```

### **Cek Traefik Dashboard:**
```
http://145.79.10.110:8080  # Jika dashboard enabled
```

Atau via Docker labels:
```bash
docker exec traefik cat /etc/traefik/traefik.yml
```

---

## 🔒 Security Best Practices

✅ **Yang Sudah Benar:**
- SSL/TLS via Traefik + Let's Encrypt
- Frontend tidak expose port langsung
- MongoDB tidak public (port 27017 hanya host-local)
- CORS configured untuk domain spesifik

⚠️ **Yang Perlu Diperhatikan:**
- Backend port 8000 exposed ke host:
  - Jika tidak perlu akses langsung, bisa dihapus port mapping
  - Atau restrict dengan firewall (hanya localhost/internal IP)
- MongoDB port 27017 exposed:
  - Untuk backup/admin tools
  - Pastikan firewall hanya allow dari IP terpercaya

**Recommendation**: Gunakan firewall rules:
```bash
# UFW (Ubuntu)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 8000/tcp  # Block public akses backend
sudo ufw deny 27017/tcp  # Block public akses MongoDB
sudo ufw enable
```

---

## 📈 Diagram Lengkap

```
┌─────────────────────────────────────────────────────────┐
│                      INTERNET                            │
│              (Users/Browsers/Mobile)                     │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ HTTPS (443)
                     │ HTTP (80)
                     ▼
┌─────────────────────────────────────────────────────────┐
│               TRAEFIK (Reverse Proxy)                    │
│  - Auto SSL (Let's Encrypt)                             │
│  - Domain Routing                                        │
│  - Load Balancing                                        │
│                                                          │
│  Rules:                                                  │
│  ┌─ Host: madrasah.srv1721481.hstgr.cloud/*            │
│  │    → Frontend (priority: 1)                          │
│  └─ Host: madrasah.srv1721481.hstgr.cloud/api/*        │
│       → Backend (priority: 10)                          │
└────────┬─────────────────────┬──────────────────────────┘
         │                     │
         │                     │
    ┌────▼─────┐         ┌────▼─────┐
    │ Frontend │         │ Backend  │
    │ (Nginx)  │         │(FastAPI) │
    │ Port: 80 │         │Port: 8000│
    │ Internal │◄────┐   │ Public:  │
    │          │     │   │ Server:  │
    └──────────┘     │   │ 8000     │
                     │   └────┬─────┘
                     │        │
                     │        │ mongodb://mongodb:27017
                     │        │ (Docker network)
                     │        ▼
                     │   ┌──────────┐
                     │   │ MongoDB  │
                     │   │Port:27017│
                     └───│ Public:  │
                         │ Server:  │
                         │ 27017    │
                         └──────────┘
                              │
                              ▼
                         [Data Volume]
                         mongodb_data
```

---

## ✅ Checklist Production

- [x] Traefik running (port 80, 443)
- [x] Frontend accessible via domain (https://madrasah.srv1721481.hstgr.cloud)
- [x] SSL certificate valid (Let's Encrypt)
- [x] Backend API responding (/api/health)
- [x] MongoDB connected
- [x] CORS configured correctly
- [ ] Firewall rules configured (optional tapi recommended)
- [ ] Backup MongoDB automated
- [ ] Monitoring setup (optional)

---

## 🎉 Summary

**Setup yang Berhasil:**
- ✅ Traefik sebagai main reverse proxy
- ✅ Frontend diakses lewat Traefik (tidak expose port langsung)
- ✅ Backend expose port 8000 untuk server-side access
- ✅ MongoDB lokal untuk database
- ✅ SSL otomatis via Let's Encrypt
- ✅ Single domain untuk frontend + backend

**Key Points:**
1. Frontend **harus** diakses via domain yang match Traefik router
2. Akses via IP langsung tidak akan work (TLS issue + routing)
3. Service communication lewat Docker network (internal)
4. Backend dan MongoDB bisa diakses dari server via localhost:port

---

Dokumentasi ini mencerminkan setup production yang **sudah berjalan dengan sukses**.
