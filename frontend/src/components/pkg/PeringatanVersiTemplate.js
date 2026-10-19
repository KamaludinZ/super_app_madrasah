import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { ambilInfoTemplate } from '@/lib/pkgTemplate';
import { bandingkanVersiTemplate } from '@/lib/pkgInstrumen';

// Peringatan bila instrumen aktif tidak sejalan dengan template instrumen resmi di server: berasal dari versi
// template lain, atau isinya sudah berbeda dari berkas resmi. Kepala mendapat tombol impor ulang.
export default function PeringatanVersiTemplate({ instrumen, kepala, onImpor }) {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let hidup = true;
    ambilInfoTemplate().then((d) => { if (hidup) setInfo(d); }).catch(() => {});
    return () => { hidup = false; };
  }, []);

  const beda = bandingkanVersiTemplate(instrumen, info);
  if (!beda) return null;
  const versi = beda.jenis === 'versi';

  return (
    <div className={`flex flex-col gap-3 rounded-lg border p-3 text-sm sm:flex-row sm:items-center ${versi ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}
      role="alert" data-testid={`pkg-peringatan-versi-${beda.jenis}`}>
      <AlertTriangle className="h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {versi
            ? `Instrumen aktif memakai template ${beda.versiInstrumen}, sedangkan template resmi di server versi ${beda.versiTemplate}.`
            : `Instrumen aktif tidak lagi sama dengan berkas template resmi versi ${beda.versiTemplate}.`}
        </p>
        <p className="text-xs opacity-90">
          {versi
            ? 'Lembar penilaian baru akan memakai instrumen lama sampai kepala madrasah mengimpor ulang dari template terbaru.'
            : 'Instrumen telah diubah atau diimpor dari berkas unggahan. Pastikan perubahannya sudah disahkan.'}
        </p>
      </div>
      {kepala && versi && onImpor && (
        <Button size="sm" variant="outline" className="h-8 shrink-0 gap-1 bg-white" onClick={onImpor} data-testid="pkg-peringatan-impor">
          <FileSpreadsheet className="h-3.5 w-3.5" /> Impor ulang
        </Button>
      )}
    </div>
  );
}
