import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { ajukanResetPin } from '@/lib/simpanAkun';

const MAKS_KETERANGAN = 200;

// Modal pengajuan reset PIN Simpan Akun ke admin (pemilik lupa PIN).
export default function LupaPinDialog({ open, onClose, onTerkirim }) {
  const [keterangan, setKeterangan] = useState('');
  const [proses, setProses] = useState(false);

  useEffect(() => { if (open) setKeterangan(''); }, [open]);

  const kirim = async () => {
    setProses(true);
    try {
      const hasil = await ajukanResetPin(keterangan.trim());
      toast.success('Permintaan reset PIN dikirim ke admin');
      onTerkirim?.(hasil);
      onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || 'Gagal mengajukan reset PIN');
    } finally {
      setProses(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !proses) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="pin-lupa-dialog">
        <DialogHeader>
          <DialogTitle>Lupa PIN Simpan Akun?</DialogTitle>
          <DialogDescription>Ajukan reset PIN kepada admin.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-1.5 text-sm text-slate-700">
          <li>1. Permintaan Anda masuk ke daftar reset PIN admin.</li>
          <li>2. Setelah admin mereset, buka Simpan Akun dan buat PIN baru.</li>
          <li>3. Akun-akun yang Anda simpan tetap utuh.</li>
        </ol>
        <p className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Admin hanya dapat mereset PIN — admin tidak dapat melihat isi simpanan Anda.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="keterangan-reset">Keterangan untuk admin (opsional)</Label>
          <Textarea
            id="keterangan-reset"
            rows={2}
            maxLength={MAKS_KETERANGAN}
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            placeholder="Mis. lupa PIN setelah ganti HP"
          />
          <p className="text-right text-xs text-slate-400">{keterangan.length}/{MAKS_KETERANGAN}</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={proses}>Batal</Button>
          <Button onClick={kirim} disabled={proses} className="bg-[#006837] hover:bg-[#005830]" data-testid="pin-lupa-kirim">
            {proses && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Ajukan reset PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
