import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CalendarClock, Link2, Loader2, RotateCcw, Save } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatWIB } from '@/lib/datetime';
import { labelJenjang } from '@/lib/mapelUjian';
import { pesanGalat } from '@/lib/ujian';
import { keInputWaktu } from '@/lib/ujianTautanPublik';
import {
  URL_SOAL_MAKS, galatIsianLink, isianDariLink, isianLinkSama, peringatanJendela, simpanLinkSoal,
} from '@/lib/ujianLinkSoal';

const teksJadwal = (j) => (j
  ? `${formatWIB(j.tanggal || j.mulai_at, 'Date', { weekday: 'long', day: 'numeric', month: 'long' })} · Sesi ${j.sesi_ke} · ${formatWIB(j.mulai_at, 'Time', { hour: '2-digit', minute: '2-digit' })}–${formatWIB(j.selesai_at, 'Time', { hour: '2-digit', minute: '2-digit' })} WIB`
  : null);

function GalatField({ pesan, id }) {
  return pesan ? <p id={id} className="text-xs text-rose-600" role="alert">{pesan}</p> : null;
}

/**
 * Form satu link soal (jenjang × mapel): tautan soal eksternal, waktu mulai & tutup tombol "Mengerjakan" (awalnya dari
 * sesi jadwal ujian), dan sakelar aktif. Disimpan dengan cek versi; 409 = admin lain baru mengubah baris ini.
 * `sasaran` = { jenjang, kode, nama, link } atau null; `onTersimpan(link, tiruan)` setelah berhasil; `onBentrok()` untuk
 * memuat ulang data saat terjadi bentrok versi.
 */
