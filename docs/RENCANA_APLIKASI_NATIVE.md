# Rencana Aplikasi Android Native per Peran (tanpa WebView)

Tujuan: semua menu untuk **Guru, Tenaga Kependidikan, Siswa, Guru Piket, dan Kepala Madrasah** tersedia
sebagai layar **native** di aplikasi Android (cepat, nyaman di HP, sebagian bisa offline), menggantikan
modul web tertanam. Modul web tetap menjadi **cadangan** untuk menu yang belum native, sehingga semua
fitur tetap bisa dipakai selama pengerjaan bertahap.

## Ringkasan inventaris
- 52 menu unik untuk 5 peran (dari `navForRole` web, `mobile/src/menu/webMenu.json`).
- Sudah native: Jurnal Presisi (scan QR / Token Kelas / Token QR), Riwayat Jurnal, Guru Pengganti,
  Tugas Piket (untuk guru piket).
- **49 halaman** perlu dibuat native (± 37.000 baris antarmuka web sebagai acuan perilaku).
- Semua memakai **endpoint backend yang sudah ada** — tidak perlu API baru kecuali disebut khusus.

## Prinsip pengerjaan
1. **Perilaku sama dengan web**: aturan akses, validasi, dan data mengikuti endpoint yang sama.
2. **Didesain untuk HP**: daftar + detail + lembar bawah, bukan tabel lebar; aksi utama di jangkauan jempol.
3. **Offline bila wajar**: data baca harian (jadwal, tugas, materi, kehadiran, rapor) disimpan di cache.
4. **Bertahap & selalu bisa dipakai**: setiap menu yang selesai native otomatis menggantikan versi web di
   tab Menu (pemetaan di `mobile/src/menu/routes.ts`); yang belum selesai tetap terbuka lewat modul web.
5. **Setiap fase**: uji di HP (Expo Go), build APK, commit, push & sync, bahan presentasi diperbarui.

## Fase
| Fase | Fokus | Isi |
|---|---|---|
| 1 ✅ selesai | **Siswa** (harian, ringan) | Jadwal, Tugas (lihat & kumpulkan), Materi, Kehadiran, Rapor, Prestasi, Ekstrakurikuler, CLKB, PCL, Profil, Ajuan Verval |
| 2 ✅ selesai | **Guru & Tendik harian** | Agenda Saya, Titipkan Tugas, Tugas & Materi kelas (buat, lihat pengumpulan, nilai), Input Nilai, Kebersihan Kelas, Laporan, Absensi Saya, Jadwal Piket, Profil |
| 3 ✅ selesai | **Kepegawaian & akademik lanjutan** | E-Kinerja (RHK, SKP, LCKB, jurnal harian), Profesionalitas GTK, Input Indikator & Materi, Atur Jadwal Saya |
| 4 | **Kepala Madrasah** (pemantauan) | Data Jurnal, Kehadiran Siswa, Data Siswa & GTK (cari + detail), Agenda Guru/Tendik, Laporan Absensi GTK, Kegiatan, Kebersihan, DANA RKAM, Tata Tertib, BK, UKS, Perpus, Sarpras, Alumni |
| 5 | **Dashboard native per peran** | Ringkasan & grafik per peran menggantikan Dashboard web |

Perkiraan: fase 1–2 adalah prioritas pemakaian harian; fase 4 berisi banyak halaman laporan bertipe
"cari, saring, lihat detail" yang bisa memakai komponen daftar/detail bersama agar lebih cepat.

