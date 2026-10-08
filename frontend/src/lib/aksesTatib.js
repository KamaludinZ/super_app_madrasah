import { ClipboardEdit, BookMarked, ShieldCheck, Database, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';

// Hak akses & menu Tata Tertib per peran aktif — satu sumber untuk navigasi (navForRole)
// dan tombol di halaman.
//   input   : catat poin kebaikan/pelanggaran, ubah, tindak lanjut
//   lihat   : read-only (lihat poin & rekap)
//   kelas   : read-only, hanya siswa di kelas yang diampu (wali kelas)
//   pribadi : hanya poin milik sendiri (siswa)
// Hapus catatan hanya admin (sama dengan backend).
export const AKSES_TATIB_PER_PERAN = {
  admin: 'input',
  guru_tata_tertib: 'input',
  waka_kesiswaan: 'input',
  guru_bk: 'lihat',
  kepala_sekolah: 'lihat',
  penjamin_mutu: 'lihat',
  kepala_tata_usaha: 'lihat',
  waka_kurikulum: 'lihat',
  wali_kelas: 'kelas',
  siswa: 'pribadi',
};

export const PERAN_INPUT_TATIB = Object.keys(AKSES_TATIB_PER_PERAN).filter((r) => AKSES_TATIB_PER_PERAN[r] === 'input');

// Peran yang mengelola master aturan & kategori tatib.
const PERAN_KELOLA_ATURAN = ['admin', 'guru_tata_tertib', 'guru_bk'];

export const aksesTatib = (activeRole) => AKSES_TATIB_PER_PERAN[activeRole] || null;

export const bolehInputTatib = (activeRole) => aksesTatib(activeRole) === 'input';

export const bolehHapusTatib = (activeRole) => activeRole === 'admin';

export const PESAN_TOLAK_TATIB = 'Peran Anda hanya dapat melihat data tata tertib. Perubahan hanya oleh admin, guru tata tertib, atau waka kesiswaan.';
export const PESAN_TOLAK_HAPUS_TATIB = 'Hanya admin yang dapat menghapus data tata tertib.';

// Tampilkan penolakan bila peran tidak boleh mengubah. -> true bila aksi harus dibatalkan.
export function tolakUbahTatib(activeRole, { hapus = false } = {}) {
  const boleh = hapus ? bolehHapusTatib(activeRole) : bolehInputTatib(activeRole);
  if (boleh) return false;
  toast.error(hapus ? PESAN_TOLAK_HAPUS_TATIB : PESAN_TOLAK_TATIB);
  return true;
}

// Pesan galat API tatib: 403 dari server diterjemahkan ke pesan penolakan yang jelas.
export function pesanGalatTatib(e, cadangan) {
  if (e?.response?.status === 403) return PESAN_TOLAK_TATIB;
  return e?.response?.data?.detail || cadangan;
}

// Halaman poin utama untuk peran (dipakai saat mengalihkan dari halaman peran lain).
export function halamanPoinTatib(role) {
  const akses = aksesTatib(role);
  if (akses === 'pribadi') return '/siswa/poin';
  if (akses === 'kelas') return '/wali-kelas/poin-tatib';
  return akses ? '/admin/tatib/penanganan' : '/dashboard';
}

// Item menu Tata Tertib untuk satu peran; `prefix` membentuk data-testid (mis. 'nav-admin').
export function menuTatib(role, prefix) {
  const akses = aksesTatib(role);
  if (!akses) return [];
  if (akses === 'pribadi') {
    return [{ to: '/siswa/poin', label: 'Poin Saya', icon: ShieldCheck, testid: `${prefix}-poin` }];
  }
  if (akses === 'kelas') {
    return [{ to: '/wali-kelas/poin-tatib', label: 'Pantauan Walikelas', icon: ShieldCheck, testid: `${prefix}-poin-tatib` }];
  }
  const items = [];
  if (PERAN_KELOLA_ATURAN.includes(role)) {
    items.push(
      { to: '/admin/tatib/input', label: 'Input Tata Tertib', icon: ClipboardEdit, testid: `${prefix}-tatib-input` },
      { to: '/admin/tatib/kategori', label: 'Input Kategori', icon: BookMarked, testid: `${prefix}-tatib-kategori` },
    );
  }
  items.push(
    {
      to: '/admin/tatib/penanganan',
      label: akses === 'input' ? 'Catat Poin Tatib' : 'Poin Tata Tertib',
      icon: ShieldCheck,
      testid: `${prefix}-tatib-penanganan`,
    },
    { to: '/admin/tatib/data', label: 'Data Tata Tertib', icon: Database, testid: `${prefix}-tatib-data` },
    { to: '/tatib/rekap', label: 'Rekap Pengawas', icon: BarChart3, testid: `${prefix}-tatib-rekap` },
  );
  return items;
}
