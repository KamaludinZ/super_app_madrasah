# Audit Menyeluruh Super Apps MATSANDATAMA (26 Sep 2026)

Audit ini membaca kode backend (FastAPI + MongoDB) dan frontend (React). Isinya
dibagi menjadi tiga bagian: apa yang harus **Anda lakukan sendiri**, apa yang
**sudah diperbaiki** di cabang ini, dan **tindak lanjut saran** yang juga sudah dikerjakan.

Tingkat risiko: 🔴 Kritis · 🟠 Tinggi · 🟡 Sedang · ⚪ Rendah

---

## A. Wajib dilakukan sendiri (tidak bisa diperbaiki lewat kode)

| # | Risiko | Temuan | Yang harus dilakukan |
|---|---|---|---|
| A1 | 🔴 | **Password MongoDB Atlas** (`kamaludinzuhri_db_user`) tertulis di repo: `AUDIT_REPORT.md`, `SECURITY_AUDIT_REPORT.md`, `MIGRASI_KE_MONGODB_LOKAL.md` (kini di `docs/`), `backend/seed_atlas.py`, `backend/seed_all_data.py`. Sudah dihapus dari file, tetapi **masih tersimpan di riwayat git**. | Ganti password user database di MongoDB Atlas sekarang juga, lalu perbarui `MONGO_URL` di server. |
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

## C. Tindak lanjut saran (sudah dikerjakan)

Semua saran di bagian ini dikerjakan berurutan, masing-masing dalam commit terpisah.

### Keamanan
| Risiko | Temuan | Status |
|---|---|---|
| 🟠 | **Token reset password** disimpan di memori, sehingga link reset dari email sering "tidak valid" saat server berjalan dengan 2 worker dan hilang saat restart. | ✅ Dipindah ke MongoDB (hash SHA-256, TTL 30 menit, sekali pakai). Password baru divalidasi **sebelum** token dipakai. Cek SMTP dilakukan sebelum mencari user agar tidak membocorkan akun. Pengiriman email dijalankan di thread terpisah. |
| 🟠 | `GET /users` mengirim NIK, No. KK, dan data lain ke banyak peran. | ✅ Selain admin, kepala madrasah, dan kepala TU, peran lain tidak lagi menerima NIK, No. KK, nomor KIP/PKH/KKS, NIK & penghasilan orang tua, tautan dokumen, dan rekam didik. |
| 🟠 | Token tidak bisa dicabut. | ✅ Logout mencabut token di perangkat itu saja (koleksi `revoked_tokens`). Ganti password, reset via email, password diganti admin, atau akun dinonaktifkan mencabut **semua** sesi lama (`token_version`). Sesi yang sedang dipakai saat ganti password langsung mendapat token baru. Token lama yang sudah beredar tetap berlaku, jadi tidak ada logout massal saat update dipasang. |
| 🟡 | Admin bisa *impersonate* admin lain. | ✅ Ditolak server, dan tombol "Login Sebagai" disembunyikan untuk akun admin. |
| 🟡 | Password minimal 6 karakter. | ✅ Password pilihan pengguna minimal 8 karakter, bukan password umum/berulang, dan tidak sama dengan username. Password yang di-set admin atau hasil impor tidak diubah aturannya. |
| 🟡 | `$regex` memakai input mentah. | ✅ Dibungkus `re.escape` di alumni, lab, perpus, sarpras, buku induk, dan UKS. Pencarian berisi `(` sebelumnya menyebabkan error 500. |
| 🟡 | CORS `*` dipasangkan dengan `allow_credentials=True`. | ✅ Kredensial CORS hanya aktif bila domain diisi eksplisit (aplikasi memakai header `Authorization`, bukan cookie). Server memberi peringatan bila `CORS_ORIGINS` kosong di produksi. **Tetap isi `CORS_ORIGINS` dengan domain resmi.** |
| ⚪ | Paket `xlsx@0.18.5` punya CVE-2023-30533 dan CVE-2024-22363. | ℹ️ **Tidak berlaku di aplikasi ini.** Kedua celah hanya terpicu saat *membaca* file Excel berbahaya, sedangkan frontend hanya *membuat* file (`json_to_sheet`, `writeFile`). Impor Excel diproses backend dengan openpyxl. Upgrade tetap disarankan bila kelak frontend perlu membaca file Excel. |
| ⚪ | Backup berisi `password_reset_tokens`. | ✅ Koleksi itu dikeluarkan dari backup. `password_hash` tetap disertakan agar restore bisa berjalan, jadi **simpan file backup di tempat aman**. |
| ⚪ | Upload logo mempercayai `content_type` dari browser. | ✅ Jenis file dibaca dari isi gambar dengan Pillow; SVG/HTML ditolak. |
| ⚪ | Log produksi mencetak data siswa. | ✅ 44 log berisi data siswa/sampel record diturunkan ke level debug, `print()` diganti logger, dan blok log `[DEBUG]` di `server.py` dihapus. |

