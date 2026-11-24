import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CalendarRange, Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KerangkaPublik from '@/components/ujian/publik/KerangkaPublik';
import TautanTidakBerlaku from '@/components/ujian/publik/info/TautanTidakBerlaku';
import JadwalUjianPublik from '@/components/ujian/publik/info/JadwalUjianPublik';
import TataTertibUjian from '@/components/ujian/publik/info/TataTertibUjian';
import PanduanCbt from '@/components/ujian/publik/info/PanduanCbt';
import KisiKisiPerJenjang from '@/components/ujian/publik/info/KisiKisiPerJenjang';
import { formatWIB } from '@/lib/datetime';
import { JENJANG_UJIAN } from '@/lib/mapelUjian';
import {
  bersihkanToken, galatTautanInfo, msSampai, muatInfoUjianPublik, rentangTanggal, unduhKisiKisiPublik,
} from '@/lib/ujianInfoPublik';

const JUDUL = 'Informasi Ujian';
const KUNCI_JENJANG = 'infoUjian:jenjang';
const MUAT_OTOMATIS_MAKS_MS = 12 * 60 * 60 * 1000; // tautan yang dibuka ≤ 12 jam lagi dimuat ulang otomatis saat dibuka

const NAVIGASI = [
  { id: 'jadwal', label: 'Jadwal' },
  { id: 'tata-tertib', label: 'Tata Tertib' },
  { id: 'panduan-cbt', label: 'Panduan CBT' },
  { id: 'kisi-kisi', label: 'Kisi-kisi' },
];

/**
 * Navigasi bagian yang menempel di atas saat digulir (satu baris, dapat digeser di layar sempit). Bagian yang sedang
 * terlihat ditandai aktif (IntersectionObserver; tanpa dukungan browser, navigasi tetap berfungsi tanpa penanda).
 */
