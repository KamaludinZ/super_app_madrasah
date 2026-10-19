import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Pencil, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BATAS_INSTRUMEN, ubahSubKompetensi, validasiUbahSub } from '@/lib/pkgInstrumen';

function PesanGalat({ id, teks }) {
  return teks ? <p id={id} className="text-xs text-rose-600">{teks}</p> : null;
}

// Ubah satu sub-kompetensi instrumen aktif (khusus kepala): nama, bobot, teks indikator Level 1–5, dan alasan.
// Validasi sama dengan backend; galat tampil per isian setelah pengguna mencoba menyimpan.
export default function UbahSubKompetensiDialog({ sub, onClose, onTersimpan }) {
  const [isian, setIsian] = useState(null);
  const [coba, setCoba] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (sub) {
      setIsian({ nama: sub.nama, bobot: String(sub.bobot ?? ''), indikator: sub.indikator.map((i) => ({ ...i })), alasan: '' });
      setCoba(false);
    }
  }, [sub]);

  if (!sub || !isian) return null;
  const galat = coba ? validasiUbahSub(isian) : {};
  const ubah = (kunci) => (e) => setIsian((x) => ({ ...x, [kunci]: e.target.value }));
  const ubahIndikator = (level) => (e) => setIsian((x) => ({
    ...x, indikator: x.indikator.map((i) => (i.level === level ? { ...i, teks: e.target.value } : i)),
  }));
  const aria = (kunci) => (galat[kunci] ? { 'aria-invalid': true, 'aria-describedby': `galat-${kunci}` } : {});

  const simpan = async (e) => {
    e.preventDefault();
    setCoba(true);
    if (Object.keys(validasiUbahSub(isian)).length) return;
    setMenyimpan(true);
    try {
      const instrumen = await ubahSubKompetensi(sub.kode, isian);
      toast.success(`Sub-kompetensi ${sub.kode} diperbarui`);
      onTersimpan?.(instrumen);
    } catch (err) {
      toast.error(err.message || 'Gagal menyimpan perubahan');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Dialog open={!!sub} onOpenChange={(o) => { if (!o && !menyimpan) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="pkg-ubah-sub">
        <form onSubmit={simpan} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-[#006837]" /> Ubah Sub-kompetensi {sub.kode}</DialogTitle>
            <DialogDescription className="text-left">
              Bila instrumen sudah dipakai penilaian, perubahan disimpan sebagai revisi baru sehingga penilaian lama tetap utuh.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-3">
            <div className="space-y-1">
              <Label htmlFor="ubah-nama">Nama sub-kompetensi</Label>
              <Input id="ubah-nama" value={isian.nama} onChange={ubah('nama')} maxLength={BATAS_INSTRUMEN.nama} {...aria('nama')} />
              <PesanGalat id="galat-nama" teks={galat.nama} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ubah-bobot">Bobot</Label>
              <Input id="ubah-bobot" inputMode="decimal" value={isian.bobot} onChange={ubah('bobot')} className="tabular-nums" {...aria('bobot')} />
              <PesanGalat id="galat-bobot" teks={galat.bobot} />
            </div>
          </div>

          <div className="space-y-3">
            {isian.indikator.map((i) => (
              <div key={i.level} className="space-y-1">
                <Label htmlFor={`ubah-indikator-${i.level}`}>Indikator Level {i.level}</Label>
                <Textarea
                  id={`ubah-indikator-${i.level}`}
                  value={i.teks}
                  onChange={ubahIndikator(i.level)}
                  rows={2}
                  maxLength={BATAS_INSTRUMEN.teks}
                  {...aria(`indikator_${i.level}`)}
                />
                <PesanGalat id={`galat-indikator_${i.level}`} teks={galat[`indikator_${i.level}`]} />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <Label htmlFor="ubah-alasan">Alasan perubahan</Label>
            <Textarea id="ubah-alasan" value={isian.alasan} onChange={ubah('alasan')} rows={2} maxLength={BATAS_INSTRUMEN.alasan}
              placeholder="mis. penyesuaian redaksi sesuai juknis terbaru" {...aria('alasan')} />
            <PesanGalat id="galat-alasan" teks={galat.alasan} />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={menyimpan}>Batal</Button>
            <Button type="submit" disabled={menyimpan} className="bg-[#006837] hover:bg-[#005830]" data-testid="pkg-ubah-sub-simpan">
              {menyimpan && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Simpan perubahan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
