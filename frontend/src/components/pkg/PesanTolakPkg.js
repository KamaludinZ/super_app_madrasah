import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ShieldX, UserX, ShieldAlert, Lock, Home } from 'lucide-react';

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
  bukan_kepala: {
    judul: 'Khusus kepala madrasah',
    saran: 'Penetapan periode, tim penilai, dan pembagian guru yang dinilai hanya dapat dilakukan dari akun kepala madrasah.',
    Icon: Lock,
  },
};

// Pesan tolak akses modul PKG di dalam AppShell. `penolakan` = { alasan, pesan } dari backend.
export default function PesanTolakPkg({ penolakan }) {
  const cfg = ALASAN[penolakan?.alasan] || ALASAN.bukan_anggota_sk;
  const { Icon } = cfg;

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
        </div>
        <Button asChild className="bg-[#006837] hover:bg-[#005a30] gap-2">
          <Link to="/dashboard"><Home className="h-4 w-4" /> Ke Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
