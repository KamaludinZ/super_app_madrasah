import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowRightLeft, Loader2 } from 'lucide-react';
import { pesanGalat } from '@/lib/ujian';
import { ALASAN_PINDAH_MIN, pindahPeserta } from '@/lib/ujianPeserta';

/**
 * Dialog pindah ruang satu peserta. Siswa tetap satu baris peserta (dipindah, bukan digandakan) sehingga tidak
 * mungkin tercatat di dua ruang. Ruang tujuan hanya yang memuat jenjang siswa; ruang penuh tidak dapat dipilih.
 * Alasan wajib (perubahan plotting tercatat di jejak audit). `sasaran` = { peserta, ruangAsal } atau null.
 */
export default function PindahRuangDialog({ ujianId, sasaran, ruangList = [], onTutup, onTersimpan }) {
  const [tujuan, setTujuan] = useState('');
  const [alasan, setAlasan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const p = sasaran?.peserta;

  useEffect(() => { setTujuan(''); setAlasan(''); }, [sasaran]);

  const pilihan = ruangList.filter((r) => r.id !== sasaran?.ruangAsal?.id && p && r.jenjang.includes(p.jenjang));
  const alasanKurang = alasan.trim().length < ALASAN_PINDAH_MIN;

  const simpan = async () => {
    setMenyimpan(true);
    try {
      const h = await pindahPeserta(ujianId, p.id, tujuan, alasan.trim());
      const r = ruangList.find((x) => x.id === tujuan);
      toast.success(`${p.nama} dipindah ke Ruang ${r?.nama_ruang}${h.tiruan ? ' (contoh)' : ''}`);
      onTersimpan?.();
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal memindahkan peserta.'));
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Dialog open={!!sasaran} onOpenChange={(o) => { if (!o && !menyimpan) onTutup?.(); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-pindah-ruang">
        <DialogHeader>
          <DialogTitle>Pindah Ruang</DialogTitle>
          <DialogDescription>
            {p ? `${p.nama} (kelas ${p.kelas}) dari Ruang ${sasaran.ruangAsal?.nama_ruang}. Nomor peserta ikut pindah.` : ''}
          </DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Ruang tujuan</legend>
          {pilihan.length === 0 ? (
            <p className="text-sm text-slate-500">Tidak ada ruang lain yang memuat kelas {p?.jenjang}.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {pilihan.map((r) => {
                const penuh = r.jumlah_peserta >= r.kapasitas;
                return (
                  <label key={r.id} className={`flex flex-col rounded-lg border p-2 text-sm ${tujuan === r.id ? 'border-[#006837] bg-emerald-50' : 'border-slate-200'} ${penuh ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                    <span className="flex items-center gap-2 font-medium">
                      <input type="radio" name="ruang-tujuan" value={r.id} disabled={penuh} checked={tujuan === r.id} onChange={() => setTujuan(r.id)} className="accent-[#006837]" />
                      Ruang {r.nama_ruang}
                    </span>
                    <span className="text-xs text-slate-500">{penuh ? 'Penuh' : `${r.kapasitas - r.jumlah_peserta} kursi`}</span>
                  </label>
                );
              })}
            </div>
          )}
        </fieldset>
        <div className="space-y-1.5">
          <Label htmlFor="alasan-pindah">Alasan pemindahan<span className="text-red-500" aria-hidden="true"> *</span></Label>
          <Textarea id="alasan-pindah" rows={2} maxLength={200} value={alasan} onChange={(e) => setAlasan(e.target.value)}
            placeholder="Mis. Menyeimbangkan jumlah peserta ruang" data-testid="input-alasan-pindah" />
          <p className="text-xs text-slate-500">Minimal {ALASAN_PINDAH_MIN} karakter; tercatat di jejak audit.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onTutup} disabled={menyimpan}>Batal</Button>
          <Button onClick={simpan} disabled={menyimpan || !tujuan || alasanKurang} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-pindah">
            {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />} Pindahkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
