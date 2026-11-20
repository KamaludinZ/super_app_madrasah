import React from 'react';
import { Button } from '@/components/ui/button';
import { ShieldAlert, UserRoundSearch } from 'lucide-react';
import { formatWIB } from '@/lib/datetime';

/**
 * Pesan penolakan kiriman ganda: satu nama hanya sekali per sesi. Menjelaskan kapan nama itu sudah mengisi dan langkah
 * bila keliru (salah pilih nama / perlu perbaikan): hubungi pengawas atau panitia agar admin membuka kunci dengan
 * alasan tercatat. `rincian` = { pesan, nama, waktu_kirim }.
 */
export default function PenolakanGanda({ rincian, onPilihLain }) {
  if (!rincian) return null;
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm sm:p-5" role="alert" data-testid="penolakan-ganda">
      <div className="flex gap-3">
        <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
        <div className="min-w-0 space-y-1.5 text-sm text-amber-900">
          <p className="font-semibold">{rincian.pesan || 'Nama ini sudah mengisi daftar hadir pada sesi ini.'}</p>
          {(rincian.nama || rincian.waktu_kirim) && (
            <p className="text-amber-800">
              {rincian.nama && <><strong>{rincian.nama}</strong> </>}
              {rincian.waktu_kirim && <>tercatat hadir pukul {formatWIB(rincian.waktu_kirim, 'Time', { hour: '2-digit', minute: '2-digit' })} WIB.</>}
            </p>
          )}
          <ul className="list-inside list-disc text-xs text-amber-800">
            <li>Bila Anda salah memilih nama, pilih nama Anda yang benar.</li>
            <li>Bila nama Anda dipakai orang lain atau perlu diperbaiki, hubungi pengawas ruang/panitia — admin dapat membuka kunci dengan alasan yang tercatat.</li>
          </ul>
          {onPilihLain && (
            <Button type="button" variant="outline" size="sm" onClick={onPilihLain} className="mt-1 gap-1 border-amber-400 bg-white" data-testid="btn-pilih-nama-lain">
              <UserRoundSearch className="h-4 w-4" /> Pilih nama lain
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
