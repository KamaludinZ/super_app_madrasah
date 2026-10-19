import React from 'react';
import { Button } from '@/components/ui/button';
import { Check, CloudUpload, Loader2, AlertCircle } from 'lucide-react';
import { formatWIB } from '@/lib/datetime';

// Indikator status simpan otomatis draf + tombol simpan manual.
export default function StatusSimpanDraf({ status, tersimpanPada, pesanGalat, onSimpan, nonaktif }) {
  const jam = tersimpanPada ? formatWIB(tersimpanPada, 'Time', { hour: '2-digit', minute: '2-digit' }) : null;
  const isi = {
    menyimpan: <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Menyimpan draf…</>,
    menunggu: <><CloudUpload className="h-3.5 w-3.5" /> Perubahan belum tersimpan</>,
    gagal: <><AlertCircle className="h-3.5 w-3.5" /> Gagal menyimpan draf{pesanGalat ? `: ${pesanGalat}` : ''}</>,
    tersimpan: <><Check className="h-3.5 w-3.5" /> Draf tersimpan{jam ? ` pukul ${jam}` : ''}</>,
    diam: jam ? <><Check className="h-3.5 w-3.5" /> Tersimpan terakhir pukul {jam}</> : <>Belum ada draf tersimpan</>,
  }[status];
  const warna = status === 'gagal' ? 'text-rose-700' : status === 'menunggu' ? 'text-amber-700' : 'text-slate-600';

  return (
    <div className="flex items-center gap-2" data-testid="pkg-status-draf" aria-live="polite">
      <span className={`inline-flex items-center gap-1 text-xs ${warna}`} role={status === 'gagal' ? 'alert' : undefined}>{isi}</span>
      <Button type="button" size="sm" variant={status === 'gagal' ? 'default' : 'outline'} className="h-7 bg-white text-xs"
        onClick={onSimpan} disabled={nonaktif || status === 'menyimpan'} data-testid="pkg-lembar-simpan-draf">
        {status === 'gagal' ? 'Coba lagi' : 'Simpan sekarang'}
      </Button>
    </div>
  );
}
