import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Award, CalendarRange, Bell, CalendarClock, UserCheck, Info,
} from 'lucide-react';
import KartuRingkasanKinerja from '@/components/pkg/KartuRingkasanKinerja';
import DaftarTugasPenilaian from '@/components/pkg/DaftarTugasPenilaian';
import GridPintasanPkg from '@/components/pkg/GridPintasanPkg';
import PesanTolakPkg from '@/components/pkg/PesanTolakPkg';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuth } from '@/lib/AuthContext';
import { formatWIB, formatWIBPanjang } from '@/lib/datetime';
import { sisaHari } from '@/lib/pkgPengingat';
import { MENU_PKG, SKENARIO_BERANDA, berandaTiruan } from '@/lib/pkgDataTiruan';

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

// Beranda Modul PKG (Penilaian Kinerja Guru): ringkasan periode berjalan, tugas penilaian pengguna,
// pengingat tenggat, dan pintasan ke sub-menu PKG. Sementara memakai data tiruan (lib/pkgDataTiruan);
// keadaan lain bisa dicoba lewat ?skenario= (lihat SKENARIO_BERANDA).
export default function PkgBerandaPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const skenario = SKENARIO_BERANDA[searchParams.get('skenario')] ? searchParams.get('skenario') : 'normal';
  const { periode, ringkasan, keanggotaan, tugas, pengingat, penolakan } = berandaTiruan(skenario);

  if (penolakan) return <PesanTolakPkg penolakan={penolakan} />;

  return (
    <div className="space-y-6" data-testid="pkg-beranda">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="h-7 w-7 text-[#006837]" /> Penilaian Kinerja Guru
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Beranda PKG{user?.full_name ? ` — ${user.full_name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="pkg-periode">
          {periode && (
            <>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
                <CalendarRange className="h-3 w-3" /> {periode.nama_periode}
              </Badge>
              <span className="text-slate-500">
                {formatWIB(periode.tanggal_buka, 'Date', { day: 'numeric', month: 'short' })} – {formatWIB(periode.tanggal_tutup, 'Date', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </>
          )}
          <Badge variant="outline" className="border-dashed text-slate-500" title={SKENARIO_BERANDA[skenario]}>Data tiruan</Badge>
        </div>
      </div>

      {periode ? (
        <>
          <KartuRingkasanKinerja ringkasan={ringkasan} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <DaftarTugasPenilaian tugas={tugas} keanggotaan={keanggotaan} />
            </div>
            <PengingatTenggat pengingat={pengingat} />
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

      <GridPintasanPkg menu={MENU_PKG} />
    </div>
  );
}
