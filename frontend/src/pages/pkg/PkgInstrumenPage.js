import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ListTree, Layers, ListChecks, Target, Loader2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import { formatWIBPanjang } from '@/lib/datetime';
import { ambilInstrumenAktif, ringkasInstrumen } from '@/lib/pkgInstrumen';

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

function IsiHalamanInstrumen() {
  const [instrumen, setInstrumen] = useState(null);

  useEffect(() => {
    ambilInstrumenAktif().then(setInstrumen).catch(() => toast.error('Gagal memuat instrumen PKG'));
  }, []);

  if (!instrumen) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;

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
            <Tag className="h-3 w-3" /> Template {instrumen.versi_template}
          </Badge>
          {instrumen.diimpor_pada && <span className="text-slate-500">Diimpor {formatWIBPanjang(instrumen.diimpor_pada)}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KartuAngka icon={Layers} label="Kompetensi" value={r.kompetensi} />
        <KartuAngka icon={ListTree} label="Sub-kompetensi" value={r.sub} />
        <KartuAngka icon={ListChecks} label="Indikator" value={r.indikator} />
        <KartuAngka icon={Target} label="Skor Maksimal" value={r.skorMaks} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {instrumen.kompetensi.map((k) => (
          <Card key={k.kode} data-testid={`pkg-kompetensi-${k.kode}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-[#006837]">{k.kode}</span>
                {k.nama}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {k.sub.map((s) => (
                <div key={s.kode} className="flex items-start gap-3 rounded-lg border border-slate-200 p-2.5">
                  <span className="shrink-0 font-mono text-xs font-semibold text-slate-500 mt-0.5">{s.kode}</span>
                  <span className="min-w-0 flex-1 text-sm text-slate-800">{s.nama}</span>
                  <Badge variant="outline" className="shrink-0 tabular-nums">{s.indikator.length} level</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
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
