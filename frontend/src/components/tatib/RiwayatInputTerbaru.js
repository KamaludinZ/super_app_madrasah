import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { formatPoin } from '@/components/tatib/RingkasanPoin';

const formatTanggal = (tgl) => {
  if (!tgl) return '-';
  const d = new Date(`${tgl.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? tgl : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * Daftar pencatatan tatib terbaru di samping form input.
 * `items`: catatan [{ id, siswa_nama, siswa_kelas, kode_aturan, jenis_nama, kategori_nama, poin, tanggal, keterangan, petugas_nama }].
 * `idBaru`: id catatan yang baru disimpan (diberi penanda); `idDiperbaiki`: catatan yang sedang dibuka di form.
 * `onPerbaiki` / `onHapus`: tombol aksi hanya muncul bila handler diberikan (sesuai hak peran).
 */
export default function RiwayatInputTerbaru({
  items = [], loading, memuatLagi, adaLagi, onMuatLagi, idBaru, idDiperbaiki, onPerbaiki, onHapus, kosong = 'Belum ada pencatatan.',
}) {
  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;
  }
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500" data-testid="input-tatib-riwayat-kosong">{kosong}</p>;
  }
  return (
    <div>
      <ul className="divide-y" data-testid="input-tatib-riwayat">
        {items.map((r) => (
          <li
            key={r.id}
            className={`flex items-start justify-between gap-3 py-3 ${
              r.id === idDiperbaiki ? '-mx-2 rounded-md bg-sky-50 px-2 ring-1 ring-sky-300' : r.id === idBaru ? '-mx-2 rounded-md bg-amber-50 px-2' : ''
            }`}
            data-testid={`riwayat-${r.id}`}
          >
            <div className="min-w-0">
              <p className="font-medium truncate">
                {r.siswa_nama} <span className="text-xs font-normal text-slate-500">{r.siswa_kelas}</span>
                {r.id === idBaru && <Badge className="ml-2 bg-amber-500 px-1.5 py-0 text-[10px] hover:bg-amber-500">Baru</Badge>}
              </p>
              <p className="text-sm text-slate-700 truncate">
                <span className="font-mono text-xs text-slate-500 mr-1">{r.kode_aturan}</span>{r.jenis_nama}
              </p>
              <p className="text-xs text-slate-500">
                {formatTanggal(r.tanggal)} · <Badge variant="outline" className="px-1.5 py-0 text-[11px]">{r.kategori_nama}</Badge>
                {r.petugas_nama ? ` · oleh ${r.petugas_nama}` : ''}
              </p>
              {r.keterangan && <p className="mt-0.5 text-xs italic text-slate-500 line-clamp-2">“{r.keterangan}”</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className={`font-semibold tabular-nums ${r.poin < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{formatPoin(r.poin)}</span>
              {(onPerbaiki || onHapus) && (
                <div className="flex">
                  {onPerbaiki && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onPerbaiki(r)} aria-label={`Perbaiki catatan ${r.siswa_nama}`} data-testid={`riwayat-perbaiki-${r.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {onHapus && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => onHapus(r)} aria-label={`Hapus catatan ${r.siswa_nama}`} data-testid={`riwayat-hapus-${r.id}`}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {adaLagi && (
        <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={onMuatLagi} disabled={memuatLagi} data-testid="input-tatib-riwayat-lagi">
          {memuatLagi && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Muat lebih banyak
        </Button>
      )}
    </div>
  );
}
