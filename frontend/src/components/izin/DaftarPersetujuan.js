import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Inbox } from 'lucide-react';
import {
  STATUS_IZIN, URGENSI_MENUNGGU, jamSekarangWIB, kelompokMenunggu, labelPeran, teksDurasi, urgensiMenunggu,
} from '@/lib/izinKamad';
import { formatWIBPanjang } from '@/lib/datetime';
import { hariIniWIB } from '@/lib/tanggal';

/**
 * Daftar izin untuk kepala madrasah: pengaju, tanggal & jam, keperluan, status. `mode` 'menunggu'
 * dikelompokkan per tanggal (hari ini / besok / akan datang) dengan penanda mendesak & waktu lewat;
 * 'riwayat' menampilkan waktu keputusan & alasan penolakan.
 * Menekan baris memanggil `onPilih(izin)`; `aksi(izin)` (opsional) merender tombol di sisi baris.
 */
export default function DaftarPersetujuan({ items = [], mode = 'menunggu', onPilih, aksi, kosong = 'Tidak ada data' }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center" data-testid={`persetujuan-kosong-${mode}`}>
        <Inbox className="h-8 w-8 text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-700">{kosong}</p>
      </div>
    );
  }
  const hariIni = hariIniWIB();
  const jam = jamSekarangWIB();

  if (mode === 'menunggu') {
    return (
      <div className="space-y-4" data-testid="daftar-persetujuan-menunggu">
        {kelompokMenunggu(items, hariIni).map((g) => (
          <section key={g.kunci} aria-label={g.judul}>
            <h3 className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {g.judul} <span className="tabular-nums">({g.items.length})</span>
            </h3>
            <BarisDaftar items={g.items} mode={mode} onPilih={onPilih} aksi={aksi} hariIni={hariIni} jam={jam} />
          </section>
        ))}
      </div>
    );
  }
  return (
    <div data-testid={`daftar-persetujuan-${mode}`}>
      <BarisDaftar items={items} mode={mode} onPilih={onPilih} aksi={aksi} hariIni={hariIni} jam={jam} />
    </div>
  );
}

function BarisDaftar({ items, mode, onPilih, aksi, hariIni, jam }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((izin) => {
        const u = mode === 'menunggu' ? urgensiMenunggu(izin, { hariIni, jam }) : null;
        const s = STATUS_IZIN[izin.status] || STATUS_IZIN.menunggu;
        const durasi = teksDurasi(izin.jam_mulai, izin.jam_selesai);
        return (
          <li key={izin.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center" data-testid={`persetujuan-${izin.id}`}>
            <button
              type="button"
              onClick={() => onPilih?.(izin)}
              className="min-w-0 flex-1 rounded-lg px-2 py-1 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837]/40"
              aria-label={`Lihat detail izin ${izin.pengaju_nama}`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-slate-900">{izin.pengaju_nama}</span>
                <span className="text-xs text-slate-500">{labelPeran(izin.pengaju_peran)}</span>
                {u && <Badge variant="outline" className={URGENSI_MENUNGGU[u].kelas}>{URGENSI_MENUNGGU[u].label}</Badge>}
                {mode === 'riwayat' && <Badge variant="outline" className={s.kelas}>{s.label}</Badge>}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {formatWIBPanjang(izin.tanggal, false)} · <span className="font-mono tabular-nums">{izin.jam_mulai}–{izin.jam_selesai}</span>
                {durasi && ` (${durasi})`}
              </div>
              <p className="text-sm text-slate-700 mt-1 break-words">{izin.keperluan}</p>
              {mode === 'riwayat' ? (
                <p className="text-[11px] text-slate-500 mt-1">
                  Diputuskan {izin.diputuskan_oleh_nama ? `oleh ${izin.diputuskan_oleh_nama} ` : ''}· {formatWIBPanjang(izin.diputuskan_pada)}
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 mt-1">Diajukan {formatWIBPanjang(izin.dibuat_pada)}</p>
              )}
              {mode === 'riwayat' && izin.status === 'ditolak' && izin.alasan_penolakan && (
                <p className="mt-1.5 rounded-md bg-rose-50 border border-rose-100 px-2 py-1 text-xs text-rose-800">
                  Alasan ditolak: {izin.alasan_penolakan}
                </p>
              )}
            </button>
            {aksi && <div className="flex shrink-0 gap-2 px-2 sm:px-0">{aksi(izin)}</div>}
          </li>
        );
      })}
    </ul>
  );
}
