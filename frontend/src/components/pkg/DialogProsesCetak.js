import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, Circle, AlertTriangle, ShieldX } from 'lucide-react';
import { MESIN_LABEL, TAHAP_CETAK } from '@/lib/pkgCetak';

// Dialog umpan balik cetak. `proses` = { format, tahap, selesai, namaBerkas, mesin, alasanCadangan, penolakan, galat } | null.
// Tampil saat berkas disiapkan; setelah selesai dengan PDF cadangan (ReportLab) dialog tetap terbuka dengan penanda
// bahwa hasilnya bukan salinan identik Excel. Penolakan akses 403 ditampilkan dengan alasannya.
export default function DialogProsesCetak({ proses, onTutup }) {
  if (!proses) return null;
  const tahap = TAHAP_CETAK.filter((t) => !t.hanyaPdf || proses.format === 'pdf');
  const idxAktif = tahap.findIndex((t) => t.kunci === proses.tahap);
  const cadangan = proses.selesai && proses.mesin === 'reportlab';
  const bolehTutup = proses.selesai || proses.penolakan || proses.galat;

  return (
    <Dialog open onOpenChange={(o) => { if (!o && bolehTutup) onTutup(); }}>
      <DialogContent className="max-w-md" data-testid="pkg-dialog-cetak">
        {proses.penolakan ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-rose-700"><ShieldX className="h-5 w-5" /> Akses ditolak</DialogTitle>
              <DialogDescription className="text-left">{proses.penolakan.pesan || 'Anda tidak dapat mencetak dokumen ini.'}</DialogDescription>
            </DialogHeader>
            <p className="text-sm text-slate-600">Dokumen hanya dapat dicetak oleh kepala madrasah untuk seluruh guru, atau oleh penilai untuk guru yang dinilainya.</p>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{proses.selesai ? 'Berkas siap' : 'Menyiapkan berkas…'}</DialogTitle>
              <DialogDescription className="text-left">{proses.namaBerkas || 'Dokumen resmi dari template PKG.'}</DialogDescription>
            </DialogHeader>
            <ol className="space-y-2" aria-live="polite">
              {tahap.map((t, i) => {
                const selesai = proses.selesai || i < idxAktif;
                const aktif = !proses.selesai && i === idxAktif && !proses.galat;
                return (
                  <li key={t.kunci} className={`flex items-center gap-2 text-sm ${selesai ? 'text-emerald-700' : aktif ? 'text-slate-900' : 'text-slate-400'}`}>
                    {selesai ? <CheckCircle2 className="h-4 w-4" /> : aktif ? <Loader2 className="h-4 w-4 animate-spin" /> : <Circle className="h-4 w-4" />}
                    {t.label}{t.kunci === 'pdf' && proses.selesai && proses.mesin ? ` — ${MESIN_LABEL[proses.mesin]}` : ''}
                  </li>
                );
              })}
            </ol>
            {proses.galat && <p className="text-sm text-rose-700" role="alert">{proses.galat}</p>}
            {cadangan && (
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="alert" data-testid="pkg-cetak-cadangan">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  PDF dibuat dengan <strong>mesin cadangan (ReportLab)</strong> karena {proses.alasanCadangan === 'konversi_gagal' ? 'konversi LibreOffice di server gagal' : 'LibreOffice tidak tersedia di server'}.
                  Tata letaknya <strong>bukan salinan identik</strong> berkas Excel resmi dan diberi penanda pada setiap halaman.
                  Untuk dokumen resmi, unduh Excel atau hubungi admin sistem.
                </span>
              </div>
            )}
          </>
        )}
        {bolehTutup && (
          <DialogFooter>
            <Button onClick={onTutup} className="bg-[#006837] hover:bg-[#005830]" data-testid="pkg-dialog-cetak-tutup">Tutup</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
