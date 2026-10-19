import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, ShieldCheck, ShieldAlert, Tag, Target, Loader2 } from 'lucide-react';
import { formatWIBPanjang } from '@/lib/datetime';
import { aktifkanInstrumen, daftarVersiInstrumen, labelVersi } from '@/lib/pkgInstrumen';

// Daftar versi instrumen (aktif + revisi lama) dengan label versi template, kecocokan template resmi,
// waktu impor, dan jumlah penilaian yang memakainya. `muatUlangKunci` berubah -> daftar dimuat ulang.
// Kepala (`onAktifkan` diisi) dapat menjadikan versi lain sebagai acuan dengan alasan.
export default function DaftarVersiInstrumen({ muatUlangKunci, onAktifkan }) {
  const [daftar, setDaftar] = useState([]);
  const [pilih, setPilih] = useState(null);
  const [alasan, setAlasan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  const aktifkan = async () => {
    if (!alasan.trim()) {
      toast.error('Alasan wajib diisi.');
      return;
    }
    setMenyimpan(true);
    try {
      const instrumen = await aktifkanInstrumen(pilih.id, alasan.trim());
      toast.success(`${labelVersi(instrumen)} menjadi acuan penilaian`);
      setPilih(null);
      onAktifkan?.(instrumen);
    } catch (e) {
      toast.error(e.message || 'Gagal menetapkan acuan');
    } finally {
      setMenyimpan(false);
    }
  };

  useEffect(() => {
    daftarVersiInstrumen().then(setDaftar).catch(() => setDaftar([]));
  }, [muatUlangKunci]);

  if (!daftar.length) return null;

  return (
    <Card data-testid="pkg-versi-instrumen">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4 text-[#006837]" /> Daftar Versi Instrumen</CardTitle>
        <p className="text-xs text-slate-500">Penilaian selalu memakai versi instrumen saat lembar dibuat; versi lama tetap tersimpan.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {daftar.map((v) => (
          <div key={v.id} className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center ${v.is_active ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`} data-testid={`pkg-versi-${v.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gap-1 bg-white text-slate-800 border-slate-300"><Tag className="h-3 w-3" /> {labelVersi(v)}</Badge>
              {v.is_active && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Aktif · acuan penilaian</Badge>}
              {v.cocok_resmi
                ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" /> Sesuai template resmi</span>
                : <span className="inline-flex items-center gap-1 text-xs text-amber-700"><ShieldAlert className="h-3.5 w-3.5" /> Diubah dari template resmi</span>}
            </div>
            <div className="text-xs text-slate-500 sm:ml-auto sm:text-right">
              {formatWIBPanjang(v.diimpor_pada)} · {v.dipakai_penilaian} penilaian
            </div>
            {onAktifkan && !v.is_active && (
              <Button size="sm" variant="outline" className="h-7 shrink-0 gap-1 text-xs" onClick={() => { setPilih(v); setAlasan(''); }}
                data-testid={`pkg-versi-aktifkan-${v.id}`}>
                <Target className="h-3 w-3" /> Jadikan acuan
              </Button>
            )}
          </div>
        ))}
      </CardContent>

      <Dialog open={!!pilih} onOpenChange={(o) => { if (!o && !menyimpan) setPilih(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Jadikan {labelVersi(pilih)} acuan</DialogTitle>
            <DialogDescription className="text-left">
              Lembar penilaian baru akan memakai versi ini. Lembar yang sudah dibuat tetap memakai versinya.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={3} maxLength={300} placeholder="Alasan (tercatat di jejak audit)" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPilih(null)} disabled={menyimpan}>Batal</Button>
            <Button onClick={aktifkan} disabled={menyimpan} className="bg-[#006837] hover:bg-[#005830]">
              {menyimpan && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Jadikan acuan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
