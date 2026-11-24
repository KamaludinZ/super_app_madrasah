import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, RefreshCw, ShieldCheck, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KerangkaPublik from '@/components/ujian/publik/KerangkaPublik';
import PortalTerkunci from '@/components/ujian/publik/portal/PortalTerkunci';
import DaftarSoalPortal, { useJamServer } from '@/components/ujian/publik/portal/DaftarSoalPortal';
import { formatWIB } from '@/lib/datetime';
import { JENJANG_UJIAN } from '@/lib/mapelUjian';
import { bersihkanToken, msSampai } from '@/lib/ujianInfoPublik';
import { batasBerikutAt, buatSesi, galatPortal, muatPortalPublik, selisihJamServer } from '@/lib/ujianPortalPublik';

const JUDUL = 'Portal Ujian';
const KUNCI_JENJANG = 'portalUjian:jenjang';
const SEGARKAN_MS = 60 * 1000; // status & tautan mapel dimuat ulang otomatis tiap menit selama halaman terbuka
const MUAT_OTOMATIS_MAKS_MS = 12 * 60 * 60 * 1000;
const PERIKSA_DITUTUP_MS = 2 * 60 * 1000; // portal ditutup sementara: periksa ulang otomatis
const DETAK_RAPAT_MS = 10 * 60 * 1000; // batas mapel ≤ 10 menit lagi: jam berdetak tiap detik (hitung mundur menit:detik)
const SUSUL_BATAS_MS = 1500; // muat ulang dari server sesaat setelah mapel dibuka/ditutup agar status dikonfirmasi server

const jenjangSah = (v) => (JENJANG_UJIAN.includes(Number(v)) ? Number(v) : null);
function jenjangAwal(param) {
  const dariTautan = jenjangSah(param);
  if (dariTautan) return dariTautan;
  try { return jenjangSah(localStorage.getItem(KUNCI_JENJANG)) || JENJANG_UJIAN[0]; } catch { return JENJANG_UJIAN[0]; }
}

/**
 * Portal ujian publik lewat tautan /publik/portal-ujian/:token (tanpa login, token jenis `portal` — terpisah dari tautan
 * info & monitoring): jadwal mapel ujian per jenjang dalam tab Kelas 7/8/9 beserta status tiap mapel menurut jam server.
 * Tidak memuat kisi-kisi, tata tertib, berkas, maupun data pribadi siswa. Di luar masa ujian / saat ditutup panitia,
 * server menolak dan hanya pesan "portal belum dibuka / sudah ditutup" beserta jadwal berikutnya yang tampil (isi yang
 * sempat dimuat dibuang). Tab jenjang dapat dibuka langsung dengan ?kelas=.
 */
