import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle, CalendarClock, Check, CheckCircle2, Copy, ExternalLink, Globe2, KeyRound, Loader2, Lock, MonitorCheck, MonitorPlay, Save, Share2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatWIBPanjang } from '@/lib/datetime';
import { pesanGalat } from '@/lib/ujian';
import {
  dariInputWaktu, galatJendela, gantiTokenTautan, keInputWaktu, keteranganWaktu, peringatanTautan, pesanBagikan, presetJendela, ringkasJendela,
  salinTeks, selesaiSudahLewat, simpanTautanPublik, statusTautan, urlTautan,
} from '@/lib/ujianTautanPublik';

const IKON = { info: Globe2, monitoring: MonitorCheck, portal: MonitorPlay };

// Lencana status berlaku saat ini (dari server: cek_tautan).
const STATUS = {
  ok: { label: 'Berlaku', kelas: 'bg-emerald-50 text-emerald-700 border-emerald-200', Ikon: CheckCircle2 },
  nonaktif: { label: 'Ditutup', kelas: 'bg-slate-100 text-slate-600 border-slate-200', Ikon: Lock },
  belum_mulai: { label: 'Belum dibuka', kelas: 'bg-amber-50 text-amber-800 border-amber-200', Ikon: CalendarClock },
  sudah_selesai: { label: 'Berakhir', kelas: 'bg-rose-50 text-rose-700 border-rose-200', Ikon: CalendarClock },
};

