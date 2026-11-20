import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus } from 'lucide-react';
import { JENIS_UJIAN, buatUjian, pesanGalat } from '@/lib/ujian';

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
export const NAMA_UJIAN_MAKS = 120;

// Aturan sama dengan UjianIn di backend/ujian.py.
export const skemaUjian = z.object({
  jenis: z.enum(['UTS', 'UAS'], { errorMap: () => ({ message: 'Pilih jenis ujian' }) }),
  nama: z.string().trim().min(3, 'Nama ujian minimal 3 karakter').max(NAMA_UJIAN_MAKS, `Maksimal ${NAMA_UJIAN_MAKS} karakter`),
  mulai: z.string().regex(POLA_TANGGAL, 'Tanggal mulai wajib diisi'),
  selesai: z.string().regex(POLA_TANGGAL, 'Tanggal selesai wajib diisi'),
}).refine((v) => v.selesai >= v.mulai, { path: ['selesai'], message: 'Tanggal selesai tidak boleh sebelum tanggal mulai' });

const kosong = { jenis: 'UAS', nama: '', mulai: '', selesai: '' };

function Field({ id, label, error, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={error ? 'text-red-600' : undefined}>{label}<span className="text-red-500" aria-hidden="true"> *</span></Label>
      {children}
      {error && <p id={`${id}-galat`} className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

const tanda = (id, error) => (error ? { 'aria-invalid': true, 'aria-describedby': `${id}-galat`, className: 'border-red-500' } : {});

/**
 * Dialog tambah ujian (UTS/UAS) pada semester aktif. `onTersimpan(ujian, tiruan)` dipanggil setelah berhasil.
 * Nama mengikuti istilah madrasah, mis. "ASAS Ganjil 2026/2027".
 */
export default function FormUjianDialog({ buka, onTutup, onTersimpan, konteks }) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(skemaUjian), defaultValues: kosong, mode: 'onTouched', shouldFocusError: true,
  });
  const jenis = watch('jenis');

  useEffect(() => { if (buka) reset(kosong); }, [buka, reset]);

  const usulNama = (j) => {
    if (!konteks?.tahun_pelajaran) return;
    const singkat = j === 'UTS' ? 'ASTS' : 'ASAS';
    setValue('nama', `${singkat} ${konteks.semester_nama || ''} ${konteks.tahun_pelajaran}`.replace(/\s+/g, ' '), { shouldValidate: true });
  };

  const simpan = async (nilai) => {
    try {
      const h = await buatUjian({ ...nilai, nama: nilai.nama.trim() });
      toast.success(`Ujian "${h.ujian.nama}" dibuat${h.tiruan ? ' (contoh, belum tersimpan di server)' : ''}`);
      onTersimpan?.(h.ujian, h.tiruan);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal membuat ujian. Periksa isian lalu coba lagi.'));
    }
  };

  return (
    <Dialog open={buka} onOpenChange={(o) => { if (!o && !isSubmitting) onTutup?.(); }}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-tambah-ujian">
        <DialogHeader>
          <DialogTitle>Tambah Ujian</DialogTitle>
          <DialogDescription>
            {konteks?.tahun_pelajaran
              ? `Ujian dibuat untuk Semester ${konteks.semester_nama} TP ${konteks.tahun_pelajaran}.`
              : 'Ujian dibuat untuk semester aktif.'}
          </DialogDescription>
        </DialogHeader>
        <form id="form-tambah-ujian" onSubmit={handleSubmit(simpan)} className="space-y-4" noValidate>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Jenis ujian<span className="text-red-500" aria-hidden="true"> *</span></legend>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(JENIS_UJIAN).map(([k, j]) => (
                <label key={k} className={`flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-colors ${jenis === k ? 'border-[#006837] bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <span className="flex items-center gap-2 font-semibold">
                    <input type="radio" value={k} {...register('jenis', { onChange: (e) => usulNama(e.target.value) })} className="accent-[#006837]" data-testid={`radio-jenis-${k}`} />
                    {j.label}
                  </span>
                  <span className="text-xs text-slate-500">{j.nama}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field id="ujian-nama" label="Nama ujian" error={errors.nama?.message}>
            <Input id="ujian-nama" maxLength={NAMA_UJIAN_MAKS} placeholder="Mis. ASAS Ganjil 2026/2027" {...register('nama')} {...tanda('ujian-nama', errors.nama)} data-testid="input-ujian-nama" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="ujian-mulai" label="Tanggal mulai" error={errors.mulai?.message}>
              <Input id="ujian-mulai" type="date" {...register('mulai')} {...tanda('ujian-mulai', errors.mulai)} data-testid="input-ujian-mulai" />
            </Field>
            <Field id="ujian-selesai" label="Tanggal selesai" error={errors.selesai?.message}>
              <Input id="ujian-selesai" type="date" {...register('selesai')} {...tanda('ujian-selesai', errors.selesai)} data-testid="input-ujian-selesai" />
            </Field>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup} disabled={isSubmitting}>Batal</Button>
          <Button type="submit" form="form-tambah-ujian" disabled={isSubmitting} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-ujian">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Simpan Ujian
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
