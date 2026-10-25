import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { simpanBerkas } from '@/lib/pkgCetak';

// Tombol cetak form/angket kertas untuk diisi offline. `ambil` = fungsi async yang mengembalikan
// { blob, namaBerkas } (mis. cetakFormKosong / cetakAngket); `sedangLuar` mengunci tombol saat proses lain berjalan.
// Memakai pola unduh blob yang sama dengan halaman Cetak (simpanBerkas) agar jalan juga di WebView aplikasi HP.
// `onHasil` (opsional) menerima hasil alih-alih langsung disimpan, mis. untuk dibuka di dialog pratinjau.
export default function TombolCetakOffline({ ambil, children, ikon: Ikon = Printer, variant = 'outline', size = 'sm', className = '', sedangLuar = false, testId, onHasil }) {
  const [sedang, setSedang] = useState(false);
  const cetak = async () => {
    setSedang(true);
    try {
      const hasil = await ambil();
      if (onHasil) return onHasil(hasil);
      simpanBerkas(hasil.blob, hasil.namaBerkas);
      toast.success(`${hasil.namaBerkas} diunduh`);
    } catch (e) {
      toast.error(e.message || 'Gagal mencetak form');
    } finally {
      setSedang(false);
    }
  };
  return (
    <Button type="button" size={size} variant={variant} className={`h-8 gap-1 ${className}`} disabled={sedang || sedangLuar} onClick={cetak} data-testid={testId}>
      {sedang ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ikon className="h-3.5 w-3.5" />} {children}
    </Button>
  );
}
