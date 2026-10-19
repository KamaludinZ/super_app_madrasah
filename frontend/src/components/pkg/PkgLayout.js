import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Award, CalendarRange, Loader2, Lock, AlertTriangle, RotateCw } from 'lucide-react';
import PesanTolakPkg from '@/components/pkg/PesanTolakPkg';
import { LencanaTemplate } from '@/components/pkg/IndikatorChecksumTemplate';
import { formatWIB } from '@/lib/datetime';
import { RUTE_PKG_TERSEDIA, ambilKeanggotaan, ambilMenuPkg, labelPeranPkg } from '@/lib/pkg';

const kelasTab = ({ isActive }) => `shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
  isActive ? 'bg-[#006837] text-white' : 'text-slate-600 hover:bg-emerald-50 hover:text-[#006837]'
}`;

// Kerangka semua halaman modul PKG: memeriksa keanggotaan SK aktif (GET /pkg/sk/my-membership), menolak
// non-anggota, lalu menampilkan kepala modul + sub-navigasi. Halaman anak menerima konteks lewat
// useOutletContext(): { keanggotaan, menu, muatUlang }.
export default function PkgLayout() {
  const [keanggotaan, setKeanggotaan] = useState(null);
  const [menu, setMenu] = useState([]);
  const [galat, setGalat] = useState(null);
  const [memuat, setMemuat] = useState(true);

  const muatUlang = useCallback(async () => {
    setMemuat(true);
    setGalat(null);
    try {
      const k = await ambilKeanggotaan();
      setKeanggotaan(k);
      setMenu(k.anggota ? await ambilMenuPkg() : []);
    } catch (e) {
      setGalat(e);
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { muatUlang(); }, [muatUlang]);

  if (memuat && !keanggotaan) {
    return (
      <div className="p-12 text-center" data-testid="pkg-memuat">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
        <p className="text-slate-500">Memeriksa keanggotaan SK PKG...</p>
      </div>
    );
  }
  if (galat?.penolakan) return <PesanTolakPkg penolakan={galat.penolakan} />;
  if (galat) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-12 text-center" role="alert" data-testid="pkg-galat">
        <AlertTriangle className="h-8 w-8 text-amber-600" />
        <p className="text-sm text-slate-700">{galat.message}</p>
        <Button variant="outline" size="sm" onClick={muatUlang} className="gap-2"><RotateCw className="h-4 w-4" /> Coba lagi</Button>
      </div>
    );
  }
  if (!keanggotaan?.anggota) return <PesanTolakPkg penolakan={keanggotaan?.penolakan} />;

  const { periode } = keanggotaan;
  const peran = labelPeranPkg(keanggotaan);

  return (
    <div className="space-y-5" data-testid="pkg-layout">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="h-7 w-7 text-[#006837]" /> Penilaian Kinerja Guru
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {keanggotaan.nomor_sk ? `SK ${keanggotaan.nomor_sk}` : 'Belum ada SK penilaian aktif'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs" data-testid="pkg-periode">
          {periode && (
            <>
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 gap-1">
                <CalendarRange className="h-3 w-3" /> {periode.nama_periode}
              </Badge>
              {periode.tanggal_buka && periode.tanggal_tutup && (
                <span className="text-slate-500">
                  {formatWIB(periode.tanggal_buka, 'Date', { day: 'numeric', month: 'short' })} – {formatWIB(periode.tanggal_tutup, 'Date', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </>
          )}
          {peran && <Badge variant="outline" data-testid="pkg-peran">{peran}</Badge>}
          <LencanaTemplate />
        </div>
      </div>

      <nav aria-label="Sub-menu PKG" className="-mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 pb-2" data-testid="pkg-subnav">
        <NavLink to="/pkg" end className={kelasTab}>Beranda</NavLink>
        <NavLink to="/pkg/keanggotaan" className={kelasTab} data-testid="pkg-subnav-keanggotaan">Status Saya</NavLink>
        <NavLink to="/pkg/template" className={kelasTab} data-testid="pkg-subnav-template">Template</NavLink>
        {menu.map((m) => {
          const siap = m.akses && RUTE_PKG_TERSEDIA.has(m.to);
          return siap ? (
            <NavLink key={m.key} to={m.to} className={kelasTab} data-testid={`pkg-subnav-${m.key}`}>{m.label}</NavLink>
          ) : (
            <span
              key={m.key}
              aria-disabled="true"
              title={m.akses ? 'Segera tersedia' : 'Tidak tersedia untuk peran Anda'}
              className="shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-slate-400"
              data-testid={`pkg-subnav-${m.key}`}
            >
              {!m.akses && <Lock className="h-3 w-3" />}{m.label}
            </span>
          );
        })}
      </nav>

      <Outlet context={{ keanggotaan, menu, muatUlang }} />
    </div>
  );
}