export function LencanaStatusTautan({ tautan, testId }) {
  const s = STATUS[tautan?.alasan] || STATUS.nonaktif;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${s.kelas}`} data-testid={testId} data-alasan={tautan?.alasan}>
      <s.Ikon className="h-3.5 w-3.5" aria-hidden="true" /> {s.label}
    </span>
  );
}

// Jam sekarang, diperbarui tiap menit agar status & keterangan waktu tidak basi selama halaman terbuka.
function useSekarang() {
  const [kini, setKini] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setKini(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return kini;
}

/**
 * Satu tautan publik (info / monitoring / portal): status berlaku, URL + salin/buka, sakelar buka/tutup (tersimpan langsung),
 * jendela waktu akses (WIB; kosong = tanpa batas), dan ganti token dengan konfirmasi. `bolehUbah` false = hanya lihat.
 */
export default function KartuTautanPublik({ ujianId, namaUjian, masaUjian, meta, tautan, bolehUbah, onTersimpan }) {
  const Ikon = IKON[meta.jenis] || Globe2;
  const [mulai, setMulai] = useState(keInputWaktu(tautan.mulai_at));
  const [selesai, setSelesai] = useState(keInputWaktu(tautan.selesai_at));
  const [sibuk, setSibuk] = useState(null); // 'aktif' | 'jendela' | 'token'
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [tersalin, setTersalin] = useState(false);
  const timerSalin = useRef(null);
  useEffect(() => () => clearTimeout(timerSalin.current), []);
  useEffect(() => { setMulai(keInputWaktu(tautan.mulai_at)); setSelesai(keInputWaktu(tautan.selesai_at)); }, [tautan.mulai_at, tautan.selesai_at]);

  const kini = useSekarang();
  // Status dihitung ulang di klien (cermin cek_tautan server) agar ikut berganti saat batas waktu terlewati.
  const st = statusTautan(tautan, kini, masaUjian);
  const tampil = { ...tautan, ...st };
  const keterangan = keteranganWaktu(tautan, kini, masaUjian);
  const peringatan = peringatanTautan(tautan, masaUjian, kini);
  const url = urlTautan(tautan);
  const galat = galatJendela({ mulai, selesai });
  const berubah = mulai !== keInputWaktu(tautan.mulai_at) || selesai !== keInputWaktu(tautan.selesai_at);
  const id = (s) => `tautan-${meta.jenis}-${s}`;

  // `pesanOk`: teks notifikasi, atau fungsi (tautanBaru) => void untuk notifikasi khusus.
  const simpan = async (isi, jenisSibuk, pesanOk) => {
    setSibuk(jenisSibuk);
    try {
      const r = await simpanTautanPublik(ujianId, meta.jenis, isi);
      onTersimpan(r.tautan, r.tiruan);
      if (typeof pesanOk === 'function') pesanOk(r.tautan); else toast.success(pesanOk);
      (r.peringatan || []).forEach((p) => toast.warning(p.pesan));
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menyimpan pengaturan tautan.'));
    } finally {
      setSibuk(null);
    }
  };
  // Menutup harus cepat (mis. ada akses mencurigakan): tanpa dialog, tetapi notifikasinya dapat diurungkan.
  // Hanya field yang diubah yang dikirim (server parsial): menyimpan jendela tidak membuka/menutup tautan, dan sebaliknya.
  const ubahAktif = (aktif) => simpan({ aktif }, 'aktif', (baru) => {
    if (!aktif) {
      toast.success(`Tautan ${meta.judul} ditutup. Pengunjung kini melihat "tautan sedang ditutup".`, {
        action: { label: 'Urungkan', onClick: () => simpan({ aktif: true }, 'aktif', `Tautan ${meta.judul} dibuka kembali.`) },
      });
    } else if (baru?.alasan && baru.alasan !== 'ok') {
      toast.warning(`Tautan ${meta.judul} dibuka, tetapi belum dapat diakses: ${baru.pesan || 'periksa jendela waktu'}`);
    } else {
      toast.success(`Tautan ${meta.judul} dibuka.`);
    }
  });
  const simpanJendela = () => simpan({ mulai_at: dariInputWaktu(mulai), selesai_at: dariInputWaktu(selesai) }, 'jendela', 'Jendela waktu disimpan.');

  const gantiToken = async () => {
    setSibuk('token');
    try {
      const r = await gantiTokenTautan(ujianId, meta.jenis);
      onTersimpan(r.tautan, r.tiruan);
      toast.success('Token diganti. Bagikan tautan yang baru.');
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal mengganti token.'));
    } finally {
      setSibuk(null);
      setKonfirmasi(false);
    }
  };

  const salin = async () => {
    if (await salinTeks(url)) {
      setTersalin(true);
      clearTimeout(timerSalin.current);
      timerSalin.current = setTimeout(() => setTersalin(false), 2000);
      toast.success('Tautan disalin');
    } else {
      toast.error('Browser menolak menyalin otomatis. Tekan lama/blok tautan di kotak lalu salin manual.');
    }
  };
  const bisaBagikan = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const bagikan = async () => {
    try {
      await navigator.share({ title: `${meta.judul}${namaUjian ? ` · ${namaUjian}` : ''}`, text: pesanBagikan(meta, url, namaUjian), url });
    } catch (e) {
      if (e?.name !== 'AbortError') toast.error('Gagal membagikan tautan.');
    }
  };

  return (
    <Card data-testid={id('kartu')}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base"><Ikon className="h-4 w-4 text-[#006837]" /> {meta.judul}</CardTitle>
            <p className="mt-1 text-xs text-slate-500"><span className="font-medium text-slate-700">Untuk {meta.untuk}.</span> {meta.keterangan}</p>
          </div>
          <LencanaStatusTautan tautan={tampil} testId={id('status')} />
        </div>
        <p className="text-xs text-slate-500" data-testid={id('pesan')}>
          {tampil.pesan}{keterangan && <span className="font-medium text-slate-700" data-testid={id('keterangan')}> · {keterangan}</span>}
        </p>
        {peringatan.length > 0 && (
          <ul className="space-y-1" data-testid={id('peringatan')}>
            {peringatan.map((p) => (
              <li key={p.kode} className="flex items-start gap-1.5 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800" data-kode={p.kode}>
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {p.pesan}
              </li>
            ))}
          </ul>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
          <code className="min-w-0 flex-1 select-all truncate text-xs text-slate-700" title={url} data-testid={id('url')}>{url}</code>
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1" onClick={salin} data-testid={id('salin')}
            aria-label={`Salin tautan ${meta.judul}`}>
            {tersalin ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span aria-live="polite">{tersalin ? 'Tersalin' : 'Salin'}</span>
          </Button>
          {bisaBagikan && (
            <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1" onClick={bagikan} data-testid={id('bagikan')}
              aria-label={`Bagikan tautan ${meta.judul}`}>
              <Share2 className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Bagikan</span>
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer" data-testid={id('buka')}><ExternalLink className="h-3.5 w-3.5" /> Buka</a>
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor={id('aktif')} className="text-sm font-medium text-slate-800">Buka untuk publik</Label>
            <p className="text-xs text-slate-500">Menutup tidak menghapus tautan; buka lagi kapan saja.</p>
          </div>
          <div className="flex items-center gap-2">
            {sibuk === 'aktif' ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              : <span className={`text-xs font-medium ${tautan.aktif ? 'text-emerald-700' : 'text-slate-500'}`} data-testid={id('aktif-label')}>{tautan.aktif ? 'Terbuka' : 'Tertutup'}</span>}
            <Switch id={id('aktif')} checked={!!tautan.aktif} onCheckedChange={ubahAktif} disabled={!bolehUbah || !!sibuk} data-testid={id('aktif')} />
          </div>
        </div>

        <fieldset className="space-y-2" disabled={!bolehUbah || !!sibuk}>
          <legend className="text-sm font-medium text-slate-800">Jendela waktu akses <span className="font-normal text-slate-500">(WIB, kosong = tanpa batas)</span></legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="text-xs text-slate-600">Mulai
              <input type="datetime-local" value={mulai} onChange={(e) => setMulai(e.target.value)} data-testid={id('mulai')}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 disabled:bg-slate-50" />
            </label>
            <label className="text-xs text-slate-600">Selesai
              <input type="datetime-local" value={selesai} onChange={(e) => setSelesai(e.target.value)} data-testid={id('selesai')}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 disabled:bg-slate-50" />
            </label>
          </div>
          {bolehUbah && (
            <div className="flex flex-wrap gap-1.5" data-testid={id('preset')}>
              {presetJendela(masaUjian).map((p) => (
                <button key={p.kode} type="button" onClick={() => { setMulai(p.mulai); setSelesai(p.selesai); }} data-testid={id(`preset-${p.kode}`)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${mulai === p.mulai && selesai === p.selesai ? 'border-[#006837] bg-emerald-50 text-[#006837]' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
          {galat ? <p className="text-xs text-rose-600" role="alert" data-testid={id('galat')}>{galat}</p>
            : <p className="text-xs text-slate-600" data-testid={id('ringkas')}>{ringkasJendela({ mulai, selesai })}</p>}
          {!galat && selesaiSudahLewat(selesai) && (
            <p className="text-xs text-amber-700" data-testid={id('lewat')}>Waktu selesai sudah lewat — pengunjung akan melihat "masa akses sudah berakhir".</p>
          )}
          {bolehUbah && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={simpanJendela} disabled={!berubah || !!galat || !!sibuk} className="gap-1.5 bg-[#006837] hover:bg-[#005830]" data-testid={id('simpan')}>
                {sibuk === 'jendela' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Simpan jendela waktu
              </Button>
              {berubah && (
                <Button type="button" size="sm" variant="ghost" onClick={() => { setMulai(keInputWaktu(tautan.mulai_at)); setSelesai(keInputWaktu(tautan.selesai_at)); }}
                  data-testid={id('batal')}>Batalkan perubahan</Button>
              )}
            </div>
          )}
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-400">{tautan.diperbarui_pada ? `Diperbarui ${formatWIBPanjang(tautan.diperbarui_pada)}` : ''}</p>
          {bolehUbah && (
            <Button type="button" variant="outline" size="sm" onClick={() => setKonfirmasi(true)} disabled={!!sibuk} className="gap-1.5 text-rose-700 hover:text-rose-800" data-testid={id('ganti-token')}>
              {sibuk === 'token' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />} Ganti token
            </Button>
          )}
        </div>
      </CardContent>

      <AlertDialog open={konfirmasi} onOpenChange={(o) => { if (!sibuk) setKonfirmasi(o); }}>
        <AlertDialogContent data-testid={id('konfirmasi')}>
          <AlertDialogHeader>
            <AlertDialogTitle>Ganti token tautan {meta.judul}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tautan lama langsung tidak berlaku — siapa pun yang memegangnya akan melihat "tautan tidak ditemukan". Bagikan ulang
              tautan yang baru. Status buka/tutup dan jendela waktu tidak berubah.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!sibuk}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); gantiToken(); }} disabled={!!sibuk} className="gap-2 bg-rose-600 hover:bg-rose-700" data-testid={id('konfirmasi-ganti')}>
              {sibuk === 'token' ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Ya, ganti token
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
