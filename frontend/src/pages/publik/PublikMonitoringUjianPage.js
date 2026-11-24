import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, Lock, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KerangkaPublik from '@/components/ujian/publik/KerangkaPublik';
import TautanTidakBerlaku from '@/components/ujian/publik/info/TautanTidakBerlaku';
import DaftarPengumpulan from '@/components/ujian/publik/monitoring/DaftarPengumpulan';
import { formatWIB } from '@/lib/datetime';
import { JENJANG_UJIAN } from '@/lib/mapelUjian';
import { bersihkanToken, galatTautanInfo, msSampai } from '@/lib/ujianInfoPublik';
import { buatSesi, muatMonitoringPublik } from '@/lib/ujianMonitoringPublik';

const JUDUL = 'Monitoring Pengumpulan Soal';
const KUNCI_JENJANG = 'monitoringUjian:jenjang';
const SEGARKAN_MS = 60 * 1000; // status pengumpulan dimuat ulang otomatis tiap menit selama halaman terbuka
const MUAT_OTOMATIS_MAKS_MS = 12 * 60 * 60 * 1000;
const PERIKSA_DITUTUP_MS = 2 * 60 * 1000; // tautan ditutup sementara: periksa ulang otomatis (halaman sering dibiarkan terbuka)

const jenjangSah = (v) => (JENJANG_UJIAN.includes(Number(v)) ? Number(v) : null);
function jenjangAwal(param) {
  const dariTautan = jenjangSah(param);
  if (dariTautan) return dariTautan;
  try { return jenjangSah(localStorage.getItem(KUNCI_JENJANG)) || JENJANG_UJIAN[0]; } catch { return JENJANG_UJIAN[0]; }
}

/**
 * Monitoring publik pengumpulan kisi-kisi & kartu soal lewat tautan /publik/monitoring-ujian/:token (tanpa login):
 * status terkirim/belum per mapel baku dalam tab Kelas 7/8/9, nama guru PJ, dan waktu update terakhir. Isi kartu soal
 * tidak pernah ditampilkan. Data dimuat ulang otomatis tiap menit; tab jenjang dapat dibuka langsung dengan ?kelas=.
 * Tautan tidak berlaku -> halaman "tautan tidak berlaku"; bila hanya ditutup sementara, diperiksa ulang tiap 2 menit
 * dan pulih sendiri begitu panitia membukanya kembali.
 */
