# 🚀 Deployment dengan Traefik (Coolify Compatible)

## Arsitektur dengan Traefik

```text
Internet
   │
   ▼
[Traefik Reverse Proxy]
   ├── yourdomain.com/*        → Frontend (Nginx static files)
   └── yourdomain.com/api/*    → Backend (FastAPI)
                                    │
                                    ▼
                              [MongoDB Container]
```

**Perbedaan dengan Setup Nginx Proxy:**
- ✅ **Traefik** handle SSL, routing, dan load balancing
- ✅ **Nginx** hanya serve static files React (tidak proxy)
- ✅ Frontend dan Backend share domain yang sama
- ✅ Tidak ada conflict antara Traefik dan Nginx

---

## File yang Digunakan

1. `docker-compose.traefik.yml` - Compose file dengan Traefik labels
2. `frontend/Dockerfile.traefik` - Frontend Dockerfile untuk Traefik
3. `frontend/nginx-traefik.conf` - Nginx config tanpa proxy_pass

---

## Deployment Options

### **Option A: Coolify (Recommended)**

Coolify sudah include Traefik built-in, jadi konfigurasi lebih simple.

#### **1. Persiapan Repository**

Push semua perubahan:
```bash
git add .
git commit -m "Add Traefik-compatible configuration"
git push origin main
```

#### **2. Deploy di Coolify**

**Metode 1: Docker Compose Stack**

1. Dashboard → Add Resource → **Docker Compose**
2. Connect Git repo
3. **Compose File**: Pilih `docker-compose.traefik.yml` atau biarkan default `docker-compose.yml`
4. **Environment Variables**:
   ```env
   DOMAIN=yourdomain.com
   MONGO_ROOT_PASSWORD=<strong-password>
   JWT_SECRET=<random-64-chars>
   DB_NAME=super_app_madrasah
   MONGO_URL=mongodb://admin:<password>@mongodb:27017/super_app_madrasah?authSource=admin
   CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   ```

5. **Domain Settings**:
   - Frontend: `yourdomain.com`
   - Backend: Tidak perlu domain terpisah (Traefik route /api ke backend)

6. Deploy!

**Metode 2: Service Terpisah (Manual)**

Buat 3 resource di Coolify:

**A. MongoDB:**
```yaml
Type: Database → MongoDB 7
Name: superapp-mongodb
Environment:
  MONGO_INITDB_ROOT_USERNAME=admin
  MONGO_INITDB_ROOT_PASSWORD=<strong-password>
  MONGO_INITDB_DATABASE=super_app_madrasah
Network: superapp-network
```

**B. Backend:**
```yaml
Type: Application
Name: superapp-backend
Git: <repo-url>
Build Path: backend
Dockerfile: backend/Dockerfile
Port: 8000

Environment:
  MONGO_URL=mongodb://admin:<password>@superapp-mongodb:27017/super_app_madrasah?authSource=admin
  DB_NAME=super_app_madrasah
  JWT_SECRET=<random-string>
  CORS_ORIGINS=https://yourdomain.com

Domains:
  - yourdomain.com/api (dengan path prefix)

Network: superapp-network
```

**C. Frontend:**
```yaml
Type: Application
Name: superapp-frontend
Git: <repo-url>
Build Path: frontend
Dockerfile: frontend/Dockerfile.traefik

Build Args:
  REACT_APP_BACKEND_URL: ""

Port: 80

Domains:
  - yourdomain.com

Network: superapp-network
```

**PENTING**: Ketiga service **HARUS** dalam network yang sama!

---

### **Option B: Self-Hosted VPS dengan Traefik**

Jika Anda setup Traefik sendiri di VPS:

#### **1. Setup Traefik (One-time)**

Buat `docker-compose.traefik-setup.yml`:
```yaml
version: '3.8'

services:
  traefik:
    image: traefik:v2.10
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik-config:/etc/traefik
      - ./traefik-certs:/letsencrypt
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=your-email@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    networks:
      - traefik-public

networks:
  traefik-public:
    external: true
```

Run Traefik:
```bash
docker network create traefik-public
docker compose -f docker-compose.traefik-setup.yml up -d
```

#### **2. Deploy App dengan Traefik**

Edit `docker-compose.traefik.yml`:
```yaml
# Di bagian networks, ganti menjadi:
networks:
  superapp-network:
    external: true
    name: traefik-public
```

Deploy:
```bash
# Edit .env dengan domain production
nano .env

# Set DOMAIN variable
DOMAIN=yourdomain.com

# Deploy
docker compose -f docker-compose.traefik.yml up -d --build
```

---

## Troubleshooting

### **1. Frontend tidak bisa fetch /api**

**Penyebab**: Traefik tidak route /api ke backend

**Solusi**:
- Pastikan backend container ada label:
  ```yaml
  traefik.http.routers.backend.rule=Host(`yourdomain.com`) && PathPrefix(`/api`)
  ```
- Cek Traefik dashboard: http://your-server:8080
- Lihat apakah router `backend` terdaftar

### **2. CORS Error**

**Penyebab**: Backend CORS_ORIGINS tidak include domain production

**Solusi**:
```env
# Backend environment
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### **3. SSL Certificate Error**

**Penyebab**: Let's Encrypt belum issue certificate

**Solusi**:
- Pastikan domain sudah pointing ke server IP
- Tunggu beberapa menit untuk ACME challenge
- Cek logs: `docker logs traefik`

### **4. Backend container tidak bisa resolve MongoDB**

**Penyebab**: Tidak dalam network yang sama

**Solusi**:
```bash
# Cek network
docker network inspect superapp-network

# Pastikan mongodb, backend, frontend semua ada
```

---

## Keuntungan Setup Traefik

1. ✅ **Auto SSL**: Let's Encrypt otomatis
2. ✅ **Single Domain**: Frontend dan backend share domain
3. ✅ **No CORS**: Karena same-origin
4. ✅ **Load Balancing**: Built-in dari Traefik
5. ✅ **Service Discovery**: Traefik auto-detect container baru
6. ✅ **Coolify Compatible**: Coolify pakai Traefik, jadi plug-and-play

---

## Comparison: Nginx Proxy vs Traefik

| Feature | Nginx Proxy (Original) | Traefik (New) |
|---------|----------------------|--------------|
| **SSL** | Manual setup | Auto Let's Encrypt |
| **Routing** | Nginx config | Docker labels |
| **CORS** | Perlu konfigurasi | Same-origin, no issue |
| **Coolify** | Bisa conflict | Native support |
| **Maintenance** | Edit nginx.conf | Edit docker labels |
| **Complexity** | Medium | Low (auto-discover) |

---

## Rekomendasi

- **Untuk Coolify**: Gunakan setup Traefik (file yang baru dibuat)
- **Untuk VPS dengan Nginx**: Gunakan setup original (`docker-compose.yml`)
- **Untuk production scale**: Gunakan Traefik + Kubernetes

---

## Next Steps

1. Pilih deployment method (Coolify vs Self-hosted)
2. Setup environment variables
3. Deploy menggunakan file yang sesuai:
   - **Traefik**: `docker-compose.traefik.yml`
   - **Nginx**: `docker-compose.yml` (original)
4. Monitor logs dan verifikasi
5. Setup monitoring (Prometheus/Grafana optional)

Jika ada error, share logs untuk debugging!
