import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, DoorOpen } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/lib/AuthContext';
import PanelPengajuanSaya from '@/components/izin/PanelPengajuanSaya';
import DetailIzinDialog from '@/components/izin/DetailIzinDialog';
import FormPengajuanIzin from '@/components/izin/FormPengajuanIzin';
import AksesDitolak from '@/components/security/AksesDitolak';
import {
  PERAN_PENGAJU_IZIN, aksesDitolak, batalkanIzin, bolehAjukanIzin, jamSekarangWIB, muatDetailIzin, muatPengajuanSaya, pesanGalat,
} from '@/lib/izinKamad';
import { formatWIBPanjang } from '@/lib/datetime';

/**
 * Halaman Pengajuan Izin (/izin) untuk kepala tata usaha, guru mata pelajaran, tenaga kependidikan,
 * dan satpam: daftar pengajuan sendiri beserta statusnya (menunggu/disetujui/ditolak/dibatalkan).
 * Izin diputuskan kepala madrasah; alasan penolakan terlihat di sini.
 */
export default function PengajuanIzinPage() {
  const { user, activeRole } = useAuth();
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [items, setItems] = useState([]);
  const [tiruan, setTiruan] = useState(false);
  const [dipilih, setDipilih] = useState(null);
  const [sibukId, setSibukId] = useState(null);
  const [ditolakServer, setDitolakServer] = useState(''); // detail 403 dari server
  const boleh = bolehAjukanIzin(activeRole);
  const pengaju = { nama: user?.full_name || 'Anda', peran: activeRole };

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const h = await muatPengajuanSaya({ nama: user?.full_name || 'Anda', peran: activeRole });
      setItems(h.items);
      setTiruan(h.tiruan);
      setGalat('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolakServer(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat pengajuan izin. Periksa koneksi lalu coba lagi.'));
    } finally {
      setMemuat(false);
    }
  }, [user?.full_name, activeRole]);

  useEffect(() => { if (boleh) muat(); }, [boleh, muat]);

  const pilih = useCallback((izin) => {
    setDipilih(izin);
    muatDetailIzin(izin.id)
      .then((baru) => { if (baru) setDipilih((d) => (d?.id === izin.id ? baru : d)); })
      .catch(() => { /* tetap tampilkan data daftar */ });
  }, []);

  // Batalkan pengajuan sendiri (hanya selama masih menunggu) setelah konfirmasi.
  const batalkan = useCallback(async (izin) => {
    const ok = await confirmDialog(
      `Batalkan pengajuan izin "${izin.keperluan}" pada ${formatWIBPanjang(izin.tanggal, false)}, pukul ${izin.jam_mulai}–${izin.jam_selesai}?\n\nPengajuan yang dibatalkan tidak dapat diaktifkan kembali.`,
      { title: 'Batalkan Pengajuan Izin', confirmText: 'Ya, batalkan', cancelText: 'Tidak' },
    );
    if (!ok) return;
    setSibukId(izin.id);
    try {
      const h = await batalkanIzin(izin);
      setItems((l) => l.map((i) => (i.id === izin.id ? h.izin : i)));
      setDipilih((d) => (d?.id === izin.id ? h.izin : d));
      toast.success(`Pengajuan izin dibatalkan${h.tiruan ? ' (contoh, belum tersimpan di server)' : ''}`);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal membatalkan pengajuan. Periksa koneksi lalu coba lagi.'));
    } finally {
      setSibukId(null);
    }
  }, []);

  if (!boleh || ditolakServer) {
    return (
      <AksesDitolak halaman="Pengajuan Izin" untuk="kepala tata usaha, guru mata pelajaran, tenaga kependidikan, dan satpam"
        pesan={ditolakServer || undefined} peranBerhak={PERAN_PENGAJU_IZIN} />
    );
  }

  return (
    <div className="space-y-6" data-testid="pengajuan-izin-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <DoorOpen className="h-3 w-3 mr-1" /> Izin Kamad
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Pengajuan Izin</h1>
          <p className="text-sm text-slate-600 mt-1">
            Ajukan izin keluar kepada kepala madrasah dan pantau keputusannya. Izin yang disetujui tampil di papan pantau satpam.
          </p>
        </div>
        <Button variant="outline" onClick={muat} disabled={memuat} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-pengajuan">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      {tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-pengajuan">
          Server belum menyediakan data izin — menampilkan data contoh untuk mencoba tampilan.
        </p>
      )}
      {galat && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{galat}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        <div className="lg:col-span-2">
          <FormPengajuanIzin
            pengaju={pengaju}
            onTerkirim={(izin, contoh) => { setItems((l) => [izin, ...l]); if (contoh) setTiruan(true); }}
          />
        </div>
        <PanelPengajuanSaya className="lg:col-span-3" items={items} memuat={memuat} onPilih={pilih} onBatalkan={batalkan} sibukId={sibukId} />
      </div>

      <DetailIzinDialog
        izin={dipilih}
        jam={jamSekarangWIB()}
        onTutup={() => setDipilih(null)}
        onBatalkan={batalkan}
        sibuk={!!dipilih && sibukId === dipilih.id}
      />
    </div>
  );
}
