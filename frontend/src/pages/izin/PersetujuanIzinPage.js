import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Gavel, CheckCircle2, XCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/lib/AuthContext';
import DaftarPersetujuan from '@/components/izin/DaftarPersetujuan';
import DetailIzinDialog from '@/components/izin/DetailIzinDialog';
import TolakIzinDialog from '@/components/izin/TolakIzinDialog';
import PanelIzinHariIni from '@/components/izin/PanelIzinHariIni';
import AksesDitolak from '@/components/security/AksesDitolak';
import {
  PERAN_PEMUTUS_IZIN, aksesDitolak, bolehPutuskanIzin, jamSekarangWIB, labelPeran, muatDetailIzin, muatMenunggu, muatPapanHariIni, muatRiwayatKeputusan, pesanGalat, saringRiwayat, setujuiIzin, tolakIzin,
} from '@/lib/izinKamad';
import { formatWIBPanjang } from '@/lib/datetime';
import { hariIniWIB } from '@/lib/tanggal';

// Menunggu: tanggal & jam terdekat dulu (yang paling mendesak di atas).
const urutMendesak = (a, b) => a.tanggal.localeCompare(b.tanggal) || a.jam_mulai.localeCompare(b.jam_mulai);

/**
 * Persetujuan Izin Kamad (/izin/persetujuan): kepala madrasah/kepala sekolah meninjau pengajuan izin
 * yang menunggu dan melihat riwayat keputusan (disetujui/ditolak beserta alasannya).
 */
