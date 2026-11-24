import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CircleDashed, Clock, MonitorPlay } from 'lucide-react';
import { formatWIB } from '@/lib/datetime';
import { labelJenjang, mapelUntuk } from '@/lib/mapelUjian';
import { STATUS_SOAL, ringkasPortal, soalJenjang, sorotanPortal } from '@/lib/ujianPortalPublik';
import { BagianInfo, KosongInfo, TabJenjang } from '@/components/ujian/publik/info/BagianInfo';

const jam = (iso) => formatWIB(iso, 'Time', { hour: '2-digit', minute: '2-digit' });
const tglPanjang = (t) => formatWIB(t, 'Date', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Waktu server sekarang (ms) dari `selisih` jam server − jam perangkat, diperbarui tiap `tiap` ms. Status mapel dihitung
 * dari nilai ini, bukan jam perangkat, sehingga mengubah jam ponsel tidak mengubah status.
 */
export function useJamServer(selisih, tiap = 15000) {
  const [kini, setKini] = useState(() => Date.now() + selisih);
  useEffect(() => {
    setKini(Date.now() + selisih);
    const t = setInterval(() => setKini(Date.now() + selisih), tiap);
    return () => clearInterval(t);
  }, [selisih, tiap]);
  return kini;
}

const GAYA_STATUS = {
  berlangsung: 'bg-amber-100 text-amber-800',
  belum_dimulai: 'bg-slate-100 text-slate-600',
  ditutup: 'bg-slate-100 text-slate-500',
};

function ChipStatus({ soal, testId }) {
  if (!soal.siap) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[11px] font-semibold text-slate-500"
        data-testid={testId} data-status="belum_siap">
        <CircleDashed className="h-3 w-3" aria-hidden="true" /> Belum siap
      </span>
    );
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${GAYA_STATUS[soal.status]}`} data-testid={testId} data-status={soal.status}>
      {STATUS_SOAL[soal.status].label}
    </span>
  );
}

function Sorotan({ sorotan, hariIni }) {
  if (!sorotan) return null;
  const berlangsung = sorotan.status === 'berlangsung';
  return (
    <div className={`mb-3 flex items-start gap-3 rounded-xl p-3 ${berlangsung ? 'bg-[#006837] text-white' : 'border border-emerald-200 bg-emerald-50 text-slate-800'}`}
      data-testid="portal-sorotan" data-status={sorotan.status}>
      <Clock className={`mt-0.5 h-4 w-4 shrink-0 ${berlangsung ? 'text-emerald-100' : 'text-[#006837]'}`} aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <div className={`text-xs font-semibold uppercase tracking-wide ${berlangsung ? 'text-emerald-100' : 'text-[#006837]'}`}>
          {berlangsung ? 'Sedang berlangsung' : 'Ujian berikutnya'}
        </div>
        {sorotan.soal.map((s) => (
          <div key={s.id}>
            <span className="font-bold">{s.nama}</span>
            <span className={`text-xs ${berlangsung ? 'text-emerald-50' : 'text-slate-600'}`}>
              {' · '}{berlangsung ? `sampai ${jam(s.selesai_at)} WIB` : `${s.tanggal === hariIni ? 'hari ini' : tglPanjang(s.tanggal)}, ${jam(s.mulai_at)} WIB`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarisSoal({ soal, jenjang }) {
  const redup = soal.status === 'ditutup';
  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 ${redup ? 'opacity-60' : ''}`}
      data-testid={`portal-${jenjang}-${soal.mapel}`} data-status={soal.siap ? soal.status : 'belum_siap'}>
      <div className="w-24 shrink-0 text-xs text-slate-500">
        {soal.sesi_ke ? <div className="font-medium text-slate-700">Sesi {soal.sesi_ke}</div> : null}
        <div className="tabular-nums">{jam(soal.mulai_at)}–{jam(soal.selesai_at)}</div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-slate-900">{soal.nama}</div>
        {!soal.siap && <p className="text-xs text-slate-500">Tautan soal belum disiapkan panitia.</p>}
      </div>
      <div className="shrink-0" data-testid={`portal-${jenjang}-${soal.mapel}-aksi`}>
        <ChipStatus soal={soal} testId={`portal-${jenjang}-${soal.mapel}-status`} />
      </div>
    </li>
  );
}

