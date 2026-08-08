# Fix: QR Card Font Issue di Production

## Masalah
QR card yang di-generate di production muncul dengan tulisan kecil dan buram, berbeda dengan di lokal yang jelas dan besar.

## Root Cause
Font system tidak tersedia di production server Linux, sehingga aplikasi fallback ke default bitmap font yang kecil.

## Solusi yang Sudah Diterapkan

### 1. Update Dockerfile (backend/Dockerfile)
Menambahkan instalasi font packages:
```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    curl \
    build-essential \
    fonts-dejavu-core \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*
```

### 2. Font Bundling (backend/fonts/)
Menyediakan font files langsung di project:
- `Arial.ttf`
- `Arial-Bold.ttf`

Font ini akan dicari PERTAMA sebelum mencari font system.

### 3. Enhanced Font Loading dengan Logging
File `journal_core.py` sekarang memiliki:
- Prioritas pencarian font (bundled fonts → system fonts → fallback)
- Logging detail untuk debug masalah font
- Error handling yang lebih baik

## Cara Deploy

### Opsi A: Rebuild Docker Image (Recommended)
```bash
# Di production server
cd /path/to/super_app_madrasah
docker-compose down
docker-compose build backend
docker-compose up -d
```

### Opsi B: Install Font Manual (Tanpa Rebuild)
Jika tidak bisa rebuild Docker image:

```bash
# Login ke container yang sedang running
docker exec -it <backend-container-name> bash

# Install fonts
apt-get update
apt-get install -y fonts-dejavu-core fonts-liberation

# Exit container
exit

# Restart container
docker-compose restart backend
```

### Opsi C: Menggunakan Script Installer
```bash
# Di server production (jika tidak pakai Docker)
cd backend
chmod +x install_fonts.sh
./install_fonts.sh
```

## Verifikasi

### 1. Check Font Loading di Logs
Setelah deploy, generate 1 QR card dan check logs:

```bash
# Lihat logs
docker logs <backend-container> --tail=100 | grep FONT
```

**Expected output (GOOD):**
```
[FONT] Successfully loaded class_huge font: /app/fonts/Arial-Bold.ttf at size 369
[FONT] Successfully loaded room_label font: /app/fonts/Arial-Bold.ttf at size 135
...
```

**Error output (BAD):**
```
[FONT] CRITICAL: No class_huge font found! Tried 8 paths. Using default font (will be small and blurry).
```

### 2. Test Generate QR Card
1. Login ke admin panel
2. Buka menu "QR Generator"
3. Generate QR card untuk 1 ruangan
4. Download dan cek:
   - ✅ Nama kelas harus besar dan jelas
   - ✅ Token kelas harus terbaca dengan jelas
   - ✅ Tidak ada tulisan kecil atau blur

## Troubleshooting

### Masalah: Font masih kecil setelah deploy
**Solusi:**
1. Pastikan fonts sudah ter-install:
   ```bash
   docker exec <backend-container> dpkg -l | grep fonts
   ```

2. Check apakah font files ada di bundled folder:
   ```bash
   docker exec <backend-container> ls -la /app/fonts/
   ```

3. Check logs untuk error font loading:
   ```bash
   docker logs <backend-container> 2>&1 | grep -i font
   ```

### Masalah: Container tidak bisa rebuild
**Solusi:** Install fonts secara manual di running container (Opsi B di atas)

### Masalah: Logs menunjukkan "No font found"
**Kemungkinan:**
- Font files tidak ter-copy saat build
- Path font salah
- Permission issue

**Debug:**
```bash
# Masuk ke container
docker exec -it <backend-container> bash

# Check font paths
ls -la /usr/share/fonts/truetype/dejavu/
ls -la /app/fonts/

# Test manual
python3 -c "from PIL import ImageFont; import os; print([p for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/app/fonts/Arial.ttf'] if os.path.exists(p)])"
```

## Technical Details

### Font Loading Priority (Urutan)
1. `/app/fonts/DejaVuSans-Bold.ttf` (bundled - jika ada)
2. `/app/fonts/Arial-Bold.ttf` (bundled)
3. `/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf` (system)
4. `/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf` (system)
5. Fallback ke default (AVOID THIS!)

### Font Sizes @ 300 DPI
- Class name: 369pt (huge)
- Room label: 135pt
- Token value: 107pt
- Headers: 78-128pt

### Files Modified
1. `backend/Dockerfile` - Added font packages
2. `backend/journal_core.py` - Enhanced font loading logic
3. `backend/fonts/` - Added bundled fonts
4. `backend/install_fonts.sh` - Manual installer script

## Contact
Jika masih ada masalah setelah deploy, cek logs dan buat issue dengan:
- Docker logs output
- Screenshot hasil QR card
- Environment info (OS, Docker version)
