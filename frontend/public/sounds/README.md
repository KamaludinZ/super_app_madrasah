# Audio Files untuk Notifikasi

Folder ini berisi file audio untuk notifikasi "waktunya mengajar".

## Files

### 1. `notification-bell.mp3`
- **Jenis**: Bel lembut
- **Durasi**: ~2 detik
- **Penggunaan**: Notifikasi default saat app terbuka
- **Karakteristik**: Nada bell yang lembut dan tidak mengganggu

### 2. `notification-chime.mp3`
- **Jenis**: Chime
- **Durasi**: ~1.5 detik
- **Penggunaan**: Alternatif nada notifikasi
- **Karakteristik**: Nada chime yang jernih dan profesional

## Usage

File audio ini dimainkan otomatis saat:
1. Notifikasi "waktunya mengajar" muncul (10 menit sebelum)
2. Notifikasi "waktunya mengajar" saat jam mulai

**Catatan Penting:**
- ✅ Nada kustom HANYA dimainkan saat app sedang terbuka
- ⚠️ Saat app tertutup/background: Web Push menggunakan nada sistem HP (keterbatasan browser)
- 🍎 iOS: Nada sistem selalu digunakan (keterbatasan Safari)

## Audio Format

- Format: MP3
- Bitrate: 128 kbps
- Sample Rate: 44.1 kHz
- Mono channel (untuk ukuran file lebih kecil)

## Customization

Untuk mengganti nada:
1. Upload file audio baru (MP3 format)
2. Nama file harus sama atau update reference di kode
3. Maksimal file size: 100 KB

## References

- `frontend/src/lib/notifications.js` - Audio player logic
- `frontend/src/hooks/useTeachingReminder.js` - Notifikasi hook
