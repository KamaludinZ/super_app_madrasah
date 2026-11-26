import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Info, Loader2, WifiOff, X, XCircle } from 'lucide-react';
import { formatWIB } from '@/lib/datetime';
import { TAHAP_IMPOR, labelTahap, muatImpor, persenProgres, pesanGalatUnggah, teksPosisiGagal } from '@/lib/ujianNilai';
import { BadgeStatusImpor } from '@/components/ujian/nilai/MonitoringImpor';

function Batang({ diproses, total, gagal, label, kecil }) {
  const persen = persenProgres(diproses, total);
  const persenGagal = total ? Math.min(persen, Math.round((gagal / total) * 100)) : 0;
  return (
    <div>
      <div className={`mb-1 flex items-center justify-between ${kecil ? 'text-xs' : 'text-sm'}`}>
        <span className="font-medium text-slate-800">{label}</span>
        <span className="tabular-nums text-slate-500">{diproses}/{total} baris · {persen}%</span>
      </div>
      <div className={`flex overflow-hidden rounded-full bg-slate-100 ${kecil ? 'h-1.5' : 'h-2.5'}`} role="progressbar" aria-valuenow={persen} aria-valuemin={0} aria-valuemax={100} aria-label={`Progres ${label}`}>
        <div className="h-full bg-[#006837] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${persen - persenGagal}%` }} />
        <div className="h-full bg-rose-500 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${persenGagal}%` }} />
      </div>
    </div>
  );
}

