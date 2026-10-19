import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { ListTree, Layers, ListChecks, Target, Loader2, Tag, AlertTriangle, RotateCw, FileSpreadsheet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { toast } from 'sonner';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import HierarkiInstrumen from '@/components/pkg/HierarkiInstrumen';
import ImporInstrumenDialog from '@/components/pkg/ImporInstrumenDialog';
import HasilImporInstrumen from '@/components/pkg/HasilImporInstrumen';
import UbahSubKompetensiDialog from '@/components/pkg/UbahSubKompetensiDialog';
import DaftarVersiInstrumen from '@/components/pkg/DaftarVersiInstrumen';
import PenandaInstrumenAktif from '@/components/pkg/PenandaInstrumenAktif';
import PeringatanVersiTemplate from '@/components/pkg/PeringatanVersiTemplate';
import { formatWIBPanjang } from '@/lib/datetime';
import { ambilInstrumenAktif, labelVersi, ringkasInstrumen } from '@/lib/pkgInstrumen';

function KartuAngka({ icon: Icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-80" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

// Keadaan kosong: belum ada instrumen aktif. Kepala diarahkan mengimpor dari template resmi.
function InstrumenKosong({ kepala, onImpor }) {
  return (
    <Card data-testid="pkg-instrumen-kosong">
      <CardContent className="p-0">
        <EmptyState
          illustration="quran"
          size="sm"
          title="Instrumen PKG belum dimuat"
          description={kepala
            ? 'Muat kompetensi, indikator, dan bobot dari berkas template resmi PKG agar penilai dapat mulai mengisi lembar penilaian.'
            : 'Kepala madrasah belum memuat instrumen dari template resmi. Lembar penilaian dapat dibuka setelah instrumen tersedia.'}
          {...(kepala ? { actionLabel: 'Impor Instrumen', onAction: onImpor } : {})}
        />
      </CardContent>
    </Card>
  );
}

function IsiHalamanInstrumen() {
  const { keanggotaan } = useOutletContext() || {};
  const [instrumen, setInstrumen] = useState(undefined); // undefined = memuat, null = belum ada instrumen
  const [galat, setGalat] = useState(false);
  const [impor, setImpor] = useState(false);
  const [hasilImpor, setHasilImpor] = useState(null);
  const [ubahSub, setUbahSub] = useState(null);
  const kepala = keanggotaan?.peran === 'kepala';

  const muat = useCallback(async () => {
    setGalat(false);
    setInstrumen(undefined);
    try {
      setInstrumen(await ambilInstrumenAktif());
    } catch {
      setGalat(true);
      toast.error('Gagal memuat instrumen PKG');
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  if (galat) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
        <AlertTriangle className="h-8 w-8 text-amber-600" />
        <p className="text-sm text-slate-700">Instrumen PKG gagal dimuat.</p>
        <Button variant="outline" size="sm" onClick={muat} className="gap-2"><RotateCw className="h-4 w-4" /> Coba lagi</Button>
      </div>
    );
  }
  if (instrumen === undefined) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;
  const dialogImpor = (
    <ImporInstrumenDialog open={impor} onClose={() => setImpor(false)} onTerapkan={(baru, hasil) => { setImpor(false); setInstrumen(baru); setHasilImpor(hasil); }} />
  );
  if (!instrumen || !instrumen.kompetensi?.length) {
    return <><InstrumenKosong kepala={kepala} onImpor={() => setImpor(true)} />{dialogImpor}</>;
  }

  const r = ringkasInstrumen(instrumen);

  return (
    <div className="space-y-4" data-testid="pkg-instrumen">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><ListTree className="h-5 w-5 text-[#006837]" /> Master Instrumen PKG</h2>
          <p className="text-xs text-slate-500">Kompetensi, sub-kompetensi, dan indikator perilaku acuan penilaian kinerja guru.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1" data-testid="pkg-instrumen-versi">
            <Tag className="h-3 w-3" /> {labelVersi(instrumen)}
          </Badge>
          {instrumen.diimpor_pada && <span className="text-slate-500">Diimpor {formatWIBPanjang(instrumen.diimpor_pada)}</span>}
          {kepala && (
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setImpor(true)} data-testid="pkg-instrumen-impor">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Impor Instrumen
            </Button>
          )}
        </div>
      </div>

      <HasilImporInstrumen hasil={hasilImpor} onTutup={() => setHasilImpor(null)} />
      <PeringatanVersiTemplate instrumen={instrumen} kepala={kepala} onImpor={() => setImpor(true)} />
      <PenandaInstrumenAktif instrumen={instrumen} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KartuAngka icon={Layers} label="Kompetensi" value={r.kompetensi} />
        <KartuAngka icon={ListTree} label="Sub-kompetensi" value={r.sub} />
        <KartuAngka icon={ListChecks} label="Indikator" value={r.indikator} />
        <KartuAngka icon={Target} label="Skor Maksimal" value={r.skorMaks} />
      </div>

      <HierarkiInstrumen kompetensi={instrumen.kompetensi} onUbah={kepala ? setUbahSub : undefined} />
      <DaftarVersiInstrumen muatUlangKunci={`${instrumen.id}:${instrumen.revisi}`} />
      {dialogImpor}
      <UbahSubKompetensiDialog sub={ubahSub} onClose={() => setUbahSub(null)} onTersimpan={(baru) => { setUbahSub(null); setInstrumen(baru); }} />
    </div>
  );
}

// Master Instrumen PKG (semua anggota SK dapat membaca): struktur kompetensi dari template resmi yang dipakai
// sebagai acuan lembar penilaian. Data sementara dari lib/pkgInstrumen (tiruan).
export default function PkgInstrumenPage() {
  return (
    <PenjagaMenuPkg menuKey="instrumen">
      <IsiHalamanInstrumen />
    </PenjagaMenuPkg>
  );
}
