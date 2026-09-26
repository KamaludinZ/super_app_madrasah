# 🔒 Setup MongoDB di Coolify dengan Aman

## ✅ **JAWABAN: YA, AMAN** - Dengan Konfigurasi yang Benar

MongoDB yang sudah ada di Coolify **AMAN DIGUNAKAN** untuk production **JIKA** dikonfigurasi dengan benar mengikuti panduan di bawah ini.

---

## 📋 Checklist Keamanan MongoDB di Coolify

### ✅ Yang Harus Dipastikan:

1. **Authentication Enabled** ✅
   - MongoDB di Coolify sudah ada username & password
   - Tidak boleh anonymous access

2. **Strong Password** 🔐
   - Minimal 16 karakter
   - Kombinasi huruf besar, kecil, angka, simbol
   - JANGAN gunakan password default seperti "admin123"

3. **Network Isolation** 🌐
   - MongoDB hanya accessible dari internal Docker network
   - TIDAK expose port 27017 ke internet public

4. **Persistent Volume** 💾
   - Data MongoDB di-persist di volume
   - Backup regular sudah di-setup

5. **Resource Limits** ⚙️
   - Set memory limit (min 512MB untuk production)
   - Set CPU limit jika perlu

---

## 🚀 Cara Setup MongoDB di Coolify (Step-by-step)

### Option 1: Gunakan MongoDB Service yang Sudah Ada di Coolify

Jika Coolify sudah menyediakan MongoDB service:

#### 1. Cek MongoDB Credentials di Coolify

```
Coolify Dashboard > Resources > MongoDB Service > Configuration
```

Catat:
- **Username** (biasanya: `root` atau `admin` atau `mongodb`)
- **Password** (harusnya strong password)
- **Internal Hostname** (biasanya: `mongodb` atau nama service)
- **Port** (default: `27017`)

#### 2. Set Environment Variables di Backend Service

Di Coolify Dashboard > Your Backend Service > Environment, set:

```env
# MongoDB Connection - Internal Coolify Network
MONGO_URL=mongodb://USERNAME:PASSWORD@MONGODB_SERVICE_NAME:27017/super_app_madrasah?authSource=admin

# Contoh jika MongoDB service bernama "mongodb-production":
# MONGO_URL=mongodb://root:YOUR_STRONG_PASSWORD@mongodb-production:27017/super_app_madrasah?authSource=admin

DB_NAME=super_app_madrasah

# Security
JWT_SECRET=<generate-new-64-char-secret>
ENVIRONMENT=production
CORS_ORIGINS=https://app.your-domain.com,https://api.your-domain.com
```

#### 3. Verifikasi Network Connectivity

MongoDB dan Backend harus dalam **network yang sama** di Coolify:

```
Coolify Dashboard > MongoDB Service > Networks
Coolify Dashboard > Backend Service > Networks
```

Pastikan keduanya dalam network yang sama (biasanya auto-configured).

---

### Option 2: Deploy MongoDB Baru di Coolify (Recommended)

Jika ingin setup MongoDB baru khusus untuk aplikasi ini:

#### 1. Create MongoDB Service di Coolify

```
Coolify Dashboard > New Resource > Database > MongoDB
```

**Configuration:**
- Name: `super-app-mongodb` (atau nama lain)
- Image: `mongo:7.0` (versi stable)
- Root Username: `admin` atau `root`
- Root Password: **GENERATE STRONG PASSWORD** (min 16 chars)
- Database Name: `super_app_madrasah`
- Persistent Volume: **ENABLE** (default sudah enable)
- Memory Limit: `512MB` (min untuk production)

#### 2. CRITICAL: Generate Strong Password

```bash
# Generate strong password (32 characters)
openssl rand -base64 32

# Atau pakai Python
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**Copy password ini** dan simpan di password manager (1Password, Bitwarden, dll).

#### 3. Verify MongoDB Service Running

```
Coolify Dashboard > MongoDB Service > Logs
```

Harus ada pesan:
```
MongoDB starting...
MongoDB initialized
waiting for connections on port 27017
```

#### 4. Connect Backend to MongoDB

Di Coolify Dashboard > Backend Service > Environment:

```env
# Format: mongodb://username:password@service-name:port/database?authSource=admin
MONGO_URL=mongodb://admin:YOUR_GENERATED_PASSWORD@super-app-mongodb:27017/super_app_madrasah?authSource=admin

