import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, ArrowLeft, BookOpen, FileSpreadsheet, Loader2, RefreshCw } from 'lucide-react';
import PilihUjian from '@/components/ujian/PilihUjian';
import MonitoringImpor from '@/components/ujian/nilai/MonitoringImpor';
import PanelNilaiUas from '@/components/ujian/nilai/PanelNilaiUas';
import PanelTemplateNilai from '@/components/ujian/nilai/PanelTemplateNilai';
import PanelImporNilai from '@/components/ujian/nilai/PanelImporNilai';
import PanelMasaNilai from '@/components/ujian/nilai/PanelMasaNilai';
import ProgresImpor from '@/components/ujian/nilai/ProgresImpor';
import RingkasanImporSheet from '@/components/ujian/nilai/RingkasanImporSheet';
import TabelBarisGagal from '@/components/ujian/nilai/TabelBarisGagal';
import DetailUnggahan from '@/components/ujian/nilai/DetailUnggahan';
import UnggahUlangGagal from '@/components/ujian/nilai/UnggahUlangGagal';
import { muatImpor, pesanGalatUnggah } from '@/lib/ujianNilai';
import { HALAMAN_BERANDA_UJIAN } from '@/lib/ujian';

/**
 * Nilai UAS (/ujian/nilai?ujian=<id>): template & impor nilai UAS per mapel per jenjang serta monitoring impor
 * (progres, hasil per sheet kelas, dan pesan penyebab tiap kegagalan). Nilai ulangan & UTS tetap diisi guru.
 */
export default function UjianNilaiPage() {
  const [ujian, setUjian] = useState(null);
  const [segarkan, setSegarkan] = useState(0);
  const [memuat] = useState(false);
  const [dipilih, setDipilih] = useState(null);
  const [tab, setTab] = useState('nilai');
  const gantiUjian = useCallback((u) => { setUjian(u); setDipilih(null); }, []);
  const selesai = useCallback(() => setSegarkan((n) => n + 1), []);
  // Rincian satu impor; bila gagal dimuat, alasannya ditampilkan (ProgresImpor tetap mencoba lagi selama 'proses').
  const muatRincian = useCallback((logId) => muatImpor(ujian.id, logId)
    .then((d) => setDipilih((x) => (!x || x.id === logId ? d : x)))
    .catch((e) => toast.error(`Rincian impor belum dapat dimuat: ${pesanGalatUnggah(e, 'Gagal memuat rincian impor.')}`)), [ujian]);
  // Setelah unggah: pindah ke Monitoring Impor dan langsung pantau impor baru (tahap 'diterima' sampai rincian pertama masuk).
  const mulaiPantau = useCallback((logId, info = {}) => {
    setTab('monitoring');
    setSegarkan((n) => n + 1);
    setDipilih({ id: logId, status: 'proses', tahap: 'diterima', ...info, per_sheet: [], galat: [] });
    muatRincian(logId);
  }, [muatRincian]);

  return (
    <div className="space-y-6" data-testid="ujian-nilai">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to={HALAMAN_BERANDA_UJIAN} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-[#006837] hover:underline"><ArrowLeft className="h-3.5 w-3.5" /> Beranda Ujian</Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2"><FileSpreadsheet className="h-7 w-7 text-[#006837]" /> Nilai UAS</h1>
          <p className="text-sm text-slate-600 mt-1">Impor nilai UAS per mapel per jenjang; nilai langsung tampil di kolom UAS rapor dan akun guru mapel.</p>
        </div>
        <Button variant="outline" onClick={() => setSegarkan((n) => n + 1)} disabled={memuat || !ujian} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-nilai">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>
      <PilihUjian onUbah={gantiUjian} />
      {ujian && (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="nilai" className="gap-1" data-testid="tab-nilai-uas"><BookOpen className="h-4 w-4" /> Nilai UAS</TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-1" data-testid="tab-monitoring-impor"><Activity className="h-4 w-4" /> Monitoring Impor</TabsTrigger>
          </TabsList>
          <TabsContent value="nilai" className="mt-4 space-y-4">
            <PanelMasaNilai ujianId={ujian.id} />
            <PanelNilaiUas ujian={ujian} segarkan={segarkan} anak={({ mapel, jenjang, kelas, boleh }) => boleh && (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <PanelTemplateNilai ujianId={ujian.id} mapel={mapel} jenjang={jenjang} kelas={kelas} />
                <PanelImporNilai ujianId={ujian.id} mapel={mapel} jenjang={jenjang} onMulai={mulaiPantau} />
              </div>
            )} />
          </TabsContent>
          <TabsContent value="monitoring" className="mt-4 space-y-4">
            {dipilih && <DetailUnggahan log={dipilih} />}
            {dipilih && <ProgresImpor ujianId={ujian.id} log={dipilih} onSelesai={(l) => { setDipilih(l); selesai(); }} />}
            {dipilih && dipilih.status !== 'proses' && <RingkasanImporSheet log={dipilih} />}
            {dipilih && dipilih.status !== 'proses' && <TabelBarisGagal log={dipilih} />}
            {dipilih?.status === 'selesai' && (
              <UnggahUlangGagal ujianId={ujian.id} log={dipilih}
                onMulai={(logId) => mulaiPantau(logId, { mapel_id: dipilih.mapel_id, mapel_nama: dipilih.mapel_nama, jenjang: dipilih.jenjang, ulang_dari: dipilih.id })} />
            )}
            <MonitoringImpor ujian={ujian} segarkan={segarkan} dipilihId={dipilih?.id}
              onPilih={(l) => { setDipilih(l); muatRincian(l.id); }} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
