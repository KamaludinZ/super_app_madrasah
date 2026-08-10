# 🔊 Audio Files Belum Terinstall

## Status Saat Ini

❌ **File audio belum tersedia**
- `notification-bell.mp3` - Tidak ditemukan
- `notification-chime.mp3` - Tidak ditemukan

## Dampak

Saat ini, notifikasi PWA "Waktunya Mengajar" **TIDAK AKAN BERBUNYI** karena file audio belum ada.

### Apa yang Masih Berfungsi:
✅ Push notification muncul di layar
✅ Vibration (getaran) tetap berfungsi
✅ Notifikasi visual tetap tampil
✅ Click notification tetap membuka app

### Apa yang Tidak Berfungsi:
❌ Custom audio saat app terbuka (foreground)
⚠️ Sistem hanya menggunakan nada default browser/OS

## Cara Menambahkan File Audio

### Option 1: Download Audio Gratis (Recommended)

1. Kunjungi situs audio gratis:
   - https://freesound.org/ (perlu login)
   - https://pixabay.com/sound-effects/ (no login)
   - https://mixkit.co/free-sound-effects/ (no login)

2. Cari sound effect:
   - "notification bell"
   - "notification chime"
   - "gentle bell"
   - "soft notification"

3. Download dalam format MP3

4. Rename files:
   - `notification-bell.mp3` (untuk reminder 10 menit sebelum)
   - `notification-chime.mp3` (untuk reminder saat jam mulai)

5. Upload ke folder ini: `frontend/public/sounds/`

### Option 2: Buat Sendiri

Gunakan tool online seperti:
- https://www.beepbox.co/ (buat musik simple)
- https://sfxr.me/ (buat sound effect)
- Audacity (desktop app, gratis)

### Option 3: Gunakan File Sistem (Simple)

Jika tidak ingin ribet, bisa gunakan file audio simple:
1. Record suara sendiri (misal: "ting" atau "bell")
2. Convert ke MP3
3. Upload ke folder ini

## Rekomendasi Karakteristik Audio

### notification-bell.mp3
- **Durasi**: 1-2 detik
- **Volume**: Sedang (tidak terlalu keras)
- **Karakter**: Bell lembut, tidak mengganggu
- **Penggunaan**: Notifikasi 10 menit sebelum mengajar
- **File size**: < 100 KB

### notification-chime.mp3
- **Durasi**: 1-1.5 detik
- **Volume**: Sedang
- **Karakter**: Chime jernih, profesional
- **Penggunaan**: Notifikasi tepat saat jam mengajar dimulai
- **File size**: < 100 KB

## Verifikasi Instalasi

Setelah upload file audio, buka browser console (F12) dan cek:

✅ **Sukses**: Tidak ada warning tentang audio files
❌ **Gagal**: Muncul warning: "⚠️ Audio files not found"

## Testing

1. Buka aplikasi di browser
2. Login sebagai guru
3. Tunggu 10 menit sebelum jadwal mengajar
4. Notifikasi seharusnya berbunyi dengan audio yang sudah di-upload

## Keterbatasan Browser

⚠️ **Penting untuk diketahui:**

- **App Terbuka**: Audio kustom akan diputar ✅
- **App Tertutup**: Hanya nada sistem browser/HP yang berbunyi ⚠️
- **iOS Safari**: Selalu gunakan nada sistem, audio kustom tidak support 🍎

Ini adalah keterbatasan Web Push API, bukan bug aplikasi.

## Support

Jika ada masalah dengan audio:
1. Check browser console (F12) untuk error
2. Pastikan file format MP3 (bukan WAV, OGG, dll)
3. Pastikan file size < 100 KB
4. Pastikan nama file PERSIS: `notification-bell.mp3` dan `notification-chime.mp3`

---

**Dibuat**: 2026-08-10
**Update terakhir**: 2026-08-10
