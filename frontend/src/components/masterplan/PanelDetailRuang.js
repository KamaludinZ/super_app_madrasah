import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DoorOpen, Loader2, X, Package, Boxes, MousePointerClick } from 'lucide-react';
import { ambilDetailRuang } from '@/lib/masterplan';

// Panel rincian ruang untuk penanda yang dipilih, dari master ruangan (rooms/sarpras):
// nama, keterangan, dan jumlah aset tetap/lancar di ruang tersebut.
export default function PanelDetailRuang({ marker, onTutup }) {
  const [detail, setDetail] = useState(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    setDetail(null);
    setGalat('');
    if (!marker?.room_id) return undefined;
    let batal = false;
    setMemuat(true);
    ambilDetailRuang(marker.room_id)
      .then((d) => { if (!batal) setDetail(d); })
      .catch(() => { if (!batal) setGalat('Data ruang tidak ditemukan di master ruangan.'); })
      .finally(() => { if (!batal) setMemuat(false); });
    return () => { batal = true; };
  }, [marker?.room_id]);

  if (!marker) {
    return (
      <Card className="h-full" data-testid="masterplan-detail-kosong">
        <CardContent className="flex h-full flex-col items-center justify-center p-6 text-center text-sm text-slate-500">
          <MousePointerClick className="mb-2 h-8 w-8 text-slate-300" />
          Pilih penanda di denah atau nama ruang di bawah untuk melihat rinciannya.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full" data-testid="masterplan-detail-ruang">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <DoorOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              {marker.kode_ruang && (
                <span className="mb-0.5 inline-block rounded bg-[#006837] px-1.5 py-0.5 font-mono text-xs font-bold text-white" data-testid="masterplan-detail-kode">
                  {marker.kode_ruang}
                </span>
              )}
              <h2 className="truncate font-semibold text-slate-900">{detail?.room?.name || marker.nama_ruang}</h2>
              <p className="text-xs text-slate-500">{marker.kode_ruang ? `Kode ruang ${marker.kode_ruang}` : 'Ruang di denah sekolah'}</p>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onTutup} aria-label="Tutup rincian ruang">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {memuat ? (
          <div className="py-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#006837]" /></div>
        ) : galat ? (
          <p className="text-sm text-slate-500">{galat}</p>
        ) : detail && (
          <>
            <p className="text-sm text-slate-700">{detail.room.description || 'Belum ada keterangan ruang.'}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><Package className="h-3.5 w-3.5" /> Aset tetap</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{detail.jumlah_aset_tetap}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><Boxes className="h-3.5 w-3.5" /> Aset lancar</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{detail.jumlah_aset_lancar}</p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
