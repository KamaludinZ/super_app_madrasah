import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser, Eye } from 'lucide-react';
import PadTandaTangan from '@/components/pkg/PadTandaTangan';

// PNG goresan sangat pendek (titik/garis kecil) tidak diterima sebagai tanda tangan.
export const UKURAN_TTD_MIN = 1800; // panjang data URL
export const ttdCukup = (dataUrl) => !!dataUrl && dataUrl.startsWith('data:image/png;base64,') && dataUrl.length >= UKURAN_TTD_MIN;

/**
 * Kolom tanda tangan formulir publik ujian: kanvas bebas coret (pola yang sama dengan angket 360°), tombol hapus,
 * dan pratinjau bagaimana PNG tampil pada lembar cetak (sel daftar hadir bernomor / baris tanda tangan berita acara).
 * `onUbah(dataUrl | null)` hanya mengirim tanda tangan yang cukup jelas. Ref: { hapus() }.
 */
const KolomTandaTangan = forwardRef(function KolomTandaTangan({ onUbah, nomor, nama, jenis = 'daftar_hadir', disabled }, ref) {
  const padRef = useRef(null);
  const [png, setPng] = useState(null);

  const ubah = (dataUrl) => {
    setPng(dataUrl);
    onUbah?.(ttdCukup(dataUrl) ? dataUrl : null);
  };
  const hapus = () => { padRef.current?.hapus(); ubah(null); };
  useImperativeHandle(ref, () => ({ hapus }));

  const pendek = png && !ttdCukup(png);
  return (
    <div className="space-y-3" data-testid="kolom-ttd-ujian">
      <PadTandaTangan ref={padRef} onUbah={ubah} disabled={disabled} invalid={!!pendek} />
      {pendek && <p className="text-xs text-rose-700" role="alert">Tanda tangan terlalu pendek. Goreskan tanda tangan lengkap Anda.</p>}
      {ttdCukup(png) && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" data-testid="pratinjau-ttd">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"><Eye className="h-3.5 w-3.5" /> Pratinjau di lembar cetak</p>
            <Button type="button" variant="ghost" size="sm" onClick={hapus} disabled={disabled} className="h-8 gap-1 text-rose-600 hover:bg-rose-50" data-testid="btn-hapus-ttd">
              <Eraser className="h-4 w-4" /> Hapus
            </Button>
          </div>
          {jenis === 'daftar_hadir' ? (
            <div className="flex overflow-hidden rounded border border-slate-400 bg-white text-xs" style={{ fontFamily: 'Arial, sans-serif' }}>
              <span className="w-8 border-r border-slate-400 px-1 py-2 text-center">{nomor || 1}</span>
              <span className="min-w-0 flex-1 truncate border-r border-slate-400 px-2 py-2">{nama}</span>
              <span className="relative w-28 px-1">
                <span className="absolute left-1 top-0.5 text-[9px] text-slate-500">{nomor || 1}</span>
                <img src={png} alt="Pratinjau tanda tangan" className="mx-auto h-8 object-contain" />
              </span>
            </div>
          ) : (
            <div className="rounded border border-slate-200 bg-white p-2 text-[13px]" style={{ fontFamily: 'Georgia, serif' }}>
              <div className="flex items-end gap-2"><span className="w-28">Tanda Tangan</span>: <img src={png} alt="Pratinjau tanda tangan" className="h-11 object-contain" /></div>
              <div className="flex gap-2"><span className="w-28">Nama</span>: {nama}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default KolomTandaTangan;
