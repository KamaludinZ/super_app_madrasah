import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';

export const DURASI_TAMPIL_MS = 30000;

// Hook tampil/sembunyi isi rahasia: tersembunyi bawaan, tertutup lagi otomatis setelah `durasi`
// dan setiap kali `kunci` (mis. id akun) berganti.
export function useTampilRahasia(kunci, durasi = DURASI_TAMPIL_MS) {
  const [tampil, setTampil] = useState(false);
  useEffect(() => setTampil(false), [kunci]);
  useEffect(() => {
    if (!tampil || !durasi) return undefined;
    const t = setTimeout(() => setTampil(false), durasi);
    return () => clearTimeout(t);
  }, [tampil, durasi]);
  return [tampil, setTampil];
}

// Tombol ikon mata untuk menampilkan/menyembunyikan isi rahasia.
export function TombolMata({ tampil, onToggle, label = 'password', testid }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={onToggle}
      aria-label={tampil ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
      aria-pressed={tampil}
      data-testid={testid}
    >
      {tampil ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  );
}

// Teks rahasia yang tersamar (••••) kecuali sedang ditampilkan.
export default function NilaiRahasia({ nilai, tampil, testid }) {
  return (
    <span className="font-mono" data-testid={testid}>
      {tampil ? nilai : '•'.repeat(Math.min(Math.max((nilai || '').length, 8), 16))}
    </span>
  );
}

// Input password dengan ikon mata di dalam kotak isian (siap dipakai dengan register React Hook Form).
// Tampilan kembali tersembunyi otomatis setelah DURASI_TAMPIL_MS atau saat `kunci` berganti.
export const InputPassword = React.forwardRef(function InputPassword({ kunci, className = '', invalid = false, testidToggle, ...props }, ref) {
  const [tampil, setTampil] = useTampilRahasia(kunci);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={tampil ? 'text' : 'password'}
        className={`flex h-9 w-full rounded-md border bg-transparent py-1 pl-3 pr-10 font-mono text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-50 ${
          invalid ? 'border-red-500 focus-visible:ring-red-500' : 'border-input focus-visible:ring-ring'
        } ${className}`}
        aria-invalid={invalid || undefined}
        {...props}
      />
      <div className="absolute inset-y-0 right-0 flex items-center">
        <TombolMata tampil={tampil} onToggle={() => setTampil((v) => !v)} testid={testidToggle} />
      </div>
    </div>
  );
});
