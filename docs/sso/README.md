# Login lewat Super App (SSO tiket)

Super App menjadi **pusat login**. Aplikasi madrasah lain (Absensi, PTSP, Koperasi, nanti Perpustakaan) cukup
"percaya" kepada Super App: pengguna klik tombol aplikasi di dashboard Super App lalu langsung masuk tanpa
mengetik password lagi.

## Cara kerja

```
Pengguna            Super App                                   Aplikasi tujuan (mis. Koperasi)
   | klik "Koperasi"   |                                                  |
   |------------------>| buat TIKET acak (60 detik, sekali pakai)         |
   |<------------------| arahkan ke https://koperasi.../sso/masuk?tiket=… |
   |---------------------------------------------------------------------->|
   |                   |<---- POST /api/sso/tukar  (kunci rahasia) -------|
   |                   |----- data pengguna (username, NIP, NISN, …) ---->|  tiket hangus
   |<----------------------------------------------- sesi login dibuat ----|
```

* Tiket berlaku **60 detik** dan hanya bisa **dipakai sekali**. Super App hanya menyimpan sidik (hash) tiket.
* Aplikasi tujuan menukar tiket dari **servernya** memakai **kunci rahasia aplikasi**, jadi tiket curian tidak bisa
  dipakai di tempat lain.
* Hak akses (peran yang boleh, pengguna khusus yang diizinkan/diblokir) diperiksa **lagi** saat penukaran. Jadi
  akses yang dicabut admin langsung berlaku.
* Logout di Super App tidak otomatis mengeluarkan pengguna dari aplikasi lain.

## 1. Daftarkan aplikasi di Super App (admin)

Menu **Admin → Sistem & Utilitas → Aplikasi Terhubung (SSO)** → **Tambah aplikasi**:

| Isian | Contoh |
| --- | --- |
| Kode aplikasi | `koperasi` (huruf kecil, tidak bisa diubah) |
| Nama | Koperasi Sekolah |
| Alamat penerima tiket | `https://koperasi.madrasah.sch.id/sso/masuk` (wajib https) |
| Peran yang boleh membuka | tombol cepat **Semua Siswa / Semua Guru / Semua Pegawai**, atau centang per peran |
| Izinkan pengguna khusus | orang tertentu yang boleh walau perannya tidak dicentang |
| Blokir pengguna | orang tertentu yang tidak boleh walau perannya dicentang |

Setelah disimpan, muncul **kunci rahasia** beserta isian `.env`. Kunci ini hanya tampil **sekali**: salin dan
pasang di aplikasi tujuan. Bila hilang, klik **Kunci baru** (kunci lama langsung tidak berlaku).

Pengguna yang berhak akan melihat kartu **Aplikasi Madrasah Lainnya** di dashboard Super App.

## 2. Pasang penerima tiket di aplikasi Laravel

Absensi, PTSP, dan Koperasi sama-sama memakai **Laravel 12**, jadi langkahnya sama:

1. Salin file dari folder [`laravel/`](laravel) ke aplikasi tujuan:
   * `config/superapp_sso.php`
   * `app/Http/Controllers/SuperAppSsoController.php`
2. Tambahkan route di `routes/web.php`:
   ```php
   use App\Http\Controllers\SuperAppSsoController;

   Route::get('/sso/masuk', [SuperAppSsoController::class, 'masuk'])
       ->middleware('throttle:30,1')
       ->name('sso.masuk');
   ```
