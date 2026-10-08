import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { tambahAkun, ubahAkun } from '@/lib/simpanAkun';
import { InputPassword } from '@/components/simpan-akun/NilaiRahasia';

const pesanWajib = (nama) => `${nama} wajib diisi`;

// Link web boleh kosong (aplikasi non-web); bila diisi harus berupa alamat web yang wajar.
const linkWeb = z.string().trim().max(500, 'Link terlalu panjang').refine((v) => {
  if (!v) return true;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return /\./.test(u.hostname) || u.hostname === 'localhost';
  } catch {
    return false;
  }
}, 'Link web tidak valid (contoh: emis.kemenag.go.id)');

const kunciDuplikat = (aplikasi, username) => `${(aplikasi || '').trim().toLowerCase()}|${(username || '').trim().toLowerCase()}`;

// `lain`: akun tersimpan lain (untuk cek duplikat aplikasi + username).
const skemaAkun = (ubah, lain = []) => z.object({
  nama_akun: z.string().trim().min(1, pesanWajib('Nama akun')).max(120, 'Maksimal 120 karakter'),
  link_web: linkWeb,
  nama_aplikasi: z.string().trim().min(1, pesanWajib('Nama aplikasi')).max(120, 'Maksimal 120 karakter'),
  username: z.string().trim().min(1, pesanWajib('Username')).max(200, 'Maksimal 200 karakter'),
  // Saat mengubah, password kosong berarti tidak diganti.
  password: ubah
    ? z.string().max(500, 'Maksimal 500 karakter')
    : z.string().min(1, pesanWajib('Password')).max(500, 'Maksimal 500 karakter'),
}).superRefine((v, ctx) => {
  const kunci = kunciDuplikat(v.nama_aplikasi, v.username);
  if (v.nama_aplikasi.trim() && v.username.trim() && lain.some((a) => kunciDuplikat(a.nama_aplikasi, a.username) === kunci)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['username'], message: 'Akun dengan aplikasi & username ini sudah tersimpan' });
  }
});

const KOSONG = { nama_akun: '', link_web: '', nama_aplikasi: '', username: '', password: '' };

function Field({ id, label, wajib, error, children, petunjuk }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={error ? 'text-red-600' : undefined}>{label}{wajib && <span className="text-red-500"> *</span>}</Label>
      {children}
      {error ? <p id={`${id}-galat`} className="text-xs text-red-600" role="alert">{error}</p> : petunjuk && <p className="text-xs text-slate-500">{petunjuk}</p>}
    </div>
  );
}

// Atribut aksesibilitas & tampilan galat untuk satu input.
const tandaGalat = (id, error) => (error
  ? { 'aria-invalid': true, 'aria-describedby': `${id}-galat`, className: 'border-red-500 focus-visible:ring-red-500' }
  : {});

// Form tambah / ubah akun tersimpan. `akun`: null = tertutup, {} = tambah, {id, ...} = ubah.
// `daftar`: akun tersimpan saat ini (ringkas) untuk mencegah duplikat.
export default function FormAkunDialog({ akun, daftar = [], onClose, onTersimpan }) {
  const ubah = !!akun?.id;
  const lain = daftar.filter((a) => a.id !== akun?.id);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(skemaAkun(ubah, lain)),
    defaultValues: KOSONG,
    mode: 'onTouched',
    shouldFocusError: true,
  });

  useEffect(() => {
    if (akun) reset({ ...KOSONG, ...akun, password: '' });
  }, [akun, reset]);

  const kirim = async (nilai) => {
    const isi = { ...nilai, link_web: nilai.link_web.trim() };
    try {
      const hasil = ubah ? await ubahAkun(akun.id, isi) : await tambahAkun(isi);
      toast.success(ubah ? 'Akun diperbarui' : 'Akun disimpan');
      onTersimpan?.(hasil);
      onClose();
    } catch (e) {
      if (!e.sesiBerakhir) toast.error(e?.message || 'Gagal menyimpan akun');
    }
  };

  return (
    <Dialog open={!!akun} onOpenChange={(o) => { if (!o && !isSubmitting) onClose(); }}>
      <DialogContent className="max-w-lg" data-testid="simpan-akun-form">
        <DialogHeader>
          <DialogTitle>{ubah ? 'Ubah Akun' : 'Tambah Akun'}</DialogTitle>
          <DialogDescription>Data akun hanya bisa dibuka oleh Anda setelah memasukkan PIN.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(kirim)} className="space-y-4" noValidate>
          <Field id="nama_akun" label="Nama akun" wajib error={errors.nama_akun?.message}>
            <Input id="nama_akun" placeholder="Mis. Akun SIMPATIKA" autoComplete="off" {...register('nama_akun')} {...tandaGalat('nama_akun', errors.nama_akun)} />
          </Field>
          <Field id="link_web" label="Link web" error={errors.link_web?.message} petunjuk="Kosongkan bila bukan aplikasi berbasis web.">
            <Input id="link_web" placeholder="simpatika.kemenag.go.id" autoComplete="off" inputMode="url" {...register('link_web')} {...tandaGalat('link_web', errors.link_web)} />
          </Field>
          <Field id="nama_aplikasi" label="Nama aplikasi" wajib error={errors.nama_aplikasi?.message}>
            <Input id="nama_aplikasi" placeholder="Mis. SIMPATIKA" autoComplete="off" {...register('nama_aplikasi')} {...tandaGalat('nama_aplikasi', errors.nama_aplikasi)} />
          </Field>
          <Field id="username" label="Username" wajib error={errors.username?.message}>
            <Input id="username" autoComplete="off" {...register('username')} {...tandaGalat('username', errors.username)} />
          </Field>
          <Field
            id="password"
            label="Password"
            wajib={!ubah}
            error={errors.password?.message}
            petunjuk={ubah ? 'Kosongkan bila password tidak berubah.' : undefined}
          >
            <InputPassword
              id="password"
              kunci={akun?.id || (akun ? 'baru' : null)}
              autoComplete="new-password"
              invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-galat' : undefined}
              testidToggle="simpan-akun-form-toggle-password"
              {...register('password')}
            />
          </Field>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Batal</Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#006837] hover:bg-[#005830]" data-testid="simpan-akun-form-simpan">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
