import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { RincianIzin } from '@/components/izin/DetailIzinDialog';
import FormCatatanIzin from '@/components/izin/FormCatatanIzin';
import CatatanIzinTerbatas from '@/components/izin/CatatanIzinTerbatas';
import AksesDitolak from '@/components/security/AksesDitolak';
import {
  STATUS_IZIN, WAKTU_IZIN, aksesDitolak, cariIzinTiruan, jamSekarangWIB, muatDetailIzin, pesanGalat, waktuIzin,
} from '@/lib/izinKamad';
import { hariIniWIB } from '@/lib/tanggal';

/**
 * Halaman detail satu izin (/izin/:izinId), bisa dibuka langsung dari tautan. Hanya-lihat; satpam dapat
 * menulis catatan pada izin yang sudah disetujui (bukan pengajuannya sendiri). Hak baca ditegakkan server.
 */
export default function DetailIzinPage() {
  const { izinId } = useParams();
  const { user, activeRole } = useAuth();
  const [izin, setIzin] = useState(null);
  const [tiruan, setTiruan] = useState(false);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat('');
    try {
      const data = await muatDetailIzin(izinId);
      const contoh = data ? null : cariIzinTiruan(izinId);
      setIzin(data || contoh);
      setTiruan(!data);
      if (!data && !contoh) setGalat('Izin tidak ditemukan.');
    } catch (e) {
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Anda tidak berhak melihat izin ini.'));
      else setGalat(pesanGalat(e, 'Gagal memuat izin. Periksa koneksi lalu coba lagi.'));
    } finally {
      setMemuat(false);
    }
  }, [izinId]);

  useEffect(() => { muat(); }, [muat]);

  if (ditolak) return <AksesDitolak halaman="Detail Izin" untuk="pengaju, satpam, kepala TU, dan kepala madrasah" pesan={ditolak} />;

  const s = izin ? (STATUS_IZIN[izin.status] || STATUS_IZIN.menunggu) : null;
  const w = izin && izin.status === 'disetujui' && izin.tanggal === hariIniWIB() ? WAKTU_IZIN[waktuIzin(izin, jamSekarangWIB())] : null;
  const bolehCatat = activeRole === 'satpam' && izin?.status === 'disetujui' && izin?.pengaju_id !== user?.id;

  return (
    <div className="mx-auto max-w-2xl space-y-4" data-testid="detail-izin-page">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <Link to={activeRole === 'satpam' ? '/satpam' : '/dashboard'}><ArrowLeft className="h-4 w-4" /> Kembali</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={muat} disabled={memuat} className="gap-1.5">
          {memuat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Muat Ulang
        </Button>
      </div>

      {tiruan && izin && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Server belum menyediakan data izin — menampilkan data contoh.
        </p>
      )}
      {galat && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{galat}</p>}

      {memuat && !izin ? (
        <div className="py-16 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>
      ) : izin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
              Detail Izin
              <Badge variant="outline" className={s.kelas}>{s.label}</Badge>
              {w && <Badge variant="outline" className={w.kelas}>{w.label}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RincianIzin izin={izin} />
            {bolehCatat && <FormCatatanIzin izin={izin} />}
            {izin.status === 'disetujui' && <CatatanIzinTerbatas izinId={izin.id} />}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
