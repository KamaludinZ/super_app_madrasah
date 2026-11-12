import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, FilePlus2 } from 'lucide-react';
import { DURASI_MIN_MENIT, KEPERLUAN_MAKS, ajukanIzin, pesanGalat, teksDurasi, validasiWaktuIzin } from '@/lib/izinKamad';
import { hariIniWIB } from '@/lib/tanggal';

const pesanWajib = (nama) => `${nama} wajib diisi`;
const POLA_JAM = /^([01]\d|2[0-3]):[0-5]\d$/;
const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

const skemaIzin = z.object({
  keperluan: z.string().trim().min(1, pesanWajib('Keperluan')).max(KEPERLUAN_MAKS, `Maksimal ${KEPERLUAN_MAKS} karakter`),
  tanggal: z.string().min(1, pesanWajib('Tanggal')).regex(POLA_TANGGAL, 'Tanggal tidak valid'),
  jam_mulai: z.string().min(1, pesanWajib('Jam mulai')).regex(POLA_JAM, 'Jam tidak valid (JJ:MM)'),
  jam_selesai: z.string().min(1, pesanWajib('Jam selesai')).regex(POLA_JAM, 'Jam tidak valid (JJ:MM)'),
}).superRefine((v, ctx) => {
  // Tanggal hari ini/ke depan & rentang jam masuk akal (aturan sama dengan server).
  Object.entries(validasiWaktuIzin(v)).forEach(([path, message]) => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  });
});

const kosong = () => ({ keperluan: '', tanggal: hariIniWIB(), jam_mulai: '', jam_selesai: '' });

function Field({ id, label, wajib, error, children, petunjuk }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={error ? 'text-red-600' : undefined}>
        {label}{wajib && <span className="text-red-500" aria-hidden="true"> *</span>}
      </Label>
      {children}
      {error ? <p id={`${id}-galat`} className="text-xs text-red-600" role="alert">{error}</p> : petunjuk && <p className="text-xs text-slate-500">{petunjuk}</p>}
    </div>
  );
}

const tandaGalat = (id, error) => (error
  ? { 'aria-invalid': true, 'aria-describedby': `${id}-galat`, className: 'border-red-500 focus-visible:ring-red-500' }
  : {});

/**
 * Formulir pengajuan izin: keperluan, satu tanggal, jam mulai, jam selesai (semua wajib, ditandai *).
 * Tersimpan berstatus "menunggu" lalu diteruskan ke kepala madrasah. `onTerkirim(izin, tiruan)`.
 */
export default function FormPengajuanIzin({ onTerkirim, pengaju }) {
  const { register, handleSubmit, reset, watch, trigger, formState: { errors, isSubmitting, touchedFields } } = useForm({
    resolver: zodResolver(skemaIzin),
    defaultValues: kosong(),
    mode: 'onTouched',
    shouldFocusError: true,
  });
  const panjang = (watch('keperluan') || '').length;
  const [tanggal, jamMulai, jamSelesai] = watch(['tanggal', 'jam_mulai', 'jam_selesai']);
  const durasi = !errors.jam_selesai && teksDurasi(jamMulai, jamSelesai);
  // Aturan waktu melibatkan beberapa isian: periksa ulang isian terkait yang sudah disentuh.
  const periksaWaktu = () => {
    const isian = ['tanggal', 'jam_mulai', 'jam_selesai'].filter((k) => touchedFields[k]);
    if (isian.length) trigger(isian);
  };

  const kirim = async (nilai) => {
    try {
      const h = await ajukanIzin({ ...nilai, keperluan: nilai.keperluan.trim() }, pengaju);
      toast.success(`Pengajuan izin terkirim — menunggu keputusan kepala madrasah${h.tiruan ? ' (contoh, belum tersimpan di server)' : ''}`);
      reset(kosong());
      onTerkirim?.(h.izin, h.tiruan);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal mengirim pengajuan izin. Periksa koneksi lalu coba lagi.'));
    }
  };

  return (
    <Card data-testid="form-pengajuan-izin">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FilePlus2 className="h-4 w-4 text-[#006837]" /> Ajukan Izin
        </CardTitle>
        <p className="text-xs text-slate-500">Isian bertanda <span className="text-red-500">*</span> wajib diisi.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(kirim)} className="space-y-4" noValidate>
          <Field id="izin-keperluan" label="Keperluan" wajib error={errors.keperluan?.message} petunjuk={`${panjang}/${KEPERLUAN_MAKS} karakter`}>
            <Textarea
              id="izin-keperluan"
              rows={3}
              maxLength={KEPERLUAN_MAKS}
              placeholder="Mis. Mengurus berkas ke Kantor Kemenag Kabupaten"
              {...register('keperluan')}
              {...tandaGalat('izin-keperluan', errors.keperluan)}
              data-testid="input-izin-keperluan"
            />
          </Field>
          <Field id="izin-tanggal" label="Tanggal" wajib error={errors.tanggal?.message}>
            <Input id="izin-tanggal" type="date" min={hariIniWIB()} {...register('tanggal', { onChange: periksaWaktu })} {...tandaGalat('izin-tanggal', errors.tanggal)} data-testid="input-izin-tanggal" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="izin-jam-mulai" label="Jam mulai" wajib error={errors.jam_mulai?.message}>
              <Input id="izin-jam-mulai" type="time" {...register('jam_mulai', { onChange: periksaWaktu })} {...tandaGalat('izin-jam-mulai', errors.jam_mulai)} data-testid="input-izin-jam-mulai" />
            </Field>
            <Field id="izin-jam-selesai" label="Jam selesai" wajib error={errors.jam_selesai?.message}>
              <Input id="izin-jam-selesai" type="time" {...register('jam_selesai', { onChange: periksaWaktu })} {...tandaGalat('izin-jam-selesai', errors.jam_selesai)} data-testid="input-izin-jam-selesai" />
            </Field>
          </div>
          <p className="-mt-1 text-xs text-slate-500" data-testid="info-waktu-izin">
            {durasi ? `Lama izin ${durasi}${tanggal === hariIniWIB() ? ' · hari ini' : ''}.` : `Hanya hari ini atau ke depan; minimal ${DURASI_MIN_MENIT} menit.`}
          </p>
          <Button type="submit" disabled={isSubmitting} className="w-full gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-kirim-pengajuan-izin">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim Pengajuan
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