function NavigasiBagian() {
  const [aktif, setAktif] = useState(null);
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return undefined;
    const pengamat = new IntersectionObserver((entri) => {
      const terlihat = entri.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (terlihat) setAktif(terlihat.target.id);
    }, { rootMargin: '-80px 0px -55% 0px' });
    NAVIGASI.forEach((n) => { const el = document.getElementById(n.id); if (el) pengamat.observe(el); });
    return () => pengamat.disconnect();
  }, []);
  return (
    <nav aria-label="Bagian halaman" className="sticky top-0 z-20 -mx-4 flex gap-2 overflow-x-auto bg-[#FBF7EE]/95 px-4 py-2 backdrop-blur-sm" data-testid="info-navigasi">
      {NAVIGASI.map((n) => (
        <a key={n.id} href={`#${n.id}`} aria-current={aktif === n.id ? 'location' : undefined}
          className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold ${aktif === n.id
            ? 'border-[#006837] bg-[#006837] text-white' : 'border-emerald-200 bg-white text-[#006837] hover:bg-emerald-50'}`}>
          {n.label}
        </a>
      ))}
    </nav>
  );
}

const jenjangSah = (v) => (JENJANG_UJIAN.includes(Number(v)) ? Number(v) : null);

// Tab jenjang awal: ?kelas=8 pada tautan (dibagikan wali kelas) > pilihan terakhir di perangkat ini > Kelas 7.
// Pilihan perangkat hanya kenyamanan; boleh hilang (mode privat / penyimpanan diblokir).
function jenjangAwal(param) {
  const dariTautan = jenjangSah(param);
  if (dariTautan) return dariTautan;
  try { return jenjangSah(localStorage.getItem(KUNCI_JENJANG)) || JENJANG_UJIAN[0]; } catch { return JENJANG_UJIAN[0]; }
}

/**
 * Halaman informasi ujian untuk siswa lewat tautan publik /publik/info-ujian/:token (tanpa login): jadwal per jenjang,
 * tata tertib, panduan CBT, dan unduh kisi-kisi per jenjang dengan penghitung unduhan. Tautan yang tidak dikenal,
 * ditutup panitia, atau di luar jendela waktu akses menampilkan halaman "tautan tidak berlaku". Tab jenjang dapat
 * dibuka langsung dengan ?kelas=7|8|9.
 */
export default function PublikInfoUjianPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const lokasi = useLocation();
  // Tanda baca yang ikut tersalin di ujung tautan (mis. "…/abc123.") dibuang lalu alamat diganti.
  useEffect(() => {
    const bersih = bersihkanToken(token);
    if (bersih && bersih !== token) navigate(`${lokasi.pathname.slice(0, lokasi.pathname.lastIndexOf('/') + 1)}${bersih}${lokasi.search}`, { replace: true });
  }, [token, lokasi.pathname, lokasi.search, navigate]);
  const [cari, setCari] = useSearchParams();
  const [info, setInfo] = useState(null);
  const [tautanGalat, setTautanGalat] = useState(null);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [jenjang, setJenjang] = useState(() => jenjangAwal(cari.get('kelas')));
  const [mengunduh, setMengunduh] = useState(null);
  const [disorot, setDisorot] = useState(null);
  const timerSorot = useRef(null);
  useEffect(() => () => clearTimeout(timerSorot.current), []);

  const muat = useCallback(() => {
    setMemuat(true);
    setGagalMuat(false);
    return muatInfoUjianPublik(token)
      .then((d) => { setInfo(d); setTautanGalat(null); })
      .catch((e) => {
        const g = galatTautanInfo(e);
        if (g) setTautanGalat(g); else setGagalMuat(true);
      })
      .finally(() => setMemuat(false));
  }, [token]);
  useEffect(() => { if (bersihkanToken(token) === token) muat(); }, [muat, token]); // token kotor: tunggu alamat dibersihkan

  useEffect(() => {
    if (tautanGalat) document.title = `Tautan tidak berlaku · ${JUDUL}`;
    else if (info?.ujian?.nama) document.title = `${JUDUL} · ${info.ujian.nama}`;
  }, [info, tautanGalat]);

  // Tautan belum dibuka: muat ulang otomatis begitu jendela akses dimulai (bila tidak terlalu lama lagi).
  useEffect(() => {
    if (tautanGalat?.alasan !== 'belum_mulai') return undefined;
    const ms = msSampai(tautanGalat.mulai_at);
    if (ms === null || ms <= 0 || ms > MUAT_OTOMATIS_MAKS_MS) return undefined;
    const t = setTimeout(muat, ms + 2000);
    return () => clearTimeout(t);
  }, [tautanGalat, muat]);

  const ubahJenjang = (j) => {
    setJenjang(j);
    try { localStorage.setItem(KUNCI_JENJANG, String(j)); } catch { /* abaikan */ }
    // Alamat ikut tab aktif agar tautan yang disalin langsung membuka kelas yang sama.
    setCari((c) => { const n = new URLSearchParams(c); n.set('kelas', String(j)); return n; }, { replace: true });
  };

  const unduh = async (berkas) => {
    if (mengunduh) return;
    setMengunduh(berkas.id);
    try {
      const { jumlah_unduh: jumlah } = await unduhKisiKisiPublik(token, berkas);
      setInfo((d) => ({ ...d, kisi_kisi: d.kisi_kisi.map((k) => (k.id === berkas.id ? { ...k, jumlah_unduh: jumlah } : k)) }));
      setDisorot(berkas.id);
      clearTimeout(timerSorot.current);
      timerSorot.current = setTimeout(() => setDisorot(null), 1500);
    } catch (e) {
      const g = galatTautanInfo(e);
      if (g?.alasan && g.alasan !== 'tidak_dikenal') { setTautanGalat(g); return; } // tautan ditutup / jendela berakhir saat halaman terbuka
      toast.error(g ? 'Kisi-kisi ini sudah tidak tersedia. Muat ulang halaman untuk daftar terbaru.'
        : 'Gagal mengunduh kisi-kisi. Periksa koneksi lalu coba lagi.');
    } finally {
      setMengunduh(null);
    }
  };

  if (tautanGalat) {
    return (
      <KerangkaPublik info={tautanGalat.madrasah ? { madrasah: tautanGalat.madrasah } : null} judul={JUDUL}>
        <TautanTidakBerlaku galat={tautanGalat} onMuatUlang={muat} memuat={memuat} />
      </KerangkaPublik>
    );
  }
  if (gagalMuat) {
    return (
      <KerangkaPublik judul={JUDUL}>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" data-testid="info-gagal-muat">
          <WifiOff className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h2 className="text-lg font-bold text-slate-900">Halaman belum dapat dimuat</h2>
          <p className="mt-1 text-sm text-slate-600">Periksa koneksi internet, lalu coba lagi.</p>
          <Button variant="outline" onClick={muat} disabled={memuat} className="mt-4 gap-2" data-testid="info-coba-lagi">
            <RefreshCw className={`h-4 w-4 ${memuat ? 'animate-spin' : ''}`} /> Coba lagi
          </Button>
        </div>
      </KerangkaPublik>
    );
  }
  if (!info) {
    return <KerangkaPublik judul={JUDUL}><div className="py-16 text-center"><Loader2 className="mx-auto h-7 w-7 animate-spin text-[#006837]" /></div></KerangkaPublik>;
  }

  const u = info.ujian;
  return (
    <KerangkaPublik info={info} judul={JUDUL} lebar>
      {info.tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan">
          Server belum siap — menampilkan data contoh.
        </p>
      )}

      {u?.mulai && (
        <p className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm" data-testid="info-masa-ujian">
          <CalendarRange className="h-4 w-4 shrink-0 text-[#006837]" aria-hidden="true" />
          <span>Masa ujian <strong className="text-slate-900">{rentangTanggal(u.mulai, u.selesai)}</strong></span>
        </p>
      )}

      <NavigasiBagian />

      {/* Layar besar: jadwal di kolom kiri, sisanya di kanan. Layar kecil: satu kolom berurutan. */}
      <div className="space-y-4 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4 lg:space-y-0">
        <div className="space-y-4">
          <JadwalUjianPublik jadwal={info.jadwal} jenjang={jenjang} onUbahJenjang={ubahJenjang} />
        </div>
        <div className="space-y-4">
          <TataTertibUjian teks={info.tata_tertib} />
          <PanduanCbt token={token} panduan={info.panduan_cbt} tiruan={info.tiruan} />
          <KisiKisiPerJenjang kisiKisi={info.kisi_kisi} mapel={info.mapel} jenjang={jenjang} onUbahJenjang={ubahJenjang} mengunduh={mengunduh} disorot={disorot} onUnduh={unduh} />
        </div>
      </div>

      {info.tautan?.selesai_at && (
        <p className="text-center text-xs text-slate-500" data-testid="info-berlaku-sampai">
          Tautan ini berlaku sampai {formatWIB(info.tautan.selesai_at, '', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB.
        </p>
      )}
    </KerangkaPublik>
  );
}
