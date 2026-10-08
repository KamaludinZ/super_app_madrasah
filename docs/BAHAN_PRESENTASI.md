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
- **Menu Guru Pengganti** (Admin, Waka Kurikulum, Guru Piket — tidak tampil untuk guru mapel): tugaskan pengganti dalam 5 langkah — pilih guru yang berhalangan → slot jam & kelas → tanggal di **kalender satu bulan penuh** (hanya hari mengajar guru tsb., bisa pilih banyak tanggal) → guru pengganti (yang bentrok ditandai *tidak tersedia*) → simpan
- **Kalender Guru Pengganti**: lihat seluruh penugasan per bulan, hari mengajar guru ditandai; tanggal libur, lewat, di luar semester, atau yang sudah punya pengganti otomatis tidak bisa dipilih
- Di akun guru pengganti, slot yang ditugaskan **langsung muncul di Jadwal Hari Ini** (halaman Jadwal Saya & dashboard) dengan **badge "Guru Pengganti"** dan tombol **Isi Jurnal** — tanpa menu tambahan; riwayat jurnal menandai catatan "Pengganti: nama" beserta guru yang digantikan
- **Jurnal Berdampingan**: guru yang digantikan tetap bisa mengisi jurnal slot-nya (tanpa scan QR, mis. tugas yang dititipkan); catatannya dan catatan guru pengganti tampil berdampingan dalam satu halaman, tidak saling menimpa
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
- Upload berkas: KK, Akte, Ijazah wajib; KIP, PKH, KKS, Kartu Pelajar **opsional** (tidak semua siswa punya/sudah menerima) dan tidak mengurangi % kelengkapan (PDF)
- **Alamat bertingkat dari Master Wilayah Indonesia:** provinsi → kabupaten/kota → kecamatan → desa/kelurahan dipilih dari daftar resmi (kode Kemendagri 2025), kode pos terisi otomatis, cari cepat lewat kode pos/nama desa, pratinjau alamat lengkap; alamat domisili siswa (kost/asrama/kerabat) diisi tersendiri
- **Indikator % kelengkapan data** per siswa dan per kelas — klik persen untuk melihat rincian per bagian (Data Siswa, Orang Tua, Alamat, Kebutuhan Khusus, Berkas) dan data yang belum diisi
- **Verval (Verifikasi & Validasi):** perubahan dari siswa/GTK diajukan lalu disetujui admin
- **Unduh Excel Data Siswa & Data GTK:** pilih tingkat kelas (7/8/9/semua) atau jenis GTK (guru/tendik/semua), susunan kolom baku dengan pratinjau urutan kolom — bahan pelengkapan data massal (khusus admin, berisi seluruh isian tab data siswa/GTK)
- **Export Template:** berkas kosong siap isi dengan kolom identik hasil unduhan, kolom identitas terkunci, dan petunjuk pengisian per jenis kolom
- **Import Pelengkapan:** unggah kembali berkas, dicocokkan lewat NISN/NIP/ID; default hanya mengisi yang kosong, opsi timpa nilai berbeda; progres per baris dan ringkasan berhasil/gagal beserta lokasi kesalahan
- **Petunjuk pilihan di template impor:** setiap kolom pilihan (agama, pekerjaan, penghasilan, status tempat tinggal, transportasi, dll.) menampilkan isian yang tersedia di aplikasi lewat dropdown, sheet Daftar Pilihan, dan petunjuk; saat impor, variasi penulisan dari data pendaftaran (mis. "KRISTEN", "SD/MI", "Karyawan Swasta", "Motor", rentang penghasilan) dikenali dan disimpan sesuai ejaan aplikasi
- **Pencocokan Wilayah Impor:** alamat ketikan bebas dari Excel otomatis dicocokkan ke master wilayah (mengenali singkatan seperti Jatim/DIY, awalan Kab./Kec./Kel., dan salah ketik ringan) lalu disimpan dengan kode wilayah resmi; menu **Pencocokan Wilayah** menampilkan ringkasan cocok/sebagian/tidak cocok, daftar baris yang perlu diperbaiki beserta saran wilayah terdekat, perbaikan manual lewat dropdown bertingkat, dan tombol terapkan semua saran berkemiripan tinggi

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
- **Tata Tertib — poin lintas peran:** poin **kebaikan (plus)** dan **pelanggaran (minus)** dicatat lewat jalur terpisah; nilai otomatis mengikuti aturan & kondisi (mis. pertama/berulang), tindak lanjut penanganan per pelanggaran
- Siswa melihat **Poin Saya** (saldo + riwayat), wali kelas memantau kelasnya dengan sorotan **siswa perlu perhatian**, pimpinan membuka **Rekap Pengawas** (filter kelas/semester/tanggal, unduh Excel) — hanya admin, guru tatib, dan waka kesiswaan yang boleh mencatat
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
- **Detail GTK lengkap tersimpan:** tab Status & Riwayat (fungsi/jabatan, pangkat, status, pensiun), Pendidikan, Diklat, Penghargaan, Data Anak, Riwayat Pesantren (tambah/ubah/hapus), dan Arsip Berkas + File SK (unggah PDF/JPG/PNG) kini benar-benar tersimpan
- **Umur & Masa Kerja otomatis** di Formulir Data Diri GTK: umur (tahun & bulan) dari tanggal lahir; masa kerja PNS/PPPK dari TMT PNS, Non ASN dari TMT Pegawai
- **Nama & Gelar GTK:** gelar depan, nama tanpa gelar, dan gelar belakang diisi terpisah; nama lengkap tersusun otomatis (juga saat verval & impor Excel)
- **Alamat tempat tinggal GTK** memakai dropdown wilayah bertingkat yang sama dengan data siswa (kode wilayah & kode pos tersimpan)
- **% Kelengkapan GTK:** persentase data wajib per GTK beserta rincian per bagian dan penanda bagian yang masih kosong

