/**
 * Panduan markdown content per role.
 * Centralized so it's easy to maintain & also exportable to PDF later.
 */

export const PANDUAN_INDEX = [
  { slug: 'admin', title: 'Panduan Administrator', icon: 'Shield', role: 'admin' },
  { slug: 'guru', title: 'Panduan Guru Mata Pelajaran', icon: 'BookOpen', role: 'guru' },
  { slug: 'wali-kelas', title: 'Panduan Wali Kelas', icon: 'Users', role: 'wali_kelas' },
  { slug: 'siswa', title: 'Panduan Siswa', icon: 'GraduationCap', role: 'siswa' },
  { slug: 'guru-piket', title: 'Panduan Guru Piket', icon: 'ShieldAlert', role: 'guru_piket' },
  { slug: 'guru-bk', title: 'Panduan Guru BK', icon: 'HeartHandshake', role: 'guru_bk' },
  { slug: 'tata-tertib', title: 'Panduan Guru Tata Tertib', icon: 'Gavel', role: 'guru_tata_tertib' },
  { slug: 'ekstrakurikuler', title: 'Panduan Guru Ekstrakurikuler', icon: 'Sparkles', role: 'guru_ekstrakurikuler' },
  { slug: 'tendik', title: 'Panduan Tenaga Kependidikan', icon: 'Briefcase', role: 'tenaga_kependidikan' },
  { slug: 'setup-smtp', title: 'Setup SMTP / Email', icon: 'Mail', role: 'admin' },
  { slug: 'backup-restore', title: 'Backup, Restore & Export', icon: 'Database', role: 'admin' },
  { slug: 'keamanan-password', title: 'Keamanan & Password', icon: 'Lock', role: null },
];

