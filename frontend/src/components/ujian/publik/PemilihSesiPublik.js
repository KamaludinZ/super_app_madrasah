import React, { useState } from 'react';
import { CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { formatWIB } from '@/lib/datetime';
import { teksSesi } from '@/components/ujian/publik/KerangkaPublik';

const tglHari = (iso) => formatWIB(iso, 'Date', { weekday: 'long', day: 'numeric', month: 'long' });

const BADGE = {
  aktif: { teks: 'Sedang berjalan', kelas: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  terbuka: { teks: 'Belum lengkap', kelas: 'bg-amber-50 text-amber-800 ring-amber-200' },
  lengkap: { teks: 'Lengkap', kelas: 'bg-slate-100 text-slate-500 ring-slate-200' },
};

function kelompokHari(items) {
  const hari = [];
  items.forEach((s) => {
    const akhir = hari[hari.length - 1];
    if (akhir?.tanggal === s.tanggal) akhir.sesi.push(s);
    else hari.push({ tanggal: s.tanggal, sesi: [s] });
  });
  return hari;
}

/**
 * Pemilih sesi tautan publik. Sesi aktif tetap dipilih otomatis; peserta/pengawas dapat beralih ke sesi lain hari ini
 * atau hari sebelumnya yang BELUM LENGKAP. Sesi lengkap tampil terkunci; hari sebelumnya yang semua sesinya lengkap
 * diringkas satu baris; sesi hari berikutnya tidak ditampilkan (hanya keterangan tanggalnya).
 *
 * Props: pilihan (respons GET /publik/ujian/{token}/sesi), terpilihId (sesi yang dipakai halaman), onPilih(sesi),
 *        satuan ('peserta' | 'ruang') untuk teks kelengkapan.
 */
export default function PemilihSesiPublik({ pilihan, terpilihId, onPilih, satuan = 'peserta' }) {
  const items = pilihan?.items || [];
  const lainBoleh = items.filter((s) => s.boleh_dipilih && s.id !== terpilihId).length;
  const [buka, setBuka] = useState(!terpilihId);
  if (!items.length) return null;
  const terpilih = items.find((s) => s.id === terpilihId);
  const luarAktif = terpilih && terpilih.id !== pilihan.aktif_id;
  const aktif = items.find((s) => s.id === pilihan.aktif_id);
  const terbuka = buka || !terpilihId;
  const pilih = (s) => { onPilih(s); setBuka(false); };

  return (
    <section className={`rounded-2xl border bg-white p-4 shadow-sm ${luarAktif ? 'border-amber-300' : 'border-slate-200'}`} data-testid="pilih-sesi">
      <div className="flex flex-wrap items-start gap-3">
        <CalendarClock className={`mt-0.5 h-5 w-5 shrink-0 ${luarAktif ? 'text-amber-600' : 'text-[#006837]'}`} />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-slate-900">Sesi ujian</h2>
          <p className="text-sm text-slate-600" data-testid="sesi-terpilih">
            {terpilih ? teksSesi(terpilih) : 'Belum ada sesi berjalan — pilih sesi yang belum lengkap di bawah.'}
          </p>
          {luarAktif && (
            <p className="mt-1 text-xs text-amber-800" data-testid="sesi-luar-aktif">
              Anda mengisi untuk sesi di luar sesi yang sedang berjalan.
              {aktif && <> <button type="button" className="font-semibold underline underline-offset-2" onClick={() => pilih(aktif)} data-testid="kembali-sesi-aktif">Kembali ke sesi berjalan</button></>}
            </p>
          )}
        </div>
        {terpilihId && (lainBoleh > 0 || terbuka) && (
          <button type="button" onClick={() => setBuka((b) => !b)} aria-expanded={terbuka}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-[#006837] ring-1 ring-[#006837]/30 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]"
            data-testid="ganti-sesi">
            {terbuka ? <>Tutup <ChevronUp className="h-3.5 w-3.5" /></> : <>Ganti sesi{lainBoleh ? ` (${lainBoleh})` : ''} <ChevronDown className="h-3.5 w-3.5" /></>}
          </button>
        )}
      </div>

      {terbuka && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3" data-testid="daftar-sesi">
          {kelompokHari(items).map((h) => {
            const hariIni = h.tanggal === pilihan.tanggal;
            const semuaLengkap = !hariIni && h.sesi.every((s) => !s.boleh_dipilih);
            return (
              <div key={h.tanggal}>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {hariIni ? `Hari ini · ${tglHari(h.tanggal)}` : tglHari(h.tanggal)}
                </div>
                {semuaLengkap ? (
                  <p className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500" data-testid={`hari-lengkap-${h.tanggal}`}>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Semua sesi sudah lengkap
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="group" aria-label={`Sesi ${tglHari(h.tanggal)}`}>
                    {h.sesi.map((s) => {
                      const b = BADGE[s.status] || BADGE.lengkap;
                      const dipilih = s.id === terpilihId;
                      return (
                        <button key={s.id} type="button" disabled={!s.boleh_dipilih} onClick={() => pilih(s)} aria-pressed={dipilih}
                          className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] disabled:cursor-not-allowed disabled:opacity-70 ${
                            dipilih ? 'border-[#006837] bg-emerald-50' : s.boleh_dipilih ? 'border-slate-200 hover:border-[#006837]/40' : 'border-slate-100 bg-slate-50'}`}
                          data-testid={`sesi-${s.id}`} data-status={s.status}>
                          <div className="min-w-0 flex-1">
                            <div className={`font-semibold ${dipilih ? 'text-[#006837]' : 'text-slate-900'}`}>Sesi {s.sesi_ke}</div>
                            <div className="text-xs text-slate-500">{s.jam_mulai}–{s.jam_selesai} WIB{s.total ? ` · ${s.terisi}/${s.total} ${satuan}` : ''}</div>
                          </div>
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${b.kelas}`}>
                            {s.status === 'lengkap' && <Lock className="h-3 w-3" />}{b.teks}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-xs text-slate-500">
            Sesi yang sudah lengkap tidak dapat dipilih.
            {pilihan.berikutnya ? ` Sesi ${tglHari(pilihan.berikutnya)} baru dapat dibuka pada harinya.` : ''}
          </p>
        </div>
      )}
    </section>
  );
}
