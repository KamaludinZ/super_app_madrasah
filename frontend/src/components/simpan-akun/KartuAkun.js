import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Globe, AppWindow, ChevronRight } from 'lucide-react';

// Domain singkat dari link web (tanpa protokol & www), untuk ditampilkan di kartu.
export function domainDari(link) {
  if (!link) return '';
  try {
    return new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`).hostname.replace(/^www\./, '');
  } catch {
    return link;
  }
}

const WARNA = ['bg-emerald-100 text-emerald-800', 'bg-sky-100 text-sky-800', 'bg-amber-100 text-amber-800',
  'bg-violet-100 text-violet-800', 'bg-rose-100 text-rose-800', 'bg-teal-100 text-teal-800'];

function warnaDari(teks = '') {
  let h = 0;
  for (let i = 0; i < teks.length; i += 1) h = (h * 31 + teks.charCodeAt(i)) % 997;
  return WARNA[h % WARNA.length];
}

const inisial = (teks = '') => teks.trim().split(/\s+/).slice(0, 2).map((k) => k[0]).join('').toUpperCase() || '?';

// Kartu ringkas satu akun tersimpan: nama akun & aplikasi (tanpa username/password).
export default function KartuAkun({ akun, onPilih }) {
  const domain = domainDari(akun.link_web);
  const Ikon = akun.link_web ? Globe : AppWindow;
  return (
    <Card className="transition-colors hover:border-slate-300" data-testid={`simpan-akun-item-${akun.id}`}>
      <button type="button" className="w-full text-left" onClick={() => onPilih?.(akun)} aria-label={`Buka detail ${akun.nama_akun}`}>
        <CardContent className="flex items-center gap-3 p-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${warnaDari(akun.nama_aplikasi)}`} aria-hidden>
            {inisial(akun.nama_aplikasi)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{akun.nama_akun}</p>
            <p className="truncate text-sm text-slate-600">{akun.nama_aplikasi}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400">
              <Ikon className="h-3 w-3 shrink-0" /> {domain || 'Aplikasi (bukan web)'}
            </p>
          </div>
          {onPilih && <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
        </CardContent>
      </button>
    </Card>
  );
}
