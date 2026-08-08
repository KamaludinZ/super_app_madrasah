# Font Files untuk QR Card Generation

## Masalah
Di production (server Linux), font system tidak ditemukan, sehingga QR card menggunakan default font yang kecil dan buram.

## Solusi
Bundling font files ke dalam project agar selalu tersedia di semua environment.

## Download Font (Pilih salah satu)

### Opsi 1: DejaVu Sans (Recommended - Open Source)
1. Download dari: https://dejavu-fonts.github.io/Download.html
2. Extract file ZIP
3. Copy file-file berikut ke folder ini (`backend/fonts/`):
   - `DejaVuSans.ttf` (dari folder `ttf`)
   - `DejaVuSans-Bold.ttf` (dari folder `ttf`)

### Opsi 2: Menggunakan Font dari System Windows
Copy file dari `C:\Windows\Fonts\`:
- `arial.ttf` → rename ke `Arial.ttf`
- `arialbd.ttf` → rename ke `Arial-Bold.ttf`

## Atau Install Font di Production Server

Jika tidak ingin bundle font, install di production server dengan command:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y fonts-dejavu-core fonts-liberation

# CentOS/RHEL
sudo yum install -y dejavu-sans-fonts liberation-fonts
```

## Verifikasi
Setelah font tersedia, restart server dan cek log. Harus muncul:
```
[FONT] Successfully loaded class_huge font: /path/to/font at size 369
```

Jika masih muncul error:
```
[FONT] CRITICAL: No class_huge font found!
```
Berarti font belum tersedia.
