# Keamanan & Password

## Kebijakan Password Super Apps MATSANDATAMA

Semua pengguna **disarankan** (bukan dipaksa) mengubah password secara berkala demi keamanan. Sistem akan **mengingatkan** Anda, tapi Anda boleh menundanya kapanpun.

## 1. Login Pertama

Setelah login pertama dengan password yang diberikan admin, sistem akan **otomatis menampilkan popup**:

> "Selamat datang! Demi keamanan akun Anda, kami sangat menyarankan untuk mengubah password default. Anda boleh mengubahnya sekarang atau menundanya 30 hari."

Anda punya 2 pilihan:
- **"Ubah Password Sekarang"** → form ganti password muncul (perlu masukkan password lama + 2x password baru).
- **"Nanti Saja (Tunda 30 hari)"** → popup tidak muncul lagi selama 30 hari.

Popup ini juga bisa diakses kapan saja dari menu **Profil → Ubah Password**.

## 2. Pengingat Berkala (Setiap 6 Bulan)

Setelah Anda berhasil mengubah password, sistem akan mengingatkan kembali **6 bulan kemudian**:

> "Sudah lebih dari 6 bulan sejak Anda terakhir mengubah password. Demi keamanan akun, mohon perbarui password Anda."

Sekali lagi, Anda boleh:
- Ubah sekarang
- Tunda 30 hari

Kebijakan ini menyeimbangkan **keamanan** (rotasi password berkala) dengan **kenyamanan** (tidak memaksa).

## 3. Persyaratan Password Baru

- Minimal **6 karakter**.
- Hindari informasi pribadi (tanggal lahir, nama, NISN).
- **Tidak boleh sama** dengan password lama.
- Disarankan: kombinasi huruf besar + huruf kecil + angka + simbol.

### Contoh Password Bagus
- `Garam!2026` — mudah diingat, ada huruf besar/kecil, angka, simbol
- `Mts@nMlg_25` — unik, panjang
- `Hujan9-Sore` — kombinasi natural

### Contoh Password Buruk (HINDARI)
- `123456`, `password`, `qwerty`
- `Ahmad2010` (mengandung nama + tahun lahir)
- `siswa123` (terlalu generik)
- Tanggal lahir Anda dalam format apapun

## 4. Lupa Password

### Self-Service via Email (jika SMTP sudah disetup)
1. Di halaman login, klik **Lupa Password?**.
2. Masukkan username atau email Anda.
3. Cek inbox email — ada link reset password (berlaku **1 jam**).
4. Klik link — buat password baru.
5. Login dengan password baru.

### Reset Manual oleh Admin
Jika email tidak datang atau email belum terdaftar:
1. Hubungi admin sekolah.
2. Admin akan reset password Anda secara manual.
3. Anda dapat password sementara — segera ubah di login pertama.

## 5. Notifikasi Keamanan

Klik ikon 🔔 di kanan atas untuk melihat notifikasi terkait keamanan:
- Saran ubah password (info atau peringatan)
- Aktivitas mencurigakan (jika terdeteksi)
- Pengumuman keamanan dari admin

## 6. Auto-Logout

Sistem akan **otomatis logout** Anda setelah **30 menit tidak aktif** (idle timeout). Ini melindungi akun Anda di komputer bersama (lab komputer, perpustakaan, dll).

Anda akan dialihkan ke halaman login. Login lagi untuk lanjut bekerja.

## 7. Captcha Login

Setiap login wajib menjawab **captcha matematika sederhana** (mis. "Berapa 14 + 3 = ?"). Ini mencegah bot mencoba password.

Jika captcha gagal:
- Klik ikon refresh untuk captcha baru.
- Pastikan jawaban Anda dalam format angka.

## 8. Lockout Otomatis

Setelah **5 kali percobaan login gagal**, akun Anda akan **terkunci sementara selama 15 menit**. Setelah itu otomatis terbuka kembali.

Jika Anda lupa password, gunakan fitur Lupa Password — jangan terus mencoba.

## 9. Audit Trail

Semua aktivitas login & perubahan password dicatat di **Log Keamanan** (akses: admin).

Jika Anda mencurigai akun Anda diakses orang lain:
1. **Ubah password sekarang juga**.
2. Laporkan ke admin untuk dicek Log Keamanan.
3. Admin akan investigasi & mengambil tindakan jika perlu.

## 10. Tips Praktis Keamanan

- **JANGAN** share password ke siapapun — termasuk admin atau guru. Admin tidak pernah meminta password Anda.
- **JANGAN** simpan password di tempat yang mudah terlihat (sticky note di meja, dll).
- Gunakan **password manager** (Bitwarden gratis, 1Password, atau built-in browser) untuk menyimpan password yang kuat & berbeda di tiap akun.
- Selalu **logout manual** setelah selesai — terutama di komputer bersama.
- **Verifikasi URL** sebelum login: pastikan domain dengan benar (jangan login di link mencurigakan).
- Update browser & antivirus Anda secara berkala.

Dengan kebijakan ini, akun Anda lebih aman tanpa mengorbankan kenyamanan operasional sehari-hari.
