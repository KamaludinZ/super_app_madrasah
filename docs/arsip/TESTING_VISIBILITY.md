# Testing Visibility - Instruksi Lengkap

## Masalah: Menu Hidden Masih Muncul

Jika Anda masih melihat menu yang seharusnya hidden (misalnya RKAM), ikuti langkah-langkah berikut:

## Langkah 1: Pastikan Frontend Ter-update

### Jika Menggunakan Development Server (npm start):
```bash
# Stop server (Ctrl+C)
cd frontend
npm start
```

**Note**: Development server akan auto-reload saat file berubah.

### Jika Menggunakan Production Build:
```bash
cd frontend
npm run build
npm run start  # Atau serve production build
```

## Langkah 2: Hard Refresh Browser

**Windows/Linux:**
- `Ctrl + Shift + R`
- atau `Ctrl + F5`

**Mac:**
- `Cmd + Shift + R`

**Chrome:**
- Buka DevTools (F12)
- Klik kanan pada refresh button
- Pilih "Empty Cache and Hard Reload"

## Langkah 3: Clear Browser Data

**Chrome:**
1. Settings → Privacy and Security → Clear browsing data
2. Time range: "All time"
3. Pilih:
   - ✅ Cached images and files
   - ✅ Cookies and other site data (optional)
4. Click "Clear data"

**Firefox:**
1. Settings → Privacy & Security
2. Cookies and Site Data → Clear Data
3. Select "Cached Web Content"

## Langkah 4: Test di Incognito/Private Window

**Paling mudah dan cepat:**
1. Buka browser incognito/private window
2. Akses `http://localhost:3000/public/monitoring`
3. Cek header - seharusnya hanya tampil menu "Monitoring Jurnal"

## Langkah 5: Verify di Console

1. Buka DevTools (F12)
2. Tab Console
3. Refresh halaman
4. Lihat log `[Visibility] Fetched:`
5. Verify data:
   ```javascript
   {
     rkam_visibility: "hidden",          // ✅ Harus hidden
     agenda_visibility: "dashboard",
     prestasi_visibility: "dashboard",
     monitoring_visibility: "public"
   }
   ```

## Langkah 6: Check Network Tab

1. Buka DevTools (F12)
2. Tab Network
3. Refresh halaman (F5)
4. Cari request ke `/api/settings/public-pages`
5. Klik → Preview tab
6. Verify response:
   ```json
   {
     "rkam_visibility": "hidden",
     "agenda_visibility": "dashboard",
     "prestasi_visibility": "dashboard",
     "monitoring_visibility": "public"
   }
   ```

## Expected Results

### Tanpa Login:

**Header di /public/monitoring:**
- ✅ "Monitoring Jurnal" (muncul)
- ❌ "Prestasi" (hidden - dashboard mode)
- ❌ "Agenda" (hidden - dashboard mode)
- ❌ "RKAM" (hidden - hidden mode)

**Total menu: 1 item saja**

### Dengan Login:

**Header di /public/monitoring:**
- ✅ "Monitoring Jurnal" (muncul)
- ✅ "Prestasi" (muncul - dashboard mode + logged in)
- ✅ "Agenda" (muncul - dashboard mode + logged in)
- ❌ "RKAM" (tetap hidden - hidden mode)

**Total menu: 3 item**

## Troubleshooting

### Masalah: Menu masih muncul setelah hard refresh

**Solusi:**
1. Kill semua proses browser
2. Hapus folder cache manual:
   - Chrome: `%LOCALAPPDATA%\Google\Chrome\User Data\Default\Cache`
   - Firefox: `%APPDATA%\Mozilla\Firefox\Profiles\*.default\cache2`
3. Restart browser
4. Test di incognito

### Masalah: Settings tidak berubah

**Solusi:**
1. Verify backend settings:
   ```bash
   curl http://localhost:8000/api/settings/public-pages
   ```
2. Harusnya return:
   ```json
   {"rkam_visibility":"hidden", ...}
   ```
3. Jika sudah benar, masalahnya di frontend cache

### Masalah: Console log tidak muncul

**Solusi:**
1. Pastikan file `usePublicPagesVisibility.js` sudah ter-update
2. Rebuild frontend:
   ```bash
   cd frontend
   npm run build
   ```
3. Restart development server

## Test Utility

Buka `http://localhost:3000/test_visibility.html` untuk:
- Fetch settings langsung dari API
- Clear all caches
- Verify RKAM status

## Final Check

Jika semua langkah di atas sudah dilakukan dan menu hidden masih muncul:

1. Check file timestamp:
   ```bash
   ls -la frontend/src/hooks/usePublicPagesVisibility.js
   ls -la frontend/src/components/layout/PublicHeader.js
   ```

2. Verify git commit:
   ```bash
   git log --oneline -5
   ```
   Should show commit `1e6058c` - cache busting fix

3. Check if development server is running with updated code:
   - Stop server (Ctrl+C)
   - Clear node_modules/.cache (if exists)
   - Restart: `npm start`

## Contact

Jika masih ada masalah setelah semua langkah di atas, kemungkinan:
- Ada file yang belum di-save
- Ada conflict di git
- Frontend server belum direstart setelah perubahan
