import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ClipboardPen, Loader2, AlertTriangle, RotateCw } from 'lucide-react';
import DaftarTugasPenilaian from '@/components/pkg/DaftarTugasPenilaian';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import PenandaInstrumenAktif from '@/components/pkg/PenandaInstrumenAktif';
import { ambilTugasSaya } from '@/lib/pkg';
import { ambilInstrumenAktif } from '@/lib/pkgInstrumen';

const RINGKAS = [
  { key: 'belum', label: 'Belum dimulai', kelas: 'text-slate-700' },
  { key: 'draf', label: 'Draf', kelas: 'text-amber-700' },
  { key: 'terkunci', label: 'Terkunci', kelas: 'text-emerald-700' },
];

function IsiHalamanPenilaian() {
  const { keanggotaan } = useOutletContext() || {};
  const [tugas, setTugas] = useState(null);
  const [instrumen, setInstrumen] = useState(null);
  const [galat, setGalat] = useState(null);

  const muat = useCallback(async () => {
    setGalat(null);
    try {
      setTugas(await ambilTugasSaya());
    } catch (e) {
      setGalat(e);
    }
  }, []);

  useEffect(() => {
    muat();
    ambilInstrumenAktif().then(setInstrumen).catch(() => setInstrumen(null));
  }, [muat]);

  const jumlah = useMemo(() => (tugas || []).reduce((acc, t) => ({ ...acc, [t.status]: (acc[t.status] || 0) + 1 }), {}), [tugas]);

  if (galat) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
        <AlertTriangle className="h-8 w-8 text-amber-600" />
        <p className="text-sm text-slate-700">{galat.message}</p>
        <Button variant="outline" size="sm" onClick={muat} className="gap-2"><RotateCw className="h-4 w-4" /> Coba lagi</Button>
      </div>
    );
  }
  if (!tugas) return <div className="p-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;

  return (
    <div className="space-y-4" data-testid="pkg-penilaian">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2"><ClipboardPen className="h-5 w-5 text-[#006837]" /> Penilaian Kinerja</h2>
          <p className="text-xs text-slate-500">Guru yang dibagikan kepala madrasah kepada Anda pada periode berjalan.</p>
        </div>
        <PenandaInstrumenAktif instrumen={instrumen} varian="lencana" />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center" data-testid="pkg-penilaian-ringkasan">
        {RINGKAS.map((r) => (
          <div key={r.key} className="rounded-lg border border-slate-200 bg-white py-2">
            <div className={`text-xl font-bold tabular-nums ${r.kelas}`}>{jumlah[r.key] || 0}</div>
            <div className="text-[11px] text-slate-500">{r.label}</div>
          </div>
        ))}
      </div>

      <DaftarTugasPenilaian tugas={tugas} keanggotaan={keanggotaan} />
    </div>
  );
}

// Daftar tugas penilaian guru (penilai yang sudah disupervisi; kepala selalu boleh): guru yang dibagikan beserta
// status & progres lembar (GET /pkg/beranda/tugas-saya). Tombol per guru membuka lembar penilaian.
export default function PkgPenilaianPage() {
  return (
    <PenjagaMenuPkg menuKey="penilaian">
      <IsiHalamanPenilaian />
    </PenjagaMenuPkg>
  );
}
