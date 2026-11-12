import React from 'react';
import { Badge } from '@/components/ui/badge';
import { FileClock, XCircle } from 'lucide-react';
import { STATUS_IZIN } from '@/lib/izinKamad';
import { formatWIBPanjang } from '@/lib/datetime';

/**
 * Daftar pengajuan izin milik pengguna aktif dengan status menunggu/disetujui/ditolak/dibatalkan.
 * Pengajuan yang sudah diputuskan menampilkan pemutus & waktunya; alasan penolakan ditampilkan
 * pada pengajuan yang ditolak. Menekan baris memanggil `onPilih(izin)` untuk membuka detail;
 * `onBatalkan(izin)` menampilkan tombol Batalkan pada pengajuan yang masih menunggu.
 */
export default function DaftarPengajuanSaya({ items = [], kosong = 'Belum ada pengajuan izin', onPilih, onBatalkan, sibukId }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center" data-testid="pengajuan-saya-kosong">
        <FileClock className="h-8 w-8 text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-700">{kosong}</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100" data-testid="pengajuan-saya">
      {items.map((izin) => {
        const s = STATUS_IZIN[izin.status] || STATUS_IZIN.menunggu;
        const diputuskan = (izin.status === 'disetujui' || izin.status === 'ditolak') && izin.diputuskan_pada;
        return (
          <li key={izin.id} data-testid={`pengajuan-saya-${izin.id}`}>
            <button
              type="button"
              onClick={() => onPilih?.(izin)}
              className="block w-full rounded-lg px-2 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]/40"
              aria-label={`Lihat detail pengajuan: ${izin.keperluan}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">
                    {formatWIBPanjang(izin.tanggal, false)} · <span className="font-mono tabular-nums">{izin.jam_mulai}–{izin.jam_selesai}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900 mt-0.5 break-words">{izin.keperluan}</p>
                </div>
                <Badge variant="outline" className={`shrink-0 ${s.kelas}`}>{s.label}</Badge>
              </div>
              {izin.status === 'ditolak' && izin.alasan_penolakan && (
                <p className="mt-1.5 rounded-md bg-rose-50 border border-rose-100 px-2 py-1 text-xs text-rose-800">
                  Alasan ditolak: {izin.alasan_penolakan}
                </p>
              )}
              {diputuskan && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Diputuskan {izin.diputuskan_oleh_nama ? `oleh ${izin.diputuskan_oleh_nama} ` : ''}· {formatWIBPanjang(izin.diputuskan_pada)}
                </p>
              )}
              {izin.status === 'menunggu' && (
                <p className="mt-1 text-[11px] text-slate-500">Diajukan {formatWIBPanjang(izin.dibuat_pada)} · menunggu keputusan kepala madrasah</p>
              )}
            </button>
            {onBatalkan && izin.status === 'menunggu' && (
              <div className="flex justify-end px-2 pb-2 -mt-1">
                <button
                  type="button"
                  onClick={() => onBatalkan(izin)}
                  disabled={sibukId === izin.id}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  aria-label={`Batalkan pengajuan: ${izin.keperluan}`}
                  data-testid={`btn-batalkan-izin-${izin.id}`}
                >
                  <XCircle className="h-3.5 w-3.5" /> {sibukId === izin.id ? 'Membatalkan…' : 'Batalkan'}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
