import React, { useCallback, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, ArrowLeft, Archive, Loader2, Lock, Printer, RefreshCw } from 'lucide-react';
import AksesDitolak from '@/components/security/AksesDitolak';
import PilihUjian from '@/components/ujian/PilihUjian';
import PanelCetakDokumen from '@/components/ujian/PanelCetakDokumen';
import PanelArsipUjian from '@/components/ujian/PanelArsipUjian';
import { HALAMAN_BERANDA_UJIAN, aksesDitolak, pesanGalat } from '@/lib/ujian';
import { HALAMAN_ARSIP, HALAMAN_CETAK, muatPilihanCetak } from '@/lib/ujianCetak';

// Sama dengan pembuka arsip di backend/ujian.py (JABATAN_PEMBUKA_ARSIP + pengelola + pimpinan).
const PEMBUKA_ARSIP = 'admin, waka kurikulum, kepala madrasah, serta ketua dan sekretaris panitia';

/**
 * Cetak & Arsip (/ujian/cetak dan /ujian/arsip, ?ujian=<id>): cetak Daftar Hadir & Berita Acara satu jenjang pada satu
 * ruang untuk satu sesi (format template madrasah) dan telusuri arsip administrasi ujian. Tab Arsip hanya untuk admin,
 * waka kurikulum, kepala madrasah, ketua & sekretaris panitia.
 */
export default function UjianCetakArsipPage() {
  const lokasi = useLocation();
  const navigasi = useNavigate();
  const tab = lokasi.pathname.startsWith(HALAMAN_ARSIP) ? 'arsip' : 'cetak';
  const [ujian, setUjian] = useState(null);
  const [pilihan, setPilihan] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const [ditolak, setDitolak] = useState('');

  const muat = useCallback(async (u) => {
    if (!u) { setPilihan(null); return; }
    setMemuat(true);
    try {
      setPilihan(await muatPilihanCetak(u.id));
      setGalat('');
      setDitolak('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolak(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat pilihan cetak.'));
    } finally {
      setMemuat(false);
    }
  }, []);
  const gantiUjian = useCallback((u) => { setUjian(u); muat(u); }, [muat]);
  const gantiTab = (t) => navigasi(`${t === 'arsip' ? HALAMAN_ARSIP : HALAMAN_CETAK}${lokasi.search}`, { replace: true });

  return (
    <div className="space-y-6" data-testid="ujian-cetak-arsip">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Printer className="h-7 w-7 text-[#006837]" /> Cetak & Arsip
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Cetak daftar hadir dan berita acara per jenjang per ruang sesuai format madrasah. Setiap hasil cetak tersimpan di arsip.
          </p>
        </div>
        <Button variant="outline" onClick={() => muat(ujian)} disabled={memuat || !ujian} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-cetak">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      <PilihUjian onUbah={gantiUjian} />

      {ditolak && <AksesDitolak halaman="Cetak & Arsip" untuk="admin, pimpinan, dan panitia ujian ini" pesan={ditolak} />}
      {pilihan?.tiruan && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-cetak">Server belum menyediakan layanan cetak — menampilkan data contoh.</p>}
      {galat && <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert"><AlertTriangle className="h-4 w-4 shrink-0" /> {galat}</div>}

      {!ditolak && pilihan && (
        <Tabs value={tab} onValueChange={gantiTab}>
          <TabsList>
            <TabsTrigger value="cetak" className="gap-1" data-testid="tab-cetak"><Printer className="h-4 w-4" /> Cetak Dokumen</TabsTrigger>
            <TabsTrigger value="arsip" className="gap-1" data-testid="tab-arsip"
              title={pilihan.boleh_arsip === false ? `Arsip hanya untuk ${PEMBUKA_ARSIP}` : undefined}>
              {pilihan.boleh_arsip === false ? <Lock className="h-4 w-4" /> : <Archive className="h-4 w-4" />} Arsip Administrasi
            </TabsTrigger>
          </TabsList>
          <TabsContent value="cetak" className="mt-4">
            <PanelCetakDokumen ujian={ujian} pilihan={pilihan} />
          </TabsContent>
          <TabsContent value="arsip" className="mt-4">
            {pilihan.boleh_arsip === false ? (
              <AksesDitolak halaman="Arsip Administrasi Ujian" untuk={PEMBUKA_ARSIP}
                pesan={`Arsip administrasi ujian bersifat terbatas: hanya ${PEMBUKA_ARSIP} yang dapat membukanya. Anda tetap dapat mencetak dokumen di tab Cetak Dokumen.`}
                peranBerhak={['admin', 'waka_kurikulum', 'kepala_sekolah']} />
            ) : <PanelArsipUjian ujian={ujian} ruangList={pilihan.ruang} />}
          </TabsContent>
        </Tabs>
      )}
      {!pilihan && memuat && <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>}
    </div>
  );
}
