import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertTriangle, CheckCircle2, CircleDashed, ClipboardCheck, Loader2 } from 'lucide-react';

export const warnaPersen = (p) => (p >= 80 ? 'emerald' : p >= 50 ? 'amber' : 'rose');
const BAR = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' };
const TEKS = { emerald: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700' };

export function Batang({ persen, lebar = 'w-16' }) {
  return (
    <div className={`h-1.5 ${lebar} overflow-hidden rounded-full bg-slate-100`}>
      <div className={`h-full ${BAR[warnaPersen(persen)]}`} style={{ width: `${persen}%` }} />
    </div>
  );
}

/** Status visual satu bagian: lengkap / sebagian / kosong. */
export function statusBagian(b) {
  if (b.terisi >= b.total) return 'lengkap';
  if (b.terisi === 0) return 'kosong';
  return 'sebagian';
}

const IKON = {
  lengkap: <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="lengkap" />,
  sebagian: <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="belum lengkap" />,
  kosong: <CircleDashed className="h-3.5 w-3.5 shrink-0 text-rose-600" aria-label="kosong" />,
};

/** Isi panel rincian kelengkapan per bagian (dipakai Data GTK & Data Siswa). */
export function RincianKelengkapan({ k, nama }) {
  const kosong = k.bagian.filter((b) => statusBagian(b) === 'kosong');
  const sebagian = k.bagian.filter((b) => statusBagian(b) === 'sebagian');
  return (
    <>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <ClipboardCheck className="h-4 w-4 text-[#006837]" /> Kelengkapan data
        </div>
        <span className={`text-sm font-bold tabular-nums ${TEKS[warnaPersen(k.persen)]}`}>{k.persen}%</span>
      </div>
      <div className="mb-2 truncate text-xs text-slate-500">
        {nama} · {k.terisi}/{k.total} data wajib terisi
        {(kosong.length > 0 || sebagian.length > 0) && ` · ${kosong.length} kosong, ${sebagian.length} belum lengkap`}
      </div>
      <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {k.bagian.map((b) => {
          const st = statusBagian(b);
          return (
            <li
              key={b.key}
              data-testid={`bagian-${b.key}`}
              data-status={st}
              className={`rounded-md px-1.5 py-1 ${st === 'kosong' ? 'bg-rose-50 ring-1 ring-rose-200' : st === 'sebagian' ? 'bg-amber-50/60' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  {IKON[st]} {b.label}
                  {st === 'kosong' && <span className="rounded bg-rose-100 px-1 text-[10px] font-semibold uppercase text-rose-700">Kosong</span>}
                </span>
                <span className={`tabular-nums ${TEKS[warnaPersen(b.persen)]}`}>{b.terisi}/{b.total}</span>
              </div>
              <Batang persen={b.persen} lebar="w-full" />
              {st !== 'lengkap' && b.kurang?.length > 0 && (
                <div className="mt-1 text-[11px] leading-snug text-slate-600">
                  Belum diisi: {b.kurang.slice(0, 6).join(', ')}{b.kurang.length > 6 ? `, +${b.kurang.length - 6} lainnya` : ''}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

/**
 * Sel % kelengkapan yang bisa diklik untuk melihat rincian per bagian.
 * - `kelengkapan`: rincian yang sudah tersedia (GTK), ATAU
 * - `muat`: fungsi async yang mengambil rincian saat panel dibuka (Siswa).
 * - `persen`: persen untuk sel bila rincian belum dimuat.
 * - `bagianKosong`: jumlah bagian kosong untuk chip di sel (opsional).
 * - `linkDetail` atau `onLengkapi`: aksi "Lengkapi data".
 */
export default function KelengkapanPopover({ persen, kelengkapan, muat, nama, bagianKosong, linkDetail, onLengkapi, testid }) {
  const [rinci, setRinci] = useState(kelengkapan || null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');
  const k = kelengkapan || rinci;
  const p = k?.persen ?? persen ?? 0;
  const w = warnaPersen(p);
  const jumlahKosong = bagianKosong ?? (k ? k.bagian.filter((b) => statusBagian(b) === 'kosong').length : 0);

  const buka = async (open) => {
    if (!open || kelengkapan || !muat) return;
    setMemuat(true);
    setGalat('');
    try {
      setRinci(await muat());
    } catch (e) {
      setGalat(e?.response?.status === 403 ? 'Tidak diizinkan melihat rincian ini' : 'Gagal memuat rincian kelengkapan');
    } finally {
      setMemuat(false);
    }
  };

  return (
    <Popover onOpenChange={buka}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex flex-col items-start gap-0.5 rounded px-1 py-0.5 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]"
          title="Klik untuk rincian kelengkapan per bagian"
          data-testid={testid}
        >
          <span className="flex items-center gap-2">
            <Batang persen={p} />
            <span className={`text-xs font-semibold tabular-nums ${TEKS[w]}`}>{p}%</span>
          </span>
          {jumlahKosong > 0 && (
            <span className="rounded bg-rose-50 px-1 text-[10px] font-medium text-rose-700">{jumlahKosong} bagian kosong</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3" data-testid="rincian-kelengkapan">
        {memuat && (
          <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-[#006837]" /> Memuat rincian...
          </div>
        )}
        {galat && !memuat && <div className="py-4 text-center text-xs text-rose-700">{galat}</div>}
        {k && !memuat && <RincianKelengkapan k={k} nama={nama} />}
        {k && !memuat && k.persen < 100 && linkDetail && (
          <Link to={linkDetail} className="mt-2 block text-center text-xs font-medium text-[#006837] hover:underline">
            Lengkapi data di halaman detail
          </Link>
        )}
        {k && !memuat && k.persen < 100 && onLengkapi && (
          <button type="button" onClick={onLengkapi} className="mt-2 block w-full text-center text-xs font-medium text-[#006837] hover:underline">
            Lengkapi data di detail siswa
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