### Fungsi & kualitas kode
| Temuan | Status |
|---|---|
| Workflow CI `webpack.yml` selalu gagal (menjalankan npm di root). | ✅ Kini build dijalankan di `frontend/` dengan `npm ci` + `craco build`. Node 18 (EOL) dihapus dari matrix. |
| 106 `console.log`. | ✅ Build produksi membuang `console.log/info/debug` otomatis (Terser), sedangkan `console.warn/error` tetap. Skrip lama `security_audit_fix.py` yang mengedit kode sumber dihapus. |
| `alert()`/`confirm()` bawaan browser. | ✅ Koreksi angka: ternyata hanya ada **1** `alert()` (diganti toast) dan **106** `confirm()`. Semua `confirm()` diganti `confirmDialog()`, dialog bergaya aplikasi dengan tombol merah untuk aksi hapus. |
| Kebersihan repo. | ✅ 49 dokumen dipindah ke `docs/deployment/` dan `docs/arsip/`; di root tersisa README, CHANGELOG, TODO, serta file milik tool pengembang (`test_result.md`, `plan.md`, `design_guidelines.md`). File hasil salah path Windows, log server, `.blackbox/`, dan `.old` dihapus. File uji manual dipindah ke `tests/manual/`, dan `*.log` ditambahkan ke `.gitignore`. |
| `ENV` vs `ENVIRONMENT`. | ✅ Seeder dan info aplikasi kini membaca `ENVIRONMENT` (dengan `ENV` sebagai cadangan). |
| `backend_test.py` menjawab captcha hitungan otomatis. | ✅ Memakai `TEST_ACCESS_TOKEN`, atau meminta penguji mengetik captcha secara manual. |
| Halaman sangat besar (`ProfilePageEMIS.js` 2.486 baris, dll.). | ⏸️ **Belum dipecah.** Memecah halaman sebesar ini tanpa tes otomatis berisiko merusak form EMIS. Sebaiknya dikerjakan terpisah bersama pembuatan tes. |

### Tampilan
- Captcha: tampilan diperiksa di layar desktop dan HP (390px). Kolom isian yang
  sebelumnya tertekan di HP sudah diperbaiki.
- Koreksi: semua `<img>` ternyata sudah punya `alt`. Hitungan sebelumnya keliru
  karena atribut `alt` ditulis di baris berikutnya dari tag.

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
7. Login di dua perangkat, lalu ganti password di perangkat pertama. Perangkat
   kedua harus diminta login ulang, sedangkan perangkat pertama tetap masuk.
8. Hapus data apa saja (misalnya Mata Pelajaran). Dialog konfirmasi bergaya
   aplikasi harus muncul, bukan dialog bawaan browser.
9. Uji **Lupa Password** lewat email. Link reset harus tetap valid walau server
   di-restart (berlaku 30 menit).
