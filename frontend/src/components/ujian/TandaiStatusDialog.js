import React, { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Eraser, Loader2, Save } from 'lucide-react';
import { formatWIB } from '@/lib/datetime';
import { pesanGalat } from '@/lib/ujian';
import { CATATAN_MAKS, CATATAN_MIN, STATUS_HADIR, STATUS_TANDA, tandaiStatus } from '@/lib/ujianKehadiran';

// Aturan sama dengan StatusIn di backend/ujian_kehadiran.py.
const skema = z.object({
  status: z.enum(['izin', 'sakit', 'alpa'], { errorMap: () => ({ message: 'Pilih status' }) }),
  catatan: z.string().trim().max(CATATAN_MAKS, `Maksimal ${CATATAN_MAKS} karakter`),
}).superRefine((v, ctx) => {
  if (v.status !== 'alpa' && v.catatan.length < CATATAN_MIN) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['catatan'], message: `Catatan wajib untuk ${STATUS_HADIR[v.status].label.toLowerCase()} (minimal ${CATATAN_MIN} karakter)` });
  }
});

/**
 * Form admin menandai peserta izin, sakit, atau tanpa keterangan beserta catatannya. CUKUP SEKALI PER HARI: tanda
 * berlaku untuk semua sesi pada tanggal itu yang belum diisi hadir oleh peserta. `sasaran` = { item, tanggal } atau null.
 */
export default function TandaiStatusDialog({ ujianId, sasaran, onTutup, onTersimpan }) {
  const item = sasaran?.item;
  const { control, register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(skema), defaultValues: { status: 'izin', catatan: '' }, mode: 'onTouched',
  });
  const status = watch('status');

  useEffect(() => {
    if (sasaran) reset({ status: STATUS_TANDA.includes(item?.status) ? item.status : 'izin', catatan: item?.catatan || '' });
  }, [sasaran, item, reset]);

  const simpan = async (nilai, hapus = false) => {
    try {
      const h = await tandaiStatus(ujianId, { peserta_id: item.peserta_id, tanggal: sasaran.tanggal,
        status: hapus ? null : nilai.status, catatan: hapus ? '' : nilai.catatan.trim() });
      toast.success(hapus ? `Tanda ${item.nama} dihapus` : `${item.nama} ditandai ${STATUS_HADIR[nilai.status].label.toLowerCase()} untuk ${h.sesi_diterapkan} sesi hari itu${h.tiruan ? ' (contoh)' : ''}`);
      onTersimpan?.();
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menyimpan status.'));
    }
  };

  return (
    <Dialog open={!!sasaran} onOpenChange={(o) => { if (!o && !isSubmitting) onTutup?.(); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-tandai-status">
        <DialogHeader>
          <DialogTitle>Tandai Tidak Hadir</DialogTitle>
          <DialogDescription>
            {item?.nama} ({item?.kelas}) · {sasaran ? formatWIB(sasaran.tanggal, 'Date', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}.
            {' '}Cukup sekali per hari — berlaku untuk semua sesi hari itu.
          </DialogDescription>
        </DialogHeader>
        <form id="form-tandai-status" onSubmit={handleSubmit((v) => simpan(v))} className="space-y-4" noValidate>
          <Controller control={control} name="status" render={({ field }) => (
            <fieldset className="space-y-1.5">
              <legend className="text-sm font-medium">Status</legend>
              <div className="grid grid-cols-3 gap-2">
                {STATUS_TANDA.map((s) => (
                  <label key={s} className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-2 py-2 text-sm ${field.value === s ? 'border-[#006837] bg-emerald-50 font-semibold' : 'border-slate-200'}`}>
                    <input type="radio" className="sr-only" value={s} checked={field.value === s} onChange={() => field.onChange(s)} data-testid={`radio-status-${s}`} />
                    {STATUS_HADIR[s].label}
                  </label>
                ))}
              </div>
            </fieldset>
          )} />
          <div className="space-y-1.5">
            <Label htmlFor="catatan-status" className={errors.catatan ? 'text-red-600' : undefined}>
              Catatan{status !== 'alpa' && <span className="text-red-500" aria-hidden="true"> *</span>}
            </Label>
            <Textarea id="catatan-status" rows={3} maxLength={CATATAN_MAKS} placeholder={status === 'sakit' ? 'Mis. Demam, surat keterangan dari orang tua' : 'Mis. Mengikuti lomba tingkat kota'}
              {...register('catatan')} aria-invalid={!!errors.catatan} data-testid="input-catatan-status" />
            {errors.catatan && <p className="text-xs text-red-600" role="alert">{errors.catatan.message}</p>}
          </div>
        </form>
        <DialogFooter className="gap-2 sm:justify-between">
          {STATUS_TANDA.includes(item?.status) ? (
            <Button variant="ghost" onClick={() => simpan(null, true)} disabled={isSubmitting} className="gap-1 text-rose-600 hover:bg-rose-50" data-testid="btn-hapus-tanda">
              <Eraser className="h-4 w-4" /> Hapus tanda
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onTutup} disabled={isSubmitting}>Batal</Button>
            <Button type="submit" form="form-tandai-status" disabled={isSubmitting} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-status">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
