import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AppWindow, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { aplikasiSaya, bukaAplikasi } from '@/lib/sso';

// Aplikasi madrasah lain (Absensi, PTSP, Koperasi, ...) yang boleh dibuka pengguna dengan login Super App
// (login lewat tiket, tanpa memasukkan password lagi). Daftar & hak akses diatur admin di Aplikasi Terhubung.
// Tidak tampil sama sekali bila pengguna tidak punya aplikasi.
export default function KartuAplikasiTerhubung() {
  const [daftar, setDaftar] = useState([]);
  const [membuka, setMembuka] = useState(null);

  useEffect(() => {
    let hidup = true;
    aplikasiSaya().then((d) => { if (hidup) setDaftar(d || []); }).catch(() => {});
    return () => { hidup = false; };
  }, []);

  if (!daftar.length) return null;

  const buka = async (app) => {
    if (membuka) return;
    setMembuka(app.id);
    try {
      await bukaAplikasi(app.id);
    } catch (e) {
      toast.error(e.message || 'Gagal membuka aplikasi.');
    } finally {
      setMembuka(null);
    }
  };

  return (
    <Card data-testid="sso-aplikasi-terhubung">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AppWindow className="h-4 w-4 text-[#006837]" /> Aplikasi Madrasah Lainnya
        </CardTitle>
        <p className="text-xs text-slate-500">Masuk langsung dengan akun Super App, tanpa login ulang.</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {daftar.map((app) => (
            <button
              key={app.id}
              type="button"
              onClick={() => buka(app)}
              disabled={!!membuka}
              className="group flex min-h-[72px] items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-[#006837]/40 hover:bg-emerald-50/50 disabled:opacity-60"
              data-testid={`sso-buka-${app.id}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-emerald-50">
                {app.url_ikon
                  ? <img src={app.url_ikon} alt="" className="h-full w-full object-contain" loading="lazy" />
                  : <AppWindow className="h-5 w-5 text-[#006837]" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-slate-900">{app.nama}</span>
                {app.deskripsi && <span className="block truncate text-[11px] text-slate-500">{app.deskripsi}</span>}
              </span>
              {membuka === app.id
                ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#006837]" />
                : <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-[#006837]" />}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
