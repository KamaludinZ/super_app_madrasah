# Bahan Presentasi — Super Apps MATSANDATAMA

Materi slide untuk PowerPoint. Setiap slide berisi **Judul**, **Isi slide** (poin yang ditampilkan), **Saran visual**, dan **Catatan pembicara** (untuk diucapkan, tidak ditampilkan).

Total: 20 slide (± 25–30 menit presentasi).

---

## SLIDE 1 — Judul

**Judul:** Super Apps MATSANDATAMA
**Subjudul:** Sistem Akademik Digital Terintegrasi — MTsN 2 Kota Malang

**Isi slide:**
- Versi 1.2.3 · 2026
- Disusun oleh: Kamaludin Zuhri · Tim IT Madrasah

**Saran visual:** Logo madrasah + logo Kemenag, latar hijau Kemenag (#006837).

**Catatan pembicara:** Perkenalan singkat: satu aplikasi untuk seluruh urusan akademik dan administrasi madrasah.

---

## SLIDE 2 — Latar Belakang Masalah

**Judul:** Mengapa Kita Butuh Super Apps?

**Isi slide:**
- Data siswa, guru, jadwal, dan nilai tersebar di banyak file Excel dan kertas
- Jurnal mengajar manual sulit dibuktikan kebenarannya (kapan & di mana guru mengajar)
- Rekap kehadiran, prestasi, dan laporan memakan waktu lama
- Data EMIS/Dapodik harus diisi ulang berkali-kali
- Pimpinan sulit memantau kondisi madrasah secara cepat

**Saran visual:** Ikon tumpukan kertas/folder berantakan → panah → satu layar aplikasi.

---

## SLIDE 3 — Solusi

**Judul:** Satu Aplikasi, Semua Layanan

**Isi slide:**
- Satu akun untuk semua peran (guru, wali kelas, siswa, tendik, pimpinan)
- Bisa dibuka lewat browser, HP (PWA), dan aplikasi Android (APK)
- Data terpusat, real-time, dan terhubung antar-modul
- Transparansi publik: monitoring jurnal, agenda, prestasi, dan anggaran (RKAM)

**Saran visual:** Diagram lingkaran: Super Apps di tengah, modul-modul di sekelilingnya.

---

## SLIDE 4 — Pengguna & Peran

**Judul:** Siapa Saja Penggunanya?

**Isi slide (dikelompokkan):**
- **Pimpinan:** Kepala Madrasah, Waka (Kurikulum, Kesiswaan, Sarpras), Kepala TU, Penjamin Mutu
- **Pendidik:** Guru Mapel, Wali Kelas, Guru Piket, Guru BK, Guru Tata Tertib, Pembina Ekskul, Guru Lab
- **Tenaga Kependidikan:** Tendik, Bendahara, Unit Kesehatan (UKS), Perpustakaan, Unit Pelayanan
- **Peserta Didik & Keluarga:** Siswa, Akun Kelas (Kelas Digital), Orang Tua/Wali
- **Administrator**

**Poin kunci:** Satu orang bisa punya beberapa peran dan **berpindah peran** tanpa logout.

**Saran visual:** Tabel/ikon orang per kelompok.

---

## SLIDE 5 — Peta Modul

**Judul:** Modul-Modul Utama

**Isi slide (tampilkan sebagai kotak-kotak):**
1. Akademik & KBM — Jadwal, Jurnal Presisi (QR), Kelas Digital, Nilai & E-Rapor
2. Kesiswaan — Data Siswa (EMIS), Kehadiran, Prestasi, Ekskul, Tata Tertib, BK
3. Kepegawaian (GTK) — E-Kinerja, Absensi GTK, Profesionalitas, Buku Induk
4. Unit Layanan — Sarpras, Laboratorium, UKS, Perpustakaan
5. Administrasi — Mutasi, Kenaikan Kelas, Alumni, PIP, Verval Data
6. Keuangan & Publik — RKAM, Agenda Madrasah, Halaman Publik
7. Sistem — Pengumuman, Notifikasi, Backup, Keamanan, Integrasi AI & WhatsApp

**Saran visual:** Grid 7 kotak berwarna dengan ikon.

---

## SLIDE 6 — Fitur Unggulan: Jurnal Presisi

**Judul:** Jurnal Presisi — Jurnal Mengajar Berbasis QR

**Isi slide:**
- Setiap ruang kelas punya **kartu QR** (dicetak ukuran B5) di depan kelas
- Guru memindai QR lewat HP saat mulai mengajar
- Sistem memvalidasi 3 hal sekaligus:
  - ✅ **QR** valid (mode statis, atau dinamis berubah tiap 30 detik — anti foto)
  - ✅ **Jadwal** cocok (toleransi ±15 menit)
  - ✅ **Lokasi GPS** di area ruang (radius ± 20 m, opsional)
- Guru mengisi KD/Indikator, materi, dan kehadiran siswa
- Jurnal **terkunci otomatis** setelah disimpan

**Saran visual:** Alur 4 langkah: Scan QR → Validasi → Isi Jurnal → Terkunci. Foto kartu QR di depan kelas.

**Catatan pembicara:** Ini fitur inti. Jurnal tidak bisa diisi dari rumah atau di luar jam mengajar, sehingga datanya bisa dipercaya dan sekaligus menjadi dasar absensi guru.

---

## SLIDE 7 — Jadwal & Guru Piket

**Judul:** Penjadwalan & Pengganti Guru Berhalangan

**Isi slide:**
- Jadwal dibuat manual atau impor Excel massal
- Alur jadwal: **Draft → Submit → Dikunci** oleh admin
- Guru berhalangan → **Titipkan Tugas**
- Guru Piket melihat **Tugas Hari Ini**: sudah diisi ✅ / belum ⏳ / ada titipan ✍️
- Guru Piket mengisi **jurnal pengganti** agar KBM tetap tercatat
- Jadwal piket ibadah: salaman, imam shalat Dhuha/Dhuhur/Ashar, khotib Jumat, keputrian

**Saran visual:** Diagram alur guru → titipan tugas → guru piket → jurnal tercatat.

---

## SLIDE 8 — Kelas Digital

**Judul:** Kelas Digital — Materi & Tugas Online

**Isi slide:**
- Setiap kelas punya **akun kelas** (login dengan token kelas)
- Guru mengunggah **materi** dan **tugas** per mata pelajaran
- Siswa mengakses materi & tugas dari akun kelas atau akun pribadi
- Tampilan daftar siswa, jadwal, jurnal, dan kehadiran kelas

**Saran visual:** Screenshot halaman materi/tugas.

---

## SLIDE 9 — Nilai & E-Rapor

**Judul:** Penilaian & E-Rapor

**Isi slide:**
- Guru input Nilai Pengetahuan & Keterampilan per kelas/mapel
- **Nilai akhir & predikat otomatis**: A ≥ 88 · B ≥ 76 · C ≥ 60 · D < 60
- Wali kelas menambahkan catatan & deskripsi sikap
- Siswa melihat **Rapor Saya** per semester
- Export rapor untuk dicetak

**Saran visual:** Tabel contoh nilai → predikat.

---

## SLIDE 10 — Data Siswa Lengkap (EMIS)

**Judul:** Data Siswa Sesuai Standar EMIS

**Isi slide:**
- Data pribadi, orang tua/wali, alamat, transportasi
- Keahlian, **Tahfidz**, beasiswa/bantuan (KIP/PKH/KKS), kebutuhan khusus
- Data **Santri Ma'had** & kamar
- Upload berkas: KK, Akte, Ijazah, KIP, Kartu Pelajar (PDF)
- **Indikator % kelengkapan data** per siswa dan per kelas
- **Verval (Verifikasi & Validasi):** perubahan dari siswa/GTK diajukan lalu disetujui admin

**Saran visual:** Screenshot dialog data siswa dengan tab-tab.

**Catatan pembicara:** Data sekali isi, bisa dipakai untuk pelaporan EMIS/Dapodik.

---

## SLIDE 11 — Kesiswaan: Kehadiran, Prestasi, Ekskul

**Judul:** Pembinaan Kesiswaan

**Isi slide:**
- **Kehadiran harian** oleh wali kelas (Hadir/Sakit/Izin/Alpa) + rekap bulanan
- **Kebersihan kelas** dengan penilaian & foto bukti
- **Prestasi**: siswa upload sertifikat → wali kelas verifikasi → masuk rekap & halaman publik
- **Ekstrakurikuler**: anggota, kehadiran, nilai akhir dari pembina

**Saran visual:** 4 ikon berjajar.

---

## SLIDE 12 — Tata Tertib & Bimbingan Konseling

**Judul:** Tata Tertib & BK

**Isi slide:**
- **Tata Tertib:** catatan pelanggaran & prestasi dengan sistem poin, kategori, dan penanganan
- Dashboard: grafik pelanggaran vs prestasi, siswa poin tertinggi/terendah
- **BK:** kunjungan konseling, home visit, laporan BK
- **Kuesioner CLKB (56 item) & PCL (229 item, 12 kategori masalah)** diisi siswa secara mandiri, skor otomatis
- Guru BK meninjau hasil, dibantu **ringkasan AI**, lalu memberi tanggapan & rekomendasi

**Saran visual:** Grafik batang pelanggaran vs prestasi.

---

## SLIDE 13 — Manajemen GTK (Guru & Tendik)

**Judul:** Kinerja & Kehadiran GTK

**Isi slide:**
- **E-Kinerja:** RHK, LCKB (terisi otomatis, cetak PDF), SKP, Angka Kredit, PAK, Jurnal Harian
- **Absensi GTK otomatis:**
  - Guru → dihitung dari jurnal mengajar vs jadwal
  - Tendik → dihitung dari Jurnal Harian E-Kinerja
  - Hari libur otomatis dikecualikan
- **Perizinan:** sakit, cuti, dinas luar + dokumen
- **Profesionalitas & Riwayat Sertifikasi**, Buku Induk Kepegawaian, Agenda Guru & Tendik
- **Data GTK:** identitas kepegawaian memuat Peg ID, NUPTK, NIP, NPK, dan NRG; daftar GTK menampilkan kolom Peg ID

**Saran visual:** Diagram: Jadwal + Jurnal → Absensi GTK otomatis.

**Catatan pembicara:** Guru tidak perlu absen dua kali — mengisi jurnal sudah sekaligus tercatat hadir.

---

## SLIDE 14 — Unit Layanan: Sarpras, Lab, UKS, Perpustakaan

**Judul:** Unit Layanan Madrasah

**Isi slide:**
- **Sarpras:** aset tetap & lancar, lokasi per ruang, laporan kerusakan & perbaikan
- **Laboratorium** (IPA, Komputer, Bahasa, Agama, IPS, Seni): alat & bahan, jadwal lab, jurnal penggunaan, peminjaman — **terhubung langsung dengan data Sarpras**
- **UKS:** kunjungan & pemeriksaan vital, stok obat, Cek Kesehatan Gratis (CKG), imunisasi, cetak surat rujukan & izin pulang
  - **Data BMHP** (kasa, plester, sarung tangan, dll.): stok masuk per batch dengan tanggal kadaluarsa, status Aman/Menipis/Habis, peringatan kadaluarsa ≤ 90 hari; pemakaian BMHP otomatis tercatat sebagai BMHP Keluar saat penanganan disimpan
  - **Penegakan Diagnosa**: master diagnosa (kode ICD-10 opsional, aktif/nonaktif); diagnosa utama **wajib** dipilih di setiap penanganan dan tampil di riwayat kunjungan
  - **Riwayat kunjungan otomatis**: begitu pasien dipilih di form kunjungan, riwayat 1 tahun terakhir (keluhan, diagnosa, penanganan, obat/BMHP) langsung tampil, lengkap dengan peringatan bila pasien berkunjung ≥ 3 kali dalam 30 hari
  - **Riwayat UKS Siswa**: menu di data siswa dengan tab Riwayat Kunjungan dan Riwayat CKG (IMT dihitung otomatis); bisa dibuka petugas UKS, kepala madrasah, dan wali kelas untuk siswa di kelasnya
  - **Laporan UKS Baru**: rekap penegakan diagnosa per kunjungan (dipisah siswa & GTK, klik untuk rincian kunjungan) dan rekap opname obat & BMHP (stok awal, masuk, keluar, stok akhir); filter bulanan/tahunan, unduh Excel/PDF, dan cetak
  - **Surat Keterangan UKS diperbarui**: surat rujukan & izin pulang kini memuat bagian penatalaksanaan (diagnosa, jenis penanganan, tindakan, tabel obat/BMHP yang diberikan, kondisi keluar UKS) dan kolom catatan petugas; bila catatan kosong, tercetak baris titik-titik untuk ditulis tangan; catatan tersimpan per kunjungan (hanya petugas UKS/admin yang bisa mengubah) dan surat bisa diunduh sebagai PDF
- **Perpustakaan:** kunjungan, peminjaman, laporan

**Saran visual:** 4 kolom ikon (gedung, tabung lab, palang hijau, buku).

---

## SLIDE 15 — Administrasi Siswa

**Judul:** Siklus Administrasi Siswa

**Isi slide:**
- Penerimaan & import data massal (Excel)
- **Mutasi** masuk/keluar
- **Kenaikan kelas & kelulusan** massal
- **Data Alumni** & sekolah lanjutan
- **PIP:** usulan & penerima bantuan

**Saran visual:** Garis waktu: Masuk → Aktif → Naik Kelas → Lulus → Alumni.

---

## SLIDE 16 — Dashboard Pimpinan

**Judul:** Pemantauan untuk Pimpinan

**Isi slide:**
- Dashboard khusus per peran: Kepala Madrasah, Waka, Penjamin Mutu, BK, Tatib, UKS
- Kepala Madrasah melihat dalam satu layar:
  - Kehadiran siswa & **rasio pengisian jurnal guru** per minggu
  - Statistik siswa per tingkat (L/P, santri ma'had, % kelengkapan data)
  - Ringkasan tata tertib, BK, dan kunjungan UKS
- Akses baca ke laporan semua unit

**Saran visual:** Screenshot dashboard dengan grafik.

---

## SLIDE 17 — Transparansi & Komunikasi

**Judul:** Transparansi Publik & Komunikasi

**Isi slide:**
- **Halaman publik** (tanpa login): Monitoring Jurnal, Agenda Madrasah, Prestasi, **RKAM** (transparansi anggaran)
- **Pengumuman** dengan target peran & tingkat kepentingan, bisa di-pin
- **Notifikasi push** di HP/browser + suara
- **Integrasi WhatsApp** (gateway) dan **Integrasi AI** (Gemini, Claude, OpenAI, atau AI lokal)

**Saran visual:** Ikon globe (publik), lonceng (notifikasi), WhatsApp, AI.

---

## SLIDE 18 — Keamanan & Keandalan Data

**Judul:** Keamanan Data Terjamin

**Isi slide:**
- Login dengan **captcha gambar angka** + akun terkunci 15 menit setelah 5x gagal
- Password terenkripsi (bcrypt), aturan password kuat, pengingat ganti tiap 6 bulan
- Hak akses per peran (RBAC) — data sensitif (NIK, No. KK) hanya untuk pimpinan & admin
- Logout / ganti password **mencabut sesi** di perangkat lain
- Log aktivitas & log keamanan untuk setiap tindakan
- **Backup** rutin (JSON & Excel) + mode maintenance
- Audit keamanan menyeluruh (September 2026) — temuan sudah ditindaklanjuti

**Saran visual:** Ikon gembok/perisai dengan daftar centang.

**Catatan pembicara:** Tekankan bahwa data siswa dan guru dilindungi; tidak perlu menyebut detail teknis celah keamanan.

---

## SLIDE 19 — Teknologi & Akses

**Judul:** Teknologi yang Digunakan

**Isi slide:**
- **Backend:** Python FastAPI · **Database:** MongoDB
- **Frontend:** React (web responsif + PWA)
- **Mobile:** Aplikasi Android (Capacitor) — otomatis ikut update web
- **Server:** Docker + Coolify, HTTPS
- Alamat: super.mtsn2kotamalang.sch.id

**Saran visual:** Logo-logo teknologi dalam satu baris; mockup laptop + HP.

---

## SLIDE 20 — Perjalanan Pengembangan & Penutup

**Judul:** Perjalanan & Rencana ke Depan

**Isi slide:**
- **Mei 2026:** Mulai dikembangkan — uji coba inti Jurnal Presisi
- **Juni–Agustus 2026:** MVP, multi-peran, e-rapor, RKAM, pengumuman, notifikasi push
- **September 2026:** Modul Sarpras, Lab, UKS, Perpus, BK, E-Kinerja GTK, dashboard pimpinan, audit keamanan
- **Rencana ke depan:**
  - Sosialisasi & pelatihan semua pengguna
  - Pelengkapan data siswa & GTK
  - Pengujian otomatis dan penyempurnaan tampilan

**Penutup:** "Madrasah Digital, Data Terpadu, Layanan Prima" — Terima kasih.

**Saran visual:** Garis waktu horizontal; slide terakhir dengan kontak & QR menuju aplikasi.

---

## Lampiran (opsional, jika ada slide tambahan)

**Panduan singkat per peran** — bisa dijadikan slide pelatihan:

| Peran | Tugas utama di aplikasi |
|---|---|
| Admin | Setup Tahun Pelajaran, master data, jadwal, cetak QR, backup, pengumuman |
| Guru Mapel | Scan QR & isi jurnal, input nilai, titip tugas, upload prestasi |
| Wali Kelas | Kehadiran harian, data siswa lengkap, kebersihan, verifikasi prestasi, e-rapor |
| Guru Piket | Pantau Tugas Hari Ini, isi jurnal pengganti |
| Siswa | Lihat jadwal, rapor, materi & tugas, upload prestasi, isi CLKB/PCL |

Sumber lengkap: folder `docs/` (PANDUAN_ADMIN, PANDUAN_GURU, PANDUAN_WALI_KELAS, PANDUAN_GURU_PIKET, PANDUAN_SISWA) dan menu **Panduan Pengguna** di dalam aplikasi.

---

## Riwayat Pembaruan Bahan

Setiap ada fitur baru atau penyesuaian di aplikasi, catat di sini lalu perbarui slide terkait di atas.

| Tanggal | Perubahan pada aplikasi | Slide yang diperbarui |
|---|---|---|
| 2026-09-27 | Bahan awal disusun dari dokumentasi `docs/`, CHANGELOG, `plan.md`, audit 26 Sep 2026, dan riwayat commit sampai `3be2799` | Semua (1–20 + lampiran) |
| 2026-10-04 | Modul UKS lanjutan fase 1: menu Data BMHP (stok masuk/keluar otomatis), master Penegakan Diagnosa, diagnosa utama wajib di form penanganan kunjungan; perbaikan stok obat yang terpotong dua kali saat penanganan disimpan ulang | 14 |
| 2026-10-04 | Modul UKS lanjutan fase 2: riwayat kunjungan pasien 1 tahun tampil otomatis di form kunjungan; menu Riwayat UKS siswa (tab Kunjungan & CKG) dengan akses wali kelas terbatas ke kelasnya; data kesehatan UKS kini hanya bisa dibaca petugas UKS & kepala madrasah | 14 |
| 2026-10-05 | Modul UKS lanjutan fase 3: menu Laporan UKS Baru — rekap diagnosa per kunjungan (siswa/GTK) & opname obat/BMHP dengan filter bulanan/tahunan, ekspor Excel/PDF, dan cetak | 14 |
| 2026-10-05 | Modul UKS lanjutan fase 4 (tampilan): surat keterangan UKS dengan bagian penatalaksanaan dan kolom catatan petugas, format cetak rapi lintas halaman | 14 |
| 2026-10-05 | Data GTK: field Jenis PNS diganti NPK, ditambah Peg ID dan NRG pada tab Kepegawaian; kolom NIP/NUPTK di daftar GTK diganti Peg ID | 13 |
| 2026-10-05 | Modul UKS lanjutan fase 4 (server): catatan surat tersimpan per kunjungan, data surat dari satu endpoint, unduh PDF surat rujukan/izin pulang lengkap dengan penatalaksanaan & catatan | 14 |
