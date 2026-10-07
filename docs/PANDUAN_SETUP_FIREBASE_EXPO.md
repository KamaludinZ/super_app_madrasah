# Panduan Setup Firebase & Expo (Gratis) — Aplikasi Android Super Apps MATSANDATAMA

Panduan ini menyiapkan **notifikasi HP Android** dan **build APK** untuk aplikasi mobile yang dibuat di Emergent
(lihat `docs/PROMPT_APLIKASI_MOBILE_EMERGENT.md`). Semua langkah **gratis**: Firebase paket Spark + Expo paket Free.
Tidak memakai Play Store maupun akun Apple.

**Cara kerja singkat**

```
Server (api.super.mtsn2kotamalang.sch.id)
   │  kirim notifikasi (pengumuman, guru pengganti, pengingat)
   ▼
Expo Push Service (gratis) ──► Firebase Cloud Messaging (gratis) ──► HP Android guru
```

Server **tidak** menyimpan kunci Firebase. Kunci Firebase hanya disimpan di akun Expo.

**Data yang harus SAMA di semua tempat**

| Nama | Nilai |
|---|---|
| Android package | `id.sch.mtsn2kotamalang.superapps` |
| API | `https://api.super.mtsn2kotamalang.sch.id/api` |

**Waktu yang dibutuhkan:** ±45–60 menit (belum termasuk antre build di Expo).

---

## Bagian 0 — Persiapan

1. **Akun Google madrasah** (mis. akun admin TIK). Pakai akun lembaga, bukan akun pribadi, agar mudah diwariskan.
2. **Komputer/laptop** (Windows/Mac/Linux) dengan internet stabil.
3. **Node.js versi LTS** (20 atau lebih baru): unduh dari https://nodejs.org → pilih *LTS* → pasang.
   Cek di Terminal/Command Prompt:
   ```bash
   node -v      # contoh: v20.x.x
   npm -v
   ```
4. **Git** (opsional, untuk mengambil kode dari GitHub): https://git-scm.com
5. **Satu HP Android** untuk uji (Android 8 ke atas).