export default function PublikMonitoringUjianPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const lokasi = useLocation();
  // Tanda baca yang ikut tersalin di ujung tautan (mis. "…/abc123.") dibuang lalu alamat diganti.
  useEffect(() => {
    const bersih = bersihkanToken(token);
    if (bersih && bersih !== token) navigate(`${lokasi.pathname.slice(0, lokasi.pathname.lastIndexOf('/') + 1)}${bersih}${lokasi.search}`, { replace: true });
  }, [token, lokasi.pathname, lokasi.search, navigate]);
  const [cari, setCari] = useSearchParams();
  const [data, setData] = useState(null);
  const [tautanGalat, setTautanGalat] = useState(null);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [dimuatPada, setDimuatPada] = useState(null);
  const [diperiksaPada, setDiperiksaPada] = useState(null);
  const [jenjang, setJenjang] = useState(() => jenjangAwal(cari.get('kelas')));
  const adaData = useRef(false);
  const sesi = useRef(null); // satu id per pembukaan halaman (log akses: pembukaan + lama pemantauan)
  if (!sesi.current) sesi.current = buatSesi();

  // `diam` = muat ulang latar: galat koneksi tidak mengganti tampilan yang sudah ada.
  const muat = useCallback((diam = false) => {
    setMemuat(true);
    if (!diam) setGagalMuat(false);
    return muatMonitoringPublik(token, { segarkan: diam, sesi: sesi.current })
      .then((d) => { setData(d); adaData.current = true; setTautanGalat(null); setGagalMuat(false); setDimuatPada(new Date()); })
      .catch((e) => {
        const g = galatTautanInfo(e);
        if (g) setTautanGalat(g);
        else if (!(diam && adaData.current)) setGagalMuat(true);
      })
      .finally(() => { setMemuat(false); setDiperiksaPada(new Date()); });
  }, [token]);
  useEffect(() => { if (bersihkanToken(token) === token) muat(); }, [muat, token]); // token kotor: tunggu alamat dibersihkan

  useEffect(() => {
    if (!data || tautanGalat) return undefined;
    const t = setInterval(() => muat(true), SEGARKAN_MS);
    return () => clearInterval(t);
  }, [data, tautanGalat, muat]);

  useEffect(() => {
    if (tautanGalat?.alasan !== 'belum_mulai') return undefined;
    const ms = msSampai(tautanGalat.mulai_at);
    if (ms === null || ms <= 0 || ms > MUAT_OTOMATIS_MAKS_MS) return undefined;
    const t = setTimeout(() => muat(), ms + 2000);
    return () => clearTimeout(t);
  }, [tautanGalat, muat]);

  useEffect(() => {
    if (tautanGalat?.alasan !== 'nonaktif') return undefined;
    const t = setInterval(() => muat(true), PERIKSA_DITUTUP_MS);
    return () => clearInterval(t);
  }, [tautanGalat, muat]);

  useEffect(() => {
    if (tautanGalat) document.title = `Tautan tidak berlaku · ${JUDUL}`;
    else if (data?.ujian?.nama) document.title = `${JUDUL} · ${data.ujian.nama}`;
  }, [data, tautanGalat]);

  const ubahJenjang = (j) => {
    setJenjang(j);
    try { localStorage.setItem(KUNCI_JENJANG, String(j)); } catch { /* abaikan */ }
    setCari((c) => { const n = new URLSearchParams(c); n.set('kelas', String(j)); return n; }, { replace: true });
  };

  if (tautanGalat) {
    return (
      <KerangkaPublik info={tautanGalat.madrasah ? { madrasah: tautanGalat.madrasah } : null} judul={JUDUL}>
        <TautanTidakBerlaku galat={tautanGalat} onMuatUlang={() => muat()} memuat={memuat} kontak="panitia ujian atau admin madrasah"
          catatan={tautanGalat.alasan === 'nonaktif' && diperiksaPada
            ? `Diperiksa otomatis tiap 2 menit · terakhir ${formatWIB(diperiksaPada, 'Time', { hour: '2-digit', minute: '2-digit' })} WIB` : null} />
      </KerangkaPublik>
    );
  }
  if (gagalMuat) {
    return (
      <KerangkaPublik judul={JUDUL}>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" data-testid="pantau-gagal-muat">
          <WifiOff className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h2 className="text-lg font-bold text-slate-900">Halaman belum dapat dimuat</h2>
          <p className="mt-1 text-sm text-slate-600">Periksa koneksi internet, lalu coba lagi.</p>
          <Button variant="outline" onClick={() => muat()} disabled={memuat} className="mt-4 gap-2" data-testid="pantau-coba-lagi">
            <RefreshCw className={`h-4 w-4 ${memuat ? 'animate-spin' : ''}`} /> Coba lagi
          </Button>
        </div>
      </KerangkaPublik>
    );
  }
  if (!data) {
    return <KerangkaPublik judul={JUDUL}><div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#006837]" /></div></KerangkaPublik>;
  }

  return (
    <KerangkaPublik info={data} judul={JUDUL}>
      {data.tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="pantau-tiruan">
          Server belum siap — menampilkan data contoh.
        </p>
      )}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs text-slate-500" aria-live="polite" data-testid="pantau-dimuat">
          Diperbarui {dimuatPada ? formatWIB(dimuatPada, 'Time', { hour: '2-digit', minute: '2-digit' }) : '-'} WIB<span className="hidden sm:inline"> · otomatis tiap menit</span>
        </p>
        <Button variant="outline" size="sm" onClick={() => muat(true)} disabled={memuat} className="h-8 shrink-0 gap-1.5" data-testid="pantau-segarkan">
          <RefreshCw className={`h-3.5 w-3.5 ${memuat ? 'animate-spin' : ''}`} /> Muat ulang
        </Button>
      </div>

      <DaftarPengumpulan berkas={data.berkas} mapel={data.mapel} jenjang={jenjang} onUbahJenjang={ubahJenjang} />

      <p className="flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600" data-testid="pantau-kerahasiaan">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Isi kartu soal bersifat rahasia — halaman ini hanya menampilkan status pengumpulan, nama PJ, dan waktu update.
      </p>
      {data.tautan?.selesai_at && (
        <p className="text-center text-xs text-slate-500" data-testid="pantau-berlaku-sampai">
          Tautan ini berlaku sampai {formatWIB(data.tautan.selesai_at, '', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB.
        </p>
      )}
    </KerangkaPublik>
  );
}