3. Isi `.env` aplikasi tujuan (dari dialog kunci di Super App), lalu `php artisan config:clear`:
   ```env
   SUPERAPP_SSO_URL=https://superapp.madrasah.sch.id/api/sso
   SUPERAPP_SSO_KUNCI=sso_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
4. Atur urutan pencocokan akun di `config/superapp_sso.php` (`cocokkan`), sesuai kolom yang ada di tabel `users`
   aplikasi tersebut (lihat catatan per aplikasi di bawah).
5. Uji kunci dari server aplikasi tujuan:
   ```bash
   curl -H "Authorization: Bearer $SUPERAPP_SSO_KUNCI" https://superapp.madrasah.sch.id/api/sso/cek
   # {"aplikasi":"koperasi","nama":"Koperasi Sekolah","umur_tiket_detik":60}
   ```
6. Opsional: tambahkan tombol **Masuk lewat Super App** di halaman login aplikasi tujuan yang mengarah ke dashboard
   Super App, dan tampilkan pesan galat `$errors->first('sso')` di halaman login.

Controller contoh mengarahkan kegagalan ke route bernama `login`; sesuaikan bila nama route login berbeda.

## Data pengguna yang dikirim Super App

`POST /api/sso/tukar` dengan header `Authorization: Bearer <kunci>` dan body `{"tiket": "..."}` mengembalikan:

```json
{
  "aplikasi": "koperasi",
  "pengguna": {
    "id": "uuid-super-app",
    "username": "budi",
    "nama": "Budi Santoso, S.Pd.",
    "email": "budi@madrasah.sch.id",
    "nip": "198207152009012003",
    "nuptk": null,
    "peg_id": "PEG-123",
    "nisn": null,
    "nis": null,
    "jenis_kelamin": "L",
    "peran": ["guru", "wali_kelas"],
    "peran_aktif": "guru",
    "jenis": "guru",
    "kelas": null,
    "telepon": "08…"
  },
  "masuk_pada": "2026-11-10T07:00:00+00:00"
}
```

* `jenis`: `siswa` | `guru` | `pegawai` | `alumni` (kelompok besar, cocok untuk jenis anggota koperasi / tipe
  pengguna PTSP).
* `kelas`: nama rombel untuk siswa.
* Tidak pernah ada password atau token di data ini.

Galat dikembalikan sebagai `{"detail": {"kode": "...", "pesan": "..."}}`:

| Status | Kode | Arti |
| --- | --- | --- |
| 401 | `kunci_tidak_valid` | kunci di `.env` salah / sudah diganti |
| 403 | `aplikasi_nonaktif` | aplikasi dinonaktifkan admin Super App |
| 400 | `tiket_tidak_valid` | tiket salah atau milik aplikasi lain |
| 400 | `tiket_kedaluwarsa` | lewat 60 detik |
| 400 | `tiket_sudah_dipakai` | tiket dipakai dua kali |
| 403 | `tidak_berhak` | akses pengguna sudah dicabut |
| 403 | `pengguna_nonaktif` | akun Super App dinonaktifkan |

## Catatan per aplikasi

**Absensi (`absensi_mtsn2km`)**: tabel `users` punya `username`; NIP pegawai ada di `employees.nip` yang
terhubung ke `users` lewat `employees.user_id`. Hapus baris `email` dari `cocokkan` bila tidak dipakai, lalu
tambahkan pencarian NIP di method `cariPengguna()`:

```php
protected function cariPengguna(array $p): ?User
{
    if (! empty($p['username']) && $u = User::where('username', $p['username'])->first()) {
        return $u;
    }
    foreach (['nip', 'peg_id'] as $kunci) {  // pegawai non-ASN memakai Peg ID sebagai nomor pegawai
        if (! empty($p[$kunci]) && $e = \App\Models\Employee::where('nip', $p[$kunci])->first()) {
            return $e->user;
        }
    }
    return null;
}
```

Data siswa di Absensi (`students`) belum terhubung ke akun `users`. Agar siswa bisa masuk lewat Super App,
siswa perlu punya akun di `users` (mis. `username` = username Super App, atau kolom `user_id` di `students`
yang dicocokkan lewat NISN).

**PTSP (`ptsp_mtsn2km`)**: tabel `users` memakai `email` dan `user_type` (`guru`, `pegawai`, `siswa`, …).
Cocokkan dengan `email`; `jenis` dari Super App sama dengan `user_type` untuk guru/pegawai/siswa.

**Koperasi (`koperasi-sekolah`)**: tabel `users` memakai `email`; anggota (`members.type` = `siswa` | `guru`).
Cocokkan dengan `email`; bila akun siswa dibuat tanpa email, tambahkan kolom `username` atau cocokkan lewat
data anggota di `cariPengguna()`.

**Perpustakaan (nanti)**: daftarkan di Super App dengan kode `perpustakaan`, lalu pasang penerima yang sama.

## Keamanan

* Wajib **HTTPS** di kedua sisi (Super App menolak alamat penerima `http://` kecuali `localhost` untuk uji coba).
* Simpan kunci hanya di `.env` server aplikasi tujuan; jangan di kode, git, atau JavaScript browser.
* Super App mencatat setiap pembukaan aplikasi dan penukaran tiket di Log Aktivitas, dan penolakan di log keamanan.
* Admin yang sedang "masuk sebagai pengguna lain" tidak bisa membuka aplikasi terhubung atas nama pengguna itu.
