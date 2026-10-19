import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RUTE_PKG_TERSEDIA } from '@/lib/pkg';
import {
  LayoutGrid, Lock, CalendarCog, FileBadge, Split, ShieldCheck, ListTree, ClipboardPen, BarChart3, Printer, History,
} from 'lucide-react';

const IKON_MENU = {
  periode: CalendarCog,
  sk: FileBadge,
  penugasan: Split,
  supervisi: ShieldCheck,
  instrumen: ListTree,
  penilaian: ClipboardPen,
  rekap: BarChart3,
  cetak: Printer,
  audit: History,
};

function IsiPintasan({ menu, Ikon, status }) {
  return (
    <>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#006837]">
        <Ikon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-sm font-semibold text-slate-900 group-hover:text-[#006837]">{menu.label}</span>
          {menu.khusus === 'kepala' && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-500" title="Dikelola kepala madrasah">
              <Lock className="h-2.5 w-2.5" /> Kepala
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500">{menu.keterangan}</div>
        {status && <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{status}</div>}
      </div>
    </>
  );
}

// Status tile yang tidak dapat dibuka: alasan penolakan dari backend, atau halaman belum dibangun.
const STATUS_ALASAN = {
  bukan_kepala: 'Khusus kepala',
  bukan_penilai: 'Khusus penilai',
  belum_disupervisi: 'Menunggu supervisi',
  bukan_anggota_sk: 'Tanpa akses',
};

// Pintasan Menu PKG: akses cepat ke sembilan sub-menu modul PKG langsung dari beranda.
// `menu` dari GET /pkg/beranda: [{ key, label, keterangan, to, khusus, akses, alasan }]. Sub-menu tanpa akses
// atau yang halamannya belum dibangun (lib/pkg RUTE_PKG_TERSEDIA) tampil redup dan tidak dapat diklik.
export default function GridPintasanPkg({ menu = [] }) {
  return (
    <Card data-testid="pkg-pintasan">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-[#006837]" /> Pintasan Menu PKG
        </CardTitle>
      </CardHeader>
      <CardContent>
        <nav aria-label="Menu PKG" className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3">
          {menu.map((m) => {
            const Ikon = IKON_MENU[m.key] || LayoutGrid;
            const status = !m.akses ? (STATUS_ALASAN[m.alasan] || 'Tanpa akses') : !RUTE_PKG_TERSEDIA.has(m.to) ? 'Segera' : null;
            return !status ? (
              <Link
                key={m.key}
                to={m.to}
                className="group flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-[#006837]/40 hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]"
                data-testid={`pkg-pintasan-${m.key}`}
              >
                <IsiPintasan menu={m} Ikon={Ikon} />
              </Link>
            ) : (
              <div
                key={m.key}
                aria-disabled="true"
                className="flex items-start gap-3 rounded-xl border border-dashed border-slate-200 p-3 opacity-60"
                data-testid={`pkg-pintasan-${m.key}`}
              >
                <IsiPintasan menu={m} Ikon={Ikon} status={status} />
              </div>
            );
          })}
        </nav>
      </CardContent>
    </Card>
  );
}
