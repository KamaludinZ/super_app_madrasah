import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import PanelIzinHariIni from '@/components/izin/PanelIzinHariIni';
import DetailIzinDialog from '@/components/izin/DetailIzinDialog';
import AksesDitolak from '@/components/security/AksesDitolak';
import {
  PERAN_PEMANTAU_IZIN, aksesDitolak, bolehPantauIzin, jamSekarangWIB, kelompokkanWaktu, muatDetailIzin, muatPapanHariIni, pesanGalat,
} from '@/lib/izinKamad';
import { hariIniWIB } from '@/lib/tanggal';

/**
 * Pemantau Izin Hari Ini (/izin/pemantau) untuk kepala tata usaha: izin yang sudah disetujui kepala
 * madrasah untuk hari ini (nama pengaju, jam, keperluan) — data & panel yang sama dengan dashboard
 * satpam. Hanya-lihat; diperbarui otomatis tiap menit.
 */
export default function PemantauIzinPage() {
  const { activeRole } = useAuth();
  const boleh = bolehPantauIzin(activeRole);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [ditolakServer, setDitolakServer] = useState('');
  const [papan, setPapan] = useState({ tanggal: hariIniWIB(), items: [] });
  const [tiruan, setTiruan] = useState(false);
  const [jam, setJam] = useState(jamSekarangWIB);
  const [dipilih, setDipilih] = useState(null);

  const muat = useCallback(async ({ diam = false } = {}) => {
    if (!diam) setMemuat(true);
    try {
      const p = await muatPapanHariIni();
      setPapan({ tanggal: p.tanggal, items: p.items });
      setTiruan(p.tiruan);
      setJam(jamSekarangWIB());
      setGalat('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolakServer(pesanGalat(e, 'Akses ditolak.'));
      else if (!diam) setGalat(pesanGalat(e, 'Gagal memuat izin hari ini. Periksa koneksi lalu coba lagi.'));
    } finally {
      if (!diam) setMemuat(false);
    }
  }, []);

  useEffect(() => { if (boleh) muat(); }, [boleh, muat]);
  useEffect(() => {
    if (!boleh) return undefined;
    const t = setInterval(() => muat({ diam: true }), 60000);
    return () => clearInterval(t);
  }, [boleh, muat]);

  const pilih = useCallback((izin) => {
    setDipilih(izin);
    muatDetailIzin(izin.id)
      .then((baru) => { if (baru) setDipilih((d) => (d?.id === izin.id ? baru : d)); })
      .catch(() => { /* tetap tampilkan data daftar */ });
  }, []);

  if (!boleh || ditolakServer) {
    return (
      <AksesDitolak halaman="Pemantau Izin Hari Ini" untuk="kepala tata usaha dan kepala madrasah"
        pesan={ditolakServer || undefined} peranBerhak={[...PERAN_PEMANTAU_IZIN, 'kepala_sekolah']} />
    );
  }

  const g = kelompokkanWaktu(papan.items, jam);
  const kartu = [
    { label: 'Izin Hari Ini', nilai: papan.items.length, kelas: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    { label: 'Sedang Izin', nilai: g.berlangsung.length, kelas: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Belum Mulai', nilai: g.akan_datang.length, kelas: 'bg-sky-50 border-sky-200 text-sky-700' },
    { label: 'Selesai', nilai: g.selesai.length, kelas: 'bg-slate-50 border-slate-200 text-slate-600' },
  ];

  return (
    <div className="space-y-6" data-testid="pemantau-izin-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <ShieldCheck className="h-3 w-3 mr-1" /> Izin Kamad
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Pemantau Izin Hari Ini</h1>
          <p className="text-sm text-slate-600 mt-1">
            Izin keluar GTK & satpam yang sudah disetujui kepala madrasah untuk hari ini. Diperbarui otomatis tiap menit.
          </p>
        </div>
        <Button variant="outline" onClick={() => muat()} disabled={memuat} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-pemantau">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      {tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-pemantau">
          Server belum menyediakan data izin — menampilkan data contoh untuk mencoba tampilan.
        </p>
      )}
      {galat && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{galat}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="ringkasan-pemantau">
        {kartu.map((k) => (
          <div key={k.label} className={`rounded-xl border p-3 sm:p-4 ${k.kelas}`}>
            <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{k.label}</div>
            <div className="text-2xl font-extrabold tabular-nums">{memuat && !papan.items.length ? '–' : k.nilai}</div>
          </div>
        ))}
      </div>

      <PanelIzinHariIni items={papan.items} tanggal={papan.tanggal} jam={jam} memuat={memuat} onPilih={pilih} />

      <DetailIzinDialog izin={dipilih} jam={jam} onTutup={() => setDipilih(null)} />
    </div>
  );
}
