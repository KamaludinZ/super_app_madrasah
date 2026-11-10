<?php
/**
 * Login lewat Super App (SSO tiket) untuk SLiMS 9.
 * Salin ke config/superapp.php di folder SLiMS (nama file TANPA garis bawah: SLiMS mengabaikan config/*_*.php).
 * Dibaca plugin plugins/superapp_sso lewat config('superapp.sso....').
 */
return [
    'sso' => [
        // Alamat API SSO Super App (lihat Admin > Aplikasi Terhubung di Super App).
        'url' => 'https://superapp.madrasah.sch.id/api/sso',

        // Kunci rahasia aplikasi "perpustakaan" (diawali "sso_"), ditampilkan sekali saat aplikasi didaftarkan.
        // Jangan simpan file ini di git publik.
        'kunci' => '',

        // Pencocokan akun PUSTAKAWAN (tabel `user`): data Super App (kiri) => kolom tabel user (kanan), dicoba berurutan.
        'pustakawan' => [
            'username' => 'username',
            'email' => 'email',
        ],

        // Hanya pengguna Super App dengan salah satu peran ini yang boleh masuk sebagai PUSTAKAWAN (ke halaman admin).
        // Kosongkan ([]) agar siapa pun yang punya akun pustakawan yang cocok bisa masuk sebagai pustakawan.
        'peran_pustakawan' => ['perpustakaan', 'admin'],

        // Pencocokan ANGGOTA (tabel `member`): data Super App (kiri) => kolom tabel member (kanan), dicoba berurutan.
        // Umumnya ID anggota (member_id) siswa = NISN/NIS, guru = NIP, pegawai non-ASN = Peg ID.
        'anggota' => [
            'nisn' => 'member_id',
            'nis' => 'member_id',
            'nip' => 'member_id',
            'peg_id' => 'member_id',
            'username' => 'member_id',
            'email' => 'member_email',
        ],

        // Jenis pengguna Super App yang boleh masuk (siswa | guru | pegawai | alumni). Pengaman kedua; hak akses utama
        // tetap diatur admin Super App.
        'jenis_diizinkan' => ['siswa', 'guru', 'pegawai'],

        // Batas waktu menghubungi Super App (detik).
        'timeout' => 10,
    ],
];