export default function PublikPortalUjianPage() {
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
  const [selisih, setSelisih] = useState(0);
  const [tautanGalat, setTautanGalat] = useState(null);
  const [gagalMuat, setGagalMuat] = useState(false);
  const [memuat, setMemuat] = useState(false);
  const [dimuatPada, setDimuatPada] = useState(null);
  const [diperiksaPada, setDiperiksaPada] = useState(null);
  const [jenjang, setJenjang] = useState(() => jenjangAwal(cari.get('kelas')));
  const adaData = useRef(false);
  const sesi = useRef(null); // satu id per pembukaan halaman (log akses)
  if (!sesi.current) sesi.current = buatSesi();
  const [detak, setDetak] = useState(15000);
  const sekarangMs = useJamServer(selisih, detak);
  const batasAt = data ? batasBerikutAt(data.soal, sekarangMs) : null;
  const detakBaru = batasAt !== null && batasAt - sekarangMs <= DETAK_RAPAT_MS ? 1000 : 15000;
  useEffect(() => { setDetak(detakBaru); }, [detakBaru]);

  // `diam` = muat ulang latar: galat koneksi tidak mengganti tampilan yang sudah ada.
  const muat = useCallback((diam = false) => {
    setMemuat(true);
    if (!diam) setGagalMuat(false);
    return muatPortalPublik(token, { segarkan: diam, sesi: sesi.current })
      .then((d) => {
        setSelisih(selisihJamServer(d.waktu_server));
        setData(d); adaData.current = true; setTautanGalat(null); setGagalMuat(false); setDimuatPada(new Date());
      })
      .catch((e) => {
        const g = galatPortal(e);
        if (g) { setTautanGalat(g); setData(null); adaData.current = false; } // portal ditutup: isi lama tidak boleh tetap tampil
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

  // Tepat setelah satu mapel dibuka/ditutup (menurut jam server), status dimuat ulang dari server: tampilan lokal hanya
  // perkiraan dari selisih jam, server yang menentukan.
  useEffect(() => {
    if (batasAt === null) return undefined;
    const ms = batasAt - (Date.now() + selisih);
    if (ms > MUAT_OTOMATIS_MAKS_MS) return undefined;
    const t = setTimeout(() => muat(true), Math.max(0, ms) + SUSUL_BATAS_MS);
    return () => clearTimeout(t);
  }, [batasAt, selisih, muat]);

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
    if (tautanGalat) document.title = `${tautanGalat.alasan === 'tidak_dikenal' ? 'Tautan tidak berlaku' : 'Portal terkunci'} · ${JUDUL}`;
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
        <PortalTerkunci galat={tautanGalat} onMuatUlang={() => muat()} memuat={memuat}
          catatan={tautanGalat.alasan === 'nonaktif' && diperiksaPada
            ? `Diperiksa otomatis tiap 2 menit · terakhir ${formatWIB(diperiksaPada, 'Time', { hour: '2-digit', minute: '2-digit' })} WIB` : null} />
      </KerangkaPublik>
    );
  }
  if (gagalMuat) {
    return (
      <KerangkaPublik judul={JUDUL}>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm" data-testid="portal-gagal-muat">
          <WifiOff className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          <h2 className="text-lg font-bold text-slate-900">Halaman belum dapat dimuat</h2>
          <p className="mt-1 text-sm text-slate-600">Periksa koneksi internet, lalu coba lagi.</p>
          <Button variant="outline" onClick={() => muat()} disabled={memuat} className="mt-4 gap-2" data-testid="portal-coba-lagi">
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
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="portal-tiruan">
          Server belum siap — menampilkan data contoh.
        </p>
      )}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs text-slate-500" aria-live="polite" data-testid="portal-jam">
          Jam server <span className="font-semibold tabular-nums text-slate-700">{formatWIB(sekarangMs, 'Time', { hour: '2-digit', minute: '2-digit' })} WIB</span>
          <span className="hidden sm:inline"> · diperbarui {dimuatPada ? formatWIB(dimuatPada, 'Time', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
        </p>
        <Button variant="outline" size="sm" onClick={() => muat(true)} disabled={memuat} className="h-8 shrink-0 gap-1.5" data-testid="portal-segarkan">
          <RefreshCw className={`h-3.5 w-3.5 ${memuat ? 'animate-spin' : ''}`} /> Muat ulang
        </Button>
      </div>

      <DaftarSoalPortal soal={data.soal} mapel={data.mapel} jenjang={jenjang} onUbahJenjang={ubahJenjang} sekarangMs={sekarangMs}
        token={token} tiruan={data.tiruan} kiniServer={() => Date.now() + selisih} onKedaluwarsa={() => muat(true)} />

      <p className="flex items-start gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600" data-testid="portal-catatan">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Soal hanya dapat dibuka pada jam ujian mapelnya. Status mengikuti jam server madrasah, bukan jam di perangkatmu.
      </p>
      {data.tautan?.selesai_at && (
        <p className="text-center text-xs text-slate-500" data-testid="portal-berlaku-sampai">
          Portal ini dibuka sampai {formatWIB(data.tautan.selesai_at, '', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB.
        </p>
      )}
    </KerangkaPublik>
  );
}