## Inventaris per halaman
| Fase | Menu (path web) | Peran | Ukuran web | Endpoint utama |
|---|---|---|---|---|
| ✅ sudah | Guru Pengganti (`/guru-pengganti`) | Piket | 292 baris | (komponen bersama) |
| ✅ sudah | Riwayat Jurnal (`/jurnal/riwayat`) | Guru, Piket | 1035 baris | `GET /journals/{id}/attendance`<br>`PUT /admin/jurnal/{id}` |
| ✅ sudah | Jurnal Presisi (`/jurnal/scan`) | Guru | 1204 baris | `GET /indikator`<br>`GET /materi`<br>`GET /students`<br>`POST /jurnal/validate`<br>+1 lagi |
| ✅ sudah | Kehadiran Siswa (`/siswa/kehadiran`) | Siswa | 322 baris | `GET /students/my-attendance`<br>`GET /students/my-attendance/stats` |
| ✅ sudah | PCL (`/siswa/pcl`) | Siswa | 391 baris | `GET /bk/pcl/form`<br>`GET /bk/pcl/my-history`<br>`POST /bk/pcl/submit` |
| ✅ sudah | Materi Mapel (`/siswa/materi`) | Siswa | 399 baris | `GET /kelas/materi`<br>`GET /kelas/materi/{id}` |
| ✅ sudah | CLKB (`/siswa/clkb`) | Siswa | 408 baris | `GET /bk/clkb/form`<br>`GET /bk/clkb/my-history`<br>`POST /bk/clkb/submit` |
| ✅ sudah | Ajuan Verval Saya (`/verval/ajuan-saya`) | Guru, Tendik, Siswa | 410 baris | `GET /verval-requests` |
| ✅ sudah | Rapor Saya (`/rapor`) | Siswa | 422 baris | `GET /ekstrakurikuler/student/{id}`<br>`GET /grades/rapor/{id}`<br>`GET /grades/student/{id}` |
| ✅ sudah | Tugas (`/siswa/tugas`) | Siswa | 560 baris | `GET /kelas/tugas`<br>`GET /kelas/tugas/{id}`<br>`POST /kelas/tugas/{id}/submit` |
| ✅ sudah (pembina via web) | Ekstrakurikuler (`/ekstrakurikuler`) | Siswa | 709 baris | `DELETE /extracurriculars/{id}`<br>`DELETE /extracurriculars/{id}/members/{id}`<br>`GET /academic-years/active`<br>`GET /extracurriculars`<br>+9 lagi |
| ✅ sudah | Jadwal Saya (`/jadwal`) | Guru, Siswa | 713 baris | `DELETE /schedules/{id}`<br>`GET /academic-years/active`<br>`GET /classes`<br>`GET /schedules`<br>+7 lagi |
| ✅ sudah (lihat; ubah data via web) | Profil Saya (`/profile/siswa`) | Siswa | 1261 baris | `GET /achievements`<br>`GET /students/{id}/class-history`<br>`GET /students/{id}/detail`<br>`POST /students/detail/upload/{id}`<br>+3 lagi |
| ✅ sudah (admin & wali kelas via web) | Data Prestasi (`/prestasi`) | Guru, Tendik, Siswa, Kepala | 1298 baris | `DELETE /achievements/{id}`<br>`DELETE /verval-requests/{id}`<br>`GET /academic-years`<br>`GET /achievements`<br>+8 lagi |
| ✅ sudah (lihat; ubah data via web) | Profil Saya (`/profile/tendik`) | Tendik | 7 baris | (komponen bersama) |
| ✅ sudah (lihat; ubah data via web) | Profil Saya (`/profile/guru`) | Guru, Kepala | 12 baris | (komponen bersama) |
| ✅ sudah | Input Nilai (`/nilai/input`) | Guru | 307 baris | `GET /academic-years/active`<br>`GET /classes`<br>`GET /grades`<br>`GET /schedules`<br>+3 lagi |
| ✅ sudah | Laporan Absensi Saya (`/gtk/absensi-saya`) | Guru, Tendik | 315 baris | `DELETE /gtk/izin/{id}`<br>`GET /gtk/absensi/my`<br>`GET /gtk/izin/my`<br>`POST /gtk/izin`<br>+1 lagi |
| ✅ sudah | Laporan (`/guru/laporan`) | Guru | 449 baris | `DELETE /reports/{id}`<br>`GET /academic-years/active`<br>`GET /classes`<br>`GET /reports`<br>+3 lagi |
| ✅ sudah (lihat; admin kelola via web) | Jadwal Piket (`/admin/jadwal-piket`) | Guru, Tendik, Piket | 514 baris | `DELETE /ibadah-schedules/{id}`<br>`DELETE /piket-schedules/{id}`<br>`GET /ibadah-schedules`<br>`GET /ibadah-schedules/today`<br>+7 lagi |
| ✅ sudah | Agenda Saya (`/my-agenda`) | Guru, Tendik, Kepala | 547 baris | `DELETE /staff-events/{id}`<br>`GET /staff-events`<br>`GET /staff-events/stats/duration`<br>`POST /staff-events`<br>+1 lagi |
| ✅ sudah | Kebersihan Kelas (`/guru/kebersihan`) | Guru, Piket | 599 baris | `GET /academic-years/active`<br>`GET /classes`<br>`GET /cleanliness/class/{id}`<br>`GET /cleanliness/guru/classes/all`<br>+3 lagi |
| ✅ sudah | Titipkan Tugas (`/piket/tugas`) | Guru, Piket | 727 baris | `DELETE /teacher-tasks/{id}`<br>`GET /piket/schedules/today`<br>`GET /schedules`<br>`GET /students`<br>+5 lagi |
| ✅ sudah | Materi Mapel (`/guru/materi`) | Guru | 883 baris | `DELETE /kelas/materi/{id}`<br>`GET /classes`<br>`GET /classes/{id}/students`<br>`GET /kelas/materi`<br>+3 lagi |
| ✅ sudah | Tugas (`/guru/tugas`) | Guru | 1013 baris | `DELETE /kelas/tugas/{id}`<br>`GET /classes`<br>`GET /classes/{id}/students`<br>`GET /kelas/tugas`<br>+4 lagi |
| ✅ sudah (rekap penyusun via web) | Profesionalitas GTK (`/admin/gtk/profesionalitas`) | Guru, Tendik, Kepala | 343 baris | `DELETE /ekinerja/sertifikasi/{id}`<br>`GET /ekinerja/pengumpulan/meta`<br>`GET /ekinerja/sertifikasi`<br>`GET /ekinerja/sertifikasi/my`<br>+3 lagi |
| ✅ sudah | Input Indikator & Materi (`/guru/indikator-materi`) | Guru | 874 baris | `DELETE /indikator/{id}`<br>`DELETE /materi/{id}`<br>`GET /indikator`<br>`GET /materi`<br>+9 lagi |
| ✅ sudah | Atur Jadwal Saya (`/jadwal/atur`) | Guru | 916 baris | `DELETE /schedules/{id}`<br>`GET /academic-years/active`<br>`GET /classes`<br>`GET /rooms`<br>+7 lagi |
| ✅ sudah (rekap penyusun via web) | E-Kinerja (`/admin/gtk/e-kinerja`) | Guru, Tendik, Kepala | 1525 baris | `DELETE /ekinerja/jurnal-harian/link/{id}`<br>`DELETE /ekinerja/jurnal-harian/{id}`<br>`DELETE /ekinerja/pengumpulan/confirm`<br>`DELETE /ekinerja/rhk/{id}`<br>+25 lagi |
| 4 | Laporan Perpus (`/admin/perpus/laporan`) | Kepala | 115 baris | `GET /perpus/laporan/summary` |
| 4 | Laporan BK (`/admin/bk/laporan`) | Kepala | 120 baris | `GET /bk/laporan/summary` |
| 4 | Data Kunjungan Perpus (`/admin/perpus/kunjungan`) | Kepala | 223 baris | `DELETE /perpus/kunjungan/{id}`<br>`GET /perpus/kunjungan`<br>`GET /perpus/warga-madrasah`<br>`POST /perpus/kunjungan` |
| 4 | Data Peminjaman Perpus (`/admin/perpus/peminjaman`) | Kepala | 288 baris | `DELETE /perpus/peminjaman/{id}`<br>`GET /perpus/koleksi`<br>`GET /perpus/peminjaman`<br>`GET /perpus/warga-madrasah`<br>+2 lagi |
| 4 | Rekapitulasi Kebersihan (`/admin/kebersihan`) | Kepala | 300 baris | `GET /classes`<br>`GET /cleanliness/admin/recap` |
| 4 | Laporan Absensi GTK (`/admin/gtk/laporan-absensi`) | Kepala | 311 baris | `GET /gtk/absensi/rekap`<br>`GET /gtk/izin` |
| 4 | Laporan Kerusakan & Perbaikan (`/admin/sarpras/kerusakan`) | Kepala | 319 baris | `DELETE /sarpras/kerusakan/{id}`<br>`GET /rooms`<br>`GET /sarpras/aset-lancar`<br>`GET /sarpras/aset-tetap`<br>+5 lagi |
| 4 | Laporan UKS (`/admin/uks/laporan`) | Kepala | 325 baris | `GET /semesters`<br>`GET /uks/laporan/rekap-kunjungan`<br>`GET /uks/laporan/rekap-kunjungan/export-{id}`<br>`GET /uks/laporan/summary` |
| 4 | Kunjungan Konseling (`/admin/bk/kunjungan`) | Kepala | 348 baris | `DELETE /bk/kunjungan/{id}`<br>`GET /bk/kunjungan`<br>`GET /classes`<br>`GET /students`<br>+2 lagi |
| 4 | Data Alumni (`/admin/alumni`) | Kepala | 421 baris | `GET /academic-years`<br>`GET /alumni`<br>`GET /alumni/stats`<br>`GET /alumni/{id}`<br>+1 lagi |
| 4 | Data Sekolah Lanjutan (`/admin/bk/sekolah-lanjutan`) | Kepala | 462 baris | `DELETE /bk/sekolah-lanjutan/{id}`<br>`DELETE /bk/sekolah-tujuan/{id}`<br>`GET /academic-years`<br>`GET /bk/sekolah-lanjutan`<br>+6 lagi |
| 4 | Data Tata Tertib (`/admin/tatib/data`) | Kepala | 505 baris | `GET /semesters`<br>`GET /students`<br>`GET /tahun-takwim`<br>`GET /tatib/aturan`<br>+2 lagi |
| 4 | Agenda Guru (`/admin/gtk/agenda-guru`) | Kepala | 553 baris | `DELETE /staff-events/{id}`<br>`GET /jabatan`<br>`GET /staff-events`<br>`GET /tahun-takwim`<br>+3 lagi |
| 4 | Kegiatan Madrasah (`/admin/kegiatan-madrasah`) | Kepala | 553 baris | `DELETE /madrasah-events/{id}`<br>`GET /madrasah-events`<br>`GET /madrasah-events/stats/duration`<br>`GET /tahun-takwim`<br>+2 lagi |
| 4 | Agenda Tendik (`/admin/gtk/agenda-tendik`) | Kepala | 593 baris | `DELETE /staff-events/{id}`<br>`GET /jabatan`<br>`GET /staff-events`<br>`GET /tahun-takwim`<br>+3 lagi |
| 4 | Laporan UKS Baru (`/admin/uks/laporan-baru`) | Kepala | 700 baris | `GET /uks/laporan-baru/diagnosa`<br>`GET /uks/laporan-baru/opname`<br>`GET /uks/laporan-baru/{id}/export-{id}` |
| 4 | Kehadiran Siswa (`/admin/kehadiran`) | Kepala | 748 baris | `GET /admin/attendance/by-class`<br>`GET /admin/attendance/by-grade`<br>`GET /admin/attendance/overall`<br>`GET /classes` |
| 4 | Data Jurnal (`/admin/jurnal`) | Kepala | 1045 baris | `GET /admin/jurnal`<br>`GET /admin/jurnal/stats-by-teacher`<br>`GET /classes`<br>`GET /journals/{id}/attendance`<br>+5 lagi |
| 4 | DANA RKAM (`/admin/dana-rkam`) | Kepala | 1132 baris | `DELETE /rkam/budget-items/{id}`<br>`DELETE /rkam/documents/{id}`<br>`GET /rkam/budget-items`<br>`GET /rkam/budget-items/export`<br>+6 lagi |
| 4 | Data GTK (`/admin/gtk`) | Kepala | 1665 baris | `DELETE /users/{id}`<br>`GET /admin/audit-logs`<br>`GET /gtk/export-excel`<br>`GET /gtk/export-excel/ringkasan`<br>+5 lagi |
| 4 | Data Kunjungan UKS (`/admin/uks/kunjungan`) | Kepala | 1858 baris | `DELETE /uks/kunjungan/{id}`<br>`GET /classes`<br>`GET /students`<br>`GET /uks/bmhp`<br>+16 lagi |
| 4 | Data Siswa (`/admin/siswa`) | Kepala | 2772 baris | `DELETE /users/{id}`<br>`GET /academic-years/active`<br>`GET /achievements`<br>`GET /admin/audit-logs`<br>+12 lagi |
| 5 | Dashboard (`/dashboard`) | Guru, Tendik, Siswa, Piket, Kepala | 3116 baris | `GET /academic-holidays`<br>`GET /achievements`<br>`GET /admin/jurnal/stats-by-teacher`<br>`GET /admin/stats`<br>+21 lagi |

_Inventaris dibangkitkan dari kode web (rute `App.js`, komponen halaman, pemanggilan `api.*`)._
