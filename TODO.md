# TODO - Export Jurnal & Kehadiran Siswa (Guru)

## 1) Analisis & Persiapan Data
- [x] Cek model jurnal, model settings, model kehadiran siswa, dan endpoint terkait.
- [x] Identifikasi koleksi hari libur/takwim dan cara filter tanggal efektif belajar.
- [x] Identifikasi sumber data jadwal mengajar guru per bulan.

## 2) Backend - Skema Detail Absensi (Opsi Lengkap)
- [ ] Tambah field detail absensi siswa per jurnal (nama siswa + status + keterangan).
- [ ] Update request model pembuatan jurnal agar bisa menerima detail absensi.
- [ ] Pastikan backward compatibility untuk data jurnal lama.

## 3) Backend - Pengaturan TTD Kepala
- [ ] Tambah field setting untuk `nama_kepala_madrasah` dan `nip_kepala_madrasah`.
- [ ] (Pelengkap) Tambah field `nama_kepala_tu` dan `nip_kepala_tu` di pengaturan.
- [ ] Tambah/ubah endpoint admin settings agar field dapat disimpan & dibaca.

## 4) Backend - Export Jurnal Bulanan Guru
- [ ] Buat generator Excel jurnal bulanan dengan kolom:
      NO | HARI, TANGGAL | JAM KE | KELAS | KD/INDIKATOR | MATERI/POKOK BAHASAN | ABSENSI SISWA
- [ ] Buat generator PDF jurnal bulanan dengan tabel + blok tanda tangan:
      MALANG, TANGGAL / MENGETAHUI / KEPALA MTSN2 / GURU / NAMA / NIP
- [ ] Tambah endpoint:
      GET /api/jurnal/export/excel
      GET /api/jurnal/export/pdf
- [ ] Terapkan filter:
      - bulan/tahun
      - jadwal mengajar guru
      - kalender/hari libur
      - role-based akses (guru/admin)

## 5) Backend - Export Daftar Hadir Siswa (Menu Kehadiran Guru)
- [ ] Tambah endpoint export daftar hadir siswa per kelas per bulan sesuai jadwal guru.
- [ ] Tambah endpoint export rekap bulanan guru (multi kelas jika perlu).
- [ ] Kolom output berisi tanggal jadwal, status hadir/sakit/izin/alpa, total A/I/S, dan nama wali kelas.

## 6) Frontend - Integrasi Download
- [ ] Update `JurnalHistoryPage.js`:
      - tombol Export Excel (server generated)
      - tombol Export PDF
      - parameter bulan/tahun (dan kelas jika dipilih)
- [ ] Update `KehadiranPage.js`:
      - tombol Export Daftar Hadir per kelas/per bulan
      - request ke endpoint baru backend
      - unduh file respons blob

## 7) Validasi & Uji
- [ ] Uji role guru: hanya data miliknya.
- [ ] Uji role admin: dapat pilih guru.
- [ ] Uji bulan dengan hari libur agar tanggal non-efektif terfilter.
- [ ] Uji PDF format tanda tangan sesuai setting kepala madrasah.
- [ ] Uji kompatibilitas jurnal lama tanpa detail absensi siswa.
