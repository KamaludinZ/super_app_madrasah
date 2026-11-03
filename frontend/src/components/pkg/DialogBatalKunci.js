import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, LockOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BATAS_ALASAN_BATAL, batalKunciLembar } from '@/lib/pkgPenilaian';

const MIN_ALASAN = 5;

// Dialog "Batalkan kunci" lembar penilaian yang sudah dikirim & dikunci (POST /pkg/penilaian/batal-kunci).
// Lembar kembali menjadi draf (isian tetap) agar penilai dapat memperbaikinya lalu mengirim ulang; nilai resmi & baris
// rekap dihapus sampai dikunci lagi. Alasan wajib (tercatat di riwayat lembar & jejak audit).
// `guru` = { id, nama }; `onBerhasil(lembar)` dipanggil setelah kunci dibatalkan.
export default function DialogBatalKunci({ open, onOpenChange, guru, onBerhasil }) {
  const [alasan, setAlasan] = useState('');
  const [proses, setProses] = useState(false);
  const [galat, setGalat] = useState(null);

  useEffect(() => {
    if (open) {
      setAlasan('');
      setGalat(null);
    }
  }, [open]);

  const bersih = alasan.trim().replace(/\s+/g, ' ');
  const sah = bersih.length >= MIN_ALASAN;

  const kirim = async () => {
    if (!sah || proses || !guru?.id) return;
    setProses(true);
    setGalat(null);
    try {
      const lembar = await batalKunciLembar(guru.id, bersih);
      toast.success(`Kunci penilaian ${guru.nama || ''} dibatalkan. Lembar kembali menjadi draf.`);
      onOpenChange(false);
      onBerhasil?.(lembar);
    } catch (e) {
      setGalat(e.message || 'Gagal membatalkan kunci penilaian.');
    } finally {
      setProses(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !proses && onOpenChange(v)}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md" data-testid="pkg-dialog-batal-kunci">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LockOpen className="h-4 w-4 text-amber-600" /> Batalkan kunci penilaian</DialogTitle>
          <DialogDescription>
            {guru?.nama ? <><span className="font-medium text-slate-700">{guru.nama}</span>: </> : null}
            lembar akan kembali menjadi <b>draf</b> sehingga bisa diperbaiki. Isian centang & catatan tetap tersimpan, tetapi
            nilai akhir dan rekap guru ini dihapus sampai Anda mengirim & mengunci lagi.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="pkg-alasan-batal-kunci">Alasan pembatalan <span className="text-rose-600">*</span></Label>
          <Textarea
            id="pkg-alasan-batal-kunci"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value.slice(0, BATAS_ALASAN_BATAL))}
            placeholder="Contoh: ada indikator yang salah centang pada kompetensi pedagogik"
            rows={3}
            disabled={proses}
            data-testid="pkg-alasan-batal-kunci"
          />
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>{sah ? 'Alasan tercatat di riwayat lembar & jejak audit.' : `Minimal ${MIN_ALASAN} karakter.`}</span>
            <span className="tabular-nums">{alasan.length}/{BATAS_ALASAN_BATAL}</span>
          </div>
          {galat && <p className="text-sm text-rose-700" role="alert">{galat}</p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={proses}>Batal</Button>
          <Button type="button" onClick={kirim} disabled={!sah || proses} className="bg-amber-600 hover:bg-amber-700" data-testid="pkg-konfirmasi-batal-kunci">
            {proses ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <LockOpen className="h-4 w-4 mr-1" />} Batalkan kunci
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
