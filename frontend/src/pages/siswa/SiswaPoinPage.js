import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Loader2 } from 'lucide-react';
import RingkasanPoin from '@/components/tatib/RingkasanPoin';
import RiwayatPoin from '@/components/tatib/RiwayatPoin';
import RincianPoinDialog from '@/components/tatib/RincianPoinDialog';
import { ambilPoinSaya } from '@/lib/poinTatib';
import { toast } from 'sonner';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { aksesTatib, halamanPoinTatib } from '@/lib/aksesTatib';

// Halaman poin PRIBADI: hanya untuk peran siswa dan hanya memuat poin milik akun yang login.
export default function SiswaPoinPage() {
  const { activeRole } = useAuth();
  const khususSiswa = aksesTatib(activeRole) === 'pribadi';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dipilih, setDipilih] = useState(null);

  useEffect(() => {
    if (!khususSiswa) return;
    (async () => {
      try {
        setData(await ambilPoinSaya());
      } catch (e) {
        toast.error('Gagal memuat poin tata tertib');
      } finally {
        setLoading(false);
      }
    })();
  }, [khususSiswa]);

  // Peran lain melihat poin siswa lewat halaman Tata Tertib masing-masing (read-only/input).
  if (!khususSiswa) {
    return <Navigate to={halamanPoinTatib(activeRole)} replace />;
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
        <p className="text-slate-500">Memuat poin...</p>
      </div>
    );
  }

  if (!data) {
    return <p className="p-12 text-center text-sm text-slate-500">Poin tata tertib belum bisa dimuat. Coba muat ulang halaman.</p>;
  }

  return (
    <div className="space-y-6" data-testid="siswa-poin-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <ShieldCheck className="h-3 w-3 mr-1" /> Tata Tertib
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Poin Saya</h1>
        <p className="text-sm text-slate-600 mt-1">Poin kebaikan (plus) dan poin pelanggaran (minus) yang tercatat atas namamu</p>
        {data.siswa && (
          <p className="text-sm text-slate-800 mt-2 font-medium" data-testid="poin-identitas-siswa">
            {data.siswa.nama}
            <span className="font-normal text-slate-500">{[data.siswa.nis && `NIS ${data.siswa.nis}`, data.siswa.kelas].filter(Boolean).map((t) => ` · ${t}`).join('')}</span>
          </p>
        )}
      </div>

      <RingkasanPoin
        totalPlus={data.total_plus}
        totalMinus={data.total_minus}
        jumlahKebaikan={data.jumlah_kebaikan}
        jumlahPelanggaran={data.jumlah_pelanggaran}
      />

      <RiwayatPoin records={data.records || []} onPilih={setDipilih} />

      <RincianPoinDialog catatan={dipilih} onClose={() => setDipilih(null)} />
    </div>
  );
}
