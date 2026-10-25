import React, { useEffect, useMemo } from 'react';
import { Download } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { simpanBerkas } from '@/lib/pkgCetak';

// Pratinjau PDF sebelum diunduh. `pratinjau` = { blob, namaBerkas, mesin? } atau null; tombol Unduh menyimpan blob yang
// sama (tidak membuat berkas ulang, riwayat unduhan tidak dobel). Di WebView aplikasi HP PDF tidak dapat ditampilkan
// di halaman, jadi halaman pemanggil langsung menyimpan berkas (lembar berbagi) alih-alih membuka dialog ini.
export default function DialogPratinjauPdf({ pratinjau, onTutup }) {
  const url = useMemo(() => (pratinjau ? URL.createObjectURL(pratinjau.blob) : null), [pratinjau]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  return (
    <Dialog open={!!pratinjau} onOpenChange={(buka) => { if (!buka) onTutup(); }}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-5xl flex-col gap-3 p-4" data-testid="pkg-pratinjau-pdf">
        <DialogHeader>
          <DialogTitle className="break-all pr-6 text-base">Pratinjau · {pratinjau?.namaBerkas}</DialogTitle>
        </DialogHeader>
        {pratinjau?.mesin === 'reportlab' && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Versi cadangan: tata letak bukan salinan identik template resmi (LibreOffice tidak tersedia/gagal di server).
          </p>
        )}
        {url && <iframe title="Pratinjau PDF" src={url} className="min-h-0 w-full flex-1 rounded border border-slate-200" />}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onTutup}>Tutup</Button>
          <Button type="button" className="gap-1 bg-[#006837] hover:bg-[#005830]" data-testid="pkg-pratinjau-unduh"
            onClick={() => simpanBerkas(pratinjau.blob, pratinjau.namaBerkas)}>
            <Download className="h-4 w-4" /> Unduh PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
