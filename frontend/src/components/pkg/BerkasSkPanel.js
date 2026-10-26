import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eye, FileText, ImageIcon, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { formatWIBPanjang } from '@/lib/datetime';
import { bukaBerkasSk, ukuranBerkas } from '@/lib/pkg';
import { MAKS_BERKAS_SK, hapusBerkasSk, unggahBerkasSk } from '@/lib/pkgKelola';

const TERIMA = 'application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png';

// File SK pada rincian SK (kepala madrasah): unggah, lihat, ganti, hapus. File ini tampil di Status Saya seluruh
// personil SK (tim penilai & guru yang dinilai). `onBerubah(sk)` menerima SK terbaru dari server.
export default function BerkasSkPanel({ sk, onBerubah }) {
  const inputRef = useRef(null);
  const [sedang, setSedang] = useState(null); // null | 'unggah' | 'hapus' | 'lihat'
  const b = sk.berkas;
  const Ikon = b?.jenis === 'pdf' ? FileText : ImageIcon;

  const pilih = async (e) => {
    const berkas = e.target.files?.[0];
    e.target.value = '';
    if (!berkas) return;
    if (berkas.size > MAKS_BERKAS_SK) {
      toast.error('Ukuran file SK maksimal 5 MB.');
      return;
    }
    setSedang('unggah');
    try {
      onBerubah(await unggahBerkasSk(sk.id, berkas));
      toast.success(b ? 'File SK diganti' : 'File SK diunggah');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSedang(null);
    }
  };
  const hapus = async () => {
    if (!(await confirmDialog(`Hapus file SK "${b.nama_asli}"? Personil SK tidak dapat melihatnya lagi sampai diunggah ulang.`))) return;
    setSedang('hapus');
    try {
      onBerubah(await hapusBerkasSk(sk.id));
      toast.success('File SK dihapus');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSedang(null);
    }
  };
  const lihat = async () => {
    setSedang('lihat');
    try {
      await bukaBerkasSk(sk.id);
    } catch {
      toast.error('Gagal membuka file SK');
    } finally {
      setSedang(null);
    }
  };

  return (
    <div data-testid="pkg-sk-berkas">
      <input ref={inputRef} type="file" accept={TERIMA} className="hidden" onChange={pilih} data-testid="pkg-sk-berkas-input" />
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><FileText className="h-4 w-4 text-[#006837]" /> File SK</h3>
      {b ? (
        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-[#006837]"><Ikon className="h-5 w-5" /></div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900" title={b.nama_asli}>{b.nama_asli}</div>
              <div className="text-xs text-slate-500">
                {b.jenis.toUpperCase()} · {ukuranBerkas(b.ukuran)} · diunggah {b.diunggah_oleh_nama || '-'}{b.diunggah_pada ? `, ${formatWIBPanjang(b.diunggah_pada)}` : ''}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={lihat} disabled={!!sedang} data-testid="pkg-sk-berkas-lihat">
              {sedang === 'lihat' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} Lihat
            </Button>
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => inputRef.current?.click()} disabled={!!sedang} data-testid="pkg-sk-berkas-ganti">
              {sedang === 'unggah' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Ganti
            </Button>
            <Button size="sm" variant="ghost" className="h-8 gap-1 text-rose-600" onClick={hapus} disabled={!!sedang} aria-label="Hapus file SK">
              {sedang === 'hapus' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={!!sedang} data-testid="pkg-sk-berkas-unggah"
          className="flex w-full flex-col items-center gap-1 rounded-lg border-2 border-dashed border-slate-200 px-4 py-5 text-center transition hover:border-[#006837]/50 hover:bg-emerald-50/40 disabled:opacity-60">
          {sedang === 'unggah' ? <Loader2 className="h-5 w-5 animate-spin text-[#006837]" /> : <Upload className="h-5 w-5 text-[#006837]" />}
          <span className="text-sm font-medium text-slate-900">Unggah file SK</span>
          <span className="text-xs text-slate-500">PDF, JPG, atau PNG · maks. 5 MB · dapat dilihat tim penilai & guru yang dinilai di menu Status Saya</span>
        </button>
      )}
    </div>
  );
}
