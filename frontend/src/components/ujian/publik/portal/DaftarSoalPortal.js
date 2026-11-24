import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CalendarDays, CircleDashed, Clock, ExternalLink, Lock, MonitorPlay } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatWIB } from '@/lib/datetime';
import { labelJenjang, mapelUntuk } from '@/lib/mapelUjian';
import {
  STATUS_SOAL, bolehKerjakan, hitungMundurSoal, ringkasPortal, soalJenjang, sorotanPortal, urlKerjakan,
} from '@/lib/ujianPortalPublik';
import { BagianInfo, KosongInfo, TabJenjang } from '@/components/ujian/publik/info/BagianInfo';

const jam = (iso) => formatWIB(iso, 'Time', { hour: '2-digit', minute: '2-digit' });
const tglPanjang = (t) => formatWIB(t, 'Date', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Waktu server sekarang (ms) dari `selisih` jam server − jam perangkat, diperbarui tiap `tiap` ms. Status mapel dihitung
 * dari nilai ini, bukan jam perangkat, sehingga mengubah jam ponsel tidak mengubah status. Halaman portal memakai detak
 * 1 detik saat batas waktu mapel sudah dekat (hitung mundur menit:detik) dan 15 detik selebihnya.
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
  berlangsung: 'text-amber-700',
  belum_dimulai: 'text-slate-500',
  ditutup: 'text-slate-500',
};

/**
 * Keterangan status satu mapel di bawah namanya: jam buka/tutup menurut jam server dan hitung mundurnya — menuju jam
 * mulai bila belum dimulai, menuju jam tutup bila sedang berlangsung.
 */
