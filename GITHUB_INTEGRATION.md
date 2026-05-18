# GitHub Integration - Auto Update Feature

Aplikasi Super Apps MATSANDATAMA mendukung fitur auto-update yang dapat memeriksa versi terbaru dari GitHub Releases.

## Setup GitHub Repository

### 1. Buat Repository di GitHub

1. Login ke GitHub
2. Buat repository baru (bisa public atau private)
3. Push kode aplikasi ke repository tersebut

### 2. Konfigurasi Environment Variables

Edit file `.env` di folder `backend/` dan tambahkan:

```env
# Format: owner/repo-name
GITHUB_REPO=matsandatama/super-app-madrasah

# Opsional - untuk private repo atau rate limit lebih tinggi
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

**Cara mendapatkan GitHub Token:**
1. Buka https://github.com/settings/tokens
2. Klik "Generate new token" → "Generate new token (classic)"
3. Berikan nama token (contoh: "SuperApp Auto Update")
4. Pilih scopes:
   - Untuk public repo: centang `public_repo`
   - Untuk private repo: centang `repo`
5. Klik "Generate token"
6. Copy token yang dihasilkan (hanya muncul sekali!)
7. Paste ke file `.env`

### 3. Membuat Release di GitHub

Setiap kali ada versi baru:

1. Update versi di `backend/routers/app_info.py`:
   ```python
   CURRENT_VERSION = "1.1.0"  # Update versi
   RELEASE_DATE = "2025-02-01"  # Update tanggal
   ```

2. Commit dan push perubahan

3. Buat release di GitHub:
   ```bash
   # Via GitHub Web:
   # 1. Buka repository → Releases → Draft a new release
   # 2. Tag version: v1.1.0 (harus pakai prefix 'v')
   # 3. Release title: Version 1.1.0
   # 4. Describe this release: [Release notes]
   # 5. Klik "Publish release"

   # Via Git CLI:
   git tag -a v1.1.0 -m "Version 1.1.0"
   git push origin v1.1.0
   ```

4. Tambahkan release notes dengan format:
   ```markdown
   ## What's New
   - Fitur baru A
   - Fitur baru B

   ## Improvements
   - Perbaikan performa X
   - UI/UX enhancement Y

   ## Bug Fixes
   - Fixed issue #123
   - Fixed issue #456
   ```

### 4. Format Versioning

Gunakan Semantic Versioning (https://semver.org/):
- Format: `MAJOR.MINOR.PATCH`
- Contoh: `1.2.3`
- Tag di GitHub: `v1.2.3` (dengan prefix 'v')

**Aturan versioning:**
- MAJOR (1.x.x): Breaking changes, perubahan besar
- MINOR (x.1.x): Fitur baru, backward compatible
- PATCH (x.x.1): Bug fixes, perbaikan kecil

## Cara Menggunakan

### Untuk Admin

1. Login sebagai admin
2. Buka menu "Info & Update" di sidebar
3. Klik tombol "Cek Update"
4. Jika ada versi baru:
   - Lihat release notes
   - Klik "Download Update"
   - Download dan install versi baru

### Troubleshooting

**Error: "GitHub repository belum dikonfigurasi"**
- Solusi: Set environment variable `GITHUB_REPO` di file `.env`

**Error: "Repository not found"**
- Solusi: Pastikan nama repository benar
- Untuk private repo: tambahkan `GITHUB_TOKEN`

**Error: "Rate limit exceeded"**
- Solusi: Tambahkan `GITHUB_TOKEN` untuk meningkatkan rate limit
- GitHub API rate limit:
  - Tanpa token: 60 requests/hour
  - Dengan token: 5000 requests/hour

**Error: "Connection timeout"**
- Solusi: Periksa koneksi internet server
- Pastikan server bisa akses https://api.github.com

## Example GitHub Workflow

Untuk automasi release, buat file `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Create Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          draft: false
          prerelease: false
```

## Security Notes

⚠️ **PENTING:**
- Jangan commit file `.env` ke repository
- File `.env` sudah ada di `.gitignore`
- GitHub Token memiliki akses penuh, jaga kerahasiaannya
- Gunakan environment variables di production
- Rotate token secara berkala

## Struktur Versi Aplikasi

```
Current Version: 1.0.0
├── Backend: Python FastAPI
├── Frontend: React 18
├── Database: MongoDB
└── Release Date: 2025-01-15

Version History:
- v1.0.0 (2025-01-15): Initial release
```

## Support

Jika mengalami masalah:
1. Cek log backend untuk error details
2. Verifikasi konfigurasi environment variables
3. Test koneksi ke GitHub API:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://api.github.com/repos/owner/repo/releases/latest
   ```
