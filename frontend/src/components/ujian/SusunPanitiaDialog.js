import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Loader2, Save, AlertTriangle } from 'lucide-react';
import PilihGtk from '@/components/ujian/PilihGtk';
import {
  JABATAN_PANITIA, LABEL_JABATAN, galatSusunanPanitia, muatGtkPilihan, pesanGalat, simpanPanitia,
} from '@/lib/ujian';

const skema = z.object(Object.fromEntries(JABATAN_PANITIA.map((j) => [j, z.string()]))).superRefine((v, ctx) => {
  Object.entries(galatSusunanPanitia(v)).forEach(([path, message]) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message }));
});

const KETERANGAN = {
  penanggung_jawab: 'Biasanya kepala madrasah.',
  ketua: 'Memimpin pelaksanaan & membuka arsip.',
  sekretaris: 'Administrasi, cetak, dan arsip.',
  bendahara: 'Keuangan kepanitiaan.',
};

const dariPanitia = (panitia) => Object.fromEntries(JABATAN_PANITIA.map((j) => [j, panitia?.[j]?.user_id || '']));

/**
 * Dialog Susun Panitia satu ujian: memilih penanggung jawab, ketua, sekretaris, dan bendahara langsung dari daftar
 * akun GTK yang sudah ada. Satu orang hanya boleh memegang satu jabatan pada ujian yang sama. `sasaran` =
 * { ujian, panitia, diubah } atau null (tertutup); `diubah.pada` dikirim sebagai versi agar perubahan admin lain
 * tidak tertimpa. `onTersimpan(panitia, tiruan)`.
 */
export default function SusunPanitiaDialog({ sasaran, onTutup, onTersimpan }) {
  const [gtk, setGtk] = useState([]);
  const [memuatGtk, setMemuatGtk] = useState(false);
  const [galatGtk, setGalatGtk] = useState('');
  const { control, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(skema), defaultValues: dariPanitia(null), mode: 'onChange',
  });
  const nilai = watch();

  useEffect(() => {
    if (!sasaran) return undefined;
    reset(dariPanitia(sasaran.panitia));
    let hidup = true;
    setMemuatGtk(true);
    setGalatGtk('');
    muatGtkPilihan()
      .then((h) => { if (hidup) setGtk(h.items); })
      .catch((e) => { if (hidup) setGalatGtk(pesanGalat(e, 'Gagal memuat daftar GTK.')); })
      .finally(() => { if (hidup) setMemuatGtk(false); });
    return () => { hidup = false; };
  }, [sasaran, reset]);

  // GTK yang sudah dipakai jabatan lain (keterangan pada daftar pilihan).
  const dipakaiSelain = (jabatan) => Object.fromEntries(
    JABATAN_PANITIA.filter((j) => j !== jabatan && nilai[j]).map((j) => [nilai[j], LABEL_JABATAN[j]]),
  );

  const simpan = async (isian) => {
    try {
      const h = await simpanPanitia(sasaran.ujian.id, isian, sasaran.diubah?.pada || '');
      toast.success(`Susunan panitia ${sasaran.ujian.nama} disimpan${h.tiruan ? ' (contoh, belum tersimpan di server)' : ''}`);
      onTersimpan?.(h.panitia, h.tiruan);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menyimpan susunan panitia.'));
    }
  };

  return (
    <Dialog open={!!sasaran} onOpenChange={(o) => { if (!o && !isSubmitting) onTutup?.(); }}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-susun-panitia">
        <DialogHeader>
          <DialogTitle>Susun Panitia</DialogTitle>
          <DialogDescription>{sasaran?.ujian?.nama} — pilih pejabat dari akun GTK yang sudah ada.</DialogDescription>
        </DialogHeader>
        {galatGtk && (
          <p className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800" role="alert">
            <AlertTriangle className="h-4 w-4 shrink-0" /> {galatGtk}
          </p>
        )}
        <form id="form-susun-panitia" onSubmit={handleSubmit(simpan)} className="space-y-4" noValidate>
          {JABATAN_PANITIA.map((j) => (
            <div key={j} className="space-y-1.5">
              <Label htmlFor={`pejabat-${j}`} className={errors[j] ? 'text-red-600' : undefined}>{LABEL_JABATAN[j]}</Label>
              <Controller
                control={control}
                name={j}
                render={({ field }) => (
                  <PilihGtk id={`pejabat-${j}`} gtk={gtk} value={field.value} onPilih={field.onChange} dipakai={dipakaiSelain(j)}
                    disabled={memuatGtk || isSubmitting} invalid={!!errors[j]} testid={`pilih-${j}`} />
                )}
              />
              {errors[j]
                ? <p className="text-xs text-red-600" role="alert">{errors[j].message}</p>
                : <p className="text-xs text-slate-500">{KETERANGAN[j]}</p>}
            </div>
          ))}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup} disabled={isSubmitting}>Batal</Button>
          <Button type="submit" form="form-susun-panitia" disabled={isSubmitting || memuatGtk} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-panitia">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Susunan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
