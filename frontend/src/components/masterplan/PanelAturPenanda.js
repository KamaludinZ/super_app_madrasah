import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, MapPin, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { ubahPenanda, hapusPenanda, POLA_KODE_RUANG, rapikanKode } from '@/lib/masterplan';

// Panel atur satu penanda (admin, mode atur): ganti ruang dari master ruangan atau hapus penanda.
// Menggeser posisi dilakukan langsung dengan menyeret penanda di denah.
export default function PanelAturPenanda({ marker, daftarRuang = [], markers = [], onBerubah, onTerhapus, onTutup }) {
  const [roomId, setRoomId] = useState(marker.room_id);
  const [kode, setKode] = useState(marker.kode_ruang || '');
  const [proses, setProses] = useState('');

  useEffect(() => setRoomId(marker.room_id), [marker.id, marker.room_id]);
  useEffect(() => setKode(marker.kode_ruang || ''), [marker.id, marker.kode_ruang]);

  const kodeRapi = rapikanKode(kode);
  const galatKode = !kodeRapi ? 'Kode ruang wajib diisi' : !POLA_KODE_RUANG.test(kodeRapi)
    ? 'Huruf/angka, boleh titik atau tanda hubung, maks 12 karakter'
    : markers.some((m) => m.id !== marker.id && m.kode_ruang === kodeRapi) ? `Kode ${kodeRapi} sudah dipakai penanda lain` : '';
  const berubah = roomId !== marker.room_id || kodeRapi !== (marker.kode_ruang || '');

  const terpakai = new Set(markers.filter((m) => m.id !== marker.id).map((m) => m.room_id));
  const pilihan = daftarRuang.filter((r) => !terpakai.has(r.id)).sort((a, b) => a.name.localeCompare(b.name, 'id', { numeric: true }));

  const gantiRuang = async () => {
    setProses('ganti');
    try {
      const hasil = await ubahPenanda(marker.id, { room_id: roomId, kode_ruang: kodeRapi });
      toast.success(`Penanda disimpan: ${hasil.kode_ruang} · ${hasil.nama_ruang}`);
      onBerubah(hasil);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setProses('');
    }
  };

  const hapus = async () => {
    const yakin = await confirmDialog(`Penanda ${marker.kode_ruang ? `${marker.kode_ruang} · ` : ''}${marker.nama_ruang} akan dihapus dari denah. Data ruang di master ruangan tidak terhapus.`, {
      title: 'Hapus penanda ruang?',
      confirmText: 'Ya, hapus penanda',
    });
    if (!yakin) return;
    setProses('hapus');
    try {
      await hapusPenanda(marker.id);
      toast.success(`Penanda ${marker.nama_ruang} dihapus`);
      onTerhapus(marker.id);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setProses('');
    }
  };

  return (
    <Card className="h-full border-amber-300" data-testid="masterplan-atur-penanda">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
              <MapPin className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-slate-900">
                {marker.kode_ruang && <span className="mr-1.5 font-mono">{marker.kode_ruang}</span>}
                {marker.nama_ruang}
              </h2>
              <p className="text-xs text-slate-500">Posisi {marker.posisi_x}% · {marker.posisi_y}% — seret di denah untuk menggeser</p>
            </div>
          </div>
          <Button size="icon" variant="ghost" onClick={onTutup} aria-label="Tutup pengaturan penanda">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="kode-ruang-atur">Kode ruang</Label>
          <Input
            id="kode-ruang-atur"
            value={kode}
            onChange={(e) => setKode(e.target.value.toUpperCase())}
            maxLength={12}
            className="font-mono uppercase"
            aria-invalid={!!galatKode || undefined}
            data-testid="masterplan-atur-kode"
          />
          {galatKode && <p className="text-xs text-red-600" role="alert">{galatKode}</p>}
          <Label htmlFor="ganti-ruang" className="block pt-2">Nama ruang</Label>
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger id="ganti-ruang" data-testid="masterplan-ganti-ruang"><SelectValue /></SelectTrigger>
            <SelectContent>
              {pilihan.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={gantiRuang}
            disabled={!!proses || !berubah || !!galatKode}
            data-testid="masterplan-simpan-ganti-ruang"
          >
            {proses === 'ganti' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan perubahan
          </Button>
        </div>

        <Button
          variant="ghost"
          className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={hapus}
          disabled={!!proses}
          data-testid="masterplan-hapus-penanda"
        >
          {proses === 'hapus' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          Hapus penanda
        </Button>
      </CardContent>
    </Card>
  );
}
