# Dokumentasi Super Apps MATSANDATAMA

**MTsN 2 Kota Malang** — Sistem Akademik Digital Terintegrasi

> Versi: 1.0 — Juni 2026
>
> Pemilik: Tim IT Madrasah & Operator Kemenag

---

## Tentang Dokumen Ini

Folder `/app/docs` berisi panduan operasional untuk semua peran pengguna di Super Apps MATSANDATAMA. File-file ini bisa Anda buka langsung dengan editor teks apa pun, di-print, atau dikonversi menjadi PDF.

Panduan yang sama juga tersedia **di dalam aplikasi** pada menu **📖 Panduan Pengguna** — dapat diakses melalui ikon HelpCircle di kanan atas atau dari menu profil.

## Daftar Panduan

### Berdasarkan Peran Pengguna
| File | Peran | Deskripsi |
|------|-------|-----------|
| [`PANDUAN_ADMIN.md`](./PANDUAN_ADMIN.md) | Administrator | Setup TP, master data, jadwal, QR, backup, pengumuman |
| [`PANDUAN_GURU.md`](./PANDUAN_GURU.md) | Guru Mata Pelajaran | Scan jurnal, My Schedules, input nilai, prestasi |
| [`PANDUAN_WALI_KELAS.md`](./PANDUAN_WALI_KELAS.md) | Wali Kelas | Data siswa lengkap, kehadiran, kebersihan, verifikasi prestasi |
| [`PANDUAN_SISWA.md`](./PANDUAN_SISWA.md) | Siswa | Lihat jadwal, rapor, upload prestasi, ekstrakurikuler |
| [`PANDUAN_GURU_PIKET.md`](./PANDUAN_GURU_PIKET.md) | Guru Piket | Pengisian jurnal pengganti, tugas hari ini |

### Panduan Operasional
| File | Topik | Audiens |
|------|-------|---------|
| [`SETUP_SMTP.md`](./SETUP_SMTP.md) | Konfigurasi email (Gmail/SendGrid/Mailgun) | Admin |
| [`BACKUP_RESTORE.md`](./BACKUP_RESTORE.md) | Backup JSON & export Excel | Admin |
| [`KEAMANAN_PASSWORD.md`](./KEAMANAN_PASSWORD.md) | Kebijakan password & best practice | Semua peran |
| [`MOBILE_APP_EXPO_SETUP.md`](./MOBILE_APP_EXPO_SETUP.md) | (Phase 5) Setup aplikasi mobile | Admin |

## Konvensi Peran (Roles)

| Role Key | Label di UI | Akses Singkat |
|----------|-------------|---------------|
| `admin` | Administrator | Semua menu |
| `guru` | Guru Mata Pelajaran | Jurnal, jadwal, nilai |
| `wali_kelas` | Wali Kelas | + data siswa, kehadiran, rapor kelas |
| `siswa` | Siswa | Jadwal, rapor, prestasi |
| `guru_piket` | Guru Piket | + tugas piket, isi jurnal pengganti |
| `guru_bk` | Guru BK | + view data siswa & kehadiran lintas kelas |
| `guru_tata_tertib` | Guru Tata Tertib | + monitoring disiplin |
| `guru_ekstrakurikuler` | Pembina Ekskul | + kelola anggota, kehadiran, nilai ekskul |
| `tenaga_kependidikan` | Tendik | Data administratif, prestasi madrasah |
| `orang_tua` | Orang Tua/Wali | Pantau jadwal & nilai anak |

## Kontak Dukungan

Jika menemui kendala teknis:
- **Admin sekolah**: hubungi via WhatsApp / kunjungi ruang TU.
- **Tim IT Madrasah**: lihat menu Pengaturan untuk kontak resmi.

Selamat menggunakan Super Apps MATSANDATAMA. 🌿