export const PANDUAN_CONTENT = {
  admin: `# Panduan Administrator

## Selamat Datang, Admin

Anda memiliki akses penuh ke Super Apps MATSANDATAMA. Panduan ini membantu Anda menjalankan tugas-tugas operasional utama secara berurutan.

## 1. Setup Awal Tahun Pelajaran

1. Buka menu **Tahun Pelajaran** → klik **Tambah TP**.
2. Isi: Nama TP (mis. \"2025/2026\"), tipe semester (\"Regular\" untuk Ganjil/Genap, atau \"Accelerated\" untuk percepatan 6 semester).
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

## 7. Mengelola Pengumuman

Menu **Pengumuman** memungkinkan Anda menyampaikan informasi ke peran tertentu. Pilih target (semua atau peran spesifik), atur severity (info/sukses/peringatan/penting), pin pengumuman penting di atas.

## 8. Hari Libur

Daftarkan hari libur mingguan (mis. Minggu) dan hari libur akademik (Idul Fitri, libur semester). Sistem akan menonaktifkan validasi jurnal pada hari-hari ini.

## 9. Audit & Keamanan

- **Log Aktivitas**: jejak semua tindakan pengguna.
- **Log Keamanan**: percobaan login gagal, perubahan password, captcha failed.

## Tips Operasional

- Setelah membagikan akun ke pengguna baru, dorong mereka mengubah password default pada login pertama.
- Selalu aktifkan TP baru di awal tahun ajaran sebelum kegiatan KBM dimulai.
- Gunakan mode maintenance saat melakukan restore data atau migrasi.
`,

  guru: `# Panduan Guru Mata Pelajaran

## Login Pertama

Gunakan username & password yang diberikan admin. Setelah login, sistem akan menyarankan Anda untuk **mengubah password default** — ikuti saran ini demi keamanan akun.

## 1. Dashboard

Dashboard guru menampilkan:
- Jadwal mengajar hari ini
- Status pengisian jurnal
- Pengumuman dari admin
- Notifikasi ringkas (ikon 🔔 di kanan atas)

## 2. Jurnal Presisi (QR Scan)

1. Saat tiba di kelas, buka menu **Jurnal Presisi**.
2. Izinkan akses kamera — arahkan ke kartu QR di depan kelas.
3. Sistem akan memvalidasi:
   - **QR**: kode valid & belum kedaluwarsa
   - **Jadwal**: Anda memang dijadwalkan mengajar saat itu
   - **GPS** (jika aktif): Anda berada di lokasi yang benar
4. Isi: materi yang disampaikan, jumlah siswa hadir/sakit/izin/alpa, catatan.
5. Klik **Simpan** — jurnal terkunci dan tidak dapat diubah lagi.

## 3. Jadwal Saya & Atur Jadwal

- Menu **Jadwal Saya**: melihat semua jadwal mingguan Anda.
- Menu **Atur Jadwal Saya**: untuk Anda yang ingin mengusulkan jadwal sendiri.
  - Status **Draft**: Anda bisa edit/hapus.
  - **Submit** untuk dikirim ke admin / wali kelas.
  - Status **Terkunci**: tidak bisa diedit, hanya admin yang dapat membuka.

## 4. Titipkan Tugas (Jika Berhalangan)

Jika Anda tidak bisa hadir, buka menu **Titipkan Tugas**:
1. Pilih jadwal yang akan dititipkan.
2. Tulis isi tugas yang akan dikerjakan siswa.
3. Submit — guru piket akan mengisikan jurnalnya sebagai pengganti.

## 5. Input Nilai

Menu **Input Nilai**:
1. Pilih kelas → mapel → semester.
2. Isi Nilai Pengetahuan & Nilai Keterampilan untuk tiap siswa.
3. Sistem otomatis hitung **Nilai Akhir** dan **Predikat** (A/B/C/D).
4. Tambahkan deskripsi singkat jika perlu.

## 6. Data Prestasi

Upload prestasi Anda (sertifikat, jenjang, organizer, tanggal) di menu **Data Prestasi**. Admin/Wali Kelas akan memverifikasi.

## Tips

- Pastikan jam HP Anda akurat — jurnal hanya bisa dibuat dalam rentang waktu jadwal (±15 menit toleransi).
- Jika scan QR selalu gagal, foto kartu QR lalu kirim ke admin — mungkin perlu generate ulang.
- Gunakan tombol "Tandai Sudah Dibaca" untuk pengumuman yang sudah Anda baca.
`,

  'wali-kelas': `# Panduan Wali Kelas

Selain semua fitur Guru Mata Pelajaran, Anda juga memiliki tanggung jawab terhadap kelas yang dipimpin.

## 1. Dashboard Kelas

Menu **Dashboard Kelas** menampilkan:
- Daftar siswa kelas Anda
- Jadwal mengajar hari ini di kelas
- Status pengisian jurnal per mata pelajaran

## 2. Data Siswa

Menu **Data Siswa** → klik baris siswa → dialog 3 tab:
- **Data Siswa**: NIK, NIS, NISN, tempat/tanggal lahir, agama, anak ke-, dll.
- **Data Orang Tua/Wali**: data ayah, ibu, dan wali (jika ada). Termasuk pekerjaan & penghasilan.
- **Data Alamat**: alamat lengkap siswa + alamat ortu (jika berbeda).

Data ini dipakai untuk laporan ke Dapodik/EMIS — mohon diisi selengkap mungkin.

## 3. Kehadiran Siswa

Isi presensi harian di menu **Kehadiran Siswa**:
1. Pilih tanggal.
2. Tandai Hadir/Sakit/Izin/Alpa untuk setiap siswa.
3. Simpan.

## 4. Kebersihan Kelas

Catat penilaian harian kebersihan kelas (sangat bersih / bersih / kotor) plus catatan jika perlu.

## 5. E-Rapor Kelas

Lihat rekap nilai dari semua mata pelajaran untuk siswa di kelas Anda. Anda juga bisa export rapor per siswa untuk dicetak.

## 6. Verifikasi Prestasi

Siswa Anda dapat upload prestasi sendiri — tugas Anda **memverifikasi** keasliannya. Buka menu **Data Prestasi**, lihat yang belum diverifikasi, klik **Verify**.

## 7. Lock Jadwal Kelas

Anda dapat membantu admin mengunci jadwal pelajaran yang sudah final di kelas Anda. Tapi **hanya admin** yang bisa unlock jadwal yang sudah dikunci admin.

## Tips

- Pastikan setiap siswa baru memiliki Data Siswa lengkap dalam 1 minggu pertama.
- Cek presensi setiap pagi sebelum jam ke-1.
`,

  siswa: `# Panduan Siswa

Selamat datang di Super Apps MATSANDATAMA — sistem akademik digital madrasah.

## 1. Login Pertama

Setelah login pertama dengan password default, sistem akan menyarankan Anda mengubah password. **Lakukan segera** demi keamanan akun.

## 2. Dashboard

Dashboard siswa menampilkan:
- **Pengumuman penting** dari sekolah
- Jadwal pelajaran hari ini
- Akses cepat ke rapor & prestasi

## 3. Jadwal Saya

Menu **Jadwal Saya** menampilkan grid jadwal mingguan kelas Anda. Klik mata pelajaran tertentu untuk melihat detail (guru, ruang, materi terakhir).

## 4. Rapor Saya

Menu **Rapor Saya** menampilkan nilai semua mata pelajaran:
- Nilai Pengetahuan + Keterampilan + Nilai Akhir
- Predikat (A/B/C/D)
- Deskripsi per mata pelajaran

Anda dapat memilih semester untuk melihat rapor periode tertentu.

## 5. Data Prestasi

Upload prestasi Anda sendiri di menu **Data Prestasi**:
1. Klik **Tambah Prestasi**.
2. Isi: nama lomba, bidang, tingkat (sekolah/kota/provinsi/nasional/internasional), peringkat, penyelenggara, tanggal.
3. Lampirkan foto sertifikat (opsional).
4. Submit — wali kelas akan memverifikasi.

Prestasi yang sudah diverifikasi akan masuk ke rekap sekolah.

## 6. Ekstrakurikuler

Menu **Ekstrakurikuler** menampilkan kegiatan ekskul yang Anda ikuti, jadwal latihan, dan nilai dari pembina.

## Tips

- Buka aplikasi setiap pagi — ada pengumuman penting yang muncul di dashboard.
- Jangan share password Anda ke teman — setiap aktivitas tercatat di log audit.
- Klik ikon 🔔 di kanan atas untuk melihat semua notifikasi & pengumuman.
`,

  'guru-piket': `# Panduan Guru Piket

Guru Piket bertugas memastikan KBM tetap berjalan ketika guru pengampu berhalangan, dan menjadi pengisi jurnal pengganti.

## 1. Dashboard Piket

Menu utama Anda adalah **Tugas Hari Ini** — menampilkan semua jadwal mengajar hari ini beserta:
- ✅ Sudah ada jurnal
- ⏳ Belum diisi (perlu diisi sebelum jam berakhir)
- ✍️ Sudah dititipkan tugas oleh guru pengampu

## 2. Mengisi Jurnal Atas Nama Guru

Jika guru berhalangan tetapi sudah **menitipkan tugas**:
1. Buka **Tugas Hari Ini**.
2. Lihat baris dengan badge "Ada Titipan Tugas".
3. Klik **Isi Jurnal Piket**.
4. Isi materi (boleh menyalin dari titipan tugas), jumlah siswa hadir/sakit/izin/alpa, dan catatan piket.
5. Submit — jurnal langsung terkunci, dan tugas otomatis berstatus **Completed**.

Jika guru tidak menitipkan tugas tapi Anda mengisi pengganti:
- Tetap bisa mengisi jurnal piket tanpa task_id.
- Catat alasan ketidakhadiran guru di kolom catatan.

## 3. Jadwal Piket Anda

Lihat jadwal piket harian Anda (shift pagi / siang) di menu **Jadwal Piket**.

## 4. Akses Lainnya

Selain fungsi piket, Anda juga punya akses Guru biasa: jurnal presisi, jadwal saya, input nilai (jika juga merangkap guru mapel).

## Tips

- Selalu cek **Tugas Hari Ini** di awal & akhir shift Anda.
- Pastikan jurnal piket diisi paling lambat 30 menit setelah jam pelajaran berakhir.
- Untuk siswa yang ribut di kelas tanpa guru: laporkan ke Guru Tata Tertib.
`,

  'guru-bk': `# Panduan Guru BK (Bimbingan Konseling)

Guru BK memiliki akses melihat data siswa lintas kelas untuk pendampingan & konseling.

## Akses Anda

- **Data Siswa** semua kelas (read-only, kecuali bagian catatan konseling).
- **Kehadiran Siswa** semua kelas — untuk identifikasi siswa dengan tingkat alpa tinggi.
- **Data Prestasi** — ikut memverifikasi & memberi apresiasi.
- **Pengumuman** — bisa diterima sesuai role.

## Tips

Gunakan filter di Kehadiran Siswa untuk menemukan siswa yang membutuhkan perhatian (alpa > 3 dalam sebulan).
`,

  'tata-tertib': `# Panduan Guru Tata Tertib

Guru Tata Tertib bertanggung jawab atas penegakan disiplin di sekolah.

## Akses Anda

- **Data Siswa** semua kelas (read-only).
- **Kehadiran Siswa** semua kelas — identifikasi pelanggaran kehadiran.
- **Pengumuman** — dapat diterima sesuai role.
- Akses laporan dari Guru Piket terkait insiden harian.

## Tips

- Lakukan rekap pelanggaran mingguan.
- Koordinasi dengan Guru BK untuk siswa yang sering melanggar.
`,

  ekstrakurikuler: `# Panduan Guru Ekstrakurikuler (Pembina Ekskul)

Anda mengelola kegiatan ekstrakurikuler tertentu.

## 1. Daftar Ekskul Saya

Menu **Ekstrakurikuler Saya** menampilkan ekskul yang Anda bina.

## 2. Anggota

Klik nama ekskul → tab **Anggota**:
- Tambah siswa (admin yang menambah, atau pembina bisa atas izin admin).
- Lihat status aktif / nonaktif anggota.

## 3. Kehadiran

Isi presensi tiap pertemuan: Hadir / Sakit / Izin / Alpa.

## 4. Nilai Akhir Semester

Di akhir semester, isi nilai predikat (A/B/C) plus deskripsi singkat per siswa. Nilai ini akan masuk ke E-Rapor.

## Tips

- Catat kehadiran segera setelah latihan selesai.
- Komunikasikan jadwal latihan via menu Pengumuman dengan target peran "siswa" agar peserta tahu.
`,

  tendik: `# Panduan Tenaga Kependidikan

Tendik (TU, Operator, Pustakawan, dll) memiliki akses ke data administratif.

## Akses Anda

- **Data Siswa** semua kelas (read-only untuk keperluan administrasi).
- **Data Prestasi** — dapat input prestasi atas nama madrasah / staf tendik.
- **Pengumuman** — dapat diterima sesuai role.

## Tips

Untuk keperluan laporan ke Kemenag/Dapodik, gunakan menu Backup → Export Excel untuk download data dalam format yang siap dilaporkan.
`,

  'setup-smtp': `# Setup SMTP / Email (Untuk Admin)

SMTP digunakan untuk fitur **Lupa Password** — sistem akan mengirim link reset ke email user.

## Opsi 1: Gmail App Password (Direkomendasikan)

### Prasyarat
- Akun Gmail (bisa @gmail.com atau Google Workspace)
- **2-Step Verification** harus aktif di akun Gmail

### Langkah Membuat App Password

1. Buka [myaccount.google.com](https://myaccount.google.com)
2. Pilih **Security** (kiri).
3. Cari **2-Step Verification** — pastikan aktif. Jika belum, aktifkan dulu.
4. Setelah 2SV aktif, kembali ke Security → cari **App Passwords**.
5. Pilih: App = "Mail", Device = "Other (Custom name)" → isi "MATSANDATAMA".
6. Klik **Generate** — muncul kode 16 karakter (mis. \`abcd efgh ijkl mnop\`).
7. **Copy** kode ini (tanpa spasi).

### Konfigurasi di Aplikasi

Buka menu **Pengaturan → SMTP**, isi:
- **SMTP Host**: \`smtp.gmail.com\`
- **SMTP Port**: \`587\`
- **SMTP User**: email Anda (mis. \`admin@mtsn2malang.sch.id\` atau Gmail Anda)
- **SMTP Password**: paste App Password (16 karakter tanpa spasi)
- **Use TLS**: ✅ aktif
- **Use SSL**: ❌
- **From Email**: email yang sama dengan SMTP User
- **From Name**: Super Apps MATSANDATAMA

Klik **Test SMTP** — isi email tujuan, klik kirim. Jika berhasil, akan ada email masuk dalam 1-2 menit.

## Opsi 2: SendGrid

Gratis untuk 100 email/hari.

1. Daftar di [sendgrid.com](https://sendgrid.com), verifikasi domain pengirim.
2. Buat API Key di Settings → API Keys.
3. Konfigurasi:
- Host: \`smtp.sendgrid.net\`
- Port: \`587\`
- User: \`apikey\`
- Password: API Key Anda
- Use TLS: ✅

## Opsi 3: Mailgun

1. Daftar di mailgun.com, verifikasi domain.
2. Dapatkan SMTP credentials dari Sending → Domain Settings.
3. Konfigurasi sesuai instruksi mailgun.

## Troubleshooting

- **"Authentication failed"** → cek user/password. Untuk Gmail, pastikan App Password bukan password biasa.
- **"Connection refused"** → cek port (587 untuk TLS, 465 untuk SSL).
- **Email masuk Spam** → set up SPF/DKIM di DNS domain Anda. Hubungi penyedia hosting.
- **Test SMTP error 535** → username/password salah, atau Less Secure Apps disabled (untuk Gmail tanpa 2SV — tidak direkomendasikan).
`,

  'backup-restore': `# Backup, Restore & Export Data

## Backup JSON (Snapshot Lengkap)

Buka menu **Backup & Restore** → **Export Backup (JSON)**.

File JSON berisi seluruh data: users, classes, schedules, journals, grades, prestasi, ekstrakurikuler, log, dll.

### Kapan Lakukan Backup?

- **Wajib**: sebelum rapor akhir semester, sebelum migrasi TP baru, sebelum import massal.
- **Disarankan**: minimal 1x per minggu.

## Restore JSON

### Mode "Merge" (Default)
Data baru ditambahkan, data yang sudah ada di-update berdasarkan ID. **Aman** — tidak menghapus data yang tidak ada di backup.

### Mode "Replace"
**Hapus semua data lalu insert dari backup.** Gunakan hanya untuk migrasi penuh / reset.

> Aktifkan **Mode Maintenance** saat melakukan restore Replace agar pengguna tidak mengganggu proses.

## Export Excel (Subset Data)

Untuk laporan ke Kemenag / pihak luar, gunakan **Export Excel**:
- **Users**: semua akun dengan roles, status aktif, mutasi.
- **Students**: data siswa dengan kelas, NISN, gender, alamat.
- **Schedules**: jadwal mingguan + status workflow.
- **Grades**: nilai per siswa + mapel + semester.

File Excel dapat dibuka langsung di Excel/LibreOffice dan langsung dipakai untuk laporan.

## Best Practice

1. Simpan backup di **2 tempat**: download lokal + cloud (Google Drive, OneDrive).
2. Beri nama file backup dengan tanggal: \`backup_matsandatama_2026-05-13.json\`.
3. Test restore di TP non-aktif sekali setahun untuk memastikan backup valid.
4. Hapus backup lama (> 1 tahun) jika storage terbatas, tapi simpan minimal 4 backup terakhir.

## Log Backup

Setiap export & import dicatat di **Log Backup** dengan tanggal, jenis (export/import), dan jumlah dokumen. Pakai ini untuk audit.
`,

  'keamanan-password': `# Keamanan & Password

## Kebijakan Password

### Login Pertama
Sistem akan **menyarankan** Anda mengubah password default segera setelah login pertama. Saran ini muncul di:
- Notifikasi (ikon 🔔 di kanan atas)
- Dialog popup di awal sesi

Anda dapat:
- **"Ubah Sekarang"** — langsung ke form ganti password.
- **"Nanti Saja"** — tunda 30 hari, sistem akan menyarankan kembali.

### Pengingat Berkala
Setiap **6 bulan** setelah perubahan terakhir, sistem akan menyarankan kembali untuk mengubah password. Anda boleh menundanya, tapi disarankan untuk tetap mengganti demi keamanan.

## Persyaratan Password Baru

- Minimal **6 karakter**.
- Hindari informasi pribadi (tanggal lahir, nama, NISN).
- Tidak boleh sama dengan password lama.
- Disarankan: kombinasi huruf + angka + simbol.

## Lupa Password

1. Di halaman login, klik **Lupa Password?**.
2. Masukkan username atau email Anda.
3. Cek inbox email — ada link reset password (berlaku 1 jam).
4. Klik link — buat password baru.

Jika email tidak datang, hubungi admin untuk reset manual.

## Tips Keamanan

- **JANGAN** share password ke siapapun (termasuk admin). Admin tidak pernah meminta password Anda.
- **JANGAN** simpan password di tempat yang mudah terlihat (sticky note di meja, dll).
- Gunakan **password manager** (Bitwarden, 1Password) untuk menyimpan password yang kuat.
- **Logout** dari aplikasi setiap kali selesai — terutama di komputer bersama.
- Sistem akan **logout otomatis** setelah 30 menit tidak aktif.

## Audit Trail

Semua aktivitas login & perubahan password dicatat di **Log Keamanan**. Jika Anda mencurigai akun Anda diakses orang lain, segera:
1. Ubah password sekarang.
2. Laporkan ke admin untuk dicek log.
`,
};