DB_NAME=super_app_madrasah
```

**PENTING:** Ganti `YOUR_GENERATED_PASSWORD` dengan password yang Anda generate di step 2.

---

## 🔐 Security Hardening untuk MongoDB di Coolify

### 1. **JANGAN Expose MongoDB ke Internet**

❌ **BAHAYA:**
```yaml
# JANGAN LAKUKAN INI!
ports:
  - "27017:27017"  # Expose MongoDB ke internet
```

✅ **AMAN:**
```yaml
# MongoDB hanya accessible internal
expose:
  - "27017"  # Hanya di Docker network internal
```

Di Coolify, **JANGAN set public domain** untuk MongoDB service!

### 2. **Use Strong Authentication**

✅ **Wajib:**
- Root password minimal 16 karakter
- Kombinasi uppercase, lowercase, numbers, symbols
- Rotate password setiap 90 hari

❌ **Hindari:**
```
admin / admin123
root / password
mongodb / mongo
```

### 3. **Enable MongoDB Authentication**

MongoDB 7.0 di Coolify **sudah default enable authentication**. Verifikasi:

```bash
# SSH ke MongoDB container
docker exec -it <mongodb-container-name> bash

# Coba connect tanpa auth (harus GAGAL)
mongosh mongodb://localhost:27017
# Should show: "Authentication failed"

# Connect dengan auth (harus SUKSES)
mongosh mongodb://localhost:27017 -u admin -p <password> --authenticationDatabase admin
# Should show: "Connected successfully"
```

### 4. **Network Isolation**

MongoDB dan Backend harus dalam **private Docker network**:

```
Coolify secara otomatis handle ini dengan:
- Internal Docker network (biasanya: coolify-network atau project-network)
- Service discovery by name (misal: mongodb:27017)
- No external exposure
```

---

## 💾 Backup Strategy untuk MongoDB di Coolify

### 1. **Coolify Automatic Backups**

Coolify mungkin sudah menyediakan automatic backup untuk database services.

Check di:
```
Coolify Dashboard > MongoDB Service > Backups
```

Jika ada, **ENABLE** dan set:
- Frequency: Daily
- Retention: 7 days minimum
- Storage: Coolify's backup storage

### 2. **Manual Backup (Recommended untuk Production)**

Setup cron job untuk backup otomatis:

```bash
#!/bin/bash
# backup-mongodb.sh

# Configuration
MONGO_USER="admin"
MONGO_PASS="your-strong-password"
MONGO_HOST="super-app-mongodb"
DB_NAME="super_app_madrasah"
BACKUP_DIR="/backups/mongodb"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Dump database
docker exec <mongodb-container-name> mongodump \
  --uri="mongodb://$MONGO_USER:$MONGO_PASS@$MONGO_HOST:27017/$DB_NAME?authSource=admin" \
  --out="/tmp/backup_$DATE"

# Copy dari container ke host
docker cp <mongodb-container-name>:/tmp/backup_$DATE $BACKUP_DIR/

# Compress
tar -czf $BACKUP_DIR/backup_$DATE.tar.gz -C $BACKUP_DIR backup_$DATE
rm -rf $BACKUP_DIR/backup_$DATE

# Keep only last 30 days
find $BACKUP_DIR -name "backup_*.tar.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/backup_$DATE.tar.gz"
```

**Setup Cron:**
```bash
# Jalankan setiap hari jam 2 pagi
0 2 * * * /path/to/backup-mongodb.sh >> /var/log/mongodb-backup.log 2>&1
```

### 3. **Test Restore Procedure**

**PENTING:** Test restore SEBELUM disaster terjadi!

```bash
# Restore dari backup
docker exec -i <mongodb-container-name> mongorestore \
  --uri="mongodb://admin:password@localhost:27017" \
  --drop \
  --dir=/tmp/backup_20260802_020000/super_app_madrasah
```

---

## 🔍 Monitoring & Health Checks

### 1. **Verify MongoDB Connectivity dari Backend**

Setelah deploy, test connection:

```bash
# Check backend logs
docker logs <backend-container-name> | grep -i mongo

