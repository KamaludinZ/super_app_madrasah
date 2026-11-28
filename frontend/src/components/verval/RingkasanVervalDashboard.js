import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ClipboardCheck, GraduationCap, Inbox, Users, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatWIB, parseServerDate } from '@/lib/datetime';

/**
 * Stats overview Verval Data di dashboard admin: ajuan verval siswa & GTK yang menunggu ditinjau, ajuan baru 24 jam
 * terakhir, dan ajuan terbaru — agar admin langsung tahu bila ada ajuan masuk. Dimuat ulang tiap menit & saat tab aktif.
 *
 * Sumber: GET /verval-requests/stats/summary -> rincian.{siswa,gtk} = { pending, approved, rejected, baru_24_jam,
 * terbaru: { nama, request_type, created_at } | null }.
 */
const KELOMPOK = [
  { kunci: 'siswa', judul: 'Verval Data Siswa', Ikon: GraduationCap, ke: '/admin/verval-siswa' },
  { kunci: 'gtk', judul: 'Verval Data GTK', Ikon: Users, ke: '/admin/verval-gtk' },
];
const JENIS_AJUAN = { profile_update: 'perubahan data', prestasi_create: 'prestasi baru' };
const MUAT_ULANG_MS = 60000;

export function waktuRelatif(nilai, sekarang = Date.now()) {
  const d = parseServerDate(nilai);
  if (!d) return '';
  const menit = Math.max(0, Math.round((sekarang - d.getTime()) / 60000));
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.round(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.round(jam / 24);
  if (hari <= 7) return `${hari} hari lalu`;
  return formatWIB(nilai, 'Date', { day: 'numeric', month: 'short', year: 'numeric' });
}

function PanelVerval({ judul, Ikon, ke, data, kunci }) {
  const menunggu = data?.pending ?? 0;
  const baru = data?.baru_24_jam ?? 0;
  const ada = menunggu > 0;
  const t = data?.terbaru;
  return (
    <Link to={ke} data-testid={`verval-panel-${kunci}`}
      className={`group flex flex-col gap-3 rounded-xl border p-4 transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] ${
        ada ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${ada ? 'bg-amber-100 text-amber-700' : 'bg-[#006837]/10 text-[#006837]'}`}>
            <Ikon className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900">{judul}</h3>
        </div>
        {baru > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-semibold text-white" data-testid={`verval-baru-${kunci}`}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            {baru} baru
          </span>
        )}
      </div>

      <div className="flex items-end gap-2">
        <span className={`text-3xl font-extrabold tabular-nums ${ada ? 'text-amber-800' : 'text-slate-900'}`} data-testid={`verval-menunggu-${kunci}`}>{menunggu}</span>
        <span className="pb-1 text-xs font-medium text-slate-600">ajuan menunggu ditinjau</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> {data?.approved ?? 0} disetujui</span>
        <span className="inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5 text-rose-500" /> {data?.rejected ?? 0} ditolak</span>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-200/70 pt-3 text-xs">
        <span className="min-w-0 truncate text-slate-600" data-testid={`verval-terbaru-${kunci}`}>
          {t ? <>Terbaru: <strong className="text-slate-800">{t.nama || 'Tanpa nama'}</strong> · {JENIS_AJUAN[t.request_type] || 'ajuan'} · {waktuRelatif(t.created_at)}</>
            : 'Tidak ada ajuan yang menunggu'}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#006837] group-hover:underline">
          {ada ? 'Tinjau' : 'Buka'} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

export default function RingkasanVervalDashboard() {
  const [data, setData] = useState(null);
  const [gagal, setGagal] = useState(false);

  const muat = useCallback(() => api.get('/verval-requests/stats/summary')
    .then(({ data: d }) => { setData(d); setGagal(false); })
    .catch(() => setGagal(true)), []);

  useEffect(() => {
    muat();
    const t = setInterval(() => { if (document.visibilityState === 'visible') muat(); }, MUAT_ULANG_MS);
    const saatTampil = () => { if (document.visibilityState === 'visible') muat(); };
    document.addEventListener('visibilitychange', saatTampil);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', saatTampil); };
  }, [muat]);

  const total = (data?.rincian?.siswa?.pending ?? 0) + (data?.rincian?.gtk?.pending ?? 0);
  return (
    <Card data-testid="verval-stats-overview">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#006837]/10">
              <ClipboardCheck className="h-5 w-5 text-[#006837]" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Verval Data</h2>
              <p className="text-xs text-slate-500">Ajuan verifikasi &amp; validasi data dari siswa dan GTK</p>
            </div>
          </div>
          {data && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${total ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}
              data-testid="verval-total-menunggu">
              {total ? <Inbox className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {total ? `${total} ajuan perlu ditinjau` : 'Semua ajuan sudah ditinjau'}
            </span>
          )}
        </div>
        {gagal && !data ? (
          <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Ringkasan verval belum dapat dimuat.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {KELOMPOK.map((k) => <PanelVerval key={k.kunci} {...k} data={data?.rincian?.[k.kunci]} />)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
