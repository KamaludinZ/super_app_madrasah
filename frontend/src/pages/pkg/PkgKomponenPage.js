import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileSpreadsheet, FileText, Loader2, Printer, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import SaringanPeriodeRekap from '@/components/pkg/SaringanPeriodeRekap';
import BadgeStatusPenilaian from '@/components/pkg/BadgeStatusPenilaian';
import { ambilRekap } from '@/lib/pkgRekap';
import { simpanBerkas } from '@/lib/pkgCetak';
import { JENIS_ANGKET, cetakAngket, daftarJenisAngket } from '@/lib/pkgAngket';

// Cetak angket kertas: `guru` null = angket kosong. Hasil cadangan (ReportLab) diberi tahu lewat notifikasi.
function useCetakAngket(periodeId) {
  const [sedang, setSedang] = useState(null);
  const cetak = async (jenis, format, guru = null) => {
    const kunci = `${guru?.guru_id || 'kosong'}:${jenis}:${format}`;
    setSedang(kunci);
    try {
      const { blob, namaBerkas, mesin } = await cetakAngket({ jenis, format, periodeId, guruId: guru?.guru_id });
      simpanBerkas(blob, namaBerkas);
      if (mesin === 'reportlab') toast.warning(`${namaBerkas} diunduh sebagai PDF cadangan (bukan salinan identik template).`);
      else toast.success(`${namaBerkas} diunduh`);
    } catch (e) {
      toast.error(e.message || 'Gagal mencetak angket');
    } finally {
      setSedang(null);
    }
  };
  return { sedang, cetak };
}

function KartuAngketKosong({ jenis, sedang, onCetak }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Printer className="h-4 w-4 text-[#006837]" /> Cetak Angket Kosong</CardTitle>
        <p className="text-xs text-slate-500">Format FORM-360-GR template resmi; identitas guru diisi tangan. Skor tiap butir 0 / 1 / 2.</p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {jenis.map((j) => (
          <div key={j.jenis} className="rounded-lg border border-slate-200 p-3" data-testid={`pkg-angket-kosong-${j.jenis}`}>
            <div className="text-sm font-semibold text-slate-900">{j.label}</div>
            <div className="text-xs text-slate-500">{JENIS_ANGKET[j.jenis]?.keterangan} · {j.jumlah_butir} butir</div>
            <div className="mt-2 flex gap-2">
              {[['pdf', 'PDF', FileText], ['xlsx', 'Excel', FileSpreadsheet]].map(([format, label, Ikon]) => (
                <Button key={format} size="sm" variant={format === 'pdf' ? 'default' : 'outline'}
                  className={`h-8 gap-1 ${format === 'pdf' ? 'bg-[#006837] hover:bg-[#005830]' : ''}`}
                  disabled={!!sedang} onClick={() => onCetak(j.jenis, format)}>
                  {sedang === `kosong:${j.jenis}:${format}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ikon className="h-3.5 w-3.5" />} {label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function DaftarGuruAngket({ guru, jenis, sedang, onCetak }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Angket per Guru</CardTitle>
        <p className="text-xs text-slate-500">Angket PDF dengan identitas guru sudah terisi, siap dibagikan ke responden.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {guru.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Belum ada guru dalam cakupan Anda pada periode ini.</p>}
        {guru.map((g) => (
          <div key={g.guru_id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 lg:flex-row lg:items-center" data-testid={`pkg-angket-guru-${g.guru_id}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{g.nama}</span>
                <BadgeStatusPenilaian status={g.status} />
              </div>
              <div className="text-xs text-slate-500">{g.mapel || '-'} · Penilai: {g.penilai_nama || '-'}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {jenis.map((j) => (
                <Button key={j.jenis} size="sm" variant="outline" className="h-8 gap-1" disabled={!!sedang}
                  onClick={() => onCetak(j.jenis, 'pdf', g)} data-testid={`pkg-cetak-angket-${g.guru_id}-${j.jenis}`}>
                  {sedang === `${g.guru_id}:${j.jenis}:pdf` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                  {j.label}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function IsiHalamanKomponen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const periodeId = searchParams.get('periode') || undefined;
  const [rekap, setRekap] = useState(null);
  const [jenis, setJenis] = useState([]);
  const { sedang, cetak } = useCetakAngket(rekap?.periode?.id);

  const muat = useCallback(async () => {
    try {
      const [r, j] = await Promise.all([ambilRekap({ periodeId }), daftarJenisAngket()]);
      setRekap(r);
      setJenis(j);
    } catch (e) {
      toast.error(e.message || 'Gagal memuat data komponen');
    }
  }, [periodeId]);

  useEffect(() => { muat(); }, [muat]);

  if (!rekap) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;

  return (
    <div className="space-y-4" data-testid="pkg-komponen">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><UsersRound className="h-5 w-5 text-[#006837]" /> Komponen 360° &amp; Kehadiran</h2>
        <p className="text-xs text-slate-500">Angket 360° (sejawat, peserta didik, orang tua/wali) dan kehadiran guru sebagai komponen nilai akhir PKG (05-RKAP-PKGR).</p>
      </div>

      <SaringanPeriodeRekap nilai={rekap.periode?.id}
        onUbah={(id) => setSearchParams((sp) => { const baru = new URLSearchParams(sp); baru.set('periode', id); return baru; })} />

      <Tabs defaultValue="angket" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="angket" data-testid="pkg-komponen-tab-angket">Angket 360°</TabsTrigger>
        </TabsList>
        <TabsContent value="angket" className="space-y-4">
          <KartuAngketKosong jenis={jenis} sedang={sedang} onCetak={cetak} />
          <DaftarGuruAngket guru={rekap.guru} jenis={jenis} sedang={sedang} onCetak={cetak} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Komponen penilaian di luar lembar kompetensi (kepala & tim penilai): angket 360° kertas & rekap jawabannya, serta
// kehadiran guru. Guru dari rekap periode (cakupan peran); angket dari POST /pkg/angket/cetak (lib/pkgAngket).
export default function PkgKomponenPage() {
  return (
    <PenjagaMenuPkg menuKey="komponen">
      <IsiHalamanKomponen />
    </PenjagaMenuPkg>
  );
}