export default function DialogLinkSoal({ ujianId, sasaran, onTutup, onTersimpan, onBentrok }) {
  const link = sasaran?.link || null;
  const awal = useMemo(() => isianDariLink(link), [link]);
  const [isian, setIsian] = useState(awal);
  const [proses, setProses] = useState(false);
  const [galatSimpan, setGalatSimpan] = useState(null); // { pesan, bentrok }
  const [disentuh, setDisentuh] = useState(false);
  useEffect(() => { setIsian(awal); setGalatSimpan(null); setDisentuh(false); }, [awal, sasaran]);

  const galat = galatIsianLink(isian);
  const adaGalat = Object.keys(galat).length > 0;
  const peringatan = peringatanJendela(isian, link?.jadwal);
  const berubah = !isianLinkSama(isian, awal) || !link?.id;
  const jadwal = link?.jadwal || null;
  const ikutJadwalSekarang = !!jadwal && isian.mulai === keInputWaktu(jadwal.mulai_at) && isian.selesai === keInputWaktu(jadwal.selesai_at);

  const ubah = (field) => (e) => { setIsian((s) => ({ ...s, [field]: e.target.value })); setGalatSimpan(null); };
  const pakaiJadwal = () => {
    if (!jadwal) return;
    setIsian((s) => ({ ...s, mulai: keInputWaktu(jadwal.mulai_at), selesai: keInputWaktu(jadwal.selesai_at) }));
    setGalatSimpan(null);
  };

  const simpan = async () => {
    setDisentuh(true);
    if (adaGalat || proses) return;
    setProses(true);
    try {
      const r = await simpanLinkSoal(ujianId, sasaran.jenjang, sasaran.kode, isian, link?.versi);
      toast.success(`Link soal ${sasaran.nama} ${labelJenjang(sasaran.jenjang)} disimpan${r.tiruan ? ' (contoh)' : ''}`, {
        description: r.link?.siap ? 'Tombol Mengerjakan tampil di portal sesuai jendela waktunya.' : 'Mapel ditandai belum siap di portal sampai tautan diisi dan diaktifkan.',
      });
      onTersimpan?.(r.link, r.tiruan);
    } catch (e) {
      setGalatSimpan({ pesan: pesanGalat(e, 'Gagal menyimpan link soal.'), bentrok: e?.response?.status === 409 });
    } finally {
      setProses(false);
    }
  };

  const tampilGalat = (f) => (disentuh || (f === 'url' && isian.url) || (f !== 'url' && isian[f]) ? galat[f] : null);

  return (
    <Dialog open={!!sasaran} onOpenChange={(o) => { if (!o && !proses) onTutup?.(); }}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-link-soal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5 text-[#006837]" /> {sasaran?.nama} · {sasaran && labelJenjang(sasaran.jenjang)}</DialogTitle>
          <DialogDescription>
            Tautan soal hanya keluar dari portal saat jendela pengerjaan berlangsung — siswa tidak dapat melihatnya lebih awal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="link-url">Tautan soal</Label>
            <Input id="link-url" type="url" inputMode="url" value={isian.url} onChange={ubah('url')} maxLength={URL_SOAL_MAKS}
              placeholder="https://…" autoComplete="off" spellCheck={false} aria-invalid={!!tampilGalat('url')}
              aria-describedby={tampilGalat('url') ? 'galat-link-url' : 'bantuan-link-url'} data-testid="isian-link-url" />
            {tampilGalat('url')
              ? <GalatField pesan={tampilGalat('url')} id="galat-link-url" />
              : <p id="bantuan-link-url" className="text-xs text-slate-500">Hanya http:// atau https://. Kosongkan bila soal belum siap — mapel ditandai belum siap di portal.</p>}
          </div>

          <div className="space-y-2 rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><CalendarClock className="h-4 w-4 text-[#006837]" /> Jendela pengerjaan</p>
              {jadwal && !ikutJadwalSekarang && (
                <Button type="button" variant="ghost" size="sm" onClick={pakaiJadwal} className="h-7 gap-1.5 px-2 text-xs text-[#006837]" data-testid="pakai-jadwal">
                  <RotateCcw className="h-3.5 w-3.5" /> Pakai jadwal
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500" data-testid="link-jadwal">
              {jadwal ? <>Jadwal ujian: <span className="text-slate-700">{teksJadwal(jadwal)}</span></> : 'Mapel ini belum ada di jadwal ujian — isi jendelanya secara manual.'}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="link-mulai" className="text-xs">Dibuka (WIB)</Label>
                <Input id="link-mulai" type="datetime-local" value={isian.mulai} onChange={ubah('mulai')} aria-invalid={!!tampilGalat('mulai')} data-testid="isian-link-mulai" />
                <GalatField pesan={tampilGalat('mulai')} id="galat-link-mulai" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="link-selesai" className="text-xs">Ditutup (WIB)</Label>
                <Input id="link-selesai" type="datetime-local" value={isian.selesai} onChange={ubah('selesai')} aria-invalid={!!tampilGalat('selesai')} data-testid="isian-link-selesai" />
                <GalatField pesan={tampilGalat('selesai')} id="galat-link-selesai" />
              </div>
            </div>
            {peringatan && !adaGalat && (
              <p className="flex items-start gap-1.5 text-xs text-amber-700" data-testid="peringatan-jendela">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {peringatan}
              </p>
            )}
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Label htmlFor="link-aktif">Tombol aktif</Label>
              <p className="text-xs text-slate-500">Matikan untuk menahan tombol Mengerjakan meski jendela waktunya berlangsung.</p>
            </div>
            <Switch id="link-aktif" checked={isian.aktif} onCheckedChange={(v) => { setIsian((s) => ({ ...s, aktif: v })); setGalatSimpan(null); }} data-testid="isian-link-aktif" />
          </div>

          {galatSimpan && (
            <p className="flex flex-wrap items-center gap-x-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700" role="alert" data-testid="galat-simpan-link">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {galatSimpan.pesan}
              {galatSimpan.bentrok && <button type="button" className="font-semibold underline" onClick={onBentrok}>Muat ulang</button>}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onTutup} disabled={proses}>Batal</Button>
          <Button onClick={simpan} disabled={proses || !berubah || (disentuh && adaGalat)} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="simpan-link-soal">
            {proses ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