Siapkan juga satu folder aman di komputer, mis. `D:\Rahasia-SuperApps\`, untuk menyimpan file kunci. **Jangan** taruh
folder ini di Google Drive bersama atau di repo GitHub.

---

## Bagian 1 — Firebase (paket Spark, gratis)

### 1.1 Buat proyek

1. Buka https://console.firebase.google.com dan login dengan akun Google madrasah.
2. Klik **Create a project** / **Buat proyek**.
3. Nama proyek: `super-apps-matsandatama` → **Continue**.
4. **Google Analytics**: matikan (tidak diperlukan) → **Create project** → tunggu → **Continue**.
5. Pastikan di kiri bawah tertulis paket **Spark** (gratis). **Jangan** klik *Upgrade* ke Blaze.

### 1.2 Daftarkan aplikasi Android

1. Di halaman proyek, klik ikon **Android** (tulisan *Add app* / *Tambahkan aplikasi*).
   Bila tidak terlihat: klik ⚙️ **Project settings** → tab **General** → bagian **Your apps** → **Add app** → Android.
2. Isi:
   - **Android package name**: `id.sch.mtsn2kotamalang.superapps` *(harus persis sama, huruf kecil semua)*
   - **App nickname**: `Super Apps MATSANDATAMA`
   - **Debug signing certificate SHA-1**: kosongkan (tidak perlu untuk notifikasi)
3. Klik **Register app**.
4. Klik **Download google-services.json** → simpan. File ini nanti dimasukkan ke proyek aplikasi (Bagian 3).
5. Langkah "Add Firebase SDK" dan seterusnya: **lewati** (klik *Next* sampai *Continue to console*) —
   Expo sudah mengurusnya.

> `google-services.json` boleh ikut di kode aplikasi (isinya bukan kunci rahasia server), tetapi tetap jangan
> disebarkan sembarangan.

### 1.3 Pastikan Cloud Messaging (FCM V1) aktif

1. ⚙️ **Project settings** → tab **Cloud Messaging**.
2. Pada **Firebase Cloud Messaging API (V1)** harus tertulis **Enabled** (aktif).
   Bila tertulis *Disabled*: klik menu ⋮ di sebelahnya → **Manage API in Google Cloud Console** → **Enable** →
   kembali ke halaman Firebase dan muat ulang.
3. Bagian *Cloud Messaging API (Legacy)* biarkan saja — tidak dipakai.

### 1.4 Buat kunci akun layanan (service account) — **RAHASIA**

1. ⚙️ **Project settings** → tab **Service accounts**.
2. Klik **Generate new private key** → **Generate key**.
3. File `.json` terunduh (nama seperti `super-apps-matsandatama-firebase-adminsdk-xxxx.json`).
   Pindahkan ke folder aman `D:\Rahasia-SuperApps\`.

> ⚠️ File ini **kunci rahasia**. Jangan di-commit ke GitHub, jangan kirim lewat grup WA, jangan unggah ke Emergent.
> Hanya diunggah ke **Expo** (Bagian 4). Bila bocor: buka Google Cloud Console → IAM → Service Accounts →
> hapus kunci tersebut, lalu buat yang baru.

Firebase selesai. Tidak perlu mengaktifkan Firestore, Authentication, Hosting, atau Functions.

---

## Bagian 2 — Akun Expo (paket Free, gratis)

1. Buka https://expo.dev/signup → daftar dengan email madrasah. Paket **Free** (tidak perlu kartu kredit).
2. (Disarankan) Buat **Organization** agar proyek milik madrasah, bukan perorangan:
   expo.dev → klik nama akun (kiri atas) → **Create organization** → nama mis. `mtsn2kotamalang`.
3. Pasang alat perintah EAS di komputer:
   ```bash
   npm install -g eas-cli
   eas --version
   eas login           # masukkan email/username & password Expo
   eas whoami          # memastikan sudah login
   ```

---

## Bagian 3 — Siapkan kode aplikasi dari Emergent

1. Di Emergent, simpan proyek ke GitHub (fitur **Save to GitHub** / ekspor kode), lalu ambil ke komputer:
   ```bash
   git clone https://github.com/<akun>/<repo-aplikasi-mobile>.git
   cd <repo-aplikasi-mobile>
   npm install
   ```
2. Salin `google-services.json` (dari Bagian 1.2) ke **folder utama proyek** (sejajar `app.json` / `app.config.*`).
3. Buka `app.json` (atau `app.config.ts`) dan pastikan bagian Android berisi:
   ```json
   {
     "expo": {
       "name": "Super Apps MATSANDATAMA",
       "slug": "super-apps-matsandatama",
       "version": "1.0.0",
       "android": {
         "package": "id.sch.mtsn2kotamalang.superapps",
         "versionCode": 1,
         "googleServicesFile": "./google-services.json"
       },
       "plugins": [
         ["expo-notifications", { "color": "#006837" }]
       ]
     }
   }
   ```
   Bila Emergent sudah membuat bagian `plugins` lain, cukup tambahkan `expo-notifications` di dalamnya.
4. Pastikan alamat API di `.env` (atau `app.config`):
   ```
   EXPO_PUBLIC_API_URL=https://api.super.mtsn2kotamalang.sch.id/api
   ```
5. Hubungkan proyek ke Expo (membuat **projectId** yang wajib untuk token notifikasi):
   ```bash
   eas init
   ```
   Pilih akun/organisasi madrasah bila ditanya. Setelah selesai, `app.json` berisi
   `"extra": { "eas": { "projectId": "…" } }` — **jangan dihapus**.
6. Buat/cek file `eas.json` di folder utama:
   ```json
   {
     "cli": { "appVersionSource": "local" },
     "build": {
       "preview": {
         "distribution": "internal",
         "android": { "buildType": "apk" }
       },
       "production": {
         "android": { "buildType": "apk" }
       }
     }
   }
   ```
   Keduanya menghasilkan **APK** (bisa langsung dipasang, tanpa Play Store).

---

## Bagian 4 — Hubungkan kunci Firebase ke Expo

Pilih **salah satu** cara.

**Cara A — lewat website (paling mudah)**

1. Buka https://expo.dev → pilih proyek **super-apps-matsandatama** → menu **Credentials**.
2. Pilih **Android** → klik package `id.sch.mtsn2kotamalang.superapps`
   (bila belum ada, klik **Add Application Identifier** dan isi package tersebut).
3. Pada bagian **FCM V1 service account key** klik **Add a service account key** →
   unggah file `.json` dari Bagian 1.4 → **Save**.

**Cara B — lewat terminal**

```bash
eas credentials
```

Pilih: **Android** → profil **preview** (atau production) →
**Google Service Account** → **Manage your Google Service Account Key for Push Notifications (FCM V1)** →
**Set up a Google Service Account Key for Push Notifications (FCM V1)** → **Upload a new service account key** →
masukkan lokasi file `.json` dari Bagian 1.4.

Kunci cukup diunggah sekali; berlaku untuk semua build berikutnya.

---

## Bagian 5 — Build APK (gratis)

```bash
eas build -p android --profile preview
```

1. Pertanyaan **"Generate a new Android Keystore?"** → jawab **Yes**.
   Keystore (kunci tanda tangan APK) disimpan otomatis di akun Expo.
   > ⚠️ **Jangan pernah menghapus keystore ini.** Tanpanya, APK versi berikutnya tidak bisa dipasang menimpa versi
   > lama (guru harus hapus aplikasi & kehilangan antrean jurnal offline). Cadangkan dengan
   > `eas credentials` → Android → **Download credentials** → simpan di `D:\Rahasia-SuperApps\`.
2. Build berjalan di server Expo (paket gratis bisa antre beberapa menit sampai ±1 jam).
   Pantau di terminal atau di expo.dev → proyek → **Builds**.
3. Setelah selesai, Expo memberi **tautan unduh** dan **QR code** file `.apk`.

---

## Bagian 6 — Pasang & uji di HP

### 6.1 Pasang APK

1. Di HP Android, buka tautan unduh APK (atau pindai QR dari Expo).
2. Saat muncul peringatan, izinkan **Instal aplikasi tidak dikenal** untuk Chrome/File Manager
   (Setelan → Aplikasi → Chrome → *Instal aplikasi tidak dikenal* → izinkan).
3. Pasang → buka → login dengan akun guru.
4. Saat diminta izin **Notifikasi**, pilih **Izinkan** (Android 13+ menanyakan ini).
5. Matikan **penghemat baterai/optimasi baterai** untuk aplikasi ini agar pengingat tepat waktu:
   Setelan → Aplikasi → Super Apps MATSANDATAMA → Baterai → **Tidak dibatasi**.
   (Di HP Xiaomi/Oppo/Vivo/Realme juga aktifkan **Mulai otomatis / Autostart**.)

### 6.2 Uji notifikasi dari Expo (tanpa server)

1. Di aplikasi, buka halaman Profil/Pengaturan → salin **Expo push token**
   (bentuknya `ExponentPushToken[xxxxxxxx]`; minta Emergent menampilkannya di halaman *Tentang/Diagnostik*).
2. Buka https://expo.dev/notifications → tempel token → isi **Title** dan **Body** →
   **Android Channel ID**: `pengumuman` → **Send a Notification**.
3. Notifikasi harus muncul di HP dalam beberapa detik.
   - Tidak muncul? Lihat **Bagian 8 (Masalah umum)**.

### 6.3 Uji notifikasi dari server madrasah

1. Pastikan server sudah ter-deploy versi terbaru (`main` berisi `backend/routers/mobile.py`).
2. Login di aplikasi HP sebagai guru (aplikasi otomatis mendaftarkan perangkat ke `POST /mobile/devices`).
3. Dari web admin, terbitkan **Pengumuman** untuk peran *Guru* → notifikasi "📢 Pengumuman: …" muncul di HP.
4. Tugaskan guru tersebut sebagai **Guru Pengganti** → notifikasi "🧑‍🏫 Tugas Guru Pengganti — {kelas}" muncul.

### 6.4 Uji pengingat offline

1. Pastikan jadwal guru hari ini/besok ada.
2. Buka aplikasi sekali saat online (jadwal & izin offline tersimpan).
3. Aktifkan **mode pesawat** → tunggu sampai 10 menit sebelum jam mengajar → pengingat
   "⏰ 10 menit lagi mengajar — {kelas}" harus tetap muncul.

---

## Bagian 7 — Pengaturan server (sekali saja)

Di server backend (mis. variabel lingkungan di Coolify):

| Variabel | Isi | Keterangan |
|---|---|---|
| `EXPO_PUSH_ENABLED` | `1` | Default sudah `1`; isi `0` hanya untuk mematikan notifikasi HP. |
| `EXPO_ACCESS_TOKEN` | *(kosong)* | Hanya diisi bila di expo.dev Anda mengaktifkan **Enhanced Security for Push Notifications** (Project settings → Push). Bila diaktifkan, buat token di expo.dev → Account settings → **Access tokens** dan isi di sini. |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | *(sudah ada)* | Untuk notifikasi web & iPhone (PWA); `VAPID_SUBJECT` mis. `mailto:admin@mtsn2kotamalang.sch.id`. |

Server tidak butuh file Firebase apa pun.

---

## Bagian 8 — Masalah umum

| Gejala | Penyebab & solusi |
|---|---|
| `eas build` gagal: *google-services.json not found* | File belum disalin ke folder utama atau path `googleServicesFile` salah (harus `./google-services.json`). |
| Build sukses, tapi tidak dapat token push / error *projectId* | `eas init` belum dijalankan atau `extra.eas.projectId` terhapus. Jalankan `eas init`, build ulang. |
| Uji di expo.dev/notifications: *InvalidCredentials* / *Unable to retrieve the FCM server key* | Kunci FCM V1 belum diunggah ke Expo (Bagian 4), atau diunggah untuk package yang berbeda. |
| *MismatchSenderId* | `google-services.json` berasal dari proyek Firebase lain. Unduh ulang dari proyek yang sama dengan kunci service account. |
| Notifikasi masuk tapi tanpa suara/pop-up | Izin notifikasi atau channel dimatikan di HP: Setelan → Aplikasi → Notifikasi → aktifkan semua kategori (Pengingat Mengajar, Pengumuman, Guru Pengganti). |
| Pengingat telat/tidak muncul saat HP lama diam | Optimasi baterai aktif. Atur baterai ke **Tidak dibatasi** & aktifkan **Autostart** (Bagian 6.1). |
| APK baru tidak bisa dipasang ("aplikasi tidak terpasang / konflik") | APK ditandatangani keystore berbeda. Gunakan keystore yang sama di Expo (jangan dihapus/diganti). |
| Notifikasi server tidak sampai, tapi uji expo.dev berhasil | Server belum versi terbaru, `EXPO_PUSH_ENABLED=0`, atau aplikasi belum memanggil `POST /mobile/devices` (cek login ulang). |

---

## Bagian 9 — Merilis versi baru

1. Ubah di `app.json`: `version` (mis. `1.0.1`) **dan** naikkan `android.versionCode` (mis. `2`).
2. `eas build -p android --profile production`
3. Unggah APK ke GitHub Releases / Google Drive madrasah.
4. Terbitkan **Pengumuman** berisi tautan unduh APK → guru menerima notifikasi dan memasang versi baru
   (menimpa versi lama, data tetap aman).

---

## Ringkasan berkas penting

| Berkas | Di mana disimpan | Rahasia? |
|---|---|---|
| `google-services.json` | Folder utama kode aplikasi | Tidak terlalu, tapi jangan disebar |
| Kunci service account Firebase (`…firebase-adminsdk….json`) | Hanya diunggah ke Expo + cadangan di folder aman | **Ya** |
| Keystore Android | Disimpan Expo + cadangan unduhan di folder aman | **Ya** |
| Akun Expo & Firebase | Akun email madrasah, catat siapa pengelolanya | **Ya** (password) |
