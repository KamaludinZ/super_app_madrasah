# Panduan Administrator

## Selamat Datang, Admin

Anda memiliki akses penuh ke Super Apps MATSANDATAMA. Panduan ini membantu Anda menjalankan tugas-tugas operasional utama secara berurutan.

## 1. Setup Awal Tahun Pelajaran

1. Buka menu **Tahun Pelajaran** → klik **Tambah TP**.
2. Isi: Nama TP (mis. "2025/2026"), tipe semester ("Regular" untuk Ganjil/Genap, atau "Accelerated" untuk percepatan 6 semester).
3. Atur **Semester Aktif** — ini wajib karena memengaruhi penampilan jadwal & rapor.
4. Klik **Aktifkan** untuk menjadikan TP yang baru sebagai aktif.

> Hanya satu TP yang boleh aktif. TP lama dapat tetap diakses untuk laporan historis.

## 2. Kelola Master Data (urutan disarankan)

1. **Kurikulum** — daftarkan K-13 / Kurikulum Merdeka / Kurikulum Madrasah.
2. **Ruangan** — tambahkan semua ruang kelas. Aktifkan GPS jika ingin validasi lokasi saat scan jurnal.
3. **Mata Pelajaran** — daftarkan kode mapel (mis. MTK, IPA, BIN) dan tautkan ke kurikulum.
4. **Kelas** — buat kelas (7A, 8B, dst), tentukan wali kelas + ruang utama.
5. **Pengguna** — tambahkan guru, wali kelas, siswa, dan peran lainnya.

### Import Massal via Excel

Gunakan menu **Import Excel** untuk membuat ratusan akun siswa / guru sekaligus. Download template terlebih dahulu, isi dengan benar, lalu upload kembali.

## 3. Pengaturan Sistem

Menu **Pengaturan** memuat:
- Identitas sekolah (nama, NPSN, alamat) — muncul di halaman publik & rapor.
- Logo sekolah (PNG / JPG max 5MB).
- Warna utama (default: hijau Kemenag #006837).
- Hari aktif & slot jam pelajaran (memengaruhi grid jadwal).
- SMTP (untuk fitur lupa password).
- **Mode Maintenance** — saat aktif, semua pengguna non-admin akan melihat halaman maintenance.

## 4. Jadwal Pelajaran

Dua cara membuat jadwal:
- **Manual**: menu Jadwal Pelajaran → Tambah Jadwal.
- **Bulk Excel**: download template, isi, upload kembali.

Guru/Wali Kelas dapat membuat jadwal mereka sendiri (Draft) lalu **Submit** untuk dikunci admin. Admin yang melakukan **Lock/Unlock** akhir.

## 5. QR Generator

Untuk setiap ruang, generate kartu QR (B5) lalu cetak dan tempel di depan kelas. Guru memindai QR ini saat memulai mengajar.

Mode QR:
- **Static**: 1 QR permanen per ruangan.
- **Dynamic** (TOTP): QR berubah setiap 30 detik — anti foto/sebar.

## 6. Backup & Restore

Lakukan minimal **1x per minggu** atau sebelum perubahan besar.
- Export JSON: backup lengkap, bisa di-restore.
- Export Excel: snapshot data spesifik (users / students / schedules / grades) — untuk laporan.

Detail lengkap: lihat [`BACKUP_RESTORE.md`](./BACKUP_RESTORE.md).

## 7. Mengelola Pengumuman

Menu **Pengumuman** memungkinkan Anda menyampaikan informasi ke peran tertentu. Pilih target (semua atau peran spesifik), atur severity (info/sukses/peringatan/penting), pin pengumuman penting di atas.

Fitur ini menggunakan markdown sederhana — Anda bisa pakai `**tebal**`, `*miring*`, `-` untuk bullet point.

## 8. Hari Libur

Daftarkan hari libur mingguan (mis. Minggu) dan hari libur akademik (Idul Fitri, libur semester). Sistem akan menonaktifkan validasi jurnal pada hari-hari ini.

## 9. Audit & Keamanan

- **Log Aktivitas**: jejak semua tindakan pengguna (create/update/delete).
- **Log Keamanan**: percobaan login gagal, perubahan password, captcha failed.

## 10. Mode Maintenance

Aktifkan saat ingin melakukan migrasi data / restore besar:
1. Buka **Pengaturan** → tab **Maintenance**.
2. Toggle ON, isi pesan custom & estimasi waktu selesai.
3. Klik **Simpan**.
4. Pengguna non-admin akan otomatis dialihkan ke halaman maintenance.
5. Setelah selesai, toggle OFF — frontend pengguna akan otomatis refresh dalam 60 detik.

## Tips Operasional

- Setelah membagikan akun ke pengguna baru, dorong mereka mengubah password default pada login pertama (sistem otomatis akan menyarankan).
- Selalu aktifkan TP baru di awal tahun ajaran sebelum kegiatan KBM dimulai.
- Gunakan mode maintenance saat melakukan restore data atau migrasi.
- Cek **Log Keamanan** mingguan untuk deteksi percobaan login mencurigakan.
- Backup minimal 1x seminggu dan simpan di dua tempat (local + cloud).
