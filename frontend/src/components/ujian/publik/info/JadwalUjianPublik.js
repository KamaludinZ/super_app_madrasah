import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import { formatWIB } from '@/lib/datetime';
import { hariIniWIB } from '@/lib/tanggal';
import { jadwalJenjang, jamWIB, statusJadwal } from '@/lib/ujianInfoPublik';
import { labelJenjang } from '@/lib/mapelUjian';
import { BagianInfo, KosongInfo, TabJenjang } from './BagianInfo';

const tglPanjang = (t) => formatWIB(t, 'Date', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const tglHari = (t) => formatWIB(t, 'Date', { weekday: 'long', day: 'numeric', month: 'long' });

// Waktu sekarang WIB, diperbarui tiap menit agar status sesi ikut berganti selama halaman terbuka.
function useSekarangWIB() {
  const [s, setS] = useState(() => ({ hari: hariIniWIB(), jam: jamWIB() }));
  useEffect(() => {
    const t = setInterval(() => setS({ hari: hariIniWIB(), jam: jamWIB() }), 60000);
    return () => clearInterval(t);
  }, []);
  return s;
}

function Sorotan({ sorotan, hariIni }) {
  if (!sorotan) return null;
  const { sesi, tanggal } = sorotan;
  const berlangsung = sorotan.status === 'berlangsung';
  return (
    <div className={`mb-3 flex items-start gap-3 rounded-xl p-3 ${berlangsung ? 'bg-[#006837] text-white' : 'border border-emerald-200 bg-emerald-50 text-slate-800'}`}
      data-testid="jadwal-sorotan" data-status={sorotan.status}>
      <Clock className={`mt-0.5 h-4 w-4 shrink-0 ${berlangsung ? 'text-emerald-100' : 'text-[#006837]'}`} />
      <div className="min-w-0 text-sm">
        <div className={`text-xs font-semibold uppercase tracking-wide ${berlangsung ? 'text-emerald-100' : 'text-[#006837]'}`}>
          {berlangsung ? 'Sedang berlangsung' : 'Ujian berikutnya'}
        </div>
        <div className="font-bold">{sesi.mapel}</div>
        <div className={`text-xs ${berlangsung ? 'text-emerald-50' : 'text-slate-600'}`}>
          {tanggal === hariIni ? 'Hari ini' : tglHari(tanggal)} · Sesi {sesi.sesi_ke} · {sesi.jam_mulai}–{sesi.jam_selesai} WIB
        </div>
      </div>
    </div>
  );
}

function DaftarJadwal({ jadwal, jenjang }) {
  const { hari: hariIni, jam } = useSekarangWIB();
  const kelompok = useMemo(() => jadwalJenjang(jadwal, jenjang), [jadwal, jenjang]);
  const { status, sorotan } = useMemo(() => statusJadwal(kelompok, hariIni, jam), [kelompok, hariIni, jam]);
  if (!kelompok.length) {
    return (
      <KosongInfo Ikon={CalendarDays} judul="Jadwal belum diumumkan" testId={`jadwal-kosong-${jenjang}`}>
        Jadwal ujian {labelJenjang(jenjang)} akan tampil di sini setelah panitia menyusunnya.
      </KosongInfo>
    );
  }
  return (
    <>
      <Sorotan sorotan={sorotan} hariIni={hariIni} />
      {!sorotan && <p className="mb-3 text-xs text-slate-500" data-testid="jadwal-selesai">Seluruh jadwal ujian {labelJenjang(jenjang)} sudah terlaksana.</p>}
      <ol className="space-y-3" data-testid={`jadwal-jenjang-${jenjang}`}>
        {kelompok.map((h) => {
          const hari = h.tanggal === hariIni;
          const lewat = h.tanggal < hariIni;
          return (
            <li key={h.tanggal} className={`rounded-xl border ${hari ? 'border-emerald-300 bg-emerald-50/60' : 'border-slate-200'} ${lewat ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between gap-2 border-b border-inherit px-3 py-2">
                <h3 className="text-sm font-semibold text-slate-800">{tglPanjang(h.tanggal)}</h3>
                {hari && <span className="rounded-full bg-[#006837] px-2 py-0.5 text-[11px] font-semibold text-white">Hari ini</span>}
                {lewat && <span className="text-[11px] text-slate-500">Sudah lewat</span>}
              </div>
              <ul className="divide-y divide-slate-100">
                {h.sesi.map((s) => {
                  const st = status[s.id];
                  return (
                    <li key={s.id} className={`flex items-center gap-3 px-3 py-2.5 ${hari && st === 'lewat' ? 'opacity-60' : ''}`} data-status={st}>
                      <div className="w-24 shrink-0 text-xs text-slate-500">
                        <div className="font-medium text-slate-700">Sesi {s.sesi_ke}</div>
                        <div className="tabular-nums">{s.jam_mulai}–{s.jam_selesai}</div>
                      </div>
                      <div className="min-w-0 flex-1 text-sm font-semibold text-slate-900">{s.mapel}</div>
                      {st === 'berlangsung' && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Berlangsung</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ol>
    </>
  );
}

/**
 * Jadwal ujian per jenjang (tab Kelas 7/8/9), dikelompokkan per tanggal. Sesi yang sedang berlangsung atau yang
 * berikutnya disorot di atas; hari ini ditandai, sesi/hari yang sudah lewat diredupkan (jam WIB, diperbarui tiap menit).
 */
export default function JadwalUjianPublik({ jadwal, jenjang, onUbahJenjang }) {
  return (
    <BagianInfo id="jadwal" Ikon={CalendarDays} judul="Jadwal Ujian" keterangan="Semua jam dalam WIB. Pilih kelasmu.">
      <TabJenjang nilai={jenjang} onUbah={onUbahJenjang} testId="jadwal" isi={(j) => <DaftarJadwal jadwal={jadwal} jenjang={j} />} />
    </BagianInfo>
  );
}