/** Langkah job impor: selesai (centang), sedang berjalan (putar), berhenti karena gagal (silang), belum (abu). */
function LangkahTahap({ log }) {
  const gagal = log.status === 'gagal';
  const selesai = log.status === 'selesai';
  const kini = gagal ? (log.gagal_di?.tahap || log.tahap || 'diterima') : selesai ? 'selesai' : (log.tahap || 'diterima');
  const iKini = Math.max(0, TAHAP_IMPOR.findIndex((t) => t.key === kini));
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2 text-xs" aria-label="Tahap impor" data-testid="tahap-impor">
      {TAHAP_IMPOR.map((t, i) => {
        const status = i < iKini || (selesai && i === iKini) ? 'beres' : i === iKini ? (gagal ? 'gagal' : 'jalan') : 'nanti';
        const gaya = {
          beres: 'border-emerald-200 bg-emerald-50 text-emerald-800',
          jalan: 'border-sky-300 bg-sky-50 text-sky-800 font-semibold',
          gagal: 'border-rose-300 bg-rose-50 text-rose-800 font-semibold',
          nanti: 'border-slate-200 bg-white text-slate-400',
        }[status];
        const Ikon = { beres: Check, jalan: Loader2, gagal: X, nanti: null }[status];
        return (
          <li key={t.key} className="flex items-center gap-1" aria-current={status === 'jalan' || status === 'gagal' ? 'step' : undefined}>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${gaya}`} data-testid={`tahap-${t.key}-${status}`}>
              {Ikon && <Ikon className={`h-3 w-3 ${status === 'jalan' ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />}
              {t.label}
              {status === 'jalan' && t.key === 'menyimpan' && log.sheet_aktif ? ` · sheet ${log.sheet_aktif}` : ''}
              <span className="sr-only">{{ beres: ' (selesai)', jalan: ' (berjalan)', gagal: ' (gagal di sini)', nanti: ' (belum)' }[status]}</span>
            </span>
            {i < TAHAP_IMPOR.length - 1 && <span className="text-slate-300" aria-hidden="true">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Penyebab kegagalan seluruh impor: pesan, posisi berhenti, dan detail teknis (untuk dikirim ke admin). */
function KotakGagal({ log }) {
  const posisi = teksPosisiGagal(log.gagal_di);
  return (
    <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm" role="alert" data-testid="kotak-gagal-impor">
      <p className="flex items-start gap-2 font-semibold text-rose-800"><XCircle className="mt-0.5 h-4 w-4 shrink-0" /> Impor gagal</p>
      <p className="text-rose-900" data-testid="pesan-gagal-impor">{log.pesan || 'Penyebab tidak tercatat. Unggah ulang berkas; bila berulang, hubungi admin.'}</p>
      {posisi && <p className="text-xs text-rose-800"><span className="font-medium">Berhenti di:</span> {posisi}</p>}
      {log.galat_teknis && (
        <details className="text-xs text-rose-900">
          <summary className="cursor-pointer font-medium">Detail teknis (untuk admin)</summary>
          <code className="mt-1 block whitespace-pre-wrap break-all rounded bg-white/70 p-2 font-mono text-[11px]" data-testid="galat-teknis-impor">{log.galat_teknis}</code>
        </details>
      )}
      {log.berhasil > 0 && <p className="text-xs text-slate-700">{log.berhasil} baris sudah tersimpan sebelum impor berhenti — unggah ulang berkas yang sama akan menimpanya dengan nilai yang sama.</p>}
    </div>
  );
}

/**
 * Progres & status satu impor nilai: langkah tahap job (diterima → membaca → memeriksa → menyimpan → selesai), batang
 * keseluruhan dan per sheet kelas (hijau berhasil, merah gagal), aktivitas terakhir, serta penyebab bila gagal. Selama
 * status 'proses' rincian dimuat ulang tiap 1,5 detik; bila pemuatan gagal ditampilkan alasannya dan dicoba lagi.
 * `onSelesai(log)` dipanggil sekali saat selesai/gagal.
 */
export default function ProgresImpor({ ujianId, log: awal, onSelesai }) {
  const [log, setLog] = useState(awal);
  const [galatMuat, setGalatMuat] = useState('');
  const sudah = useRef(false);
  useEffect(() => { setLog(awal); setGalatMuat(''); sudah.current = false; }, [awal]);

  useEffect(() => {
    if (!log || log.status !== 'proses') return undefined;
    const t = setTimeout(async () => {
      try {
        const baru = await muatImpor(ujianId, log.id);
        setGalatMuat('');
        setLog(baru);
        if (baru.status !== 'proses' && !sudah.current) { sudah.current = true; onSelesai?.(baru); }
      } catch (e) {
        setGalatMuat(pesanGalatUnggah(e, 'Gagal memuat progres impor.'));
        setLog((l) => ({ ...l })); // coba lagi di putaran berikutnya
      }
    }, 1500);
    return () => clearTimeout(t);
  }, [log, ujianId, onSelesai]);

  if (!log) return null;
  const adaBaris = (log.total_baris || 0) > 0;
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4" data-testid="progres-impor" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">{log.mapel_nama || 'Impor nilai'}{log.jenjang ? ` · Kelas ${log.jenjang}` : ''}</span>
        <BadgeStatusImpor status={log.status} />
      </div>
      <LangkahTahap log={log} />
      {galatMuat && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900" role="status" data-testid="galat-muat-progres">
          <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Progres belum dapat dimuat: {galatMuat} Mencoba lagi otomatis…
        </p>
      )}
      {log.status === 'gagal' && <KotakGagal log={log} />}
      {(log.status !== 'gagal' || adaBaris) && (
        <>
          <Batang label="Keseluruhan" diproses={log.diproses ?? log.total_baris ?? 0} total={log.total_baris || 0} gagal={log.gagal || 0} />
          {(log.per_sheet || []).length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3" data-testid="progres-per-sheet">
              {log.per_sheet.map((s) => (
                <div key={s.sheet} className={`rounded-lg border p-2 ${log.status === 'proses' && log.sheet_aktif === s.sheet ? 'border-sky-300 bg-sky-50/40' : 'border-slate-100'}`}>
                  <Batang kecil label={`Sheet ${s.sheet}`} diproses={s.diproses ?? s.total} total={s.total} gagal={s.gagal} />
                  <div className="mt-1 flex flex-wrap gap-x-3 text-[11px]">
                    <span className="text-emerald-700">{s.berhasil} berhasil</span>
                    <span className={s.gagal ? 'text-rose-700' : 'text-slate-400'}>{s.gagal} gagal</span>
                    {s.diisi_nol > 0 && <span className="text-amber-700">{s.diisi_nol} kosong → 0</span>}
                    {s.dilewati > 0 && <span className="text-slate-500">{s.dilewati} dilewati</span>}
                    {!s.kelas && <span className="text-rose-700">bukan nama kelas</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {log.status === 'proses' && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> {labelTahap(log.tahap || 'diterima')}…
          {log.diperbarui && <span>aktivitas terakhir {formatWIB(log.diperbarui, 'Time')} WIB</span>}
        </p>
      )}
      {log.status === 'selesai' && (
        <p className="flex items-center gap-2 text-xs text-slate-600" data-testid="ringkasan-selesai-impor">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          Selesai: {log.berhasil} berhasil{log.diisi_nol ? ` (${log.diisi_nol} nilai kosong diisi 0)` : ''}, {log.gagal} gagal dari {log.total_baris} baris
          {log.dilewati ? `; ${log.dilewati} baris dilewati karena sudah berhasil sebelumnya` : ''}.
        </p>
      )}
      {log.status === 'selesai' && log.pesan && (
        <p className="flex items-start gap-2 text-xs text-amber-800"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {log.pesan}</p>
      )}
      {log.status === 'selesai' && log.gagal > 0 && (
        <p className="flex items-start gap-2 text-xs text-rose-700"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Penyebab tiap baris gagal ada di tabel di bawah.</p>
      )}
    </div>
  );
}
