import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DoorOpen, Loader2 } from 'lucide-react';
import PapanIzinHariIni from '@/components/izin/PapanIzinHariIni';
import { formatWIBPanjang } from '@/lib/datetime';

/**
 * Panel pantau izin disetujui hari ini (kartu berjudul). Satu panel yang sama dipakai dashboard
 * satpam dan halaman pemantau kepala tata usaha — tanpa aksi apa pun.
 */
export default function PanelIzinHariIni({ items = [], tanggal, jam, memuat = false, className = '', onPilih, onCatat }) {
  return (
    <Card className={className} data-testid="panel-izin-hari-ini">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-[#006837]" /> Papan Izin Hari Ini
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              Izin disetujui kepala madrasah{tanggal ? ` · ${formatWIBPanjang(tanggal, false)}` : ''}
              {jam ? ` · pukul ${jam} WIB` : ''}
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 tabular-nums" data-testid="jumlah-izin-hari-ini">{items.length} izin</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {memuat && items.length === 0 ? (
          <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>
        ) : (
          <PapanIzinHariIni items={items} jam={jam} onPilih={onPilih} onCatat={onCatat} />
        )}
      </CardContent>
    </Card>
  );
}
