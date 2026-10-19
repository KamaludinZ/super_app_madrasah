import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldX, UserX, ShieldAlert, Lock, Home, Award, IdCard } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

// Pesan per alasan penolakan (detail HTTP 403 terstruktur dari endpoint /pkg/*).
const ALASAN = {
  bukan_anggota_sk: {
    judul: 'Anda belum terdaftar di SK PKG',
    saran: 'Modul Penilaian Kinerja Guru hanya dapat dibuka oleh personil yang tercantum dalam SK penilaian aktif. Hubungi kepala madrasah bila Anda seharusnya termasuk tim penilai atau guru yang dinilai.',
    Icon: UserX,
  },
  bukan_penilai: {
    judul: 'Anda bukan penilai pada periode ini',
    saran: 'Halaman ini khusus anggota tim penilai. Guru yang dinilai dapat melihat hasilnya setelah penilaian dikunci.',
    Icon: ShieldX,
  },
  belum_disupervisi: {
    judul: 'Menunggu supervisi kepala madrasah',
    saran: 'Penilai wajib disupervisi kepala madrasah lebih dahulu sebelum membuka lembar penilaian guru yang dibagikan.',
    Icon: ShieldAlert,
  },
  bukan_penugasan: {
    judul: 'Guru ini tidak dibagikan kepada Anda',
    saran: 'Penilai hanya dapat membuka lembar penilaian guru yang dibagikan kepala madrasah kepadanya pada periode berjalan.',
    Icon: ShieldX,
  },
  di_luar_masa: {
    judul: 'Di luar masa penilaian',
    saran: 'Lembar penilaian hanya dapat diisi pada rentang tanggal buka–tutup periode PKG.',
    Icon: ShieldAlert,
  },
  bukan_kepala: {
    judul: 'Khusus kepala madrasah',
    saran: 'Penetapan periode, tim penilai, dan pembagian guru yang dinilai hanya dapat dilakukan dari akun kepala madrasah.',
    Icon: Lock,
  },
};

// Pesan tolak akses modul PKG di dalam AppShell. `penolakan` = { alasan, pesan } dari backend.
// Non-anggota SK diarahkan ke dashboard; anggota yang ditolak sub-menu tertentu (bukan kepala/penilai/
// belum disupervisi) diarahkan kembali ke Beranda PKG atau Status Saya.
export default function PesanTolakPkg({ penolakan }) {
  const { settings } = useAuth();
  const cfg = ALASAN[penolakan?.alasan] || ALASAN.bukan_anggota_sk;
  const { Icon } = cfg;
  const nonAnggota = !penolakan?.alasan || penolakan.alasan === 'bukan_anggota_sk';
  const kepala = settings?.headmaster_name;

  return (
    <div className="flex justify-center px-4 py-12" role="alert" data-testid={`pkg-tolak-${penolakan?.alasan || 'bukan_anggota_sk'}`}>
      <div className="max-w-md w-full text-center space-y-5">
        <div className="mx-auto h-20 w-20 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center">
          <Icon className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-rose-600">Akses Ditolak · 403</p>
          <h1 className="text-xl font-bold text-slate-900">{cfg.judul}</h1>
          {penolakan?.pesan && <p className="text-sm text-slate-700">{penolakan.pesan}</p>}
          <p className="text-sm text-slate-500">{cfg.saran}</p>
          {nonAnggota && kepala && (
            <p className="text-xs text-slate-500" data-testid="pkg-tolak-kontak">Kepala madrasah: <span className="font-semibold text-slate-700">{kepala}</span></p>
          )}
        </div>
        {nonAnggota ? (
          <Button asChild className="bg-[#006837] hover:bg-[#005a30] gap-2">
            <Link to="/dashboard"><Home className="h-4 w-4" /> Ke Dashboard</Link>
          </Button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/pkg/keanggotaan"><IdCard className="h-4 w-4" /> Status Saya</Link>
            </Button>
            <Button asChild className="bg-[#006837] hover:bg-[#005a30] gap-2">
              <Link to="/pkg"><Award className="h-4 w-4" /> Beranda PKG</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
