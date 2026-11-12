import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, XCircle } from 'lucide-react';
import { ALASAN_TOLAK_MAKS, ALASAN_TOLAK_MIN, labelPeran } from '@/lib/izinKamad';
import { formatWIBPanjang } from '@/lib/datetime';

const skema = z.object({
  alasan: z.string().trim()
    .min(1, 'Alasan penolakan wajib diisi')
    .min(ALASAN_TOLAK_MIN, `Alasan minimal ${ALASAN_TOLAK_MIN} karakter`)
    .max(ALASAN_TOLAK_MAKS, `Maksimal ${ALASAN_TOLAK_MAKS} karakter`),
});

/**
 * Dialog tolak izin: alasan wajib diisi (terlihat oleh pengaju). `izin` = null menutup dialog.
 * `onTolak(izin, alasan)` mengembalikan Promise; dialog tertutup bila berhasil.
 */
export default function TolakIzinDialog({ izin, onTutup, onTolak }) {
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(skema), defaultValues: { alasan: '' }, mode: 'onTouched', shouldFocusError: true,
  });
  const panjang = (watch('alasan') || '').length;

  useEffect(() => { if (izin) reset({ alasan: '' }); }, [izin, reset]);

  const kirim = async ({ alasan }) => {
    const berhasil = await onTolak(izin, alasan.trim());
    if (berhasil) onTutup();
  };

  return (
    <Dialog open={!!izin} onOpenChange={(buka) => { if (!buka && !isSubmitting) onTutup(); }}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-tolak-izin">
        {izin && (
          <>
            <DialogHeader>
              <DialogTitle>Tolak Izin</DialogTitle>
              <DialogDescription>Alasan penolakan wajib diisi dan akan terlihat oleh pengaju.</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <div className="font-semibold text-slate-900">
                {izin.pengaju_nama} <span className="text-xs font-normal text-slate-500">{labelPeran(izin.pengaju_peran)}</span>
              </div>
              <div className="text-xs text-slate-500">
                {formatWIBPanjang(izin.tanggal, false)} · <span className="font-mono tabular-nums">{izin.jam_mulai}–{izin.jam_selesai}</span>
              </div>
              <p className="text-slate-700 mt-1 break-words">{izin.keperluan}</p>
            </div>
            <form onSubmit={handleSubmit(kirim)} className="space-y-3" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="alasan-tolak" className={errors.alasan ? 'text-red-600' : undefined}>
                  Alasan penolakan<span className="text-red-500" aria-hidden="true"> *</span>
                </Label>
                <Textarea
                  id="alasan-tolak"
                  rows={3}
                  autoFocus
                  maxLength={ALASAN_TOLAK_MAKS}
                  placeholder="Mis. Bertepatan dengan rapat dinas; mohon ajukan di hari lain."
                  aria-invalid={!!errors.alasan}
                  aria-describedby="alasan-tolak-info"
                  className={errors.alasan ? 'border-red-500 focus-visible:ring-red-500' : undefined}
                  {...register('alasan')}
                  data-testid="input-alasan-tolak"
                />
                <p id="alasan-tolak-info" className={`text-xs ${errors.alasan ? 'text-red-600' : 'text-slate-500'}`} role={errors.alasan ? 'alert' : undefined}>
                  {errors.alasan?.message || `${panjang}/${ALASAN_TOLAK_MAKS} karakter`}
                </p>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={onTutup} disabled={isSubmitting}>Batal</Button>
                <Button type="submit" disabled={isSubmitting} className="gap-1.5 bg-rose-600 hover:bg-rose-700" data-testid="btn-kirim-tolak-izin">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Tolak Izin
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
