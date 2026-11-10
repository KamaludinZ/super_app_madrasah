<?php

// Login lewat Super App (SSO tiket). Salin ke config/superapp_sso.php aplikasi Laravel tujuan.
// Nilai rahasia diambil dari .env — jangan tulis kunci langsung di file ini.

return [
    // Alamat API SSO Super App, mis. https://superapp.madrasah.sch.id/api/sso (lihat Admin > Aplikasi Terhubung).
    'url' => env('SUPERAPP_SSO_URL'),

    // Kunci rahasia aplikasi ini (diawali "sso_"), ditampilkan sekali saat aplikasi didaftarkan di Super App.
    'kunci' => env('SUPERAPP_SSO_KUNCI'),

    // Urutan pencocokan akun: data dari Super App (kiri) => kolom tabel users aplikasi ini (kanan).
    // Data yang tersedia: username, email, nip, nisn, nis, peg_id, nuptk, nama, peran, jenis, kelas.
    // Hapus baris yang kolomnya tidak ada di tabel users aplikasi ini.
    'cocokkan' => [
        'username' => 'username',
        'email' => 'email',
    ],

    // Pemeriksaan ulang di sisi aplikasi: jenis pengguna Super App yang boleh masuk (siswa | guru | pegawai | alumni).
    // Hak akses utama tetap diatur admin Super App; ini pengaman kedua bila link diutak-atik.
    'jenis_diizinkan' => ['siswa', 'guru', 'pegawai'],

    // Halaman tujuan setelah berhasil masuk.
    'setelah_masuk' => env('SUPERAPP_SSO_SETELAH_MASUK', '/'),

    // Batas waktu menghubungi Super App (detik).
    'timeout' => 10,
];
