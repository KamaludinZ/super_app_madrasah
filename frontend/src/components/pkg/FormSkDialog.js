import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileBadge, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { simpanSk } from '@/lib/pkgKelola';

const KOSONG = { nomor_sk: '', tanggal_sk: '', tentang: '', periode_id: '' };

// Formulir tambah/ubah identitas SK PKG (nomor, tanggal, perihal, periode). Anggota diatur di halaman SK.
export default function FormSkDialog({ open, sk, periode = [], onClose, onTersimpan }) {
  const [form, setForm] = useState(KOSONG);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (open) setForm(sk ? { nomor_sk: sk.nomor_sk, tanggal_sk: sk.tanggal_sk, tentang: sk.tentang || '', periode_id: sk.periode_id } : KOSONG);
  }, [open, sk]);

  const ubah = (kunci) => (e) => setForm((f) => ({ ...f, [kunci]: e?.target ? e.target.value : e }));

  const simpan = async (e) => {
    e.preventDefault();
    setMenyimpan(true);
    try {
      const hasil = await simpanSk(form, sk?.id);
      toast.success(sk ? 'SK diperbarui' : 'SK ditambahkan');
      onTersimpan?.(hasil);
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan SK');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg" data-testid="pkg-form-sk">
        <form onSubmit={simpan} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileBadge className="h-5 w-5 text-[#006837]" /> {sk ? 'Ubah SK' : 'Tambah SK'} Penilaian Kinerja
            </DialogTitle>
            <DialogDescription className="text-left">
              SK menjadi dasar tim penilai dan guru yang dinilai pada satu periode PKG.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-sk-nomor">Nomor SK</Label>
            <Input id="pkg-sk-nomor" value={form.nomor_sk} onChange={ubah('nomor_sk')} placeholder="mis. B-123/Mts.10.05/KP.07.6/10/2026" required maxLength={120} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pkg-sk-tanggal">Tanggal SK</Label>
              <Input id="pkg-sk-tanggal" type="date" value={form.tanggal_sk} onChange={ubah('tanggal_sk')} required />
            </div>
            <div className="space-y-1.5">
              <Label>Periode PKG</Label>
              <Select value={form.periode_id} onValueChange={ubah('periode_id')}>
                <SelectTrigger data-testid="pkg-sk-periode"><SelectValue placeholder="Pilih periode" /></SelectTrigger>
                <SelectContent>
                  {periode.map((p) => <SelectItem key={p.id} value={p.id}>{p.nama_periode}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-sk-tentang">Tentang</Label>
            <Textarea id="pkg-sk-tentang" value={form.tentang} onChange={ubah('tentang')} rows={2} maxLength={300} placeholder="Tim Penilai Kinerja Guru ..." />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
            <Button type="submit" disabled={menyimpan} className="bg-[#006837] hover:bg-[#005830]" data-testid="pkg-sk-simpan">
              {menyimpan && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
