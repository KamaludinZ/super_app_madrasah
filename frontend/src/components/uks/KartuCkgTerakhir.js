import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, HeartPulse } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ambilCkgSaya } from '@/lib/ckgSaya';

const tgl = (s) => {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (s || '-');
};

// Ringkasan hasil CKG terakhir milik pengguna di dashboard (siswa & GTK). Tidak tampil bila belum ada data.
export default function KartuCkgTerakhir() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let hidup = true;
    ambilCkgSaya().then((d) => { if (hidup) setData(d); }).catch(() => {});
    return () => { hidup = false; };
  }, []);

  const r = data?.ringkasan;
  if (!r?.total) return null;

  const isi = [
    r.tinggi_badan != null && `TB ${r.tinggi_badan} cm`,
    r.berat_badan != null && `BB ${r.berat_badan} kg`,
    r.imt != null && `IMT ${r.imt}`,
  ].filter(Boolean).join(' · ');

  return (
    <Card data-testid="kartu-ckg-terakhir">
      <CardContent className="p-0">
        <Link to="/ckg-saya" className="flex items-center gap-3 p-4 hover:bg-emerald-50/50">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-50">
            <HeartPulse className="h-5 w-5 text-rose-600" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">Hasil CKG terakhir · {tgl(r.pemeriksaan_terakhir)}</span>
            <span className="block truncate text-xs text-slate-500">{isi || 'Lihat hasil pemeriksaan kesehatan Anda'}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
        </Link>
      </CardContent>
    </Card>
  );
}
