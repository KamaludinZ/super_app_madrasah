# Changelog - Version 1.1.2

**Release Date:** 2026-08-09

## 🎯 Fitur Utama

### 1. Pengaturan Visibilitas Halaman Public
- **Tab Baru di Admin Settings:** Tambahan tab "Halaman Public" di `/admin/settings` untuk mengontrol visibilitas halaman public
- **3 Mode Visibilitas:**
  - **Public (Terbuka):** Dapat diakses siapa saja tanpa login melalui `/public/*`
  - **Disembunyikan:** Halaman tidak dapat diakses baik public maupun dashboard
  - **Dashboard Only:** Hanya tampil di menu dashboard untuk user yang sudah login
- **Halaman yang Dikontrol:**
  - `/public/rkam` - RKAM (Rencana Kerja & Anggaran Madrasah)
  - `/public/agenda` - Agenda Kegiatan Madrasah
  - `/public/prestasi` - Prestasi Siswa
  - `/public/monitoring` - Monitoring Aktivitas Guru

### 2. Perbaikan Announcements/Pengumuman
- **Admin dapat melihat SEMUA pengumuman** terlepas dari target_roles yang dipilih
- **Fix query MongoDB** untuk mencakup pengumuman dengan `is_active=None` atau field yang tidak ada
- User non-admin tetap melihat pengumuman sesuai role mereka

## 🔧 Perbaikan Teknis

### Backend
- **New Endpoint:** `/api/settings/public-pages` - Get public pages visibility settings (accessible without auth)
- **Updated:** `/api/admin/settings` - Support untuk field visibility baru (rkam_visibility, agenda_visibility, prestasi_visibility, monitoring_visibility)
- **Updated:** `routers/notifications.py` - Fungsi `_user_matches_roles()` untuk allow admin melihat semua pengumuman
- **Updated:** Query announcements di 4 endpoints untuk include `is_active=None`

### Frontend
- **New Component:** `PublicPageGuard` - Guard component untuk mengontrol akses halaman public berdasarkan settings
- **New Hook:** `usePublicPagesVisibility` - Custom hook untuk fetch dan manage public pages visibility
- **New Component:** `PageLoader` & `FullPageLoader` - Loading components untuk better UX
- **Updated:** `App.js` - Implementasi PublicPageGuard pada routing
- **Updated:** `AdminSettingsPage.js` - Tambah tab "Halaman Public" dengan kontrol visibility

## 📦 Files Baru
- `frontend/src/components/PublicPageGuard.jsx`
- `frontend/src/hooks/usePublicPagesVisibility.js`
- `frontend/src/components/ui/page-loader.jsx`
- `backend/verify_admin_announcements.py` (testing utility)
- `ANNOUNCEMENTS_FIX_SUMMARY.md`
- `CHANGELOG_v1.1.2.md`

## 📝 Files Dimodifikasi
- `backend/routers/admin_settings.py`
- `backend/routers/notifications.py`
- `frontend/src/App.js`
- `frontend/src/pages/admin/AdminSettingsPage.js`
- `frontend/package.json` (version bump 1.1.1 → 1.1.2)

## 🐛 Bug Fixes
- Fix announcements tidak muncul untuk admin users
- Fix announcements dengan `is_active=None` tidak ditampilkan
- Fix school applications 404 error (dari previous session)
- Fix school applications 500 error dengan async database operations

## 🚀 Optimasi & Performa
- Loading states untuk halaman public menggunakan `FullPageLoader`
- Conditional rendering berdasarkan visibility settings untuk mengurangi route yang tidak perlu
- Struktur settings yang lebih modular dan maintainable

## 📚 Dokumentasi
- Tambah keterangan lengkap di tab "Halaman Public" tentang setiap mode visibility
- Tambah summary perbaikan announcements di `ANNOUNCEMENTS_FIX_SUMMARY.md`

## ⚙️ Konfigurasi Default
Semua halaman public default ke mode **"public"** (terbuka) untuk backward compatibility.

## 🔄 Migration Notes
Tidak ada migration khusus diperlukan. Settings baru akan otomatis menggunakan default value "public" jika belum dikonfigurasi.

## 🎓 Testing
Semua fitur telah ditest dengan:
- Verification script untuk announcements visibility
- Manual testing untuk public pages routing
- Settings persistence testing

---

**Full Changelog:** v1.1.1...v1.1.2
