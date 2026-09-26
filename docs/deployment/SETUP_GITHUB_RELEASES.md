# Setup GitHub Releases untuk Auto-Update

## Status Repository
Repository: https://github.com/KamaludinZ/super_app_madrasah

⚠️ **Saat ini repository belum public atau belum tersedia.**

## Langkah Setup

### Option 1: Buat Repository Public

1. **Buat Repository di GitHub**
   ```
   - Login ke GitHub
   - Buka https://github.com/KamaludinZ/super_app_madrasah
   - Jika repo belum ada, klik "New repository"
   - Repository name: super_app_madrasah
   - Visibility: Public (agar bisa di-access tanpa token)
   - Initialize repository
   ```

2. **Push Code ke GitHub**
   ```bash
   cd C:\super_app_madrasah\super_app_madrasah

   # Initialize git jika belum
   git init

   # Add remote
   git remote add origin https://github.com/KamaludinZ/super_app_madrasah.git

   # Add all files
   git add .

   # Commit
   git commit -m "Initial commit - Version 1.0.0"

   # Push
   git branch -M main
   git push -u origin main
   ```

3. **Buat Release Pertama (v1.0.0)**
   ```bash
   # Via GitHub Web Interface:
   1. Buka https://github.com/KamaludinZ/super_app_madrasah/releases
   2. Klik "Create a new release"
   3. Tag version: v1.0.0
   4. Release title: Version 1.0.0 - Initial Release
   5. Description:
      ## 🎉 Initial Release - Version 1.0.0

      ### Features
      - ✅ Jurnal Harian Guru dengan QR Scanner
      - ✅ Manajemen Jadwal Pelajaran
      - ✅ Monitoring Kehadiran Siswa
      - ✅ Monitoring Kebersihan Kelas
      - ✅ Manajemen Prestasi & Achievement
      - ✅ Manajemen Nilai & Rapor
      - ✅ Data GTK (Guru & Tenaga Kependidikan)
      - ✅ Ekstrakurikuler Management
      - ✅ Real-time Notifications
      - ✅ Backup & Restore System
      - ✅ Audit Log & Activity Tracking
      - ✅ Multi-role Access Control
      - ✅ Public Monitoring Dashboard
      - ✅ Auto-Update Feature

      ### Tech Stack
      - Backend: Python FastAPI + MongoDB
      - Frontend: React 18 + TailwindCSS
      - QR Scanner: html5-qrcode
      - UI Components: shadcn/ui

      ### Installation
      See README.md for installation instructions.

      Release Date: 2025-01-15
   6. Klik "Publish release"
   ```

### Option 2: Gunakan Private Repository dengan Token

Jika repository tetap private:

1. **Generate GitHub Personal Access Token**
   ```
   1. Buka https://github.com/settings/tokens
   2. Klik "Generate new token" → "Generate new token (classic)"
   3. Token name: "SuperApp Auto Update"
   4. Scopes:
      - ✅ repo (full control of private repositories)
   5. Click "Generate token"
   6. COPY token (hanya tampil sekali!)
   ```

2. **Configure Environment Variable**
   ```bash
   # Edit backend/.env
   GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Option 3: Disable Auto-Update (Temporary)

Jika belum siap setup GitHub:

```bash
# Edit backend/.env
GITHUB_REPO=
```

Aplikasi akan menampilkan pesan bahwa auto-update belum dikonfigurasi.

## Testing Auto-Update

Setelah setup:

1. **Login sebagai Admin**
2. **Buka Menu "Info & Update"**
3. **Klik "Cek Update"**
4. **Verifikasi response:**
   - ✅ Jika berhasil: Menampilkan versi current dan latest
   - ❌ Jika gagal: Menampilkan error message

## Troubleshooting

### Error: "Not Found" atau "404"

**Penyebab:**
- Repository belum dibuat
- Repository masih private tanpa token
- Nama repository salah

**Solusi:**
1. Pastikan repository public, ATAU
2. Tambahkan GITHUB_TOKEN untuk private repo
3. Verifikasi nama repository benar

### Error: "Rate limit exceeded"

**Penyebab:**
- GitHub API limit tercapai (60 requests/hour tanpa token)

**Solusi:**
- Tambahkan GITHUB_TOKEN (limit menjadi 5000 requests/hour)

### Error: "No releases found"

**Penyebab:**
- Repository belum punya release

**Solusi:**
- Buat release pertama dengan tag v1.0.0

## Version Management

### Untuk Update Aplikasi ke v1.1.0:

1. **Update Code**
   ```python
   # backend/routers/app_info.py
   CURRENT_VERSION = "1.1.0"
   RELEASE_DATE = "2025-02-01"
   ```

2. **Commit & Push**
   ```bash
   git add .
   git commit -m "Update to version 1.1.0"
   git push
   ```

3. **Create Release**
   ```bash
   git tag -a v1.1.0 -m "Version 1.1.0"
   git push origin v1.1.0
   ```

4. **Add Release Notes di GitHub**
   - Buka Releases → Draft new release
   - Select tag: v1.1.0
   - Add release notes
   - Publish

## Recommended: Create Release Template

File: `.github/RELEASE_TEMPLATE.md`

```markdown
## 🚀 What's New
- New feature A
- New feature B

## ✨ Improvements
- Performance improvement X
- UI/UX enhancement Y

## 🐛 Bug Fixes
- Fixed issue #123
- Fixed issue #456

## 📦 Dependencies
- Updated package X to v2.0
- Added new package Y

## 🔧 Breaking Changes
(if any)

## 📚 Documentation
- Updated README
- Added API documentation

---
**Full Changelog**: https://github.com/KamaludinZ/super_app_madrasah/compare/v1.0.0...v1.1.0
```

## Current Configuration

```
Version: 1.0.0
Release Date: 2025-01-15
GitHub Repo: KamaludinZ/super_app_madrasah
Auto-Update: Configured (needs repository setup)
```