function IsiJenjang({ soal, mapel, jenjang, sekarangMs, hariIni }) {
  const daftarMapel = useMemo(() => mapelUntuk(mapel, jenjang), [mapel, jenjang]);
  const { hari, tanpaJadwal } = useMemo(() => soalJenjang(soal, jenjang, daftarMapel, sekarangMs), [soal, jenjang, daftarMapel, sekarangMs]);
  const sorotan = sorotanPortal(hari);
  if (!hari.length) {
    return (
      <KosongInfo Ikon={CalendarDays} judul="Jadwal pengerjaan belum disusun" testId={`portal-kosong-${jenjang}`}>
        Mapel ujian {labelJenjang(jenjang)} akan tampil di sini setelah panitia menyusun jadwal dan tautan soalnya.
      </KosongInfo>
    );
  }
  return (
    <>
      <Sorotan sorotan={sorotan} hariIni={hariIni} />
      {!sorotan && <p className="mb-3 text-xs text-slate-500" data-testid="portal-selesai">Seluruh ujian {labelJenjang(jenjang)} sudah ditutup.</p>}
      <ol className="space-y-3" data-testid={`portal-jenjang-${jenjang}`}>
        {hari.map((h) => {
          const iniHari = h.tanggal === hariIni;
          const lewat = h.tanggal < hariIni;
          return (
            <li key={h.tanggal} className={`rounded-xl border ${iniHari ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200'} ${lewat ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between gap-2 border-b border-inherit px-3 py-2">
                <h3 className="text-sm font-semibold text-slate-800">{tglPanjang(h.tanggal)}</h3>
                {iniHari && <span className="rounded-full bg-[#006837] px-2 py-0.5 text-[11px] font-semibold text-white">Hari ini</span>}
                {lewat && <span className="text-[11px] text-slate-500">Sudah lewat</span>}
              </div>
              <ul className="divide-y divide-slate-100">
                {h.soal.map((s) => <BarisSoal key={s.id} soal={s} jenjang={jenjang} />)}
              </ul>
            </li>
          );
        })}
      </ol>
      {tanpaJadwal.length > 0 && (
        <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500" data-testid={`portal-tanpa-jadwal-${jenjang}`}>
          Belum dijadwalkan: <span className="text-slate-700">{tanpaJadwal.map((m) => m.nama).join(', ')}</span>.
        </p>
      )}
    </>
  );
}

/**
 * Daftar mapel ujian portal dalam tiga tab jenjang (Kelas 7/8/9), dikelompokkan per tanggal sesuai jadwal. Tiap tab
 * hanya memuat mapel baku jenjang itu; mapel yang sedang berlangsung (atau berikutnya) disorot di atas. Status dihitung
 * dari `sekarangMs` = waktu server berjalan (useJamServer), bukan jam perangkat.
 */
export default function DaftarSoalPortal({ soal, mapel, jenjang, onUbahJenjang, sekarangMs }) {
  const hariIni = useMemo(() => new Date(sekarangMs).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }), [sekarangMs]);
  const lencana = (j) => {
    const r = ringkasPortal(soalJenjang(soal, j, mapelUntuk(mapel, j), sekarangMs).hari);
    if (r.berlangsung) return `${r.berlangsung} berlangsung`;
    return r.total ? `${r.ditutup}/${r.total} selesai` : 'belum ada';
  };
  return (
    <BagianInfo id="portal" Ikon={MonitorPlay} judul="Mata Pelajaran Ujian" keterangan="Semua jam dalam WIB menurut jam server madrasah. Pilih kelasmu.">
      <TabJenjang nilai={jenjang} onUbah={onUbahJenjang} testId="portal" lencana={lencana}
        isi={(j) => <IsiJenjang soal={soal} mapel={mapel} jenjang={j} sekarangMs={sekarangMs} hariIni={hariIni} />} />
    </BagianInfo>
  );
}
