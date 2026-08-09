# Panduan Build APK Android — Super Apps MATSANDATAMA (Capacitor)

Folder ini membungkus aplikasi web Anda menjadi **APK Android** memakai **Capacitor**.
Pendekatan yang dipakai: **thin wrapper** — APK memuat langsung situs live Anda
(`https://super.mtsn2kotamalang.sch.id`). Keuntungannya:

- **Ganti domain cukup 1 baris** di `capacitor.config.json` (atau jalankan `set-domain.js`).
- **APK otomatis ikut update** setiap kali Anda deploy web baru (tidak perlu build APK ulang untuk perubahan fitur).
- Kamera (Scan QR), GPS, dan Notifikasi bekerja karena situs sudah HTTPS + sudah PWA.

> Catatan: environment build (Emergent) **tidak bisa meng-compile APK**. Build dilakukan
> di komputer Anda (Windows/Mac/Linux) yang punya Android Studio. Ikuti langkah di bawah.

---

## 0) Prasyarat (install di komputer Anda)
- **Node.js 18+** dan **npm**
- **Java JDK 17**
- **Android Studio** (termasuk Android SDK + Platform Tools)
- Setelah install Android Studio, buka sekali agar SDK terunduh.

## 1) Siapkan proyek
Salin seluruh folder `mobile-capacitor/` ini ke komputer Anda, lalu:

```bash
cd mobile-capacitor
npm install
```

## 2) (Opsional) Ubah domain
Domain default sudah diisi `https://super.mtsn2kotamalang.sch.id`.
Jika suatu saat berubah:

```bash
node set-domain.js https://domain-baru-anda.sch.id
```

atau edit manual file `capacitor.config.json` bagian:
```json
"server": { "url": "https://domain-baru-anda.sch.id" }
```

## 3) Tambahkan platform Android
```bash
npx cap add android
npx cap sync android
```
Ini membuat folder `android/`.

## 4) Set izin (permissions) Android
Buka file: `android/app/src/main/AndroidManifest.xml`
Tambahkan di dalam tag `<manifest>` (sebelum `<application>`):

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

### Agar kamera (Scan QR) jalan di dalam WebView
Scan QR memakai `getUserMedia` di WebView. Tambahkan handler izin kamera.
Buka `android/app/src/main/java/.../MainActivity.java` dan pastikan WebView
mengizinkan permintaan kamera. Capacitor 6 sudah menangani `onPermissionRequest`
secara default untuk `getUserMedia` selama izin `CAMERA` sudah diberikan di runtime.
Jika kamera tetap hitam, pasang plugin kamera resmi:
```bash
npm install @capacitor/camera
npx cap sync android
```

## 5) Ikon aplikasi
Ikon ada di `resources/icon.png` (dari logo madrasah). Untuk meng-generate
semua ukuran ikon Android secara otomatis:
```bash
npm install -g @capacitor/assets
npx @capacitor/assets generate --android
```
(Jalankan dari folder ini setelah `npx cap add android`.)

## 6) Build APK
### Cara cepat (debug, untuk dibagikan internal):
```bash
npm run build:apk
```
APK ada di: `android/app/build/outputs/apk/debug/app-debug.apk`
File ini bisa langsung Anda **share/kirim** dan di-install di HP Android
(aktifkan "Install dari sumber tak dikenal").

### Lewat Android Studio (disarankan):
```bash
npx cap open android
```
Lalu di Android Studio: menu **Build → Build Bundle(s)/APK(s) → Build APK(s)**.

## 7) (Opsional) APK Release yang ditandatangani
Untuk distribusi lebih luas, buat keystore & tandatangani:
```bash
keytool -genkey -v -keystore matsa.keystore -alias matsa -keyalg RSA -keysize 2048 -validity 10000
```
Lalu konfigurasikan signing di `android/app/build.gradle` dan jalankan `npm run build:apk:release`.

---

## Ganti domain di kemudian hari (ringkasan untuk Admin)
1. `node set-domain.js https://domain-baru`
2. `npx cap sync android`
3. `npm run build:apk`
4. Bagikan APK baru.

> Karena APK memuat situs live, **perubahan fitur/tampilan tidak butuh build APK ulang** —
> cukup redeploy web. Build APK ulang hanya diperlukan bila **domain berubah** atau ganti ikon/izin.

## Troubleshooting
- **Layar putih / tidak memuat**: pastikan HP punya internet & `server.url` benar (HTTPS valid).
- **Kamera hitam**: pastikan izin CAMERA diberikan saat diminta; jika perlu pasang `@capacitor/camera`.
- **GPS tidak akurat / ditolak**: pastikan izin lokasi "Saat digunakan" diberikan.
- **Notifikasi**: Web Push di dalam WebView Android **tidak dijamin**. Untuk push native
  di APK, perlu Firebase Cloud Messaging (FCM) + plugin `@capacitor/push-notifications`
  (menyusul, opsional). Di PWA (Chrome/Safari) push sudah berfungsi.
