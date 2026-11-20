import React, { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';
import { pesanGalat } from '@/lib/ujian';
import {
  JENJANG, KAPASITAS_BAWAAN, KAPASITAS_MAKS, KETERANGAN_RUANG_MAKS, NAMA_RUANG_MAKS, tambahRuang, ubahRuang,
} from '@/lib/ujianRuang';

// Aturan sama dengan RuangIn di backend/ujian_ruang.py.
const skema = z.object({
  nama_ruang: z.string().trim().min(1, 'Nama/nomor ruang wajib diisi').max(NAMA_RUANG_MAKS, `Maksimal ${NAMA_RUANG_MAKS} karakter`),
  jenjang: z.array(z.number()).min(1, 'Pilih minimal satu jenjang').max(2, 'Satu ruang paling banyak dua jenjang'),
  kapasitas: z.coerce.number({ invalid_type_error: 'Kapasitas wajib angka' }).int('Kapasitas harus bilangan bulat')
    .min(1, 'Kapasitas minimal 1').max(KAPASITAS_MAKS, `Kapasitas maksimal ${KAPASITAS_MAKS}`),
  keterangan: z.string().trim().max(KETERANGAN_RUANG_MAKS, `Maksimal ${KETERANGAN_RUANG_MAKS} karakter`),
});

const awal = (r) => ({
  nama_ruang: r?.nama_ruang || '',
  jenjang: r?.jenjang || [],
  kapasitas: r?.kapasitas ?? KAPASITAS_BAWAAN,
  keterangan: r?.keterangan || '',
});

/**
 * Dialog tambah/ubah ruang ujian. Satu ruang boleh memuat dua jenjang berbeda sekaligus (mis. kelas 7 & 8).
 * `sasaran` = { ruang | null } (null ruang = tambah) atau null (tertutup). `onTersimpan(ruang, tiruan)`.
 */
export default function FormRuangDialog({ ujianId, sasaran, onTutup, onTersimpan }) {
  const ruang = sasaran?.ruang || null;
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(skema), defaultValues: awal(null), mode: 'onTouched',
  });

  useEffect(() => { if (sasaran) reset(awal(sasaran.ruang)); }, [sasaran, reset]);

  const simpan = async (nilai) => {
    const isi = { ...nilai, jenjang: [...nilai.jenjang].sort((a, b) => a - b), nama_ruang: nilai.nama_ruang.trim(), keterangan: nilai.keterangan.trim() };
    try {
      const h = ruang ? await ubahRuang(ujianId, ruang.id, isi) : await tambahRuang(ujianId, isi);
      toast.success(`Ruang ${isi.nama_ruang} ${ruang ? 'diperbarui' : 'ditambahkan'}${h.tiruan ? ' (contoh, belum tersimpan di server)' : ''}`);
      onTersimpan?.(h.ruang, h.tiruan);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menyimpan ruang. Periksa isian lalu coba lagi.'));
    }
  };

  return (
    <Dialog open={!!sasaran} onOpenChange={(o) => { if (!o && !isSubmitting) onTutup?.(); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-form-ruang">
        <DialogHeader>
          <DialogTitle>{ruang ? `Ubah Ruang ${ruang.nama_ruang}` : 'Tambah Ruang Ujian'}</DialogTitle>
          <DialogDescription>Satu ruang boleh dipakai dua jenjang sekaligus, mis. sebagian kelas 7 dan sebagian kelas 8.</DialogDescription>
        </DialogHeader>
        <form id="form-ruang" onSubmit={handleSubmit(simpan)} className="space-y-4" noValidate>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="ruang-nama" className={errors.nama_ruang ? 'text-red-600' : undefined}>Nama/nomor ruang<span className="text-red-500" aria-hidden="true"> *</span></Label>
              <Input id="ruang-nama" maxLength={NAMA_RUANG_MAKS} placeholder="Mis. 01" {...register('nama_ruang')} aria-invalid={!!errors.nama_ruang} data-testid="input-ruang-nama" />
              {errors.nama_ruang && <p className="text-xs text-red-600" role="alert">{errors.nama_ruang.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ruang-kapasitas" className={errors.kapasitas ? 'text-red-600' : undefined}>Kapasitas<span className="text-red-500" aria-hidden="true"> *</span></Label>
              <Input id="ruang-kapasitas" type="number" inputMode="numeric" min={1} max={KAPASITAS_MAKS} {...register('kapasitas')} aria-invalid={!!errors.kapasitas} data-testid="input-ruang-kapasitas" />
              {errors.kapasitas && <p className="text-xs text-red-600" role="alert">{errors.kapasitas.message}</p>}
            </div>
          </div>
          <Controller
            control={control}
            name="jenjang"
            render={({ field }) => (
              <fieldset className="space-y-1.5">
                <legend className={`text-sm font-medium ${errors.jenjang ? 'text-red-600' : ''}`}>Jenjang dalam ruang<span className="text-red-500" aria-hidden="true"> *</span></legend>
                <div className="flex flex-wrap gap-2">
                  {JENJANG.map((j) => {
                    const aktif = field.value.includes(j);
                    const penuh = !aktif && field.value.length >= 2;
                    return (
                      <label key={j} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${aktif ? 'border-[#006837] bg-emerald-50' : 'border-slate-200'} ${penuh ? 'cursor-not-allowed opacity-50' : ''}`}>
                        <input type="checkbox" className="accent-[#006837]" checked={aktif} disabled={penuh}
                          onChange={() => field.onChange(aktif ? field.value.filter((x) => x !== j) : [...field.value, j])} data-testid={`cek-jenjang-${j}`} />
                        Kelas {j}
                      </label>
                    );
                  })}
                </div>
                {errors.jenjang ? <p className="text-xs text-red-600" role="alert">{errors.jenjang.message}</p>
                  : <p className="text-xs text-slate-500">Pilih satu atau dua jenjang.</p>}
              </fieldset>
            )}
          />
          <div className="space-y-1.5">
            <Label htmlFor="ruang-keterangan">Keterangan</Label>
            <Input id="ruang-keterangan" maxLength={KETERANGAN_RUANG_MAKS} placeholder="Mis. Gedung A lantai 1" {...register('keterangan')} data-testid="input-ruang-keterangan" />
            {errors.keterangan && <p className="text-xs text-red-600" role="alert">{errors.keterangan.message}</p>}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup} disabled={isSubmitting}>Batal</Button>
          <Button type="submit" form="form-ruang" disabled={isSubmitting} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-ruang">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Ruang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