export default function PersetujuanIzinPage() {
  const { user, activeRole } = useAuth();
  const boleh = bolehPutuskanIzin(activeRole);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [menunggu, setMenunggu] = useState([]);
  const [riwayat, setRiwayat] = useState([]);
  const [papan, setPapan] = useState({ tanggal: hariIniWIB(), items: [] }); // izin disetujui hari ini
  const [tiruan, setTiruan] = useState(false);
  const [tab, setTab] = useState('menunggu');
  const [dipilih, setDipilih] = useState(null);
  const [sibukId, setSibukId] = useState(null);
  const [ditolakServer, setDitolakServer] = useState(''); // detail 403 dari server
  const [akanDitolak, setAkanDitolak] = useState(null); // izin yang sedang diisi alasan penolakannya
  const [saringan, setSaringan] = useState({ status: 'semua', cari: '' }); // tab riwayat

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [m, r, p] = await Promise.all([muatMenunggu(), muatRiwayatKeputusan(), muatPapanHariIni()]);
      setMenunggu([...m.items].sort(urutMendesak));
      setRiwayat(r.items);
      setPapan({ tanggal: p.tanggal, items: p.items });
      setTiruan(m.tiruan || r.tiruan || p.tiruan);
      setGalat('');
    } catch (e) {
      if (aksesDitolak(e)) setDitolakServer(pesanGalat(e, 'Akses ditolak.'));
      else setGalat(pesanGalat(e, 'Gagal memuat pengajuan izin. Periksa koneksi lalu coba lagi.'));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { if (boleh) muat(); }, [boleh, muat]);

  const pilih = useCallback((izin) => {
    setDipilih(izin);
    muatDetailIzin(izin.id)
      .then((baru) => { if (baru) setDipilih((d) => (d?.id === izin.id ? baru : d)); })
      .catch(() => { /* tetap tampilkan data daftar */ });
  }, []);

  // Keputusan tersimpan: keluarkan dari daftar menunggu, masukkan ke riwayat (terbaru di atas).
  const terapkanKeputusan = useCallback((baru) => {
    setMenunggu((l) => l.filter((i) => i.id !== baru.id));
    setRiwayat((l) => [baru, ...l.filter((i) => i.id !== baru.id)]);
    setDipilih((d) => (d?.id === baru.id ? baru : d));
    // Izin hari ini yang disetujui langsung masuk papan pantau.
    if (baru.status === 'disetujui') {
      setPapan((p) => (baru.tanggal === p.tanggal ? { ...p, items: [...p.items.filter((i) => i.id !== baru.id), baru] } : p));
    }
  }, []);

  const setujui = useCallback(async (izin) => {
    const ok = await confirmDialog(
      `Setujui izin ${izin.pengaju_nama} (${labelPeran(izin.pengaju_peran)})?\n${formatWIBPanjang(izin.tanggal, false)}, pukul ${izin.jam_mulai}–${izin.jam_selesai}\nKeperluan: ${izin.keperluan}`,
      { title: 'Setujui Izin', confirmText: 'Ya, setujui', cancelText: 'Batal' },
    );
    if (!ok) return;
    setSibukId(izin.id);
    try {
      const h = await setujuiIzin(izin, user?.full_name || 'Kepala Madrasah');
      terapkanKeputusan(h.izin);
      const papan = h.izin.tanggal === hariIniWIB() ? ' — langsung tampil di papan pantau satpam' : '';
      toast.success(`Izin ${izin.pengaju_nama} disetujui${papan}${h.tiruan ? ' (contoh, belum tersimpan di server)' : ''}`);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menyetujui izin. Periksa koneksi lalu coba lagi.'));
    } finally {
      setSibukId(null);
    }
  }, [user?.full_name, terapkanKeputusan]);

  // Dipanggil TolakIzinDialog; true = berhasil (dialog ditutup).
  const tolak = useCallback(async (izin, alasan) => {
    setSibukId(izin.id);
    try {
      const h = await tolakIzin(izin, alasan, user?.full_name || 'Kepala Madrasah');
      terapkanKeputusan(h.izin);
      toast.success(`Izin ${izin.pengaju_nama} ditolak — alasan terlihat oleh pengaju${h.tiruan ? ' (contoh, belum tersimpan di server)' : ''}`);
      return true;
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menolak izin. Periksa koneksi lalu coba lagi.'));
      return false;
    } finally {
      setSibukId(null);
    }
  }, [user?.full_name, terapkanKeputusan]);

  const bukaTolak = useCallback((izin) => { setDipilih(null); setAkanDitolak(izin); }, []);

  const aksiMenunggu = (izin) => (
    <>
      <Button size="sm" variant="outline" onClick={() => bukaTolak(izin)} disabled={sibukId === izin.id}
        className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800" data-testid={`btn-tolak-izin-${izin.id}`}>
        <XCircle className="h-3.5 w-3.5" /> Tolak
      </Button>
      <Button size="sm" onClick={() => setujui(izin)} disabled={sibukId === izin.id}
        className="gap-1.5 bg-[#006837] hover:bg-[#00552d]" data-testid={`btn-setujui-izin-${izin.id}`}>
        {sibukId === izin.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Setujui
      </Button>
    </>
  );

  if (!boleh || ditolakServer) {
    return (
      <AksesDitolak halaman="Persetujuan Izin" untuk="kepala madrasah/kepala sekolah"
        pesan={ditolakServer || undefined} peranBerhak={PERAN_PEMUTUS_IZIN} />
    );
  }

  const disetujui = riwayat.filter((i) => i.status === 'disetujui').length;
  const ditolak = riwayat.filter((i) => i.status === 'ditolak').length;
  const pemuat = <div className="py-12 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>;

  return (
    <div className="space-y-6" data-testid="persetujuan-izin-page">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
            <Gavel className="h-3 w-3 mr-1" /> Izin Kamad
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Persetujuan Izin</h1>
          <p className="text-sm text-slate-600 mt-1">
            Tinjau pengajuan izin keluar kepala TU, guru, tendik, dan satpam. Izin yang disetujui langsung tampil di papan pantau satpam.
          </p>
        </div>
        <Button variant="outline" onClick={muat} disabled={memuat} className="gap-2 self-start sm:self-auto" data-testid="btn-muat-ulang-persetujuan">
          {memuat ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Muat Ulang
        </Button>
      </div>

      {tiruan && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="info-tiruan-persetujuan">
          Server belum menyediakan data izin — menampilkan data contoh untuk mencoba tampilan.
        </p>
      )}
      {galat && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">{galat}</p>}

      <div className="grid grid-cols-3 gap-3" data-testid="ringkasan-persetujuan">
        {[
          { label: 'Menunggu', nilai: menunggu.length, kelas: 'bg-amber-50 border-amber-200 text-amber-700' },
          { label: 'Disetujui', nilai: disetujui, kelas: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { label: 'Ditolak', nilai: ditolak, kelas: 'bg-rose-50 border-rose-200 text-rose-700' },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl border p-3 sm:p-4 ${k.kelas}`}>
            <div className="text-xs font-semibold uppercase tracking-wide opacity-80">{k.label}</div>
            <div className="text-2xl font-extrabold tabular-nums">{memuat && !menunggu.length && !riwayat.length ? '–' : k.nilai}</div>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="menunggu" data-testid="tab-izin-menunggu">Menunggu ({menunggu.length})</TabsTrigger>
          <TabsTrigger value="hari-ini" data-testid="tab-izin-hari-ini">Izin Hari Ini ({papan.items.length})</TabsTrigger>
          <TabsTrigger value="riwayat" data-testid="tab-izin-riwayat">Riwayat Keputusan ({riwayat.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="hari-ini" className="mt-4">
          <PanelIzinHariIni items={papan.items} tanggal={papan.tanggal} jam={jamSekarangWIB()} memuat={memuat} onPilih={pilih} />
        </TabsContent>
        <TabsContent value="menunggu" className="mt-4">
          <Card><CardContent className="pt-3">
            {memuat && !menunggu.length ? pemuat : (
              <DaftarPersetujuan items={menunggu} mode="menunggu" onPilih={pilih} aksi={aksiMenunggu} kosong="Tidak ada pengajuan yang menunggu keputusan" />
            )}
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="riwayat" className="mt-4">
          <Card><CardContent className="pt-3">
            <div className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Saring status keputusan">
                {[['semua', 'Semua', riwayat.length], ['disetujui', 'Disetujui', disetujui], ['ditolak', 'Ditolak', ditolak]].map(([v, l, n]) => (
                  <button key={v} type="button" role="tab" aria-selected={saringan.status === v}
                    onClick={() => setSaringan((x) => ({ ...x, status: v }))}
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${saringan.status === v ? 'border-[#006837] bg-[#006837] text-white' : 'border-slate-200 text-slate-600 hover:border-[#006837]/40'}`}
                    data-testid={`filter-riwayat-${v}`}>
                    {l} <span className="tabular-nums opacity-80">{n}</span>
                  </button>
                ))}
              </div>
              <div className="relative sm:w-64">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={saringan.cari} onChange={(e) => setSaringan((x) => ({ ...x, cari: e.target.value }))}
                  placeholder="Cari nama / keperluan" className="pl-8" aria-label="Cari riwayat keputusan" data-testid="cari-riwayat-izin" />
              </div>
            </div>
            {memuat && !riwayat.length ? pemuat : (
              <DaftarPersetujuan
                items={saringRiwayat(riwayat, saringan)}
                mode="riwayat"
                onPilih={pilih}
                kosong={riwayat.length ? 'Tidak ada keputusan yang cocok dengan saringan' : 'Belum ada keputusan izin'}
              />
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <DetailIzinDialog
        izin={dipilih}
        jam={jamSekarangWIB()}
        onTutup={() => setDipilih(null)}
        onSetujui={setujui}
        onTolak={bukaTolak}
        sibuk={!!dipilih && sibukId === dipilih.id}
      />

      <TolakIzinDialog izin={akanDitolak} onTutup={() => setAkanDitolak(null)} onTolak={tolak} />
    </div>
  );
}
