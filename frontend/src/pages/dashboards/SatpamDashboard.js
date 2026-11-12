import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, DoorOpen, Clock, CalendarClock, FileClock, FilePlus2, MapPinned, Megaphone, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { KemenagBadge } from '@/components/branding/KemenagBadge';
import PanelIzinHariIni from '@/components/izin/PanelIzinHariIni';
import PanelPengajuanSaya from '@/components/izin/PanelPengajuanSaya';
import DetailIzinDialog from '@/components/izin/DetailIzinDialog';
import {
  HALAMAN_PENGAJUAN_IZIN, jamSekarangWIB, muatDetailIzin, pesanGalat, muatPapanHariIni, muatPengajuanSaya, muatRingkasanSatpam, ringkasanSatpam,
} from '@/lib/izinKamad';
import { formatWIBPanjang } from '@/lib/datetime';
import { hariIniWIB } from '@/lib/tanggal';

function StatCard({ icon: Icon, label, value, color, subtitle, testid }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`} data-testid={testid}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</span>
        <Icon className="h-4 w-4 opacity-80" />
      </div>
      <div className="text-2xl font-extrabold tabular-nums">{value}</div>
      {subtitle && <div className="text-[10px] mt-1 opacity-70">{subtitle}</div>}
    </div>
  );
}

// Pintasan dashboard satpam. Menu satpam berikutnya ditambahkan di sini.
const PINTASAN_SATPAM = [
  { to: '/izin', label: 'Ajukan Izin', keterangan: 'Ajukan & batalkan izin keluar Anda', icon: FilePlus2 },
  { to: '/masterplan', label: 'Masterplan Sekolah', keterangan: 'Denah ruang madrasah', icon: MapPinned },
  { to: '/pengumuman', label: 'Pengumuman', keterangan: 'Informasi dari madrasah', icon: Megaphone },
];

/**
 * Dashboard satpam: ringkasan, papan izin disetujui hari ini, dan pengajuan izin sendiri.
 * Hanya-lihat — satpam tidak menandai jam keluar/kembali.
 */
export default function SatpamDashboard() {
  const { user } = useAuth();
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [papan, setPapan] = useState({ tanggal: hariIniWIB(), items: [] });
  const [saya, setSaya] = useState([]);
  const [ringkasan, setRingkasan] = useState(null); // dari server (jam server WIB)
  const [tiruan, setTiruan] = useState(false);
  const [jam, setJam] = useState(jamSekarangWIB);
  // { izin, bolehCatat }: catatan satpam hanya untuk izin di papan (milik orang lain), bukan pengajuan sendiri.
  const [dipilih, setDipilih] = useState(null);

  // diam = penyegaran otomatis tanpa indikator memuat (papan pantau diperbarui tiap menit).
  const muat = useCallback(async ({ diam = false } = {}) => {
    if (!diam) setMemuat(true);
    try {
      const [p, s, rs] = await Promise.all([muatPapanHariIni(), muatPengajuanSaya(), muatRingkasanSatpam()]);
      setPapan({ tanggal: p.tanggal, items: p.items });
      setSaya(s.items);
      setRingkasan(rs.tiruan ? null : rs);
      setTiruan(p.tiruan || s.tiruan || rs.tiruan);
      setJam(rs.tiruan ? jamSekarangWIB() : rs.jam);
      setGalat('');
    } catch (e) {
      if (!diam) setGalat(pesanGalat(e, 'Gagal memuat data izin. Periksa koneksi lalu coba lagi.'));
    } finally {
      if (!diam) setMemuat(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  // Buka detail dari data daftar, lalu segarkan dari server (status bisa berubah sejak daftar dimuat).
  const pilih = useCallback((izin, bolehCatat, fokusCatatan = false) => {
    setDipilih({ izin, bolehCatat, fokusCatatan });
    muatDetailIzin(izin.id)
      .then((baru) => { if (baru) setDipilih((d) => (d?.izin.id === izin.id ? { ...d, izin: baru } : d)); })
      .catch(() => { /* tetap tampilkan data daftar */ });
  }, []);

  // Izin yang baru disetujui & status "sedang izin / belum mulai / selesai" ikut jam berjalan.
  useEffect(() => {
    const t = setInterval(() => muat({ diam: true }), 60000);
    return () => clearInterval(t);
  }, [muat]);

  // Angka ringkasan dari server; data contoh dihitung di sini.
  const r = ringkasan || ringkasanSatpam(papan.items, saya, jam);

  return (
    <div className="space-y-6" data-testid="dashboard-satpam">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <KemenagBadge variant="default" className="mb-2" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Assalamu'alaikum, {user?.full_name?.split(' ')[0]}</h1>
          <p className="text-sm text-slate-600 mt-1">Dashboard Satpam — {formatWIBPanjang(papan.tanggal, false)}</p>
        </div>
        <Button variant="outline" onClick={() => muat()} disabled={memuat} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-satpam">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      {tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-satpam">
          Server belum menyediakan data izin — menampilkan data contoh untuk mencoba tampilan.
        </p>
      )}
      {galat && (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{galat}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="ringkasan-satpam">
        <StatCard icon={DoorOpen} label="Izin Hari Ini" value={r.izin_hari_ini} subtitle="Disetujui kepala madrasah" color="bg-emerald-50 border-emerald-200 text-emerald-700" testid="stat-izin-hari-ini" />
        <StatCard icon={Clock} label="Sedang Izin" value={r.berlangsung} subtitle={`Per pukul ${jam} WIB`} color="bg-blue-50 border-blue-200 text-blue-700" testid="stat-sedang-izin" />
        <StatCard icon={CalendarClock} label="Belum Mulai" value={r.akan_datang} subtitle="Izin nanti hari ini" color="bg-sky-50 border-sky-200 text-sky-700" testid="stat-belum-mulai" />
        <StatCard icon={FileClock} label="Pengajuan Saya" value={r.saya_menunggu} subtitle="Menunggu keputusan" color="bg-amber-50 border-amber-200 text-amber-700" testid="stat-pengajuan-menunggu" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PanelIzinHariIni className="lg:col-span-2" items={papan.items} tanggal={papan.tanggal} jam={jam} memuat={memuat} onPilih={(izin) => pilih(izin, true)} onCatat={(izin) => pilih(izin, true, true)} />

        <PanelPengajuanSaya items={saya} memuat={memuat} onPilih={(izin) => pilih(izin, false)} tautanKelola={HALAMAN_PENGAJUAN_IZIN} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Menu Satpam</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" data-testid="pintasan-satpam">
          {PINTASAN_SATPAM.map(({ to, label, keterangan, icon: Icon }) => (
            <Link key={to} to={to} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 hover:border-[#006837]/40 hover:bg-emerald-50/40 transition-colors">
              <div className="h-9 w-9 rounded-lg bg-[#006837]/10 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-[#006837]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-slate-900">{label}</div>
                <div className="text-xs text-slate-500">{keterangan}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </Link>
          ))}
        </CardContent>
      </Card>

      <DetailIzinDialog
        izin={dipilih?.izin ?? null}
        bolehCatat={!!dipilih?.bolehCatat}
        fokusCatatan={!!dipilih?.fokusCatatan}
        jam={jam}
        onTutup={() => setDipilih(null)}
      />
    </div>
  );
}