# Should see:
# "MongoDB client initialized for database: super_app_madrasah"
# "Note: Actual connection will be tested on first query"
```

### 2. **Health Check Endpoint**

Test via API:

```bash
curl https://api.your-domain.com/api/health

# Should return:
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "..."
}
```

### 3. **Monitor MongoDB Performance**

```bash
# SSH ke MongoDB container
docker exec -it <mongodb-container-name> mongosh \
  -u admin -p <password> --authenticationDatabase admin

# Check stats
db.serverStatus()
db.stats()

# Check current operations
db.currentOp()

# Check slow queries (> 100ms)
db.system.profile.find({millis: {$gt: 100}}).sort({ts: -1}).limit(10)
```

---

## ⚠️ COMPARISON: MongoDB di Coolify vs MongoDB Atlas

| Feature | MongoDB di Coolify | MongoDB Atlas |
|---------|-------------------|---------------|
| **Setup** | Medium (manual setup) | Easy (managed service) |
| **Cost** | Termasuk hosting Coolify | Bayar terpisah (gratis tier 512MB) |
| **Backup** | Manual setup | Automatic (built-in) |
| **Monitoring** | Manual (via logs) | Dashboard lengkap |
| **Scaling** | Manual | Automatic |
| **Security** | ✅ (jika configured benar) | ✅✅ (managed security) |
| **SSL/TLS** | ⚠️ Manual setup | ✅ Default enabled |
| **Maintenance** | Manual (updates, patches) | Automatic |
| **For Production** | ✅ OK (perlu maintenance) | ✅✅ Recommended |

### Rekomendasi:

- **MongoDB di Coolify:** ✅ AMAN untuk production **JIKA**:
  - Anda punya team DevOps untuk maintain
  - Sudah setup backup automation
  - Sudah setup monitoring
  - Budget terbatas

- **MongoDB Atlas:** ✅✅ **LEBIH RECOMMENDED** untuk production karena:
  - Managed service (less maintenance)
  - Built-in backups & monitoring
  - Better security defaults
  - High availability (replica sets)
  - Free tier cukup untuk start (512MB)

---

## 📝 Final Configuration untuk MongoDB di Coolify

### Environment Variables untuk Backend Service:

```env
# MongoDB Configuration (Coolify Internal)
MONGO_URL=mongodb://admin:STRONG_PASSWORD_HERE@super-app-mongodb:27017/super_app_madrasah?authSource=admin
DB_NAME=super_app_madrasah

# Security - CRITICAL!
JWT_SECRET=GENERATE_NEW_64_CHAR_SECRET_HERE
JWT_ALGORITHM=HS256
ENVIRONMENT=production

# CORS - Replace with your actual domains
CORS_ORIGINS=https://app.your-domain.com,https://api.your-domain.com

# Coolify will auto-set these:
# SERVICE_URL_BACKEND=https://api.your-domain.com
# SERVICE_URL_FRONTEND=https://app.your-domain.com
```

### Security Checklist:

- [x] MongoDB username bukan "admin" atau "root" (optional, tapi better)
- [x] Password minimal 16 karakter (WAJIB)
- [x] MongoDB tidak expose ke internet (WAJIB)
- [x] Authentication enabled (default di Coolify)
- [x] Network isolation (internal Docker network only)
- [x] Backup strategy sudah di-setup
- [x] Health check endpoint working
- [x] Connection tested dari backend

---

## ✅ KESIMPULAN

**YA, MongoDB di Coolify AMAN untuk production** dengan syarat:

1. ✅ **Strong password** (min 16 chars)
2. ✅ **Not exposed to internet** (internal network only)
3. ✅ **Authentication enabled** (default)
4. ✅ **Backups configured** (manual atau automatic)
5. ✅ **Monitoring active** (logs & health checks)

**Connection string format:**
```
mongodb://username:password@mongodb-service-name:27017/super_app_madrasah?authSource=admin
```

**TIDAK perlu ubah code** - aplikasi sudah support MongoDB mana saja (Atlas, Coolify, atau local).

---

**Happy Deploying! 🚀**

Jika ada pertanyaan tentang setup MongoDB di Coolify, tanyakan saja!
