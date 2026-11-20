import React, { useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Printer } from 'lucide-react';

/**
 * Pratinjau PDF daftar hadir / berita acara sebelum dicetak (pratinjau tidak masuk arsip). Tombol "Cetak & Arsipkan"
 * membuat berkas final sesuai format pilihan yang otomatis tersimpan ke arsip. `pratinjau` = { blob, judul, mesin }.
 */
export default function PratinjauDokumenDialog({ pratinjau, onTutup, onCetak, mencetak }) {
  const url = useMemo(() => (pratinjau ? URL.createObjectURL(pratinjau.blob) : null), [pratinjau]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return (
    <Dialog open={!!pratinjau} onOpenChange={(b) => { if (!b && !mencetak) onTutup(); }}>
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-5xl flex-col gap-3 p-4" data-testid="pratinjau-dokumen-ujian">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base">Pratinjau · {pratinjau?.judul}</DialogTitle>
        </DialogHeader>
        {pratinjau?.mesin === 'reportlab' && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Versi cadangan ReportLab: LibreOffice tidak tersedia di server, tata letak meniru (bukan salinan identik) template madrasah.
          </p>
        )}
        {url && <iframe title={`Pratinjau ${pratinjau?.judul}`} src={url} className="min-h-0 w-full flex-1 rounded border border-slate-200 bg-white" />}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onTutup} disabled={mencetak}>Tutup</Button>
          <Button onClick={onCetak} disabled={mencetak} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-cetak-dari-pratinjau">
            {mencetak ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} Cetak & Arsipkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
