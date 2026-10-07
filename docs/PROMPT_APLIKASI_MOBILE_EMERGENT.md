# Prompt & Panduan Aplikasi Mobile (Gratis) — Super Apps MATSANDATAMA

Dokumen ini berisi:

- **Bagian A** — keputusan teknis & alasannya (baca dulu).
- **Bagian B** — **PROMPT LENGKAP** untuk ditempel ke Emergent (emergent.sh).
- **Bagian C** — perubahan backend yang diperlukan (dikerjakan di repo ini, bukan di Emergent).
- **Bagian D** — penyiapan Firebase (gratis) untuk notifikasi Android.
- **Bagian E** — build & distribusi gratis (APK Android) dan iPhone lewat web app (PWA).
- **Bagian F** — daftar uji sebelum dibagikan ke guru.

Web aplikasi: **https://super.mtsn2kotamalang.sch.id** — API: **https://api.super.mtsn2kotamalang.sch.id/api**
(cek: https://api.super.mtsn2kotamalang.sch.id/api/health → `{"status":"healthy"}`)

**Semua jalur di dokumen ini GRATIS:** Android dibagikan sebagai file APK (tanpa Play Store), iPhone memakai
web app (PWA) yang sudah ada (tanpa akun Apple berbayar), Firebase paket Spark, Expo paket gratis.

> Dokumen ini menggantikan asumsi di `docs/MOBILE_APP_EXPO_SETUP.md` bahwa backend tidak perlu diubah.
> Tambahan backend untuk offline yang akurat & notifikasi native **sudah tersedia** (Bagian C, `backend/routers/mobile.py`).

---

## A. Keputusan teknis (ringkas)

| Kebutuhan | Pilihan | Alasan |
|---|---|---|
| Kerangka aplikasi | **Expo (React Native) + EAS Build**, target **Android (APK)** | Emergent membangun aplikasi mobile dengan Expo; APK bisa dibagikan langsung tanpa Play Store. |
| iPhone | **Web app (PWA)** https://super.mtsn2kotamalang.sch.id dipasang ke Layar Utama | Aplikasi iPhone native wajib akun Apple berbayar; PWA gratis dan mendukung notifikasi (iOS 16.4+). |
| Notifikasi saat online (pengumuman, penugasan guru pengganti, dll.) | Android: **Expo Push Service** → FCM. iPhone (PWA): **Web Push** yang sudah ada | Gratis; backend mengirim ke keduanya otomatis. |
| Pengingat mengajar saat **offline** | **Notifikasi lokal terjadwal di HP** (`expo-notifications`) dari jadwal yang tersimpan | Tetap berbunyi walau HP tanpa internet; tidak bergantung server. |
| Data terakhir saat offline | **SQLite lokal** (`expo-sqlite`) + label "Terakhir diperbarui …" | Bisa membaca jadwal, jurnal, pengumuman terakhir tanpa internet. |
| Keamanan data di HP | Token di **SecureStore** (Keychain/Keystore), kunci aplikasi **biometrik/PIN**, hapus semua data saat logout | Token & data siswa tidak bisa dibaca aplikasi lain. |
| Jurnal offline yang akurat | **Izin offline bertanda tangan server** + jam monoton HP (Bagian C) | QR dinamis kedaluwarsa ±1 menit dan validasi jadwal memakai waktu sinkron — tanpa izin offline, jurnal yang disinkron setelah jam pelajaran usai akan ditolak. |
| Firebase | **Hanya Cloud Messaging, paket Spark (gratis)** | Tidak perlu Firestore/Functions/Hosting. FCM gratis tanpa batas pesan. |

**Yang sengaja TIDAK dipakai (berbayar):** Google Play Console (USD 25) dan Apple Developer Program (USD 99/tahun).

Konsekuensi yang perlu diketahui guru:

- **Android**: aplikasi dipasang dari file APK; HP perlu mengizinkan *Instal aplikasi tidak dikenal* sekali saja.
  Pembaruan aplikasi = unduh APK versi baru; admin mengumumkannya lewat menu Pengumuman (otomatis jadi notifikasi).
- **iPhone**: memakai web app (PWA). Notifikasi pengumuman, guru pengganti, dan pengingat mengajar tetap datang
  saat **online** (Web Push dari server). Yang tidak tersedia di iPhone: pengingat yang berbunyi saat **offline**
  dan antrean jurnal offline seandal aplikasi Android — guru iPhone sebaiknya mengisi jurnal saat ada sinyal/Wi-Fi madrasah.
- **Expo/EAS** paket gratis: kuota build bulanan terbatas & antre lebih lama — cukup untuk rilis sesekali.

---

## B. PROMPT UNTUK EMERGENT

Salin seluruh isi kotak di bawah ke Emergent. Endpoint di bagian 9 prompt sudah tersedia di backend.

````text
Buatkan aplikasi mobile ANDROID bernama "Super Apps MATSANDATAMA" untuk MTsN 2 Kota Malang,
menggunakan Expo (React Native, TypeScript, Expo Router) dan siap dibangun dengan EAS Build menjadi
file APK yang dibagikan langsung (TIDAK lewat Play Store; tidak perlu build iOS — pengguna iPhone
memakai web app). Jangan memakai layanan berbayar apa pun.
Aplikasi ini adalah klien untuk backend yang SUDAH ADA (FastAPI). JANGAN membuat backend baru,
database sendiri, atau logika bisnis tiruan. Semua data berasal dari REST API di bawah.

=== 1. KONFIGURASI DASAR ===
- API base URL: https://api.super.mtsn2kotamalang.sch.id/api  (simpan di app.config / EXPO_PUBLIC_API_URL)
  Cek koneksi: GET /health → { status: "healthy", time_wib }.
- Tautan "Buka versi web": https://super.mtsn2kotamalang.sch.id
- Bahasa antarmuka: Bahasa Indonesia. Zona waktu acuan: WIB (Asia/Jakarta) untuk semua tampilan tanggal/jam.
- Warna utama #006837 (hijau Kemenag), aksen #0B7A3B, latar terang; dukung mode gelap.
- Android package: id.sch.mtsn2kotamalang.superapps
- Tampilkan versi aplikasi (app.json version) di halaman Profil. Pembaruan APK diumumkan admin lewat
  Pengumuman (berisi tautan unduh APK); jadikan tautan di isi pengumuman bisa diketuk.
- Autentikasi: header "Authorization: Bearer <access_token>" di setiap request.
- Semua request dengan timeout 15 detik; tampilkan pesan error dari field "detail" respons API bila ada.

=== 2. LOGIN & SESI ===
- GET /auth/captcha → tampilkan gambar captcha; POST /auth/login dengan
  { username, password, captcha_id, captcha_answer, remember } → { access_token, user, active_role,
  expires_in_minutes, idle_timeout_minutes }.
- Simpan access_token HANYA di expo-secure-store (bukan AsyncStorage). Simpan expiry token.
- GET /auth/me untuk profil; POST /auth/switch-role { role } bila user punya lebih dari satu peran
  (user.roles); POST /auth/logout saat keluar.
- Kunci aplikasi: setelah aplikasi tidak aktif > idle_timeout_minutes, minta biometrik/PIN perangkat
  (expo-local-authentication) sebelum menampilkan data — berlaku juga saat offline.
- Saat logout: hapus token, hapus SEMUA data cache SQLite & antrean milik user itu, batalkan semua
  notifikasi lokal terjadwal, dan panggil DELETE /mobile/devices/{device_id} (lihat bagian 7).
- Jika API mengembalikan 401: jangan hapus antrean jurnal offline; minta login ulang, lalu lanjutkan sinkron.

=== 3. MENU SESUAI PERAN (navigasi bawah + menu lain) ===
Guru mapel (guru, guru_ipa, guru_ips, guru_bahasa, guru_seni, guru_agama, guru_tik):
  Beranda (jadwal hari ini), Scan & Isi Jurnal, Riwayat Jurnal, Pengumuman/Notifikasi, Profil.
Guru piket: Tugas Piket Hari Ini, Guru Pengganti (penugasan), Riwayat Jurnal Piket, Pengumuman.
Admin & Waka Kurikulum: Guru Pengganti (daftar, tugaskan, kalender), Data Jurnal, Pengumuman.
Wali kelas: Jadwal kelas, Jurnal kelas, Pengumuman.
Siswa: Jadwal, Pengumuman (read-only).
Menu Guru Pengganti HANYA tampil bila GET /guru-pengganti/config → can_manage = true.

=== 4. JADWAL HARI INI & GURU PENGGANTI ===
- GET /schedules/my-today?include_substitute=true → daftar slot hari ini (start_time, end_time,
  class_name, subject_name, room_name, journal_filled, journal_id).
  * Item dengan is_substitute = true adalah slot di mana user menjadi GURU PENGGANTI: tampilkan badge
    kuning "Guru Pengganti" + "Menggantikan {original_teacher_name}" dan tombol "Isi Jurnal".
  * Item reguler dengan field substitute != null berarti slot user sedang DIGANTIKAN: tampilkan
    "Digantikan {substitute.substitute_teacher_name}" dan tombol "Isi Jurnal Saya" (tanpa QR).
- GET /schedules?teacher_id={user.id} dan GET /schedules/grouped?teacher_id={user.id} → jadwal mingguan.
- Isi jurnal guru pengganti: GET /students?class_id=... lalu POST /guru-pengganti/journals
  { assignment_id, materi, catatan, attendance_records:[{student_id, student_name, status}] },
  status ∈ hadir|sakit|izin|alpha.
- Isi jurnal guru asli saat digantikan: POST /guru-pengganti/journals/original
  { assignment_id: item.substitute.assignment_id, materi, catatan }.
- Jurnal berdampingan: GET /guru-pengganti/assignments/{id}/journals.
- Untuk petugas (can_manage): GET /guru-pengganti/assignments, DELETE /guru-pengganti/assignments/{id},
  alur tugaskan 5 langkah: GET /guru-pengganti/teachers → GET /guru-pengganti/teachers/{id}/slots →
  GET /guru-pengganti/slots/{schedule_id}/dates?month=YYYY-MM (kalender sebulan, multi-pilih hanya
  tanggal selectable=true, tampilkan "reason" bila tidak) → GET /guru-pengganti/substitute-candidates
  ?schedule_id=..&dates=a,b (tampilkan "Tidak tersedia" + alasan untuk available=false) →
  POST /guru-pengganti/assignments { schedule_id, dates, substitute_teacher_id, reason }.

=== 5. SCAN QR & ISI JURNAL (ONLINE) ===
- Pindai QR ruangan dengan expo-camera (barcode). Kirim isi QR APA ADANYA sebagai qr_token
  (jangan di-decode; isinya terenkripsi server).
- Ambil lokasi (expo-location, akurasi tinggi) → user_lat, user_lon.
- POST /jurnal/validate { qr_token, user_lat, user_lon } → tampilkan hasil validasi (jadwal, ruang, GPS).
- POST /jurnal { qr_token, user_lat, user_lon, materi, catatan, indikator_id?, materi_id?,
  siswa_hadir, siswa_tidak_hadir, siswa_izin, siswa_sakit, attendance_details[] }.
- Alternatif token kelas: POST /jurnal/validate-by-class-token dan POST /jurnal/by-class-token.
- Riwayat: GET /jurnal/my (tampilkan kolom "Diisi oleh" dari field diisi_oleh; catatan berpasangan
  pair_position first/second ditampilkan berurutan dengan penanda "berdampingan").

=== 6. MODE OFFLINE (WAJIB AKURAT & AMAN) ===
6a. Penyimpanan lokal
- Gunakan expo-sqlite. Tabel: cache (key, json, updated_at, user_id) dan journal_queue.
- Setiap respons GET penting disimpan ke cache: my-today, jadwal mingguan, /jurnal/my (50 terakhir),
  /announcements, /notifications, daftar siswa per kelas yang diajar, izin offline (6c).
- Saat offline tampilkan data cache + banner "Mode offline — data terakhir diperbarui {waktu WIB}".
  Jangan pernah menampilkan cache milik user lain (selalu filter user_id).
- Cache dihapus saat logout dan dibatasi usia 14 hari.
- Deteksi koneksi dengan @react-native-community/netinfo + ping GET /health.

6b. Antrean jurnal offline
- Jika offline saat isi jurnal: simpan ke journal_queue dengan id unik (uuid), payload lengkap,
  isi QR yang dipindai, lokasi, dan bukti waktu (6c). Status: pending → syncing → synced | failed.
- Sinkron otomatis saat online kembali (NetInfo), saat aplikasi dibuka, dan via expo-background-fetch
  (interval minimal 15 menit). Satu item diproses sekali (kunci per item), retry dengan backoff
  (1, 5, 15, 60 menit), maksimal 10 kali.
- Kirim ke POST /mobile/journals/offline (lihat kontrak di bagian 9). Respons 409 (detail.error_type
  "duplicate") = anggap synced. Respons 400 = failed permanen (error jaringan/5xx tetap di-retry);
  tampilkan detail.message dan tombol "Hubungi admin".
- Tampilkan halaman "Antrean Jurnal" berisi status tiap item dan tombol "Sinkronkan sekarang".
- Jangan izinkan edit item yang sedang syncing; jangan hapus item failed tanpa konfirmasi.

6c. Bukti waktu yang tidak bisa dimanipulasi (penting)
- Saat online, panggil GET /mobile/offline-permits?date=YYYY-MM-DD untuk hari ini sampai 7 hari ke depan
  (server menerima kemarin s.d. +7 hari) → daftar izin bertanda tangan server per slot jadwal user,
  berisi server_time. Perbarui setiap kali online dan setiap jadwal/penugasan berubah. Simpan bersama nilai jam monoton
  perangkat saat itu (elapsed realtime sejak boot; gunakan modul native ringan atau
  expo-modules dengan SystemClock.elapsedRealtime/ProcessInfo.systemUptime).
- Saat mengisi jurnal offline, hitung waktu tepercaya = server_time_terakhir + (monoton_sekarang −
  monoton_saat_sinkron). Jika perangkat sudah reboot (monoton lebih kecil), tandai
  "clock_unverified": true dan tetap simpan — server yang memutuskan.
- Kirim bersama payload: permit (string), captured_server_estimate, device_wall_clock,
  monotonic_elapsed_ms, clock_unverified, qr_token hasil pindai, lokasi + akurasi + waktu GPS.
- QR wajib dipindai untuk jadwal sendiri; untuk slot guru pengganti (is_substitute) QR opsional.
  Untuk QR dinamis, server memakai waktu terbit QR sebagai bukti waktu (paling akurat).
- Tolak di sisi aplikasi pengisian offline bila tidak ada izin untuk slot itu (tampilkan
  "Buka aplikasi saat online minimal sekali hari ini agar bisa mengisi jurnal offline").

=== 7. NOTIFIKASI ===
7a. Registrasi push (online)
- Pakai expo-notifications. Minta izin notifikasi saat onboarding dengan penjelasan manfaatnya.
- Android: buat channel "pengingat-mengajar" (importance HIGH, suara + getar), "pengumuman"
  (DEFAULT), "guru-pengganti" (HIGH), "sinkron" (LOW).
- Ambil Expo push token (getExpoPushTokenAsync dengan projectId EAS) lalu POST /mobile/devices
  { device_id (uuid tersimpan di SecureStore), expo_push_token, platform, app_version,
  local_reminders: true }. Ulangi saat token berubah, saat login, dan saat switch role.
- Halaman "Tentang & Diagnostik" (dari Profil): versi aplikasi, status izin notifikasi, Expo push token
  (bisa disalin), status koneksi ke API (GET /health), jumlah antrean jurnal, dan waktu sinkron terakhir.
- Tombol "Buka pengaturan baterai" yang mengarahkan pengguna menonaktifkan optimasi baterai untuk aplikasi
  (agar pengingat tepat waktu di HP Xiaomi/Oppo/Vivo/Realme).

7b. Pengingat mengajar yang tetap jalan saat OFFLINE (notifikasi lokal)
- Dari jadwal mingguan + slot guru pengganti yang tersimpan, jadwalkan notifikasi lokal untuk
  7 hari ke depan: 10 menit sebelum mulai dan tepat saat mulai (menit bisa diatur di Pengaturan:
  5/10/15). Lewati hari libur (GET /guru-pengganti/period → holidays, simpan di cache).
- Isi notifikasi harus jelas, contoh:
  Judul: "⏰ 10 menit lagi mengajar — VIII C"
  Isi:   "Akidah Akhlak · Jam ke-3–4 (08:30–09:40) · Ruang R. 8C. Ketuk untuk scan QR & isi jurnal."
  Untuk slot pengganti: "⏰ 10 menit lagi menggantikan Bu Siti — VIII C …".
  Saat mulai: "🔔 Saatnya mengajar — VIII C (08:30)".
- Identifier notifikasi = "{schedule_id}-{tanggal}-{menit}" agar tidak ganda; jadwalkan ulang setiap
  kali jadwal berubah/aplikasi dibuka/background fetch; batalkan semua saat logout.
- Ketuk notifikasi → buka langsung layar Scan QR / Isi Jurnal slot tersebut.
- Pengingat jurnal belum diisi: 15 menit setelah slot selesai jika journal_filled masih false di cache:
  "📝 Jurnal VIII C belum diisi — isi sekarang agar tidak terlewat".

7c. Notifikasi dari server (push, saat online)
- Payload data berisi { type, ... }. Tangani:
  type "announcement" → buka detail pengumuman (GET /announcements, tandai baca:
    POST /notifications/announcement/{id}/read).
  type "substitute_assignment" → buka jadwal hari itu / detail penugasan.
  type "teaching_reminder" → abaikan bila notifikasi lokal dengan identifier sama sudah terjadwal.
  type lain → buka layar Notifikasi (GET /notifications, GET /notifications/unread-count,
    POST /notifications/mark-all-read).
- Tampilkan badge jumlah belum dibaca di ikon tab Notifikasi dan ikon aplikasi.
- Notifikasi yang datang saat aplikasi dibuka tampil sebagai banner dalam aplikasi.
- Notifikasi lokal "Sinkron berhasil: 2 jurnal terkirim" / "Sinkron gagal: …" di channel "sinkron".

=== 8. KEAMANAN ===
- Wajib HTTPS; tolak sertifikat tidak valid; tidak ada log token/data siswa di console produksi.
- Data siswa hanya untuk kelas yang diajar user; cache dibersihkan saat logout/ganti user.
- Tidak ada screenshot di layar data siswa (expo-screen-capture preventScreenCaptureAsync) — opsional.
- Jangan menyimpan password. Jangan menampilkan menu yang tidak diizinkan peran.

=== 9. KONTRAK ENDPOINT KHUSUS MOBILE (sudah tersedia di backend) ===
POST   /mobile/devices            { device_id (8-100 karakter), expo_push_token ("ExponentPushToken[...]"),
       platform: "android"|"ios", app_version, local_reminders: true } → { ok, device_id }
DELETE /mobile/devices/{device_id} → { ok, removed }
GET    /mobile/offline-permits?date=YYYY-MM-DD
       → { server_time, date, holiday (nama libur atau null), permits:[{ schedule_id, date, start_time,
           end_time, class_id, class_name, subject_name, room_id, room_name, is_substitute,
           assignment_id, original_teacher_name, valid_until, permit }] }
POST   /mobile/journals/offline   { client_id (uuid antrean, 8-64 karakter), permit, qr_token?, user_lat?,
       user_lon?, location_accuracy?, location_time?, captured_server_estimate (ISO 8601 dengan zona),
       device_wall_clock?, monotonic_elapsed_ms?, clock_unverified, materi, catatan?, indikator_id?,
       materi_id?, attendance_details:[{ student_id, student_name, status: hadir|sakit|izin|alpha }] }
       -> 200 jurnal tersimpan
       -> 409 { detail: { error_type: "duplicate", message } }  (anggap sukses)
       -> 400 { detail: { error_type, message } } dengan error_type salah satu:
          invalid_permit, deadline_passed, schedule_changed, qr_required, qr_invalid,
          gps_invalid, outside_schedule, clock_mismatch
Notifikasi push dari server membawa data.type: "announcement" (announcement_id),
"substitute_assignment" (schedule_id, dates), "substitute_assignment_cancelled" (assignment_id, date),
"teaching_reminder" (hanya dikirim ke perangkat dengan local_reminders=false).
Channel Android yang dipakai server: "pengumuman", "guru-pengganti", "pengingat-mengajar".

=== 10. KUALITAS ===
- Layar memuat, kosong, dan error di setiap halaman; tarik-untuk-segarkan.
- Ukuran teks mengikuti pengaturan aksesibilitas HP; target sentuh minimal 44px.
- Berjalan baik di Android 8+ (HP guru beragam, termasuk spesifikasi rendah); ukuran APK sekecil mungkin.
- Sertakan README: cara set EXPO_PUBLIC_API_URL, eas.json dengan profil "preview" dan "production"
  yang keduanya menghasilkan APK (android.buildType = "apk"), dan langkah memasukkan kredensial FCM ke EAS.
- Hanya izin Android yang benar-benar dipakai: kamera, lokasi, notifikasi, biometrik, jaringan.
````

---

## C. Perubahan backend (SUDAH DIKERJAKAN di repo ini)

Status: tersedia di `backend/routers/mobile.py`, diuji `tests/test_mobile.py`. Variabel lingkungan baru (opsional):

| Variabel | Default | Fungsi |
|---|---|---|
| `EXPO_PUSH_ENABLED` | `1` | Set `0` untuk mematikan pengiriman Expo Push (mis. di server uji). |
| `EXPO_ACCESS_TOKEN` | kosong | Isi bila "Enhanced Security for Push Notifications" diaktifkan di expo.dev. |

Rincian implementasi:

1. **Registrasi perangkat** — koleksi `mobile_devices` (`user_id`, `device_id`, `expo_push_token`,
   `platform`, `app_version`, `local_reminders`, `updated_at`), endpoint `POST/DELETE /mobile/devices`.
2. **Pengirim Expo Push** — fungsi `send_expo_push_to_users` / `send_expo_push_to_roles` yang memanggil
   `https://exp.host/--/api/v2/push/send` (batch maks 100, buang token `DeviceNotRegistered`).
   Dipanggil berdampingan dengan Web Push yang sudah ada pada:
   - pengumuman baru (`routers/notifications.py`, saat `send_push_to_roles`);
   - Web Push untuk PWA (dipakai iPhone) **diperbaiki** ke enkripsi standar `aes128gcm` (RFC 8291) dan header
     VAPID standar (RFC 8292). Sebelumnya memakai skema lama `aesgcm` tanpa header `Encryption`, sehingga
     ditolak layanan push ("Missing Encryption header") dan tidak pernah bisa sampai ke iPhone;
   - penugasan guru pengganti baru/dibatalkan (`routers/guru_pengganti.py`) ke guru pengganti & guru asli;
   - pengingat mengajar (`teaching_reminder_scheduler.py`) — **dilewati** untuk perangkat dengan
     `local_reminders = true` agar tidak dobel.
3. **Izin offline** — `GET /mobile/offline-permits`: untuk tiap slot user (jadwal reguler + slot pengganti)
   pada tanggal tsb. (kemarin s.d. +7 hari; hari libur akademik tanpa izin jadwal reguler), buat token
   bertanda tangan (JWT HS256 dengan kunci turunan JWT_SECRET, tidak bisa dipakai sebagai token login)
   berisi `uid, sid, date, rid, st, et, is_sub, aid, exp` — berlaku sampai H+1 setelah slot selesai + 30 menit.
4. **Simpan jurnal offline** — `POST /mobile/journals/offline`:
   - verifikasi tanda tangan izin, kepemilikan user, belum kedaluwarsa;
   - dekripsi `qr_token` tanpa cek kedaluwarsa dan pastikan **ruang di QR = ruang pada izin**; untuk QR
     dinamis, kode TOTP diverifikasi terhadap `issued_at` QR dan `issued_at` dipakai sebagai waktu isi;
   - waktu isi (`captured_server_estimate`, atau `issued_at` QR dinamis) harus di jam slot ± toleransi
     (`grace_minutes` pengaturan) dan tidak di masa depan; `clock_unverified` diterima tetapi ditandai
     `offline_submission.needs_verification` untuk diperiksa admin;
   - cek jarak GPS seperti validasi sekarang;
   - idempoten per `client_id` (index unik) → 409 bila sudah ada;
   - jurnal disimpan dengan `started_at` = estimasi waktu tepercaya, `offline_submission` berisi metadata
     bukti, `fill_mode` sesuai (self / substitute).
5. **Tes**: `tests/test_mobile.py` (izin, waktu, QR, Expo Push) + uji end-to-end ke MongoDB lokal.

---

## D. Penyiapan Firebase (gratis, paket Spark) — untuk notifikasi Android

> Panduan langkah demi langkah yang lebih lengkap (Firebase + Expo + build APK + uji + masalah umum):
> **`docs/PANDUAN_SETUP_FIREBASE_EXPO.md`**.

Firebase hanya dipakai sebagai jalur pengiriman notifikasi Android (FCM). Tidak perlu Firestore, Functions,
Hosting, atau kartu kredit.

1. Buka https://console.firebase.google.com → **Add project** → nama `super-apps-matsandatama`.
   Google Analytics boleh dimatikan. Paket otomatis **Spark (gratis)** — jangan upgrade ke Blaze.
2. **Project settings → General → Your apps → Add app → Android**:
   - Android package name: `id.sch.mtsn2kotamalang.superapps` (harus sama dengan di prompt/`app.json`).
   - Unduh **`google-services.json`** → serahkan ke Emergent/letakkan di root proyek Expo dan isi
     `android.googleServicesFile: "./google-services.json"` di `app.json`.
3. **Project settings → Cloud Messaging**: pastikan **Firebase Cloud Messaging API (V1)** berstatus *Enabled*.
4. **Project settings → Service accounts → Generate new private key** → unduh file JSON.
   Simpan aman (jangan di-commit ke Git, jangan dibagikan).
5. Masukkan kunci itu ke Expo: di folder proyek mobile jalankan `eas credentials` → Android →
   *Google Service Account Key for Push Notifications (FCM V1)* → unggah file JSON dari langkah 4.
   (Atau via expo.dev → Project → Credentials.)
6. Selesai. Backend **tidak** perlu kunci Firebase: backend mengirim ke Expo Push, Expo yang meneruskan ke FCM.

Batasan paket gratis yang relevan: FCM gratis tanpa batas jumlah pesan. Expo Push juga gratis
(batas laju ±600 notifikasi/detik per proyek — jauh di atas kebutuhan madrasah).

---

## E. Build & distribusi gratis

**Akun yang dibutuhkan (gratis):** Firebase (Bagian D) dan **Expo** di https://expo.dev.

**Build APK Android (gratis, di server Expo)**

```bash
npm i -g eas-cli
eas login
eas init                                     # hubungkan proyek ke akun Expo
eas build -p android --profile preview      # hasil: tautan unduh file .apk
```

`eas.json` minimal:

```json
{
  "build": {
    "preview":    { "android": { "buildType": "apk" }, "distribution": "internal" },
    "production": { "android": { "buildType": "apk" } }
  }
}
```

**Membagikan APK ke guru (gratis)**

1. Unggah APK ke **GitHub Releases** repo ini (lihat `docs/deployment/SETUP_GITHUB_RELEASES.md`) atau Google Drive
   madrasah, lalu bagikan tautannya di grup guru.
2. Di HP: buka tautan → unduh → izinkan *Instal aplikasi tidak dikenal* untuk browser/File Manager → pasang.
3. Versi baru: naikkan `version` & `android.versionCode` di `app.json`, build ulang, unggah APK baru, lalu
   terbitkan **Pengumuman** berisi tautan unduhnya (guru menerima notifikasi).
   APK harus ditandatangani dengan **keystore yang sama** (EAS menyimpannya otomatis — jangan dihapus), agar
   bisa dipasang menimpa versi lama tanpa menghapus data.

**iPhone — pakai web app (PWA), gratis**

1. Buka https://super.mtsn2kotamalang.sch.id di **Safari** (bukan Chrome).
2. Ketuk **Bagikan** → **Tambahkan ke Layar Utama** → **Tambah**.
3. Buka aplikasi dari ikon di Layar Utama, login, lalu ketuk **Aktifkan Notifikasi** dan pilih **Izinkan**.
   (Notifikasi hanya bisa diaktifkan dari ikon Layar Utama, bukan dari tab Safari biasa; perlu iOS/iPadOS 16.4+.)

**Konfigurasi server (sekali saja)**

- API `https://api.super.mtsn2kotamalang.sch.id/api` sudah dapat diakses publik dengan SSL (health: healthy).
- Pastikan `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, dan `VAPID_SUBJECT` (mis. `mailto:admin@mtsn2kotamalang.sch.id`)
  terisi di server — dipakai notifikasi web/iPhone.
- Penjadwal pengingat (`teaching_reminder_scheduler.py`) tetap aktif: iPhone/web menerima pengingat dari server,
  Android memakai pengingat lokal (server tidak mengirim dobel).
- Perbarui **semester aktif** di menu Semester agar izin offline & penugasan tanggal mendatang berlaku.

---

## F. Daftar uji sebelum dibagikan

**Offline**

- [ ] Buka aplikasi online → matikan data → jadwal, riwayat jurnal, pengumuman terakhir tetap tampil dengan label waktu.
- [ ] Isi jurnal offline di kelas (scan QR) → antrean "pending" → nyalakan data → otomatis terkirim, tercatat sesuai jam mengajar (bukan jam sinkron).
- [ ] Sinkron setelah jam pelajaran usai (mis. sore hari) → tetap diterima.
- [ ] Ubah jam HP secara manual lalu isi jurnal offline → server menolak/menandai perlu verifikasi.
- [ ] Kirim item antrean yang sama dua kali (matikan data di tengah sinkron) → tidak ada jurnal ganda.
- [ ] Logout → data cache & antrean user hilang; login user lain tidak melihat data user sebelumnya.

**Notifikasi**

- [ ] Mode pesawat → pengingat "10 menit lagi mengajar — {kelas}" tetap muncul tepat waktu.
- [ ] Ketuk pengingat → langsung ke layar scan/isi jurnal slot itu.
- [ ] Admin menerbitkan pengumuman → notifikasi muncul di aplikasi Android dan di iPhone (PWA dari Layar Utama) saat online; badge bertambah.
- [ ] iPhone (PWA): 10 menit sebelum mengajar, notifikasi pengingat dari server muncul saat online.
- [ ] Admin menugaskan guru pengganti → guru pengganti menerima notifikasi; slot muncul di jadwal hari itu dengan badge.
- [ ] Tidak ada pengingat ganda (lokal + server) untuk slot yang sama.
- [ ] Hari libur akademik → tidak ada pengingat.

**Keamanan**

- [ ] Token tidak ada di AsyncStorage/log; aplikasi terkunci biometrik setelah tidak aktif.
- [ ] APK versi baru bisa dipasang menimpa versi lama tanpa kehilangan antrean jurnal.
- [ ] Guru mapel tidak melihat menu Guru Pengganti; endpoint ditolak 403 bila dipanggil paksa.
