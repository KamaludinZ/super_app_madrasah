import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { tambahPenanda, POLA_KODE_RUANG, rapikanKode, sarankanKodeRuang } from '@/lib/masterplan';

// Dialog penanda baru: posisi sudah dipilih dengan klik di denah, admin memilih ruang dari master ruangan.
// `draf` = {posisi_x, posisi_y} atau null (tertutup). Ruang yang sudah punya penanda tidak ditawarkan.
export default function PenandaBaruDialog({ draf, daftarRuang = [], markers = [], onClose, onTersimpan }) {
  const [roomId, setRoomId] = useState('');
  const [kode, setKode] = useState('');
  const [proses, setProses] = useState(false);

  useEffect(() => {
    if (!draf) return;
    setRoomId('');
    setKode(sarankanKodeRuang(markers));
  }, [draf]); // eslint-disable-line react-hooks/exhaustive-deps

  const kodeRapi = rapikanKode(kode);
  const kodeDipakai = markers.some((m) => m.kode_ruang === kodeRapi);
  const galatKode = !kodeRapi ? '' : !POLA_KODE_RUANG.test(kodeRapi)
    ? 'Huruf/angka, boleh titik atau tanda hubung, maks 12 karakter'
    : kodeDipakai ? `Kode ${kodeRapi} sudah dipakai penanda lain` : '';

  const terpakai = new Set(markers.map((m) => m.room_id));
  const tersedia = daftarRuang.filter((r) => !terpakai.has(r.id)).sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }));

  const simpan = async () => {
    if (!roomId || !draf || !kodeRapi || galatKode) return;
    setProses(true);
    try {
      const marker = await tambahPenanda({ room_id: roomId, kode_ruang: kodeRapi, ...draf });
      toast.success(`Penanda ${marker.kode_ruang} · ${marker.nama_ruang} ditambahkan`);
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
          <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="kode-penanda">Kode ruang</Label>
            <Input
              id="kode-penanda"
              value={kode}
              onChange={(e) => setKode(e.target.value.toUpperCase())}
              placeholder="mis. R-07A"
              maxLength={12}
              className="font-mono uppercase"
              aria-invalid={!!galatKode || undefined}
              data-testid="masterplan-kode-ruang"
            />
            {galatKode
              ? <p className="text-xs text-red-600" role="alert">{galatKode}</p>
              : <p className="text-xs text-slate-500">Tampil di penanda denah dan di keterangan saat denah diunduh.</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ruang-penanda">Nama ruang</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger id="ruang-penanda" data-testid="masterplan-pilih-ruang"><SelectValue placeholder="Pilih ruang dari master ruangan" /></SelectTrigger>
              <SelectContent>
                {tersedia.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={proses}>Batal</Button>
          <Button onClick={simpan} disabled={!roomId || !kodeRapi || !!galatKode || proses} className="bg-[#006837] hover:bg-[#005830]" data-testid="masterplan-simpan-penanda">
            {proses && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan penanda
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
