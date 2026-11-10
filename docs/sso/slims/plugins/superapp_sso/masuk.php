<?php
/**
 * Penerima tiket login Super App: index.php?p=superapp_sso&tiket=...
 *
 * 1. Tukar tiket ke Super App dari server (kunci rahasia di header; tiket berlaku 60 detik, sekali pakai).
 * 2. Cocokkan akun: pustakawan (tabel user) bila perannya diizinkan, selain itu anggota (tabel member).
 * 3. Buat sesi persis seperti login biasa (lib/contents/login.inc.php), termasuk 2FA pustakawan bila aktif.
 * Pengaturan: config/superapp.php.
 */

if (!defined('INDEX_AUTH') || INDEX_AUTH != 1) {
    die('can not access this file directly');
}

use SLiMS\Auth\Validator;
use SLiMS\DB;
use SLiMS\Http\Cookie;
use SuperAppSso\MetodeSuperApp;

require_once __DIR__ . '/MetodeSuperApp.php';

$superappGagal = function (string $pesan): void {
    writeLog('member', 'superapp_sso', 'Login', 'Login lewat Super App gagal: ' . $pesan . ' dari alamat ' . ip());
    redirect()->withMessage('wrong_password', $pesan)->toPath('login');
    exit;
};

$tiket = trim((string) ($_GET['tiket'] ?? ''));
if ($tiket === '' || strlen($tiket) > 200 || !preg_match('/^[A-Za-z0-9_-]+$/', $tiket)) {
    $superappGagal('Tiket tidak ditemukan. Buka perpustakaan dari dashboard Super App.');
}

$superappCfg = (array) config('superapp.sso', []);
if (empty($superappCfg['url']) || empty($superappCfg['kunci'])) {
    $superappGagal('Login lewat Super App belum diatur di perpustakaan (config/superapp.php).');
}

// 1. Tukar tiket (server ke server).
try {
    $superappRespons = (new \GuzzleHttp\Client([
        'timeout' => (int) ($superappCfg['timeout'] ?? 10),
        'http_errors' => false,
    ]))->post(rtrim($superappCfg['url'], '/') . '/tukar', [
        'headers' => ['Authorization' => 'Bearer ' . $superappCfg['kunci'], 'Accept' => 'application/json'],
        'json' => ['tiket' => $tiket],
    ]);
} catch (\Throwable $e) {
    $superappGagal('Super App tidak dapat dihubungi. Coba lagi beberapa saat.');
}
$superappIsi = json_decode((string) $superappRespons->getBody(), true) ?: [];
if ($superappRespons->getStatusCode() !== 200) {
    $superappGagal($superappIsi['detail']['pesan'] ?? 'Login lewat Super App gagal.');
}
$superappPengguna = (array) ($superappIsi['pengguna'] ?? []);
if (!in_array($superappPengguna['jenis'] ?? null, (array) ($superappCfg['jenis_diizinkan'] ?? []), true)) {
    $superappGagal('Akun Anda tidak berhak membuka perpustakaan.');
}

// 2. Cocokkan akun lokal; nilai harus tepat satu baris (mis. email ganda tidak dipakai).
$superappCari = function (string $tabel, string $kolomId, array $peta) use ($superappPengguna) {
    foreach ($peta as $kunci => $kolom) {
        $nilai = trim((string) ($superappPengguna[$kunci] ?? ''));
        if ($nilai === '' || !is_string($kolom) || !preg_match('/^[a-z_][a-z0-9_]*$/', $kolom)) {
            continue;
        }
        $baris = DB::query("SELECT `{$kolomId}` AS id FROM `{$tabel}` WHERE `{$kolom}` = ? LIMIT 2", [$nilai]);
        if ($baris->count() === 1) {
            return $baris->first()['id'];
        }
    }
    return null;
};

$superappPeranPustakawan = (array) ($superappCfg['peran_pustakawan'] ?? []);
$superappBolehPustakawan = !$superappPeranPustakawan
    || array_intersect($superappPeranPustakawan, (array) ($superappPengguna['peran'] ?? []));
$superappIdPustakawan = $superappBolehPustakawan
    ? $superappCari('user', 'user_id', (array) ($superappCfg['pustakawan'] ?? []))
    : null;

// 3a. Pustakawan -> halaman admin (alur sama dengan login.inc.php).
if ($superappIdPustakawan !== null) {
    MetodeSuperApp::$idPustakawan = (int) $superappIdPustakawan;
    $logon = Validator::use(MetodeSuperApp::class);
    if (!$logon->process('admin')) { // 2FA aktif -> diarahkan ke index.php?p=2fa oleh Validator
        $superappGagal($logon->getError());
    }
    simbio_security::destroySessionCookie(null, MEMBER_COOKIES_NAME, SWB, false);
    require SB . 'admin/default/session.inc.php';
    session_regenerate_id(true);
    Cookie::withPath(SWB)
        ->withExpires(time() + 14400)
        ->withHttponly()
        ->withSamesite('Lax')
        ->set('admin_logged_in', true);
    if ($superappBahasa = $logon->getData('template')['default_lang'] ?? null) {
        Cookie::withPath(SWB . 'admin')->withExpires(time() + 14400)->set('admin_lang', $superappBahasa);
    }
    $superappUname = (string) ($logon->getData()['uname'] ?? '');
    writeLog('staff', $superappUname, 'Login', 'Login lewat Super App untuk pustakawan ' . $superappUname . ' dari alamat ' . ip());
    $logon->getMethodInstance()->generateSession();
    redirect('admin/index.php');
    exit;
}

// 3b. Anggota -> area anggota.
$superappIdAnggota = $superappCari('member', 'member_id', (array) ($superappCfg['anggota'] ?? []));
if ($superappIdAnggota !== null) {
    MetodeSuperApp::$idAnggota = (string) $superappIdAnggota;
    $logon = Validator::use(MetodeSuperApp::class);
    if (!$logon->process('member')) {
        $superappGagal($logon->getError());
    }
    session_regenerate_id(true);
    writeLog('member', $superappIdAnggota, 'Login', sprintf('Login lewat Super App untuk anggota %s dari alamat %s', $superappIdAnggota, ip()));
    redirect()->toPath('member');
    exit;
}

$superappGagal('Akun Anda belum terdaftar sebagai pustakawan atau anggota perpustakaan. Hubungi petugas perpustakaan.');
