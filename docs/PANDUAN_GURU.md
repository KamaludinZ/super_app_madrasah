# Panduan Guru Mata Pelajaran

## Login Pertama

Gunakan username & password yang diberikan admin. Setelah login, sistem akan menyarankan Anda untuk **mengubah password default** — ikuti saran ini demi keamanan akun.

Anda juga akan diingatkan kembali setiap **6 bulan** untuk mengganti password (boleh ditunda 30 hari kalau belum sempat).

## 1. Dashboard

Dashboard guru menampilkan:
- Jadwal mengajar hari ini
- Status pengisian jurnal (Terisi / Belum)
- Pengumuman dari admin / sekolah
- Notifikasi ringkas (ikon 🔔 di kanan atas)

## 2. Jurnal Presisi (QR Scan)

Ini adalah fitur inti. Setiap kali mengajar, Anda **wajib** scan QR dan mengisi jurnal.

1. Saat tiba di kelas, buka menu **Jurnal Presisi**.
2. Izinkan akses kamera — arahkan ke kartu QR di depan kelas.
3. Sistem akan memvalidasi 3 hal sekaligus:
   - **QR**: kode valid & belum kedaluwarsa
   - **Jadwal**: Anda memang dijadwalkan mengajar di ruang itu saat itu
   - **GPS** (jika aktif): Anda berada di lokasi yang benar (radius ~20 m)
4. Isi form:
   - Materi yang disampaikan
   - Jumlah siswa Hadir / Sakit / Izin / Alpa
   - Catatan (opsional)
5. Klik **Simpan** — jurnal terkunci dan tidak dapat diubah lagi.

### Toleransi Waktu
Jurnal hanya bisa dibuat dalam rentang **±15 menit** dari jam jadwal. Misal jadwal 07:00-07:45 → bisa scan mulai 06:45 hingga 08:00.

## 3. Jadwal Saya & Atur Jadwal Saya

- Menu **Jadwal Saya**: melihat semua jadwal mingguan Anda dalam grid.
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
3. Sistem otomatis hitung **Nilai Akhir** dan **Predikat** (A/B/C/D):
   - ≥ 88 → A
   - ≥ 76 → B
   - ≥ 60 → C
   - < 60 → D
4. Tambahkan deskripsi singkat jika perlu.
5. Klik **Simpan** — nilai bisa di-update sampai semester ditutup.

## 6. Data Prestasi

Upload prestasi Anda (sertifikat, jenjang, organizer, tanggal) di menu **Data Prestasi**. Admin/Wali Kelas akan memverifikasi.

Format data:
- Nama lomba
- Bidang (akademik / non-akademik / keagamaan / olahraga / seni)
- Tingkat (sekolah / kota / provinsi / nasional / internasional)
- Peringkat (Juara 1/2/3/Harapan/Partisipan)
- Penyelenggara
- Tanggal pelaksanaan
- Lampiran sertifikat (opsional)

## Tips

- Pastikan jam HP Anda akurat — jurnal hanya bisa dibuat dalam rentang waktu jadwal (±15 menit toleransi).
- Jika scan QR selalu gagal, foto kartu QR lalu kirim ke admin — mungkin perlu generate ulang.
- Gunakan tombol "Tandai Sudah Dibaca" untuk pengumuman yang sudah Anda baca.
- Untuk masalah teknis, hubungi admin sekolah — jangan share password ke siapapun.
