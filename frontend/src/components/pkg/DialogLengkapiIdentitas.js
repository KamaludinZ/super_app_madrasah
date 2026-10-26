import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import PanelIdentitasPkg from '@/components/pkg/PanelIdentitasPkg';

// Dialog "Lengkapi identitas" satu guru untuk laporan PKG, dipakai kepala madrasah/penilai (daftar tugas penilaian,
// tab Identitas rekap guru). Akses ditentukan backend (kepala: semua guru SK; penilai: guru yang dibagikan) dan
// ditampilkan sebagai pesan bila ditolak. `onTersimpan(data)` dipanggil setelah simpan (muat ulang tampilan induk).
export default function DialogLengkapiIdentitas({ open, onOpenChange, guruId, nama, onTersimpan }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1.5rem)] max-w-2xl overflow-y-auto" data-testid="pkg-dialog-lengkapi-identitas">
        <DialogHeader>
          <DialogTitle>Lengkapi identitas{nama ? ` — ${nama}` : ''}</DialogTitle>
          <DialogDescription>
            Isian ini tercetak pada lampiran identitas laporan PKG periode berjalan. Laporan periode yang sudah ditutup tidak berubah.
          </DialogDescription>
        </DialogHeader>
        {open && guruId && <PanelIdentitasPkg guruId={guruId} onTersimpan={onTersimpan} />}
      </DialogContent>
    </Dialog>
  );
}
