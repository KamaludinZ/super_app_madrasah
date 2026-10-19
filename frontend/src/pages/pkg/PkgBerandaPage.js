import React, { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, CalendarClock, UserCheck, Info, Loader2, AlertTriangle, RotateCw } from 'lucide-react';
import KartuRingkasanKinerja from '@/components/pkg/KartuRingkasanKinerja';
import DaftarTugasPenilaian from '@/components/pkg/DaftarTugasPenilaian';
import GridPintasanPkg from '@/components/pkg/GridPintasanPkg';
import PesanTolakPkg from '@/components/pkg/PesanTolakPkg';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatWIBPanjang } from '@/lib/datetime';
import { sisaHari } from '@/lib/pkgPengingat';
import { ambilBeranda } from '@/lib/pkg';

const IKON_PENGINGAT = { tenggat: CalendarClock, supervisi: UserCheck, info: Info };

function PengingatTenggat({ pengingat }) {
  return (
    <Card data-testid="pkg-pengingat">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4 text-[#006837]" /> Pengingat Tenggat
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pengingat.length === 0 && <p className="text-sm text-slate-500">Tidak ada tenggat dalam waktu dekat.</p>}
        {pengingat.map((p) => {
          const Ikon = IKON_PENGINGAT[p.jenis] || Info;
          const sisa = sisaHari(p.tanggal);
          return (
            <div key={p.id} className="flex gap-3" data-testid={`pkg-pengingat-${p.id}`}>
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#006837]">
                <Ikon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{p.judul}</div>
                {p.tanggal && (
                  <div className="text-xs text-slate-500">
                    {formatWIBPanjang(p.tanggal, false)}
                    {sisa >= 0 && <span className={sisa <= 7 ? 'text-rose-600 font-semibold' : ''}> · {sisa === 0 ? 'hari ini' : `${sisa} hari lagi`}</span>}
                  </div>
                )}
                <p className="text-xs text-slate-600 mt-1">{p.keterangan}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// Beranda Modul PKG (Penilaian Kinerja Guru) di dalam PkgLayout: ringkasan periode berjalan, tugas penilaian
// pengguna, pengingat tenggat, dan pintasan sub-menu PKG sesuai akses (GET /pkg/beranda).
export default function PkgBerandaPage() {
  const { keanggotaan } = useOutletContext() || {};
  const [data, setData] = useState(null);
  const [galat, setGalat] = useState(null);

  const muat = useCallback(async () => {
    setGalat(null);
    try {
      setData(await ambilBeranda());
    } catch (e) {
      setGalat(e);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  if (galat?.penolakan) return <PesanTolakPkg penolakan={galat.penolakan} />;
  if (galat) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
        <AlertTriangle className="h-8 w-8 text-amber-600" />
        <p className="text-sm text-slate-700">{galat.message}</p>
        <Button variant="outline" size="sm" onClick={muat} className="gap-2"><RotateCw className="h-4 w-4" /> Coba lagi</Button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-12 text-center" data-testid="pkg-beranda-memuat">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="pkg-beranda">
      {data.periode ? (
        <>
          <KartuRingkasanKinerja ringkasan={data.ringkasan} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DaftarTugasPenilaian tugas={data.tugas} keanggotaan={data.keanggotaan || keanggotaan} />
            </div>
            <PengingatTenggat pengingat={data.pengingat || []} />
          </div>
        </>
      ) : (
        <Card data-testid="pkg-tanpa-periode">
          <CardContent className="p-0">
            <EmptyState
              illustration="lantern"
              size="sm"
              title="Belum ada periode PKG yang berjalan"
              description="Penilaian kinerja dimulai setelah kepala madrasah menetapkan periode dan menerbitkan SK tim penilai. Ringkasan dan tugas penilaian Anda akan muncul di sini."
            />
          </CardContent>
        </Card>
      )}

      <GridPintasanPkg menu={data.menu || []} />
    </div>
  );
}
