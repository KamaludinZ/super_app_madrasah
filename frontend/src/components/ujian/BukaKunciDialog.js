import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { History, Loader2, LockOpen } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { pesanGalat } from '@/lib/ujian';
import { ALASAN_BUKA_MAKS, ALASAN_BUKA_MIN, bukaKunci } from '@/lib/ujianKehadiran';

/**
 * Panel admin buka kunci kiriman daftar hadir satu peserta pada satu sesi. Alasan wajib dan tersimpan; kiriman lama
 * (beserta tanda tangannya) diarsipkan, lalu peserta dapat mengisi ulang lewat tautan publik. Riwayat buka kunci
 * sebelumnya ditampilkan. `sasaran` = { item, sesiId } atau null.
 */
export default function BukaKunciDialog({ ujianId, sasaran, onTutup, onTersimpan }) {
  const [alasan, setAlasan] = useState('');
  const [proses, setProses] = useState(false);
  const item = sasaran?.item;
  useEffect(() => { setAlasan(''); }, [sasaran]);

  const panjang = alasan.trim().length;
  const galat = panjang > 0 && panjang < ALASAN_BUKA_MIN ? `Alasan minimal ${ALASAN_BUKA_MIN} karakter` : '';

  const simpan = async () => {
    setProses(true);
    try {
      const h = await bukaKunci(ujianId, item, sasaran.sesiId, alasan.trim());
      toast.success(`Kunci ${item.nama} dibuka — peserta dapat mengisi ulang${h.tiruan ? ' (contoh)' : ''}`);
      onTersimpan?.();
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal membuka kunci.'));
    } finally {
      setProses(false);
    }
  };

  return (
    <Dialog open={!!sasaran} onOpenChange={(o) => { if (!o && !proses) onTutup?.(); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-buka-kunci">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LockOpen className="h-5 w-5 text-[#006837]" /> Buka Kunci Daftar Hadir</DialogTitle>
          <DialogDescription>
            {item?.nama} ({item?.kelas}) sudah mengirim daftar hadir pada sesi ini. Membuka kunci mengarsipkan kiriman itu
            sehingga peserta dapat mengirim ulang. Alasan tersimpan di jejak audit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="alasan-buka" className={galat ? 'text-red-600' : undefined}>Alasan<span className="text-red-500" aria-hidden="true"> *</span></Label>
          <Textarea id="alasan-buka" rows={3} maxLength={ALASAN_BUKA_MAKS} value={alasan} onChange={(e) => setAlasan(e.target.value)}
            placeholder="Mis. Peserta salah memilih nama teman sekelas" aria-invalid={!!galat} data-testid="input-alasan-buka" />
          <p className={`text-xs ${galat ? 'text-red-600' : 'text-slate-500'}`}>{galat || `${panjang}/${ALASAN_BUKA_MAKS} karakter`}</p>
        </div>
        {item?.riwayat_buka?.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"><History className="h-3.5 w-3.5" /> Riwayat buka kunci</p>
            <ul className="space-y-1 text-xs text-slate-600">
              {item.riwayat_buka.map((r) => <li key={`${r.pada}-${r.alasan}`}>{formatWIBPanjang(r.pada)} · {r.oleh_nama}: <em>{r.alasan}</em></li>)}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onTutup} disabled={proses}>Batal</Button>
          <Button onClick={simpan} disabled={proses || panjang < ALASAN_BUKA_MIN} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-buka-kunci">
            {proses ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />} Buka Kunci
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
