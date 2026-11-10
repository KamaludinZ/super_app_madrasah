<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Penerima tiket login Super App.
 *
 * Super App mengarahkan pengguna ke  GET /sso/masuk?tiket=...  (tiket berlaku 60 detik, sekali pakai).
 * Controller ini menukar tiket ke Super App dari server (kunci rahasia di header), mencocokkan akun lokal,
 * lalu membuat sesi login biasa. Tidak ada password yang dikirim atau disimpan.
 */
class SuperAppSsoController extends Controller
{
    public function masuk(Request $request)
    {
        $tiket = (string) $request->query('tiket', '');
        if ($tiket === '' || strlen($tiket) > 200) {
            return $this->gagal('Tiket tidak ditemukan. Buka aplikasi ini dari dashboard Super App.');
        }
        if (! config('superapp_sso.url') || ! config('superapp_sso.kunci')) {
            Log::error('SSO Super App belum diatur: isi SUPERAPP_SSO_URL dan SUPERAPP_SSO_KUNCI di .env');

            return $this->gagal('Login lewat Super App belum diatur di aplikasi ini.');
        }

        try {
            $respons = Http::withToken(config('superapp_sso.kunci'))
                ->acceptJson()
                ->timeout((int) config('superapp_sso.timeout', 10))
                ->post(rtrim(config('superapp_sso.url'), '/').'/tukar', ['tiket' => $tiket]);
        } catch (ConnectionException $e) {
            Log::warning('SSO Super App tidak dapat dihubungi', ['pesan' => $e->getMessage()]);

            return $this->gagal('Super App tidak dapat dihubungi. Coba lagi beberapa saat.');
        }

        if (! $respons->successful()) {
            Log::warning('SSO Super App menolak tiket', [
                'status' => $respons->status(),
                'kode' => $respons->json('detail.kode'),
            ]);

            return $this->gagal($respons->json('detail.pesan') ?? 'Login lewat Super App gagal.');
        }

        $pengguna = (array) $respons->json('pengguna', []);

        // Pemeriksaan ulang di sisi aplikasi (hak akses utama diatur admin Super App).
        if (! in_array($pengguna['jenis'] ?? null, (array) config('superapp_sso.jenis_diizinkan', []), true)) {
            return $this->gagal('Akun Anda tidak berhak membuka aplikasi ini.');
        }

        $user = $this->cariPengguna($pengguna);
        if (! $user) {
            Log::info('SSO Super App: akun lokal tidak ditemukan', ['username' => $pengguna['username'] ?? null]);

            return $this->gagal('Akun Anda belum terdaftar di aplikasi ini. Hubungi admin aplikasi.');
        }
        if (isset($user->is_active) && ! $user->is_active) {
            return $this->gagal('Akun Anda di aplikasi ini sedang dinonaktifkan.');
        }

        Auth::login($user);
        $request->session()->regenerate();

        return redirect()->intended(config('superapp_sso.setelah_masuk', '/'));
    }

    /**
     * Cari akun lokal sesuai urutan config('superapp_sso.cocokkan'). Ubah method ini bila NIP/NISN disimpan di
     * tabel lain (mis. employees.nip / students.nisn yang terhubung ke users lewat user_id).
     */
    protected function cariPengguna(array $pengguna): ?User
    {
        foreach ((array) config('superapp_sso.cocokkan', []) as $kunci => $kolom) {
            $nilai = trim((string) ($pengguna[$kunci] ?? ''));
            if ($nilai === '') {
                continue;
            }
            $user = User::where($kolom, $nilai)->first();
            if ($user) {
                return $user;
            }
        }

        return null;
    }

    protected function gagal(string $pesan)
    {
        return redirect()->route('login')->withErrors(['sso' => $pesan]);
    }
}
