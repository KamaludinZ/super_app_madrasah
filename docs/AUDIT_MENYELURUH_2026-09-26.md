# Audit Menyeluruh Super Apps MATSANDATAMA (26 Sep 2026)

Audit ini membaca kode backend (FastAPI + MongoDB) dan frontend (React). Isinya
dibagi menjadi tiga bagian: apa yang harus **Anda lakukan sendiri**, apa yang
**sudah diperbaiki** di cabang ini, dan apa yang **disarankan untuk tahap berikutnya**.

Tingkat risiko: 🔴 Kritis · 🟠 Tinggi · 🟡 Sedang · ⚪ Rendah

---

## A. Wajib dilakukan sendiri (tidak bisa diperbaiki lewat kode)

| # | Risiko | Temuan | Yang harus dilakukan |
|---|---|---|---|
| A1 | 🔴 | **Password MongoDB Atlas** (`kamaludinzuhri_db_user`) tertulis di repo: `AUDIT_REPORT.md`, `SECURITY_AUDIT_REPORT.md`, `MIGRASI_KE_MONGODB_LOKAL.md`, `backend/seed_atlas.py`, `backend/seed_all_data.py`. Sudah dihapus dari file, tetapi **masih tersimpan di riwayat git**. | Ganti password user database di MongoDB Atlas sekarang juga, lalu perbarui `MONGO_URL` di server. |
| A2 | 🔴 | Potongan **JWT_SECRET** lama ada di `SECURITY_AUDIT_REPORT.md`, dan `backend/run_local.bat` memuat JWT_SECRET lengkap. | Buat JWT_SECRET baru untuk server produksi: `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Setelah diganti, semua pengguna perlu login ulang. |
| A3 | 🟠 | **Private key VAPID** (notifikasi push) ada di `DEPLOYMENT_PUSH_NOTIFICATION.md`. Sudah dihapus dari file. | Buat kunci baru dengan `backend/scripts/generate_vapid_keys.py`. Pelanggan notifikasi perlu mendaftar ulang. |
| A4 | 🟡 | Password MongoDB lokal `SuperStrongPassword2024!SecureMongo` muncul di banyak dokumen. | Jika password yang sama dipakai di server produksi, ganti. |
| A5 | 🟡 | Seeder data demo (akun `admin/admin123`, dll.) berjalan otomatis bila `ENVIRONMENT` **tidak** diisi `production` dan database kosong. | Pastikan server produksi memakai `ENVIRONMENT=production`. |

> Riwayat git bisa dibersihkan dengan `git filter-repo` atau BFG. Langkah ini tidak
> wajib bila semua kredensial di atas sudah diganti, karena kredensial lama tidak
> berlaku lagi.

---

## B. Sudah diperbaiki di cabang ini

### B1. 🟠 Captcha hitungan → captcha gambar angka (permintaan utama)
**Masalah lama:** soal captcha dikirim sebagai **teks** (`"Berapa 7 + 12 = ?"`).
Bot bisa membacanya lalu menghitung jawabannya otomatis, jadi captcha ini tidak menahan
serangan tebak password sama sekali.

**Sekarang:**
- Server membuat **gambar PNG berisi 5 angka acak** (sekitar 100.000 kemungkinan).
  Setiap angka punya ukuran, warna, dan kemiringan acak. Gambar juga diberi
  distorsi gelombang, garis pengganggu, dan bintik.
- Jawaban **tidak pernah dikirim ke browser**. Di database pun yang disimpan hanya
  hash-nya (HMAC-SHA256).
- Captcha **sekali pakai** dan berlaku 5 menit. MongoDB menghapus captcha yang
  kedaluwarsa secara otomatis lewat TTL index.
- Tampilan login (umum dan Kelas Digital) kini menampilkan gambar, tombol
  "Ganti gambar", dan kolom isian yang hanya menerima angka. Di HP, kolom ini
  memunculkan keyboard angka.
- File: `backend/captcha_utils.py` (baru), `routers/auth.py`, `routers/kelas_digital.py`,
  `models.py`, `frontend/src/pages/LoginPage.js`, `frontend/src/pages/KelasLoginPage.js`.

### B2. 🟠 Captcha & penguncian akun tidak bekerja dengan 2 worker server
Dockerfile menjalankan `uvicorn --workers 2`. Captcha dan hitungan gagal login dulu
disimpan di memori masing-masing worker. Akibatnya:
- pengguna **sering mendapat pesan "Captcha salah atau kedaluwarsa"** walaupun
  jawabannya benar, karena captcha dibuat di worker A tetapi login diproses worker B;
- penguncian setelah 5 kali gagal bisa diakali karena hitungannya terbagi di dua worker.

**Sekarang** keduanya disimpan di MongoDB (koleksi `captcha_challenges` dan
`login_attempts`), sehingga dipakai bersama oleh semua worker.

### B3. 🟠 Login Kelas Digital tanpa batas percobaan
Token kelas bisa ditebak tanpa batas, karena satu-satunya penghalang adalah captcha
hitungan yang mudah dibaca bot. **Sekarang** login kelas terkunci 15 menit setelah
5 kali gagal. Token juga dibandingkan dengan fungsi waktu-konstan (`hmac.compare_digest`).

### B4. 🔴 JWT_SECRET dari file `.env` tidak terbaca
`core.py` meng-import `auth_utils.py` **sebelum** memanggil `load_dotenv()`. Kalau
JWT_SECRET hanya ditulis di `backend/.env` (tidak di environment Docker/Coolify),
server diam-diam memakai secret bawaan yang tertulis di repo. Dengan secret itu,
siapa pun bisa membuat token admin palsu. **Sekarang** `.env` dimuat lebih dulu, dan
server menulis log CRITICAL bila secret masih bawaan atau kurang dari 32 karakter.

### B5. 🟠 XSS tersimpan di Materi & Tugas
Isi materi/tugas (HTML dari TinyMCE) ditampilkan dengan `dangerouslySetInnerHTML`
tanpa dibersihkan. Guru atau akun yang dibobol bisa menyisipkan `<img onerror=...>`
untuk mencuri token login admin/siswa dari `localStorage`. **Sekarang** semua 22
titik tampilan di 12 halaman dibersihkan dengan DOMPurify (`frontend/src/lib/sanitizeHtml.js`).
Konten lama yang terlanjur tersimpan juga ikut aman, karena pembersihan dilakukan
saat konten ditampilkan.

### B6. 🟡 Ganti password tanpa password lama
`PUT /users/me/profile` menerima `new_password` tanpa memeriksa password lama.
Siapa pun yang memegang token curian bisa mengambil alih akun secara permanen.
**Sekarang** field ini ditolak di endpoint tersebut. Ganti password tetap lewat
`/auth/change-password`, yang memang memeriksa password lama. Frontend tidak memakai
jalur lama ini, jadi tidak ada fitur yang rusak.

### B7. 🟡 Pesan login membocorkan akun
Dulu akun nonaktif mendapat pesan "Akun Anda dinonaktifkan" **sebelum** password
diperiksa, sehingga orang lain bisa mengetahui username mana yang ada. **Sekarang**
password dicek lebih dulu.

### B8. Bug fungsi yang diperbaiki
| Bug | Dampak | Perbaikan |
|---|---|---|
| `log_audit(user['id'], ...)` salah argumen di `dokumen_siswa.py` | **Upload & hapus dokumen siswa (Profil EMIS) selalu error 500**, padahal file sebenarnya sudah tersimpan | Argumen diperbaiki |
| Query `{'siswa': {'$in': ['roles']}}` di `promotions.py` | **Preview Naik Kelas/Lulus selalu menampilkan 0 siswa** | Diganti `{'roles': 'siswa'}` |
| Rute `/users/{uid}` dideklarasikan sebelum `/users/teachers` | `/users/teachers` tidak pernah bisa diakses | Urutan rute ditukar |
| File dokumen siswa tidak dicek pemiliknya | Siswa bisa membuka file siswa lain jika tahu nama filenya | Nama file wajib diawali `{student_id}_{jenis}_` |
| Upload dokumen siswa tanpa batas ukuran | File raksasa bisa memenuhi disk | Maksimal 5MB |

---

## C. Disarankan untuk tahap berikutnya (belum diubah)

### Keamanan
| Risiko | Temuan | Saran |
|---|---|---|
| 🟠 | **Token reset password** disimpan di memori (`email_utils._reset_tokens`). Masalahnya sama seperti B2: link reset dari email sering "tidak valid" dengan 2 worker, dan hilang setiap server restart. | Pindahkan ke MongoDB dengan TTL, seperti captcha. |
| 🟠 | `GET /users` mengembalikan **seluruh data pribadi** (NIK, No. KK, alamat, data orang tua) ke banyak peran (wali kelas, unit pelayanan, dsb.). | Kirim hanya field yang dibutuhkan halaman (projection), sesuai peran. |
| 🟠 | Token login disimpan di `localStorage` dan tidak bisa dicabut. Logout, ganti password, dan reset password tidak mematikan token lama, padahal "Ingat saya" berlaku 30 hari. | Tambahkan `token_version` di data user, lalu naikkan nilainya saat logout/ganti password. |
| 🟡 | Admin bisa *impersonate* admin lain (baris pencegahnya dikomentari di `auth.py`). | Aktifkan kembali larangan tersebut. |
| 🟡 | Password minimal hanya 6 karakter. | Naikkan menjadi minimal 8 karakter dan tolak password umum (`123456`, `password`, dll.). |
| 🟡 | Pencarian `$regex` memakai input mentah tanpa `re.escape` di `alumni`, `lab`, `perpus`, `sarpras`, `student_records`, dan `uks`. Input tertentu bisa membuat query sangat lambat (ReDoS). | Bungkus dengan `re.escape(search)`. |
| 🟡 | Default `CORS_ORIGINS='*'` dipakai bersama `allow_credentials=True`, dan CSP masih mengizinkan `'unsafe-inline' 'unsafe-eval'`. | Isi `CORS_ORIGINS` dengan domain resmi. |
| 🟡 | Paket `xlsx@0.18.5` (SheetJS) punya celah yang sudah diketahui (CVE-2023-30533, CVE-2024-22363). | Ganti ke build resmi SheetJS 0.20.x dari `cdn.sheetjs.com`. |
| ⚪ | File backup JSON berisi `password_hash` dan `password_reset_tokens`. | Simpan file backup di tempat yang aman, atau keluarkan kedua field itu dari ekspor. |
| ⚪ | Upload logo mempercayai `content_type` dari browser. | Validasi file dengan Pillow sebelum disimpan. |
| ⚪ | Log produksi mencetak data siswa (`[DASHBOARD-STATS] Sample record`, debug rute di `server.py`, `print` di upload logo). | Turunkan ke `logger.debug` atau hapus. |

### Fungsi & kualitas kode
- 106 `console.log` dan sekitar 107 `alert()`/`confirm()` bawaan browser di frontend.
  Disarankan diganti dengan `toast` (sonner) dan `AlertDialog`, yang sudah tersedia di proyek.
- Beberapa halaman sangat besar (`ProfilePageEMIS.js` 2.486 baris, `AdminEKinerjaPage.js`
  1.523 baris), sehingga sulit dirawat. Pecah menjadi beberapa komponen.
- Kebersihan repo: ada 56 file `.md` di root, file berawalan `C…super_app_madrasah…`
  (hasil salah path dari Windows), `server_debug.log`, `server_output.log`,
  `.blackbox/tmp/*.log`, `GuruMateriPage.js.old`, `test_*.html`, dan `bulk_template_test.xlsx`.
  Pindahkan dokumen ke `docs/` dan hapus file sisa.
- Nama variabel lingkungan tidak konsisten: `seed_data.py` membaca `ENV`, sedangkan
  `server.py` membaca `ENVIRONMENT`.
- `backend_test.py` masih menjawab captcha hitungan secara otomatis, sehingga perlu
  disesuaikan karena captcha kini berupa gambar.

### Tampilan
- Tampilan captcha baru mengikuti gaya kartu yang sudah ada (latar krem, aksen hijau
  `#006837`). Di layar kecil, gambar dan kolom isian tersusun atas-bawah; di layar
  lebar, keduanya sejajar.
- Sebagian `<img>` belum memiliki `alt`, dan dialog `alert()` bawaan browser terasa
  kurang rapi. Keduanya bisa dibenahi bertahap.

---

## Cara menguji perubahan
1. Buka halaman **Login** dan pastikan gambar 5 angka muncul. Tekan "Ganti gambar"
   untuk mendapat gambar baru.
2. Isi angka yang salah. Pesan "Kode captcha salah atau kedaluwarsa" harus muncul,
   dan gambar otomatis berganti.
3. Coba password salah 5 kali. Akun harus terkunci 15 menit, bahkan jika server
   berjalan dengan 2 worker.
4. Ulangi pengujian di halaman **Login Kelas**.
5. Di **Profil EMIS** siswa, upload lalu hapus dokumen. Keduanya tidak boleh error lagi.
6. Di **Naik Kelas**, pilih kelas asal. Daftar siswa harus muncul.
