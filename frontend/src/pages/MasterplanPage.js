import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Map as IkonPeta, Loader2, Info, ImageOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import KeadaanDenah from '@/components/masterplan/KeadaanDenah';
import KelolaDenahBar from '@/components/masterplan/KelolaDenahBar';
import UnggahDenahDialog from '@/components/masterplan/UnggahDenahDialog';
import PenandaBaruDialog from '@/components/masterplan/PenandaBaruDialog';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { useAuth } from '@/lib/AuthContext';
import { bolehKelolaMasterplan } from '@/lib/aksesMasterplan';
import BannerModeLihat from '@/components/tatib/BannerModeLihat';
import { toast } from 'sonner';
import { ambilMasterplan, hapusDenah as hapusDenahApi, ambilDaftarRuang, ambilGambarDenah, ubahPenanda } from '@/lib/masterplan';
import PenandaRuang from '@/components/masterplan/PenandaRuang';
import PanelDetailRuang from '@/components/masterplan/PanelDetailRuang';
import PanelAturPenanda from '@/components/masterplan/PanelAturPenanda';
import KeteranganRuang from '@/components/masterplan/KeteranganRuang';
import TombolUnduhDenah from '@/components/masterplan/TombolUnduhDenah';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

// Masterplan / Denah Sekolah: gambar denah sebagai latar + penanda ruang (posisi dalam persen).
// Fase 1 masih memakai data tiruan; unggah denah & kelola penanda (admin) menyusul.
export default function MasterplanPage() {
  const { activeRole } = useAuth();
  const bolehKelola = bolehKelolaMasterplan(activeRole);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [galatMuat, setGalatMuat] = useState(false);
  const [versiGambar, setVersiGambar] = useState(0);
  const [sibuk, setSibuk] = useState(false);
  const [dialogUnggah, setDialogUnggah] = useState(false);
  // Mode atur penanda (admin): tempatkan, geser, pilih ruang, hapus penanda di atas denah.
  const [modeAturDiminta, setModeAtur] = useState(false);
  // Read-only: mode atur hanya berlaku untuk peran yang boleh mengelola (admin).
  const modeAtur = bolehKelola && modeAturDiminta;
  const [daftarRuang, setDaftarRuang] = useState([]);
  const [draf, setDraf] = useState(null); // {posisi_x, posisi_y} penanda baru yang belum disimpan
  const kotakDenah = useRef(null);
  const panelRuang = useRef(null);
  const geser = useRef(null); // {id, awal: {x, y}, bergerak}

  const gantiPenanda = useCallback((id, ubah) => {
    setData((d) => (d ? { ...d, markers: d.markers.map((m) => (m.id === id ? { ...m, ...ubah } : m)) } : d));
    setDipilih((p) => (p?.id === id ? { ...p, ...ubah } : p));
  }, []);

  // Seret penanda (mode atur): posisi mengikuti pointer, disimpan ke server saat dilepas.
  const mulaiGeser = (e, marker) => {
    if (!modeAtur || e.button > 0) return;
    e.stopPropagation();
    geser.current = { id: marker.id, awal: { x: marker.posisi_x, y: marker.posisi_y }, bergerak: false };
    const persen = (ev) => {
      const k = kotakDenah.current.getBoundingClientRect();
      const bulat = (v) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));
      return { posisi_x: bulat(((ev.clientX - k.left) / k.width) * 100), posisi_y: bulat(((ev.clientY - k.top) / k.height) * 100) };
    };
    const gerak = (ev) => {
      geser.current.bergerak = true;
      gantiPenanda(marker.id, persen(ev));
    };
    const lepas = async (ev) => {
      window.removeEventListener('pointermove', gerak);
      window.removeEventListener('pointerup', lepas);
      const g = geser.current;
      geser.current = null;
      if (!g?.bergerak) return;
      const posisi = persen(ev);
      try {
        gantiPenanda(g.id, await ubahPenanda(g.id, posisi));
        toast.success('Posisi penanda disimpan');
      } catch (err) {
        gantiPenanda(g.id, { posisi_x: g.awal.x, posisi_y: g.awal.y });
        toast.error(err.message);
      }
    };
    window.addEventListener('pointermove', gerak);
    window.addEventListener('pointerup', lepas);
  };
  const [ukuranAsli, setUkuranAsli] = useState(null);
  const [gagalGambar, setGagalGambar] = useState(false);
  const [gambarUrl, setGambarUrl] = useState('');
  const [tampilNama, setTampilNama] = useState(true);
  const [dipilih, setDipilih] = useState(null);
  const [sorot, setSorot] = useState(null);

  const muat = useCallback(() => {
    setLoading(true);
    setGalatMuat(false);
    ambilMasterplan()
      .then((d) => {
        setData(d);
        setGagalGambar(false);
      })
      .catch(() => {
        setGalatMuat(true);
        toast.error('Gagal memuat denah sekolah');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { muat(); }, [muat]);

  // Master ruangan dimuat saat mode atur dibuka (sumber nama ruang penanda).
  useEffect(() => {
    if (!modeAtur || daftarRuang.length) return;
    ambilDaftarRuang().then(setDaftarRuang).catch(() => toast.error('Gagal memuat master ruangan'));
  }, [modeAtur, daftarRuang.length]);

  // Klik titik kosong di denah (mode atur) -> posisi dalam persen terhadap gambar denah.
  const klikDenah = (e) => {
    if (!bolehKelola || !modeAtur || e.target.closest('[data-penanda]')) return;
    const kotak = e.currentTarget.getBoundingClientRect();
    const bulat = (v) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));
    setDipilih(null);
    setDraf({
      posisi_x: bulat(((e.clientX - kotak.left) / kotak.width) * 100),
      posisi_y: bulat(((e.clientY - kotak.top) / kotak.height) * 100),
    });
  };

  // Kelola denah (admin): unggah/ganti lewat dialog, hapus dengan konfirmasi.
  const setelahUnggah = () => {
    setUkuranAsli(null);
    muat();
  };

  const hapusDenah = async () => {
    const yakin = await confirmDialog(
      `Denah aktif beserta ${markers.length} penanda ruangnya akan dihapus. Warga madrasah tidak lagi dapat melihat denah sampai denah baru diunggah.`,
      { title: 'Hapus denah sekolah?', confirmText: 'Ya, hapus denah' },
    );
    if (!yakin) return;
    setSibuk(true);
    try {
      await hapusDenahApi();
      toast.success('Denah dihapus');
      setModeAtur(false);
      setDipilih(null);
      muat();
    } catch (err) {
      toast.error(err?.message || 'Gagal menghapus denah');
    } finally {
      setSibuk(false);
    }
  };

  const urlDenah = data?.denah?.image_url;
  useEffect(() => {
    if (!urlDenah) {
      setGambarUrl('');
      return undefined;
    }
    let batal = false;
    let objek = '';
    setGagalGambar(false);
    ambilGambarDenah(urlDenah)
      .then((u) => {
        objek = u;
        if (batal) URL.revokeObjectURL(u);
        else setGambarUrl(u);
      })
      .catch(() => { if (!batal) setGagalGambar(true); });
    return () => {
      batal = true;
      if (objek) URL.revokeObjectURL(objek);
    };
  }, [urlDenah, versiGambar]);

  // Layar sempit (HP): panel ruang berada di bawah denah, jadi gulir ke panel saat penanda dipilih.
  const idDipilih = dipilih?.id;
  useEffect(() => {
    if (!idDipilih || window.innerWidth >= 1024 || !panelRuang.current) return;
    panelRuang.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [idDipilih]);

  const muatUlangGambar = () => {
    setGagalGambar(false);
    setVersiGambar((v) => v + 1);
  };

  const denah = data?.denah;
  const markers = data?.markers || [];
  // Proporsi denah dari data (lebar/tinggi) atau ukuran asli gambar saat dimuat; cadangan 16:10.
  const lebar = denah?.lebar || ukuranAsli?.w || 16;
  const tinggi = denah?.tinggi || ukuranAsli?.h || 10;

  return (
    <div className="space-y-6" data-testid="masterplan-page">
      <div>
        <Badge className="bg-[#006837]/10 text-[#006837] border-[#006837]/20 mb-2">
          <IkonPeta className="h-3 w-3 mr-1" /> Sarana Prasarana
        </Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Masterplan Sekolah</h1>
        <p className="text-sm text-slate-600 mt-1">
          Denah tata ruang madrasah beserta posisi dan nama ruang{!bolehKelola && ' · hanya dapat dilihat'}
        </p>
      </div>

      {!bolehKelola && (
        <BannerModeLihat>Mode lihat saja — denah dan penanda ruang dikelola oleh admin.</BannerModeLihat>
      )}

      {bolehKelola && !loading && !galatMuat && (
        <>
          <KelolaDenahBar
            denah={denah}
            jumlahPenanda={markers.length}
            sibuk={sibuk}
            onUnggah={() => setDialogUnggah(true)}
            onHapus={hapusDenah}
            modeAtur={modeAtur}
            onModeAtur={setModeAtur}
          />
          {denah && markers.some((m) => !m.kode_ruang) && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="masterplan-tanpa-kode">
              <span>
                {markers.filter((m) => !m.kode_ruang).length} penanda belum punya kode ruang. Kode tampil di penanda dan di keterangan saat denah diunduh.
              </span>
              {!modeAtur && (
                <Button size="sm" variant="outline" className="h-7 bg-white" onClick={() => setModeAtur(true)}>Lengkapi kode</Button>
              )}
            </div>
          )}
          {modeAtur && denah && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" data-testid="masterplan-petunjuk-atur">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Mode atur penanda: klik titik kosong di denah untuk menempatkan penanda baru, seret penanda untuk menggeser, atau pilih penanda untuk mengganti ruang / menghapusnya.</span>
            </div>
          )}
          <UnggahDenahDialog
            open={dialogUnggah}
            ganti={!!denah}
            denahLama={denah && { lebar, tinggi }}
            jumlahPenanda={markers.length}
            onClose={() => setDialogUnggah(false)} onTerunggah={setelahUnggah} />
        </>
      )}

      {loading ? (
        <div className="p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-[#006837]" />
          <p className="text-slate-500">Memuat denah...</p>
        </div>
      ) : galatMuat ? (
        <KeadaanDenah jenis="gagal" onCobaLagi={muat} />
      ) : !denah?.image_url ? (
        <KeadaanDenah jenis="kosong" bolehKelola={bolehKelola} onUnggah={() => setDialogUnggah(true)} sibuk={sibuk} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="overflow-hidden">
          <CardContent className="p-2 sm:p-4">
            {/* Layar sempit: denah tetap minimal 640px dan bisa digeser agar nama ruang terbaca. */}
            <div className="overflow-x-auto">
            <div
              className={`relative w-full min-w-[640px] overflow-hidden rounded-md bg-slate-50 ${modeAtur ? 'cursor-crosshair ring-2 ring-amber-400' : ''}`}
              style={{ aspectRatio: `${lebar} / ${tinggi}` }}
              onClick={klikDenah}
              ref={kotakDenah}
              data-testid="masterplan-denah"
            >
              {gagalGambar ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-slate-500" data-testid="masterplan-gambar-gagal">
                  <ImageOff className="h-8 w-8 text-slate-300" />
                  Gambar denah gagal dimuat
                  <Button variant="outline" size="sm" onClick={muatUlangGambar}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Muat ulang gambar
                  </Button>
                </div>
              ) : !gambarUrl ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#006837]" />
                </div>
              ) : (
                <img
                  key={versiGambar}
                  src={gambarUrl}
                  alt="Denah sekolah"
                  className="absolute inset-0 h-full w-full select-none object-contain"
                  draggable={false}
                  onLoad={(e) => setUkuranAsli({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
                  onError={() => setGagalGambar(true)}
                />
              )}
              {draf && (
                <span
                  className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-white bg-amber-500 ring-4 ring-amber-300/60"
                  style={{ left: `${draf.posisi_x}%`, top: `${draf.posisi_y}%` }}
                  aria-hidden
                />
              )}
              {!gagalGambar && markers.map((m) => (
                <PenandaRuang
                  key={m.id}
                  marker={m}
                  aktif={dipilih?.id === m.id}
                  sorot={sorot === m.id}
                  tampilNama={tampilNama}
                  onPilih={setDipilih}
                  onMulaiGeser={modeAtur ? mulaiGeser : undefined}
                />
              ))}
            </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {markers.length ? `${markers.length} ruang ditandai` : 'Belum ada ruang yang ditandai pada denah ini.'}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch id="tampil-nama-ruang" checked={tampilNama} onCheckedChange={setTampilNama} />
                  <Label htmlFor="tampil-nama-ruang" className="text-xs text-slate-600">Tampilkan nama ruang</Label>
                </div>
                <TombolUnduhDenah gambarUrl={gambarUrl} markers={markers} disabled={gagalGambar} />
              </div>
            </div>
            <KeteranganRuang markers={markers} dipilihId={dipilih?.id} onPilih={setDipilih} onSorot={setSorot} />
          </CardContent>
        </Card>
        <PenandaBaruDialog
        draf={draf}
        daftarRuang={daftarRuang}
        markers={markers}
        onClose={() => setDraf(null)}
        onTersimpan={(m) => {
          setData((d) => ({ ...d, markers: [...(d?.markers || []), m] }));
          setDipilih(m);
        }}
      />
      <div ref={panelRuang} className="scroll-mt-4">
      {modeAtur && dipilih ? (
        <PanelAturPenanda
          marker={dipilih}
          daftarRuang={daftarRuang}
          markers={markers}
          onBerubah={(m) => gantiPenanda(m.id, m)}
          onTerhapus={(id) => {
            setData((d) => ({ ...d, markers: d.markers.filter((m) => m.id !== id) }));
            setDipilih(null);
          }}
          onTutup={() => setDipilih(null)}
        />
      ) : (
        <PanelDetailRuang marker={dipilih} onTutup={() => setDipilih(null)} />
      )}
      </div>
        </div>
      )}
    </div>
  );
}
