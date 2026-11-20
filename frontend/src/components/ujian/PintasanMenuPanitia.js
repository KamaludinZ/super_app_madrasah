import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutGrid } from 'lucide-react';
import { IKON_MENU_UJIAN as IKON_MENU } from '@/lib/menuUjian';
import { LABEL_JABATAN, RUTE_UJIAN_TERSEDIA } from '@/lib/ujian';

function Isi({ menu, Ikon, status }) {
  return (
    <>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#006837]">
        <Ikon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold text-slate-900 group-hover:text-[#006837]">{menu.label}</span>
        <div className="text-xs text-slate-500">{menu.keterangan}</div>
        {status && <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{status}</div>}
      </div>
    </>
  );
}

function keteranganAkses(akses) {
  if (!akses) return null;
  if (akses.pengelola) return 'Anda pengelola ujian: semua menu kepanitiaan terbuka.';
  const jabatan = (akses.jabatan || []).map((j) => LABEL_JABATAN[j] || j);
  if (jabatan.length) return `Menu sesuai jabatan Anda: ${jabatan.join(', ')}.`;
  if (akses.pimpinan) return 'Anda memantau ujian: daftar hadir, berita acara, cetak, dan arsip.';
  return 'Anda belum tercatat sebagai panitia ujian semester ini.';
}

/**
 * Pintasan Menu Panitia: jalan pintas ke menu kepanitiaan yang relevan sesuai jabatan pengguna login.
 * Hanya menu yang boleh diakses yang ditampilkan; menu yang halamannya belum dibangun tampil redup ("Segera").
 * `menu` = [{ key, label, keterangan, to, akses }] dan `akses` = { pengelola, pimpinan, jabatan } dari beranda.
 */
export default function PintasanMenuPanitia({ menu = [], akses }) {
  const boleh = menu.filter((m) => m.akses);
  return (
    <Card data-testid="ujian-pintasan">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-[#006837]" /> Pintasan Menu Panitia
        </CardTitle>
        <p className="text-xs text-slate-500" data-testid="ujian-pintasan-keterangan">{keteranganAkses(akses)}</p>
      </CardHeader>
      <CardContent>
        {boleh.length === 0 ? (
          <p className="text-sm text-slate-500">Belum ada menu kepanitiaan untuk Anda.</p>
        ) : (
          <nav aria-label="Menu panitia ujian" className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3">
            {boleh.map((m) => {
              const Ikon = IKON_MENU[m.key] || LayoutGrid;
              return RUTE_UJIAN_TERSEDIA.has(m.to) ? (
                <Link
                  key={m.key}
                  to={m.to}
                  className="group flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors hover:border-[#006837]/40 hover:bg-emerald-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]"
                  data-testid={`ujian-pintasan-${m.key}`}
                >
                  <Isi menu={m} Ikon={Ikon} />
                </Link>
              ) : (
                <div key={m.key} aria-disabled="true" className="flex items-start gap-3 rounded-xl border border-dashed border-slate-200 p-3 opacity-60" data-testid={`ujian-pintasan-${m.key}`}>
                  <Isi menu={m} Ikon={Ikon} status="Segera" />
                </div>
              );
            })}
          </nav>
        )}
      </CardContent>
    </Card>
  );
}
