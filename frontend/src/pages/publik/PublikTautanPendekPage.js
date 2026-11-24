import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KerangkaPublik from '@/components/ujian/publik/KerangkaPublik';
import TautanTidakBerlaku from '@/components/ujian/publik/info/TautanTidakBerlaku';
import { bersihkanToken, cekTautanPublik, galatTautanInfo } from '@/lib/ujianInfoPublik';

const JUDUL = 'Tautan Publik Madrasah';

/**
 * Tautan pendek universal /publik/t/:token: token divalidasi server (GET /publik/tautan/{token}) lalu pengunjung
 * diarahkan ke halaman yang sesuai jenisnya (info ujian / monitoring pengumpulan). Halaman tujuan sendiri yang
 * menampilkan status "ditutup / belum dibuka / berakhir"; token tak dikenal ditampilkan di sini.
 */
export default function PublikTautanPendekPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [galat, setGalat] = useState(null);
  const [koneksi, setKoneksi] = useState(false);

  const periksa = useCallback(() => {
    setKoneksi(false);
    cekTautanPublik(bersihkanToken(token))
      .then((d) => { if (d?.jalur) navigate(d.jalur, { replace: true }); else setGalat({ alasan: 'tidak_dikenal' }); })
      .catch((e) => {
        const g = galatTautanInfo(e);
        if (g) setGalat(g.alasan === 'tidak_dikenal' && !g.pesan ? { alasan: 'tidak_dikenal' } : g);
        else setKoneksi(true);
      });
  }, [token, navigate]);
  useEffect(() => { periksa(); }, [periksa]);

  if (galat) return <KerangkaPublik judul={JUDUL}><TautanTidakBerlaku galat={galat} kontak="pengirim tautan atau panitia ujian" /></KerangkaPublik>;
  if (koneksi) {
    return (
      <KerangkaPublik judul={JUDUL}>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" data-testid="pendek-gagal">
          <WifiOff className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h2 className="text-lg font-bold text-slate-900">Tautan belum dapat diperiksa</h2>
          <p className="mt-1 text-sm text-slate-600">Periksa koneksi internet, lalu coba lagi.</p>
          <Button variant="outline" onClick={periksa} className="mt-4 gap-2"><RefreshCw className="h-4 w-4" /> Coba lagi</Button>
        </div>
      </KerangkaPublik>
    );
  }
  return <KerangkaPublik judul={JUDUL}><div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#006837]" /></div></KerangkaPublik>;
}
