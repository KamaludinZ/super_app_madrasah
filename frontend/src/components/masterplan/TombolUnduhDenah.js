import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Download, Loader2, Image as IkonGambar, MapPinned } from 'lucide-react';
import { toast } from 'sonner';
import { unduhDenahKosong, unduhDenahBerpenanda } from '@/lib/unduhDenah';

// Unduh denah untuk semua peran: denah kosong (gambar asli) atau denah dengan penanda
// (label kode ruang + keterangan kode & nama ruang di tepi kanan).
export default function TombolUnduhDenah({ gambarUrl, markers = [], disabled = false }) {
  const [proses, setProses] = useState(false);

  const jalankan = async (fn, pesanSukses) => {
    setProses(true);
    try {
      await fn();
      toast.success(pesanSukses);
    } catch (e) {
      toast.error(e?.message || 'Gagal mengunduh denah');
    } finally {
      setProses(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={disabled || !gambarUrl || proses} data-testid="masterplan-unduh">
          {proses ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Unduh denah
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Pilih versi denah</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => jalankan(() => unduhDenahKosong(gambarUrl), 'Denah kosong diunduh')}
          className="items-start gap-2"
          data-testid="masterplan-unduh-kosong"
        >
          <IkonGambar className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="block font-medium">Denah kosong</span>
            <span className="block text-xs text-slate-500">Gambar denah asli tanpa penanda</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => jalankan(() => unduhDenahBerpenanda(gambarUrl, markers), 'Denah dengan penanda diunduh')}
          disabled={!markers.length}
          className="items-start gap-2"
          data-testid="masterplan-unduh-penanda"
        >
          <MapPinned className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <span className="block font-medium">Denah dengan penanda</span>
            <span className="block text-xs text-slate-500">
              {markers.length ? 'Penanda berlabel kode ruang + keterangan kode & nama ruang di tepi denah (PNG)' : 'Belum ada penanda ruang'}
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