function KeteranganStatus({ soal, sekarangMs, testId }) {
  if (!soal.siap) {
    // Jam ujian sudah berjalan tetapi tautan soal belum dipasang: siswa perlu tahu harus melapor, bukan menunggu diam.
    const mendesak = soal.status === 'berlangsung';
    return (
      <p className={`mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs ${mendesak ? 'text-amber-800' : 'text-slate-500'}`}
        data-testid={testId} data-status="belum_siap" data-mendesak={mendesak ? 'ya' : 'tidak'}>
        <span className={`inline-flex items-center gap-1 rounded-full border border-dashed px-1.5 py-px text-[11px] font-semibold ${mendesak ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}>
          {mendesak ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : <CircleDashed className="h-3 w-3" aria-hidden="true" />} Belum siap
        </span>
        {mendesak ? 'Jam ujian sudah dimulai, tetapi tautan soal belum disiapkan. Laporkan ke pengawas ruang.' : 'Tautan soal belum disiapkan panitia.'}
      </p>
    );
  }
  const rincian = {
    berlangsung: `ditutup ${jam(soal.selesai_at)} WIB`,
    belum_dimulai: `dibuka ${jam(soal.mulai_at)} WIB`,
    ditutup: null,
  }[soal.status];
  const mundur = hitungMundurSoal(soal, sekarangMs);
  return (
    <p className={`text-xs ${GAYA_STATUS[soal.status]}`} data-testid={testId} data-status={soal.status}>
      <span className="font-semibold">{STATUS_SOAL[soal.status].label}</span>{rincian && <> · {rincian}</>}
      {mundur?.teks && (
        <span className="whitespace-nowrap" data-testid={`${testId}-mundur`} data-menuju={mundur.menuju}>
          {' · '}{mundur.menuju === 'selesai' ? 'sisa ' : ''}<span className="font-semibold tabular-nums">{mundur.teks}</span>{mundur.menuju === 'mulai' ? ' lagi' : ''}
        </span>
      )}
    </p>
  );
}

/**
 * Tombol "Mengerjakan": aktif hanya saat mapel berlangsung — membuka rute kerjakan server di tab baru tanpa referrer.
 * Di luar jendela tombol dinonaktifkan dengan alasannya. Mapel yang tautan soalnya belum disiapkan tidak diberi tombol.
 * Mode contoh (`tiruan`) tidak membuka apa pun: belum ada tautan soal sungguhan.
 */
function TombolKerjakan({ soal, token, tiruan, testId }) {
  if (!soal.siap) return null;
  if (!bolehKerjakan(soal)) {
    const alasan = soal.status === 'ditutup' ? 'Waktu pengerjaan sudah ditutup' : `Belum dimulai — dibuka ${jam(soal.mulai_at)} WIB`;
    return (
      <Button type="button" size="sm" variant="outline" disabled title={alasan} aria-label={`Mengerjakan ${soal.nama} — ${alasan.toLowerCase()}`}
        className="h-9 gap-1.5 px-3" data-testid={testId} data-aktif="tidak">
        {soal.status === 'ditutup' ? <Lock aria-hidden="true" /> : <Clock aria-hidden="true" />} Mengerjakan
      </Button>
    );
  }
  const klikContoh = (e) => {
    if (!tiruan) return;
    e.preventDefault();
    toast.info('Mode contoh: tautan soal sungguhan terbuka setelah server portal siap.');
  };
  return (
    <Button asChild size="sm" className="h-9 gap-1.5 bg-[#006837] px-3 text-white hover:bg-[#00552d]" data-testid={testId} data-aktif="ya">
      <a href={urlKerjakan(token, soal.id)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={klikContoh}
        aria-label={`Mengerjakan ${soal.nama} (membuka soal di tab baru)`}>
        <ExternalLink aria-hidden="true" /> Mengerjakan
      </a>
    </Button>
  );
}

function Sorotan({ sorotan, hariIni, sekarangMs }) {
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
        {sorotan.soal.map((s) => {
          const mundur = hitungMundurSoal(s, sekarangMs);
          return (
            <div key={s.id}>
              <span className="font-bold">{s.nama}</span>
              <span className={`text-xs ${berlangsung ? 'text-emerald-50' : 'text-slate-600'}`}>
                {' · '}{berlangsung ? `sampai ${jam(s.selesai_at)} WIB` : `${s.tanggal === hariIni ? 'hari ini' : tglPanjang(s.tanggal)}, ${jam(s.mulai_at)} WIB`}
                {mundur?.teks && <> · {berlangsung ? 'sisa ' : ''}<span className="font-semibold tabular-nums">{mundur.teks}</span>{berlangsung ? '' : ' lagi'}</>}
              </span>
              {!s.siap && (
                <span className={`ml-1.5 inline-flex rounded-full border border-dashed px-1.5 text-[11px] font-semibold ${berlangsung ? 'border-white/60 text-white' : 'border-slate-300 text-slate-600'}`}
                  data-testid={`portal-sorotan-belum-siap-${s.mapel}`}>
                  Belum siap
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarisSoal({ soal, jenjang, token, tiruan, sekarangMs }) {
  const redup = soal.status === 'ditutup' || !soal.siap;
  const berlangsung = soal.siap && soal.status === 'berlangsung';
  return (
    <li className={`flex items-center gap-3 px-3 py-2.5 ${berlangsung ? 'bg-amber-50/70' : ''}`}
      data-testid={`portal-${jenjang}-${soal.mapel}`} data-status={soal.siap ? soal.status : 'belum_siap'}>
      <div className={`w-20 shrink-0 text-xs text-slate-500 sm:w-24 ${redup ? 'opacity-60' : ''}`}>
        {soal.sesi_ke ? <div className="font-medium text-slate-700">Sesi {soal.sesi_ke}</div> : null}
        <div className="tabular-nums">{jam(soal.mulai_at)}–{jam(soal.selesai_at)}</div>
      </div>
      <div className={`min-w-0 flex-1 ${redup ? 'opacity-70' : ''}`}>
        <div className="text-sm font-semibold text-slate-900">{soal.nama}</div>
        <KeteranganStatus soal={soal} sekarangMs={sekarangMs} testId={`portal-${jenjang}-${soal.mapel}-status`} />
      </div>
      <div className="shrink-0">
        <TombolKerjakan soal={soal} token={token} tiruan={tiruan} testId={`portal-${jenjang}-${soal.mapel}-kerjakan`} />
      </div>
    </li>
  );
}

function IsiJenjang({ soal, mapel, jenjang, sekarangMs, hariIni, token, tiruan }) {
  const daftarMapel = useMemo(() => mapelUntuk(mapel, jenjang), [mapel, jenjang]);
  const { hari, tanpaJadwal } = useMemo(() => soalJenjang(soal, jenjang, daftarMapel, sekarangMs), [soal, jenjang, daftarMapel, sekarangMs]);
  const sorotan = sorotanPortal(hari);
  // Yang sudah ditutup tidak perlu diumumkan lagi: hanya mapel yang masih akan/sedang berlangsung.
  const belumSiap = hari.flatMap((h) => h.soal).filter((s) => !s.siap && s.status !== 'ditutup');
  if (!hari.length) {
    return (
      <KosongInfo Ikon={CalendarDays} judul="Jadwal pengerjaan belum disusun" testId={`portal-kosong-${jenjang}`}>
        Mapel ujian {labelJenjang(jenjang)} akan tampil di sini setelah panitia menyusun jadwal dan tautan soalnya.
      </KosongInfo>
    );
  }
  return (
    <>
      <Sorotan sorotan={sorotan} hariIni={hariIni} sekarangMs={sekarangMs} />
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
                {h.soal.map((s) => <BarisSoal key={s.id} soal={s} jenjang={jenjang} token={token} tiruan={tiruan} sekarangMs={sekarangMs} />)}
              </ul>
            </li>
          );
        })}
      </ol>
      {belumSiap.length > 0 && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600" data-testid={`portal-belum-siap-${jenjang}`}>
          <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            {belumSiap.length} mapel belum siap: <span className="font-medium text-slate-800">{belumSiap.map((m) => m.nama).join(', ')}</span>.
            {' '}Tombol Mengerjakan muncul sendiri setelah panitia memasang tautan soalnya — halaman ini diperbarui otomatis tiap menit.
          </span>
        </p>
      )}
      {tanpaJadwal.length > 0 && (
        <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500" data-testid={`portal-tanpa-jadwal-${jenjang}`}>
          Belum dijadwalkan: <span className="text-slate-700">{tanpaJadwal.map((m) => m.nama).join(', ')}</span>.
        </p>
      )}
    </>
  );
}

/**
 * Daftar mapel ujian portal dalam tiga tab jenjang (Kelas 7/8/9), dikelompokkan per tanggal sesuai jadwal. Tiap baris:
 * sesi & jam, nama mapel, keterangan status, dan tombol "Mengerjakan" (aktif hanya saat mapel berlangsung). Tiap tab
 * hanya memuat mapel baku jenjang itu; mapel yang sedang berlangsung (atau berikutnya) disorot di atas. Status dihitung
 * dari `sekarangMs` = waktu server berjalan (useJamServer), bukan jam perangkat. `token` = token portal (rute kerjakan).
 */
export default function DaftarSoalPortal({ soal, mapel, jenjang, onUbahJenjang, sekarangMs, token, tiruan = false }) {
  const hariIni = useMemo(() => new Date(sekarangMs).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }), [sekarangMs]);
  const lencana = (j) => {
    const r = ringkasPortal(soalJenjang(soal, j, mapelUntuk(mapel, j), sekarangMs).hari);
    if (r.berlangsung) return `${r.berlangsung} berlangsung`;
    return r.total ? `${r.ditutup}/${r.total} selesai` : 'belum ada';
  };
  return (
    <BagianInfo id="portal" Ikon={MonitorPlay} judul="Mata Pelajaran Ujian" keterangan="Semua jam dalam WIB menurut jam server madrasah. Pilih kelasmu.">
      <TabJenjang nilai={jenjang} onUbah={onUbahJenjang} testId="portal" lencana={lencana}
        isi={(j) => <IsiJenjang soal={soal} mapel={mapel} jenjang={j} sekarangMs={sekarangMs} hariIni={hariIni} token={token} tiruan={tiruan} />} />
    </BagianInfo>
  );
}
