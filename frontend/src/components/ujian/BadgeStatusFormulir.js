import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Lock, LockOpen, CheckCheck } from 'lucide-react';
import { STATUS_FORMULIR } from '@/lib/ujian';

const IKON = { tertutup: Lock, dibuka: LockOpen, selesai: CheckCheck };

/**
 * Status Formulir Ringkas: menandai formulir daftar hadir & berita acara satu ujian — Tertutup, Sedang dibuka,
 * atau Selesai. `formulir` = { status, jam_buka, jam_tutup }. `ringkas` menampilkan badge saja (tanpa jam),
 * sedangkan bentuk penuh menambahkan jendela waktu formulir di bawahnya.
 */
export default function BadgeStatusFormulir({ formulir, ringkas = false }) {
  const kunci = STATUS_FORMULIR[formulir?.status] ? formulir.status : 'tertutup';
  const s = STATUS_FORMULIR[kunci];
  const Ikon = IKON[kunci];
  const jam = formulir?.jam_buka && formulir?.jam_tutup ? `${formulir.jam_buka}–${formulir.jam_tutup} WIB` : null;
  const badge = (
    <Badge
      className={`${s.kelas} gap-1 whitespace-nowrap`}
      title={`Daftar hadir & berita acara: ${formulir?.pesan || s.keterangan}`}
      aria-label={`Status formulir: ${s.label}`}
      data-testid="ujian-status-formulir"
      data-status={kunci}
    >
      {kunci === 'dibuka' ? (
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
      ) : <Ikon className="h-3 w-3" aria-hidden="true" />}
      {s.label}
    </Badge>
  );
  if (ringkas) return badge;
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      {badge}
      <span className="text-xs text-slate-500">{jam ? `Formulir ${jam}` : 'Jam formulir belum diatur'}</span>
      {kunci === 'tertutup' && formulir?.pesan && formulir?.alasan !== 'nonaktif' && (
        <span className="text-[11px] text-slate-400">{formulir.pesan}</span>
      )}
    </div>
  );
}
