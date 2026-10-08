import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { tambahPenanda } from '@/lib/masterplan';

// Dialog penanda baru: posisi sudah dipilih dengan klik di denah, admin memilih ruang dari master ruangan.
// `draf` = {posisi_x, posisi_y} atau null (tertutup). Ruang yang sudah punya penanda tidak ditawarkan.
export default function PenandaBaruDialog({ draf, daftarRuang = [], markers = [], onClose, onTersimpan }) {
  const [roomId, setRoomId] = useState('');
  const [proses, setProses] = useState(false);

  useEffect(() => { if (draf) setRoomId(''); }, [draf]);

  const terpakai = new Set(markers.map((m) => m.room_id));
  const tersedia = daftarRuang.filter((r) => !terpakai.has(r.id)).sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }));

  const simpan = async () => {
    if (!roomId || !draf) return;
    setProses(true);
    try {
      const marker = await tambahPenanda({ room_id: roomId, ...draf });
      toast.success(`Penanda ${marker.nama_ruang} ditambahkan`);
      onTersimpan?.(marker);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || 'Gagal menambahkan penanda');
    } finally {
      setProses(false);
    }
  };

  return (
    <Dialog open={!!draf} onOpenChange={(o) => { if (!o && !proses) onClose(); }}>
      <DialogContent className="max-w-sm" data-testid="masterplan-penanda-baru">
        <DialogHeader>
          <DialogTitle>Penanda baru</DialogTitle>
          <DialogDescription>
            {draf ? `Posisi ${draf.posisi_x}% dari kiri, ${draf.posisi_y}% dari atas denah.` : ''}
          </DialogDescription>
        </DialogHeader>
        {tersedia.length === 0 ? (
          <p className="text-sm text-slate-600">Semua ruang di master ruangan sudah ditandai. Tambahkan ruang baru di menu Ruangan terlebih dahulu.</p>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="ruang-penanda">Ruang</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger id="ruang-penanda" data-testid="masterplan-pilih-ruang"><SelectValue placeholder="Pilih ruang dari master ruangan" /></SelectTrigger>
              <SelectContent>
                {tersedia.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={proses}>Batal</Button>
          <Button onClick={simpan} disabled={!roomId || proses} className="bg-[#006837] hover:bg-[#005830]" data-testid="masterplan-simpan-penanda">
            {proses && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan penanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
