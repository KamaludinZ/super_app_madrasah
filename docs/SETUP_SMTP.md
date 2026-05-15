# Setup SMTP / Email

SMTP digunakan untuk fitur **Lupa Password** — sistem akan mengirim link reset ke email user.

Konfigurasi dilakukan oleh **Admin** melalui menu **Pengaturan → SMTP & Email**.

## Opsi 1: Gmail App Password (Direkomendasikan)

Gratis, simple, dan reliable untuk volume email rendah-sedang (< 500/hari).

### Prasyarat
- Akun Gmail (`@gmail.com`) atau Google Workspace (`@madrasah.sch.id` via Google)
- **2-Step Verification** harus aktif di akun Gmail tersebut

### Langkah Membuat App Password

1. Buka [myaccount.google.com](https://myaccount.google.com)
2. Pilih **Security** (panel kiri).
3. Cari **2-Step Verification** — pastikan **AKTIF**. Jika belum, aktifkan dulu (perlu nomor HP).
4. Setelah 2SV aktif, scroll ke bawah → cari **App Passwords** (atau buka langsung [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
5. Pilih:
   - App: "Mail"
   - Device: "Other (Custom name)" → isi **MATSANDATAMA**.
6. Klik **Generate** — muncul kode 16 karakter (mis. `abcd efgh ijkl mnop`).
7. **Copy** kode ini (tanpa spasi). Simpan baik-baik — kode ini tidak bisa dilihat lagi.

### Konfigurasi di Aplikasi

Buka **Pengaturan → SMTP & Email**, isi:

| Field | Nilai |
|-------|-------|
| SMTP Host | `smtp.gmail.com` |
| SMTP Port | `587` |
| SMTP User | Email Gmail Anda (mis. `admin.matsa@gmail.com`) |
| SMTP Password | Paste 16 karakter App Password (tanpa spasi) |
| Use TLS | ✅ Aktif |
| Use SSL | ❌ Nonaktif |
| From Email | Sama dengan SMTP User |
| From Name | Super Apps MATSANDATAMA |

Klik **Simpan**, lalu klik **Test SMTP** — masukkan email tujuan Anda, klik kirim. Jika berhasil, email akan masuk dalam 1-2 menit.

## Opsi 2: SendGrid

Gratis untuk **100 email/hari**.

1. Daftar di [sendgrid.com](https://sendgrid.com).
2. Verifikasi domain pengirim (Settings → Sender Authentication).
3. Buat API Key di Settings → API Keys — pilih "Full Access".
4. Konfigurasi di aplikasi:

| Field | Nilai |
|-------|-------|
| SMTP Host | `smtp.sendgrid.net` |
| SMTP Port | `587` |
| SMTP User | `apikey` (literal kata "apikey") |
| SMTP Password | API Key Anda |
| Use TLS | ✅ |
| From Email | Email yang sudah diverifikasi di SendGrid |

## Opsi 3: Mailgun

1. Daftar di [mailgun.com](https://mailgun.com), verifikasi domain.
2. Dapatkan SMTP credentials dari Sending → Domain Settings.
3. Konfigurasi sesuai instruksi Mailgun (host biasanya `smtp.mailgun.org`, port 587).

## Troubleshooting

| Error | Sebab | Solusi |
|-------|-------|--------|
| Authentication failed (535) | User/password salah atau App Password tidak benar | Cek ulang App Password — untuk Gmail bukan password akun |
| Connection refused | Port salah (firewall blokir) | Coba 587 (TLS) atau 465 (SSL) |
| Email masuk Spam | SPF/DKIM belum di-setup | Hubungi penyedia hosting domain Anda untuk setup SPF & DKIM |
| "Less Secure Apps" disabled | Gmail tanpa 2SV | Wajib aktifkan 2SV + App Password (Less Secure Apps sudah dimatikan Google sejak 2022) |
| Test SMTP timeout | Network/Firewall sekolah blokir port SMTP | Hubungi IT sekolah untuk allowlist `smtp.gmail.com:587` |

## Keamanan

- App Password Gmail **berbeda** dari password akun. Jangan share password akun ke siapapun.
- Jika App Password bocor, **revoke** di [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) dan generate baru.
- Jangan commit SMTP password ke git/repository. Sistem menyimpannya di database settings (encrypted).
