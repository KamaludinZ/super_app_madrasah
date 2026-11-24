import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CalendarDays, CircleDashed, Clock, ExternalLink, Lock, MonitorPlay } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatWIB } from '@/lib/datetime';
import { labelJenjang } from '@/lib/mapelUjian';
import {
  STATUS_SOAL, bolehKerjakan, bukaSoalContoh, catatKlikTiruan, hitungMundurSoal, mapelPortalJenjang, normalKlik, ringkasPortal, soalJenjang,
  sorotanPortal, statusSoal, urlKerjakan,
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
 * Keterangan status satu mapel di bawah namanya beserta hitung mundurnya — menuju jam mulai bila belum dimulai, menuju
 * jam tutup bila sedang berlangsung (jamnya sendiri sudah tertulis di kolom kiri).
 */
function KeteranganStatus({ soal, sekarangMs, testId }) {
  if (!soal.siap) {
    // Jam ujian sudah berjalan tetapi tombol belum bisa dipakai: siswa perlu tahu harus melapor, bukan menunggu diam.
    const mendesak = soal.status === 'berlangsung';
    const teks = soal.ditahan
      ? (mendesak ? 'Tombol sedang ditahan panitia. Tunggu arahan pengawas ruang.' : 'Tombol ditahan panitia.')
      : (mendesak ? 'Jam ujian sudah dimulai, tetapi tautan soal belum disiapkan. Laporkan ke pengawas ruang.' : 'Tautan soal belum disiapkan panitia.');
    return (
      <p className={`mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs ${mendesak ? 'text-amber-800' : 'text-slate-500'}`}
        data-testid={testId} data-status={soal.ditahan ? 'ditahan' : 'belum_siap'} data-mendesak={mendesak ? 'ya' : 'tidak'}>
        <span className={`inline-flex items-center gap-1 rounded-full border border-dashed px-1.5 py-px text-[11px] font-semibold ${mendesak ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}>
          {mendesak ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : <CircleDashed className="h-3 w-3" aria-hidden="true" />} {soal.ditahan ? 'Ditahan' : 'Belum siap'}
        </span>
        {teks}
      </p>
    );
  }
  const mundur = hitungMundurSoal(soal, sekarangMs);
  return (
    <p className={`text-xs ${GAYA_STATUS[soal.status]}`} data-testid={testId} data-status={soal.status}>
      <span className="whitespace-nowrap font-semibold">{STATUS_SOAL[soal.status].label}</span>
      {mundur?.teks && (
        <span className="whitespace-nowrap" data-testid={`${testId}-mundur`} data-menuju={mundur.menuju}>
          {' · '}{mundur.menuju === 'selesai' ? 'sisa ' : ''}<span className="font-semibold tabular-nums">{mundur.teks}</span>{mundur.menuju === 'mulai' ? ' lagi' : ''}
        </span>
      )}
    </p>
  );
}

/**
 * Jumlah klik sah "Mengerjakan" sebelumnya (per klik, bukan per siswa; dari cache jumlah_klik server / pencatat tiruan)
 * di dalam tombol, mis. "18 klik". Angka nol ditampilkan ("0 klik") hanya bila `tampilNol` — saat mapel berlangsung
 * atau sudah ditutup; sebelum dimulai nol sudah pasti sehingga disembunyikan.
 */
function JumlahKlik({ n, aktif, tampilNol = false, testId }) {
  if (!n && !tampilNol) return null;
  return (
    <span className={`rounded px-1.5 py-px text-[11px] font-semibold tabular-nums ${aktif ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}
      title={`Tombol ini sudah diklik ${n.toLocaleString('id-ID')} kali`} data-testid={testId} data-jumlah={n}>
      {n.toLocaleString('id-ID')} klik
    </span>
  );
}

/**
 * Tombol "Mengerjakan": aktif hanya saat mapel berlangsung — membuka rute kerjakan server di tab baru tanpa referrer;
 * server mencatat klik sah lalu mengalihkan ke tautan soal. Jumlah klik sebelumnya tampil di tombol dan langsung
 * bertambah setelah diklik (sementara, lalu dikonfirmasi server lewat muat ulang). Di luar jendela tombol dinonaktifkan
 * dengan alasannya; mapel yang tautan soalnya belum disiapkan tidak diberi tombol. Mode contoh (`tiruan`) mencatat
 * klik ke pencatat tiruan dan membuka halaman soal contoh.
 */
function TombolKerjakan({ soal, jenjang, token, sesi, tiruan, kiniServer, onKedaluwarsa, onKlik, lebar = false, testId }) {
  if (!soal.siap) return null;
  const n = normalKlik(soal.jumlah_klik);
  if (!bolehKerjakan(soal)) {
    const alasan = soal.status === 'ditutup' ? 'Waktu pengerjaan sudah ditutup' : `Belum dimulai — dibuka ${jam(soal.mulai_at)} WIB`;
    return (
      <Button type="button" size="sm" variant="outline" disabled title={alasan}
        aria-label={`Mengerjakan ${soal.nama} — ${alasan.toLowerCase()}${n ? `, sudah diklik ${n} kali` : ''}`}
        className="h-9 gap-1.5 px-2.5 sm:px-3" data-testid={testId} data-aktif="tidak">
        {soal.status === 'ditutup' ? <Lock aria-hidden="true" /> : <Clock aria-hidden="true" />}
        <span className="hidden sm:inline">Mengerjakan</span>
        <JumlahKlik n={n} tampilNol={soal.status === 'ditutup'} testId={`${testId}-klik`} />
      </Button>
    );
  }
  const klik = (e) => {
    // Detak jam di tab latar bisa tertahan peramban: periksa ulang dengan jam server saat ini sebelum membuka soal.
    // (Server tetap memeriksa jendela waktu pada rute kerjakan; klik di luar jendela tidak dihitung.)
    const kini = kiniServer ? kiniServer() : Date.now();
    if (statusSoal(soal, kini) !== 'berlangsung') {
      e.preventDefault();
      toast.error(statusSoal(soal, kini) === 'ditutup' ? `Waktu pengerjaan ${soal.nama} sudah ditutup.` : `${soal.nama} belum dimulai.`);
      onKedaluwarsa?.();
      return;
    }
    if (tiruan) {
      e.preventDefault();
      try {
        const hasil = catatKlikTiruan(token, soal.id);
        bukaSoalContoh(soal, jenjang);
        onKlik?.(soal.id, hasil);
      } catch (err) {
        toast.error(err?.response?.data?.detail?.pesan || 'Klik tidak dapat dicatat.');
        onKedaluwarsa?.();
      }
      return;
    }
    // Tautan dibiarkan terbuka (rute kerjakan); angka dinaikkan sementara sampai server mengonfirmasinya.
    onKlik?.(soal.id, { jumlah_klik: n + 1, klik_terakhir_at: new Date(kini).toISOString() }, { sementara: true });
  };
  return (
    <Button asChild size="sm" className={`gap-1.5 bg-[#006837] px-3 text-white hover:bg-[#00552d] ${lebar ? 'h-10 w-full text-sm sm:h-9 sm:w-auto sm:text-xs' : 'h-9'}`}
      data-testid={testId} data-aktif="ya">
      <a href={urlKerjakan(token, soal.id, sesi)} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" onClick={klik}
        aria-label={`Mengerjakan ${soal.nama} (membuka soal di tab baru)${n ? `, sudah diklik ${n} kali` : ''}`}>
        <ExternalLink aria-hidden="true" /> Mengerjakan
        <JumlahKlik n={n} aktif tampilNol testId={`${testId}-klik`} />
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
                  {s.ditahan ? 'Ditahan' : 'Belum siap'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarisSoal({ soal, jenjang, token, sesi, tiruan, sekarangMs, kiniServer, onKedaluwarsa, onKlik }) {
  const redup = soal.status === 'ditutup' || !soal.siap;
  const berlangsung = soal.siap && soal.status === 'berlangsung';
  // Di layar sempit tombol aktif turun ke baris sendiri selebar kolom isi agar mudah diketuk; tombol nonaktif tetap ringkas.
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:flex-nowrap ${berlangsung ? 'bg-amber-50/70' : ''}`}
      data-testid={`portal-${jenjang}-${soal.mapel}`} data-status={soal.siap ? soal.status : (soal.ditahan ? 'ditahan' : 'belum_siap')}>
      <div className={`w-[4.75rem] shrink-0 text-xs text-slate-500 sm:w-24 ${redup ? 'opacity-60' : ''}`}>
        {soal.sesi_ke ? <div className="font-medium text-slate-700">Sesi {soal.sesi_ke}</div> : null}
        <div className="tabular-nums">{jam(soal.mulai_at)}–{jam(soal.selesai_at)}</div>
      </div>
      <div className={`min-w-0 flex-1 ${redup ? 'opacity-70' : ''}`}>
        <div className="text-sm font-semibold text-slate-900">{soal.nama}</div>
        <KeteranganStatus soal={soal} sekarangMs={sekarangMs} testId={`portal-${jenjang}-${soal.mapel}-status`} />
      </div>
      <div className={berlangsung ? 'w-full pl-[5.5rem] sm:w-auto sm:shrink-0 sm:pl-0' : 'shrink-0'}>
        <TombolKerjakan soal={soal} jenjang={jenjang} token={token} sesi={sesi} tiruan={tiruan} kiniServer={kiniServer} onKedaluwarsa={onKedaluwarsa}
          onKlik={onKlik} lebar={berlangsung} testId={`portal-${jenjang}-${soal.mapel}-kerjakan`} />
      </div>
    </li>
  );
}

function IsiJenjang({ soal, mapel, jenjang, sekarangMs, hariIni, token, sesi, tiruan, kiniServer, onKedaluwarsa, onKlik }) {
  const daftarMapel = useMemo(() => mapelPortalJenjang(mapel, jenjang), [mapel, jenjang]);
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
                {h.soal.map((s) => <BarisSoal key={s.id} soal={s} jenjang={jenjang} token={token} sesi={sesi} tiruan={tiruan} sekarangMs={sekarangMs}
                  kiniServer={kiniServer} onKedaluwarsa={onKedaluwarsa} onKlik={onKlik} />)}
              </ul>
            </li>
          );
        })}
      </ol>
      {belumSiap.length > 0 && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600" data-testid={`portal-belum-siap-${jenjang}`}>
          <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <span>
            {belumSiap.length} mapel belum siap: <span className="font-medium text-slate-800">{belumSiap.map((m) => (m.ditahan ? `${m.nama} (ditahan)` : m.nama)).join(', ')}</span>.
            {' '}Tombol Mengerjakan muncul sendiri setelah panitia memasang atau membuka tautan soalnya — halaman ini diperbarui otomatis tiap menit.
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
 * `kiniServer()` = jam server saat ini (dipakai memeriksa ulang saat tombol ditekan); `onKedaluwarsa()` = muat ulang
 * bila tombol ternyata sudah tidak berlaku; `onKlik(soalId, { jumlah_klik, klik_terakhir_at }, { sementara })` = klik sah
 * tercatat (sementara = perkiraan klien sebelum server mengonfirmasi).
 */
export default function DaftarSoalPortal({
  soal, mapel, jenjang, onUbahJenjang, sekarangMs, token, sesi = null, tiruan = false, kiniServer, onKedaluwarsa, onKlik,
}) {
  const hariIni = useMemo(() => new Date(sekarangMs).toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }), [sekarangMs]);
  const lencana = (j) => {
    const r = ringkasPortal(soalJenjang(soal, j, mapelPortalJenjang(mapel, j), sekarangMs).hari);
    if (r.berlangsung) return `${r.berlangsung} berlangsung`;
    return r.total ? `${r.ditutup}/${r.total} selesai` : 'belum ada';
  };
  return (
    <BagianInfo id="portal" Ikon={MonitorPlay} judul="Mata Pelajaran Ujian" keterangan="Semua jam dalam WIB menurut jam server madrasah. Pilih kelasmu.">
      <TabJenjang nilai={jenjang} onUbah={onUbahJenjang} testId="portal" lencana={lencana}
        isi={(j) => <IsiJenjang soal={soal} mapel={mapel} jenjang={j} sekarangMs={sekarangMs} hariIni={hariIni} token={token} sesi={sesi} tiruan={tiruan}
          kiniServer={kiniServer} onKedaluwarsa={onKedaluwarsa} onKlik={onKlik} />} />
    </BagianInfo>
  );
}
