import React, { useEffect, useState } from 'react';
import { AlertTriangle, Globe, Loader2, Smartphone } from 'lucide-react';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { formatWIB } from '@/lib/datetime';
import { labelJenjang } from '@/lib/mapelUjian';
import { pesanGalat } from '@/lib/ujian';
import { ringkasPerangkat } from '@/lib/ujianTautanPublik';
import { muatRincianKlik } from '@/lib/ujianLinkSoal';

const BATAS = 200;
const jamDetik = (iso) => formatWIB(iso, 'Time', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const tglPendek = (iso) => formatWIB(iso, 'Date', { weekday: 'short', day: 'numeric', month: 'short' });

/** Daftar sumber terbanyak (IP / perangkat) dengan batang proporsional terhadap total klik. */
function DaftarSumber({ judul, Ikon, baris, kunci, total, format = (v) => v, testId }) {
  const tampil = baris.slice(0, 5);
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 p-3" data-testid={testId}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Ikon className="h-3.5 w-3.5 text-slate-400" /> {judul}</p>
      <ul className="space-y-1.5">
        {tampil.map((b) => {
          const persen = total ? Math.round((b.jumlah / total) * 100) : 0;
          return (
            <li key={b[kunci]} className="text-xs">
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate font-mono text-slate-700" title={b[kunci]}>{format(b[kunci])}</span>
                <span className="shrink-0 tabular-nums text-slate-500">{b.jumlah.toLocaleString('id-ID')} · {persen}%</span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <div className="h-full rounded-full bg-[#006837]" style={{ width: `${Math.max(2, persen)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
      {baris.length > tampil.length && <p className="mt-1.5 text-[11px] text-slate-400">+{baris.length - tampil.length} lainnya</p>}
    </div>
  );
}

/**
 * Panel samping rincian klik "Mengerjakan" satu mapel (dari jejak audit): ringkasan IP & perangkat terbanyak, lalu daftar
 * klik terbaru (waktu, IP, perangkat, sesi). Tidak ada penandaan otomatis "mencurigakan": satu IP jaringan sekolah/lab
 * wajar dipakai banyak siswa — admin menilai sendiri, lalu dapat mempersempit jendela atau menutup portal.
 * `sasaran` = { ujianId, jenjang, nama, data: entri intensitas } atau null.
 */
export default function RincianKlikSheet({ sasaran, onTutup }) {
  const [hasil, setHasil] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const linkId = sasaran?.data?.link_soal_id;

  useEffect(() => {
    if (!sasaran || !linkId) return undefined;
    let hidup = true;
    setHasil(null); setGalat(''); setMemuat(true);
    muatRincianKlik(sasaran.ujianId, linkId, { batas: BATAS })
      .then((r) => { if (hidup) setHasil(r); })
      .catch((e) => { if (hidup) setGalat(pesanGalat(e, 'Gagal memuat rincian klik.')); })
      .finally(() => { if (hidup) setMemuat(false); });
    return () => { hidup = false; };
  }, [sasaran, linkId]);

  const d = sasaran?.data;
  return (
    <Sheet open={!!sasaran} onOpenChange={(o) => { if (!o) onTutup?.(); }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg" data-testid="rincian-klik">
        <SheetHeader className="text-left">
          <SheetTitle>Rincian klik · {sasaran?.nama} {sasaran && labelJenjang(sasaran.jenjang)}</SheetTitle>
          <SheetDescription>
            {d?.mulai_at ? `${tglPendek(d.mulai_at)} · ${formatWIB(d.mulai_at, 'Time', { hour: '2-digit', minute: '2-digit' })}–${formatWIB(d.selesai_at, 'Time', { hour: '2-digit', minute: '2-digit' })} WIB` : 'Tanpa jendela'}
            {d?.url_host ? ` · ${d.url_host}` : ''}. Klik sah yang tercatat di jejak audit.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {memuat && <div className="py-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[#006837]" /></div>}
          {galat && (
            <p className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {galat}
            </p>
          )}
          {hasil && !hasil.total && <p className="rounded-md bg-slate-50 px-3 py-6 text-center text-sm text-slate-500" data-testid="rincian-kosong">Belum ada klik yang tercatat.</p>}
          {hasil?.total > 0 && (
            <>
              <p className="text-sm text-slate-700" data-testid="rincian-total">
                <span className="text-lg font-bold tabular-nums text-slate-900">{hasil.total.toLocaleString('id-ID')}</span> klik dari{' '}
                <span className="font-semibold">{hasil.per_ip.length}</span> IP dan <span className="font-semibold">{hasil.per_perangkat.length}</span> jenis perangkat
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DaftarSumber judul="IP terbanyak" Ikon={Globe} baris={hasil.per_ip} kunci="ip" total={hasil.total} testId="rincian-per-ip" />
                <DaftarSumber judul="Perangkat terbanyak" Ikon={Smartphone} baris={hasil.per_perangkat} kunci="perangkat" total={hasil.total}
                  format={ringkasPerangkat} testId="rincian-per-perangkat" />
              </div>
              <p className="text-[11px] text-slate-500">Satu IP dapat dipakai banyak siswa sekaligus (jaringan sekolah atau lab komputer).</p>

              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid-cols-[6.5rem_8rem_minmax(0,1fr)]" aria-hidden="true">
                  <span>Waktu (WIB)</span><span className="hidden sm:block">IP</span><span>Perangkat</span>
                </div>
                <ol className="divide-y divide-slate-100" data-testid="rincian-daftar">
                  {hasil.klik.map((k) => (
                    <li key={k.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 px-3 py-1.5 text-xs sm:grid-cols-[6.5rem_8rem_minmax(0,1fr)]">
                      <span className="tabular-nums text-slate-700"><span className="block text-[11px] text-slate-400">{tglPendek(k.waktu)}</span>{jamDetik(k.waktu)}</span>
                      <span className="hidden truncate font-mono text-slate-700 sm:block" title={k.ip}>{k.ip}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-slate-700" title={k.perangkat}>{ringkasPerangkat(k.perangkat)}</span>
                        <span className="block truncate font-mono text-[11px] text-slate-400 sm:hidden">{k.ip}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
              {hasil.total > hasil.klik.length && (
                <p className="text-xs text-slate-500" data-testid="rincian-terpotong">Menampilkan {hasil.klik.length} klik terbaru dari {hasil.total.toLocaleString('id-ID')}.</p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