**Saran visual:** Diagram: Jadwal + Jurnal → Absensi GTK otomatis.

**Catatan pembicara:** Guru tidak perlu absen dua kali — mengisi jurnal sudah sekaligus tercatat hadir.

---

## SLIDE 14 — Unit Layanan: Sarpras, Lab, UKS, Perpustakaan

**Judul:** Unit Layanan Madrasah

**Isi slide:**
- **Sarpras:** aset tetap & lancar, lokasi per ruang, laporan kerusakan & perbaikan
- **Laboratorium** (IPA, Komputer, Bahasa, Agama, IPS, Seni): alat & bahan, jadwal lab, jurnal penggunaan, peminjaman — **terhubung langsung dengan data Sarpras**
- **UKS:** kunjungan & pemeriksaan vital, stok obat, Cek Kesehatan Gratis (CKG), imunisasi, cetak surat rujukan & izin pulang
  - **Data CKG selaras format resmi:** tabel 16 kolom baku (identitas pasien, BB, TB, TD, karies, visus, kulit, pendengaran, Hb, GDS), pencarian nama/NIK, filter kelas/tingkat/GTK & jenis kelamin; data lama dirapikan otomatis
  - **Template & Impor CKG:** template Excel per kelas/tingkat/jenis GTK dengan identitas terisi, impor hasil pemeriksaan dengan validasi per baris (rentang nilai, tanggal), ringkasan baru/diperbarui/gagal
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
- **Berkas unggahan aman** di penyimpanan permanen (tidak hilang saat pembaruan aplikasi); berkas pribadi siswa tidak bisa dibuka siswa lain
- **Migrasi data otomatis** saat pembaruan aplikasi: data lama dirapikan sendiri sekali jalan, tanpa perintah manual di server
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
- **Aplikasi Android native (Expo, dalam pengembangan, APK gratis):** login dengan captcha, kunci biometrik/PIN, Beranda jadwal hari ini, Scan QR & isi jurnal (bisa offline, terkirim otomatis saat online), Riwayat Jurnal sesuai peran, Notifikasi & pengumuman, Antrean jurnal offline, serta Tentang & Diagnostik; tampilan bermotif pendidikan modern dengan layar pembuka beranimasi, Lupa Password langsung di aplikasi, Guru Pengganti (penugasan 5 langkah, daftar, kalender, jurnal berdampingan), Tugas Piket (isi jurnal atas nama guru, terima tugas titipan), serta menu lengkap untuk semua peran (admin, kepala madrasah, waka, guru, wali kelas, BK, tata tertib, piket, UKS, perpustakaan, lab, bendahara, siswa, dan lainnya) yang sama persis dengan web, dibuka langsung di aplikasi tanpa login ulang, lengkap dengan unduhan laporan PDF/Excel; menu siswa kini berupa layar aplikasi asli (bukan halaman web): Jadwal, Tugas (lihat & kumpulkan), Materi, Kehadiran, Rapor, Data Prestasi (ajukan prestasi dengan foto dari kamera/galeri), Ekstrakurikuler, CLKB, PCL, Profil Saya, dan Ajuan Verval — tetap bisa dibuka saat offline; menu guru & tendik juga berupa layar aplikasi asli: Laporan Absensi Saya & perizinan, Agenda Saya, Jadwal Piket, Kebersihan Kelas, Laporan, Input Nilai E-Rapor, Titipkan Tugas, Materi & Tugas Kelas Digital (bagikan ke kelas/siswa tertentu, lihat pengumpulan) dan Profil GTK
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
| 2026-10-05 | Kelengkapan data fase 1 (tampilan): tombol Unduh Excel di Data Siswa (filter tingkat) dan Data GTK (filter jenis), pratinjau urutan kolom baku | 10 |
| 2026-10-05 | Kelengkapan data fase 1 (server): unduh Excel Data Siswa (Data Siswa, Orang Tua, Alamat; per tingkat) dan Data GTK (6 sub-tab Data Guru; per jenis) khusus admin, kolom baku sama dengan template/impor, keterangan bila data kosong, tercatat di audit log | 10 |
| 2026-10-05 | Kelengkapan data fase 2 (tampilan): tombol Export Template di Data Siswa & Data GTK dengan pratinjau kolom (per sub-tab untuk GTK), penanda kolom identitas terkunci, dan legenda petunjuk pengisian | 10 |
| 2026-10-05 | Kelengkapan data fase 2 (server): template impor Data Siswa & GTK dari server — sheet Petunjuk, baris keterangan pengisian, komentar & dropdown pilihan, kolom identitas terkunci pada berkas unduhan; khusus admin | 10 |
| 2026-10-05 | Kelengkapan data fase 3 (tampilan): tombol Import di Data Siswa & GTK — unggah .xlsx (seret-lepas), cek susunan kolom, pilih mode isi-kosong/timpa (dengan konfirmasi), progres baris demi baris, ringkasan & daftar kesalahan per baris yang bisa diunduh | 10 |
| 2026-10-05 | Kelengkapan data fase 3 (server): mesin impor pelengkapan — validasi berkas di server, pencocokan via ID/NISN/NIP (cegah data tertukar & duplikat), isi kosong atau timpa (wajib konfirmasi), konversi & validasi nilai, riwayat sesi impor, jejak per baris dan per field (nilai lama → baru), khusus admin | 10, 17 |
| 2026-10-05 | Kelengkapan data fase 4 (tampilan): kolom % Kelengkapan di daftar GTK dengan rincian per bagian (Data Guru, Status & Riwayat, Pendidikan, Data Anak, Riwayat Pesantren, Arsip Berkas), penanda bagian kosong & daftar data yang belum diisi | 13 |
| 2026-10-05 | Kelengkapan data fase 4 (server): compute_completeness diperluas untuk GTK (6 bagian), endpoint % kelengkapan daftar & rincian per GTK; tambahan: rincian % kelengkapan per bagian di Data Siswa (klik persen), perbaikan statistik PNS/PPPK/Non ASN di Data GTK | 10, 13 |
| 2026-10-06 | Data CKG fase 1–2: tabel CKG 16 kolom baku dengan cari & filter, perapian data lama, template CKG bertingkat (kelas/tingkat/jenis GTK), impor hasil CKG tervalidasi; Nama & Gelar GTK terpisah dengan nama lengkap tersusun otomatis | 13, 14 |
| 2026-10-06 | Master Wilayah Indonesia (fase 3): data resmi 38 provinsi s.d. ±83 ribu desa/kelurahan + kode pos (Kepmendagri 2025) bisa dimuat sekali klik atau lewat unggah paket, dropdown wilayah bertingkat & cari cepat kode pos | 10 |
| 2026-10-06 | Alamat bertingkat & Pencocokan Wilayah Impor (fase 4): alamat siswa (ayah/ibu/wali/domisili) & GTK menyimpan kode wilayah, alamat impor Excel dicocokkan otomatis, menu laporan pencocokan dengan saran & perbaikan manual/massal; berkas KIP, PKH, KKS, Kartu Pelajar siswa menjadi opsional | 10, 13 |
| 2026-10-06 | Migrasi data otomatis saat deploy/redeploy (sekali per database, aman multi-worker, dicoba ulang bila gagal): perapian CKG, nama & gelar GTK, pemuatan master wilayah resmi, dan kode wilayah alamat tersimpan | 18 |
| 2026-10-06 | Detail GTK: field Umur Saat Ini (tahun & bulan dari tanggal lahir) dan Masa Kerja (PNS/PPPK dari TMT PNS, Non ASN dari TMT Pegawai) dihitung otomatis di Formulir Data Diri | 13 |
| 2026-10-06 | Perbaikan simpan data GTK & siswa dari admin: 22 field Data Guru yang sebelumnya hilang setelah disimpan kini tersimpan, NUPTK terbaca ulang, tab Status & Riwayat/Pendidikan/Diklat/Penghargaan/Anak/Pesantren/Arsip Berkas berfungsi; isian siswa yang dikosongkan admin ikut terhapus | 10, 13 |
| 2026-10-06 | Penyimpanan berkas unggahan dipindah ke folder volume permanen (aman saat redeploy) dengan peringatan bila volume belum terpasang; berkas detail siswa (KK, akta, ijazah, dll.) hanya bisa dibuka staf & siswa pemiliknya | 18 |
| 2026-10-06 | Perbaikan impor Data Siswa: kolom "Siswa - Status Tempat Tinggal" kini menerima isian sesuai pilihan form siswa (Tinggal dengan Ayah Kandung, Kontrak/Kost, dll.), tidak lagi tertolak oleh aturan pilihan GTK | 10 |
| 2026-10-06 | Template impor Data Siswa & GTK: kolom pilihan kini menampilkan seluruh isian yang tersedia di aplikasi (petunjuk, dropdown, sheet Daftar Pilihan); impor mengenali variasi penulisan dari data pendaftaran dan menyimpannya dengan ejaan baku, isian tak dikenal/ambigu ditolak beserta daftar pilihannya | 10, 13 |
| 2026-10-06 | Data Siswa & dashboard kepala madrasah: siswa mutasi keluar tidak lagi tampil maupun terhitung di statistik (hanya siswa aktif & mutasi masuk); kotak statistik Mutasi menjadi Mutasi Masuk | 10, 16 |
| 2026-10-06 | Seluruh daftar siswa & data per siswa (BK, tata tertib, UKS, prestasi, pemilih siswa) hanya menampilkan siswa aktif; data siswa mutasi keluar/nonaktif tetap tersimpan dan tampil lagi setelah siswa diaktifkan kembali (riwayat mutasi disimpan) | 10, 11, 12, 14 |
| 2026-10-07 | Modul Guru Pengganti fase 1 (tampilan, data contoh): menu khusus Admin/Waka Kurikulum/Guru Piket, daftar penugasan, alur penugasan 5 langkah dengan kalender satu bulan multi-tanggal yang mengikuti hari jadwal guru, penanda guru pengganti tidak tersedia, serta Kalender Guru Pengganti | 7 |
| 2026-10-07 | Guru Pengganti fase 2 (tampilan, data contoh): slot penugasan tampil di Jadwal Hari Ini guru pengganti dengan badge Guru Pengganti & tombol Isi Jurnal (form materi, catatan, absensi), riwayat jurnal dengan keterangan pengganti; backend fase 1 (API penugasan, validasi hari/periode/libur/bentrok, hak akses) | 7 |
| 2026-10-07 | Guru Pengganti fase 2 (server): jurnal guru pengganti tersimpan terpisah dari jurnal guru asli & tampil di riwayat kedua akun dengan keterangan "pengganti: nama"; Jadwal Hari Ini guru kini juga menampilkan jadwal yang harinya tersimpan berhuruf besar ("Senin"), dan status "Terisi" hanya menghitung jurnal hari ini | 6, 7 |
| 2026-10-07 | Guru Pengganti fase 3 (tampilan): halaman Jurnal Berdampingan (catatan guru asli & guru pengganti per slot), slot guru asli tetap terbuka dengan keterangan "Digantikan oleh…" & form isi jurnal tanpa QR, kolom Diisi Oleh "pengganti: nama" dengan tautan berdampingan; form jurnal guru pengganti kini tersimpan ke server | 7 |
| 2026-10-07 | Guru Pengganti fase 3 (server): jurnal guru asli & guru pengganti tersimpan sebagai entri terpisah per slot (jurnal pengganti tidak lagi membuat guru asli ditolak "sudah diisi"), guru asli bisa mengisi jurnal slot-nya tanpa QR saat digantikan, halaman Jurnal Berdampingan memakai data server dengan akses petugas & kedua guru, validasi slot sebelum jurnal disimpan | 7 |
| 2026-10-07 | Guru Pengganti fase 4 (tampilan): kolom Diisi Oleh di riwayat jurnal menampilkan nama pengisi (pengajar, "piket: nama", "pengganti: nama", "diisi saat digantikan"), catatan guru asli & guru pengganti pada slot yang sama tampil berurutan bertanda berdampingan; label pengganti juga muncul di Data Jurnal admin/waka, jurnal kelas, wali kelas, dan Tugas Piket Hari Ini | 6, 7 |
| 2026-10-07 | Guru Pengganti fase 4 (server): semua jurnal mencatat pengisinya (jurnal scan QR, piket, pengganti) termasuk data lama lewat migrasi otomatis; riwayat jurnal dari server sudah berisi teks "diisi oleh" dan catatan guru asli & pengganti tersusun berpasangan | 6, 7 |
| 2026-10-07 | Guru Pengganti tersambung penuh ke server (tanpa data contoh): penugasan, kalender, jadwal hari ini guru pengganti, dan riwayat memakai data sungguhan; perbaikan: jurnal mingguan tidak lagi ditolak "sudah diisi" karena jurnal minggu lalu, Tugas Piket Hari Ini menampilkan jadwal berhari huruf besar, ringkasan kehadiran form jurnal piket tidak lagi error | 6, 7 |
| 2026-10-07 | Persiapan aplikasi mobile Android/iPhone: server siap mengirim notifikasi ke HP (pengumuman, penugasan & pembatalan guru pengganti, pengingat mengajar tanpa dobel dengan pengingat lokal), izin jurnal offline bertanda tangan server, dan penyimpanan jurnal offline yang tetap tercatat sesuai jam mengajar walau baru tersinkron belakangan, aman dari pengiriman ganda & manipulasi jam HP; dokumen prompt Emergent & panduan Firebase gratis | 18, 19 |
| 2026-10-07 | Notifikasi web & iPhone (PWA) diperbaiki ke standar enkripsi Web Push terbaru sehingga bisa diterima iPhone (iOS 16.4+) dan browser modern; rencana aplikasi mobile ditetapkan gratis: Android via APK langsung, iPhone via web app di Layar Utama | 17, 19 |
| 2026-10-07 | Aplikasi Android native (Expo) berlogo resmi madrasah: login, kunci biometrik/PIN, Beranda jadwal hari ini, Scan QR & Isi Jurnal (online/offline/guru pengganti), Riwayat Jurnal sesuai peran (guru, piket, wali kelas, admin), Notifikasi & detail pengumuman, detail jurnal dengan daftar siswa tidak hadir, Antrean jurnal offline (kirim ulang/hapus), serta layar Tentang & Diagnostik (status server, izin notifikasi, pengaturan baterai) | 19 |
| 2026-10-07 | Aplikasi Android: layar pembuka beranimasi (logo resmi + indikator memuat), latar bermotif pendidikan modern (buku, toga, atom, laptop, rumus) di layar pembuka, login, lupa password & layar kunci; Lupa Password kini di dalam aplikasi — kirim tautan reset ke email, tempel tautan, buat password baru tanpa membuka versi web | 19 |
| 2026-10-07 | Aplikasi Android: menu Guru Pengganti untuk admin, waka kurikulum & guru piket — tugaskan pengganti 5 langkah (guru, slot, tanggal di kalender, calon pengganti dengan cek bentrok, simpan), daftar mendatang/riwayat dengan status jurnal, kalender bulanan, detail dengan jurnal berdampingan & pembatalan; Tugas Piket — jadwal hari ini tanpa jurnal, terima tugas titipan, isi jurnal atas nama guru lengkap dengan absensi siswa | 6, 7, 19 |
| 2026-10-07 | Semua peran terlayani di aplikasi Android: tab Menu berisi seluruh fitur peran aktif sama persis dengan menu web (40 peran, disinkron otomatis dari web) dan dibuka di dalam aplikasi tanpa login ulang (unduhan PDF/Excel bisa disimpan & dibagikan), pintasan menu per peran di Beranda; notifikasi pribadi per peran di HP & lonceng web: tugas & materi baru (siswa), tugas titipan & jurnal diisi piket (guru, guru piket), catatan tata tertib (wali kelas, BK), ajuan & hasil verval, prestasi menunggu verifikasi & terverifikasi, laporan & status kerusakan lab/sarpras, peminjaman barang/ruangan, tanggapan BK atas CLKB/PCL, serta guru pengganti | 17, 19 |
| 2026-10-07 | Aplikasi Android: isi jurnal kini punya tiga cara validasi seperti di web — Scan QR, Token QR (tempel token, bisa offline), dan Token Kelas (format otomatis XX-XXXX-XXXX, tetap cek jadwal & GPS); bisa dipakai walau kamera tidak tersedia. Jurnal lewat Token Kelas kini juga menyimpan absensi per siswa sehingga rekap & ekspor kehadiran lengkap | 6, 19 |
| 2026-10-07 | Aplikasi Android: form jurnal kini memuat pilihan KD/Indikator dan Materi/Pokok Bahasan per mapel seperti di web (tetap tersedia saat offline karena disimpan saat sinkron); menu web di dalam aplikasi menampilkan layar memuat sampai isi siap, dan tombol web yang punya fitur aplikasi (mis. Scan QR & Isi Jurnal) langsung membuka layar aplikasi | 6, 19 |
| 2026-10-08 | Aplikasi Android fase 1 (siswa) — layar aplikasi asli tanpa halaman web: Jadwal Pelajaran (siswa, wali kelas, guru), Tugas (daftar, tenggat, kumpulkan jawaban), Materi, Kehadiran per bulan, Rapor & nilai ekskul, Data Prestasi (daftar, detail, ajukan prestasi dengan foto/sertifikat dari kamera atau galeri), Ekstrakurikuler, CLKB & PCL (isi, riwayat, tanggapan Guru BK), Profil Saya (data EMIS lengkap, kelengkapan data, berkas, riwayat kelas) dan Ajuan Verval; perbaikan: tugas/materi untuk siswa tertentu kini tampil & bisa dikumpulkan, nilai ekskul tampil di E-Rapor, siswa bisa melihat riwayat kelasnya sendiri | 8, 9, 11, 12, 19 |
| 2026-10-08 | Data Prestasi per peran: ajuan prestasi yang menunggu kini bisa disetujui/ditolak (dengan catatan) langsung dari halaman Prestasi oleh admin, Waka Kesiswaan (pemegang data prestasi siswa) dan wali kelas (siswa kelasnya); Waka Kesiswaan dapat melihat semua ajuan, memverifikasi serta menambah/mengubah prestasi siswa; semua peran guru mapel, kepala madrasah, penjamin mutu, waka & unit pelayanan kini melihat tab yang sesuai; aplikasi Android: unggah foto & sertifikat prestasi dari galeri/kamera berfungsi, sertifikat wajib, tanggal dipilih lewat kalender | 11, 19 |
| 2026-10-08 | Data Prestasi lanjutan: notifikasi ajuan prestasi siswa kini juga ke Waka Kesiswaan dan membuka halaman Prestasi; ajuan yang ditolak dipisah dari "Menunggu" (tab Ditolak, tidak terhitung di statistik) dan bisa dihapus pengaju; halaman publik Prestasi tidak lagi menampilkan NISN siswa (diganti kelas) serta statistik & filter tingkat berfungsi; dashboard wali kelas menghitung prestasi tingkat Kab/Kota | 11, 17 |
| 2026-10-08 | Aplikasi Android fase 2 (guru & tendik) — layar asli: Laporan Absensi Saya & perizinan, Agenda Saya, Jadwal Piket, Kebersihan Kelas, Laporan, Input Nilai E-Rapor, Titipkan Tugas, Materi & Tugas Kelas Digital, Profil GTK; perbaikan: guru IPA/IPS/agama/bahasa/seni/TIK kini dikenali sebagai guru di semua fitur, Kebersihan Kelas memakai tanggal WIB & jadwal input admin, nilai di luar 0–100 ditolak, semester bawaan input nilai mengikuti bulan, jenis izin titipan tugas tersimpan, absensi GTK tidak lagi mencap alpha sebelum jam mengajar | 6, 8, 9, 13, 19 |
| 2026-10-08 | Aplikasi Android fase 3 (kepegawaian & akademik) — layar asli: E-Kinerja GTK (jurnal harian, LCKB, ambil RHK, tautan bukti, pengumpulan dokumen), Profesionalitas GTK (pengumpulan PDF & rekaman kegiatan/sertifikat), Input Indikator & Materi per mapel, Atur Jadwal Saya (tambah/ubah draft dengan pilihan jam pelajaran, hapus, kirim ke admin); perbaikan: semester bawaan Atur Jadwal di web mengikuti bulan | 6, 8, 19 |
| 2026-10-08 | Aplikasi Android fase 4 & 5 — pemantauan Kepala Madrasah dengan layar asli: Kehadiran Siswa (madrasah → tingkat → kelas → siswa), Data Jurnal (per tanggal & per guru), Laporan Absensi GTK & perizinan, Rekap Kebersihan Kelas, Agenda Guru/Tendik & Kegiatan Madrasah, Data Siswa & Data GTK (cari + data EMIS lengkap, hanya lihat), Laporan BK/UKS/Perpustakaan, Kerusakan Sarpras, Data Alumni, DANA RKAM (serapan BOS/Komite per bidang); Beranda kini menampilkan ringkasan per peran (siswa: kehadiran & tugas; kepala: kehadiran siswa & jurnal hari ini; GTK: kehadiran bulan ini); perbaikan: tombol Detail di Data Siswa web kini terbuka untuk kepala madrasah & peran pemantau, detail Data GTK web terbuka untuk kepala madrasah & kepala TU | 6, 8, 12, 19 |
| 2026-10-08 | Aplikasi Android: poin Tata Tertib dengan layar asli — Poin Saya (siswa: kebaikan, pelanggaran, saldo & riwayat), Pantauan Walikelas (siswa kelas dengan penanda perlu perhatian), Rekap & catatan poin untuk pimpinan; rincian untuk Kepala Madrasah: Kunjungan Konseling, Sekolah Lanjutan, Kunjungan & Peminjaman Perpustakaan, Kunjungan UKS, Laporan UKS (diagnosa & opname obat/BMHP); keamanan: catatan konseling BK, home visit, data sekolah lanjutan serta daftar peminjaman & kunjungan perpustakaan kini hanya bisa dibuka peran yang berhak (sebelumnya cukup login); laporan BK kini menghitung CLKB/PCL pada tanggal akhir rentang | 6, 12, 15, 19 |
| 2026-10-08 | Perbaikan hasil uji Kepala Madrasah: kunjungan UKS tidak bisa lagi diberi tanggal yang belum terjadi (sebelumnya salah ketik tanggal membuat kunjungan hilang dari laporan berjalan); tanggal "hari ini" pada semua formulir & ekspor web kini menurut WIB (sebelumnya pengisian sebelum pukul 07.00 tercatat kemarin); Laporan UKS di aplikasi dapat dibuka per diagnosa untuk melihat daftar kunjungannya; Data GTK menampilkan peran GTK yang dilihat | 6, 15, 19 |
| 2026-10-08 | Aplikasi Android untuk wali kelas: Data Siswa kelas wali (hanya lihat, data EMIS lengkap), Jurnal Kelas, Kehadiran Siswa per bulan dengan rincian per pertemuan, Kebersihan Kelas dengan siswa piket, Laporan Kelas dan Pantauan Walikelas (poin tata tertib) kini layar asli; perbaikan: guru mapel yang juga wali kelas kini melihat laporan yang ia kirim sendiri saat aktif sebagai guru | 6, 8, 19 |
| 2026-10-08 | Aplikasi Android: Dashboard Kelas wali (kehadiran, kelengkapan data, prestasi, poin tatib, jadwal hari ini) dan Proses Ajuan untuk wali kelas & Waka Kesiswaan (setujui/tolak ajuan prestasi dan perubahan data siswa) kini layar asli; menu Dashboard membuka Beranda; notifikasi (push maupun tab Notifikasi) membuka layar yang tepat: detail tugas/materi, tanggapan BK, ajuan verval, poin tatib siswa; perbaikan: poin tata tertib di Dashboard Kelas web kini terhitung (sebelumnya selalu 0) dan status jurnal jadwal kelas hari ini tidak lagi terbaca "terisi" dari minggu sebelumnya | 6, 8, 11, 19 |
| 2026-10-08 | Poin Tata Tertib lintas peran: jalur Poin Kebaikan (plus) & Pelanggaran (minus) dengan nilai otomatis dari aturan + kondisi, tindak lanjut penanganan, menu Poin Saya (siswa), Pantauan Walikelas dengan penanda siswa perlu perhatian, Rekap Pengawas lintas kelas (filter kelas/semester/tanggal, unduh Excel) untuk pimpinan; hak input hanya admin, guru tatib, waka kesiswaan, peran lain lihat saja; menu tatib untuk kepala TU, penjamin mutu, waka kurikulum | 4, 12, 16 |
