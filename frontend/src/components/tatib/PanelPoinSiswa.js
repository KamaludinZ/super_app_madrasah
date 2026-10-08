import React, { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import RingkasanPoin, { rangkumPoin } from '@/components/tatib/RingkasanPoin';
import RiwayatPoin from '@/components/tatib/RiwayatPoin';
import RincianPoinDialog from '@/components/tatib/RincianPoinDialog';

// Panel samping saldo & riwayat poin satu siswa, dihitung dari daftar catatan
// yang sudah dimuat halaman (kebaikan + pelanggaran).
export default function PanelPoinSiswa({ siswa, records = [], onClose }) {
  const [dipilih, setDipilih] = useState(null);
  const milikSiswa = useMemo(() => records.filter((r) => siswa && r.siswa_id === siswa.id), [records, siswa]);
  const ringkasan = rangkumPoin(milikSiswa);

  return (
    <>
      <Sheet open={!!siswa} onOpenChange={(o) => { if (!o) onClose(); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="panel-poin-siswa">
          {siswa && (
            <div className="space-y-5">
              <SheetHeader>
                <SheetTitle>{siswa.nama}</SheetTitle>
                <SheetDescription>{[siswa.nis && `NIS ${siswa.nis}`, siswa.kelas].filter(Boolean).join(' · ') || 'Poin tata tertib'}</SheetDescription>
              </SheetHeader>
              <RingkasanPoin {...ringkasan} />
              <RiwayatPoin records={milikSiswa} onPilih={setDipilih} />
            </div>
          )}
        </SheetContent>
      </Sheet>
      <RincianPoinDialog catatan={dipilih} onClose={() => setDipilih(null)} />
    </>
  );
}
