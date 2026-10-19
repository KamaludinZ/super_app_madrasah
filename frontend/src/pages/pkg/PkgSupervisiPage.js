import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { ShieldCheck, ShieldAlert, Lock, LockOpen, Loader2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { confirmDialog } from '@/components/ui/confirm-dialog';
import PenjagaMenuPkg from '@/components/pkg/PenjagaMenuPkg';
import { formatWIBPanjang } from '@/lib/datetime';
import { hariIniWIB } from '@/lib/tanggal';
import { batalkanSupervisi, daftarSupervisi, tandaiSupervisi } from '@/lib/pkgKelola';

function DialogTandai({ baris, onClose, onTersimpan }) {
  const [tanggal, setTanggal] = useState(hariIniWIB());
  const [catatan, setCatatan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (baris) {
      setTanggal(hariIniWIB());
      setCatatan('');
    }
  }, [baris]);

  const simpan = async (e) => {
    e.preventDefault();
    setMenyimpan(true);
    try {
      await tandaiSupervisi(baris.penilai.id, { tanggal_supervisi: tanggal, catatan });
      toast.success(`${baris.penilai.nama} ditandai sudah disupervisi`);
      onTersimpan();
    } catch (err) {
      toast.error(err.message || 'Gagal menandai supervisi');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Dialog open={!!baris} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md" data-testid="pkg-dialog-supervisi">
        {baris && (
          <form onSubmit={simpan} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#006837]" /> Tandai Supervisi</DialogTitle>
              <DialogDescription className="text-left">
                {baris.penilai.nama} dapat membuka lembar penilaian guru yang dibagikan setelah supervisi tercatat.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-sv-tanggal">Tanggal supervisi</Label>
              <Input id="pkg-sv-tanggal" type="date" value={tanggal} max={hariIniWIB()} onChange={(e) => setTanggal(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pkg-sv-catatan">Catatan (opsional)</Label>
              <Textarea id="pkg-sv-catatan" value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={3} maxLength={500} placeholder="mis. supervisi akademik di kelas 8B" />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
              <Button type="submit" disabled={menyimpan} className="bg-[#006837] hover:bg-[#005830]" data-testid="pkg-supervisi-simpan">
                {menyimpan && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Tandai sudah disupervisi
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function IsiHalamanSupervisi() {
  const [daftar, setDaftar] = useState(null);
  const [tandai, setTandai] = useState(null);
  const [membatalkan, setMembatalkan] = useState(null);

  const muat = useCallback(async () => setDaftar(await daftarSupervisi()), []);
  useEffect(() => { muat().catch(() => toast.error('Gagal memuat data supervisi')); }, [muat]);

  const batalkan = async (b) => {
    if (!(await confirmDialog(`Batalkan tanda supervisi ${b.penilai.nama}? Lembar penilaiannya akan terkunci kembali.`, { title: 'Batalkan Supervisi' }))) return;
    setMembatalkan(b.penilai.id);
    try {
      await batalkanSupervisi(b.penilai.id);
      toast.success('Tanda supervisi dibatalkan');
      await muat();
    } catch (e) {
      toast.error(e.message || 'Gagal membatalkan supervisi');
    } finally {
      setMembatalkan(null);
    }
  };

  const selesai = daftar?.filter((b) => b.supervisi_selesai).length || 0;

  return (
    <Card data-testid="pkg-supervisi">
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#006837]" /> Supervisi Penilai</CardTitle>
          <p className="text-xs text-slate-500 mt-1">Penilai wajib disupervisi kepala madrasah sebelum lembar penilaian guru yang dibagikan dapat dibuka. Kepala madrasah tidak memerlukan supervisi.</p>
        </div>
        {daftar && <Badge variant="outline" className="shrink-0 tabular-nums">{selesai}/{daftar.length} tersupervisi</Badge>}
      </CardHeader>
      <CardContent className="space-y-2">
        {!daftar && <div className="py-10 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#006837]" /></div>}
        {daftar?.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Belum ada penilai (selain kepala) di SK aktif periode berjalan.</p>}
        {daftar?.map((b) => (
          <div key={b.penilai.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center" data-testid={`pkg-supervisi-${b.penilai.id}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{b.penilai.nama}</span>
                {b.supervisi_selesai
                  ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1"><ShieldCheck className="h-3 w-3" /> Sudah disupervisi</Badge>
                  : <Badge className="bg-amber-100 text-amber-800 border-amber-200 gap-1"><ShieldAlert className="h-3 w-3" /> Belum disupervisi</Badge>}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {b.jumlah_guru} guru dibagikan ·{' '}
                {b.supervisi_selesai ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700"><LockOpen className="h-3 w-3" /> Lembar penilaian terbuka</span>
                ) : (
                  <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Lembar penilaian terkunci</span>
                )}
              </div>
              {b.supervisi_selesai && (
                <div className="mt-1 text-xs text-slate-500">
                  {formatWIBPanjang(b.tanggal_supervisi, false)}{b.disupervisi_oleh ? ` · oleh ${b.disupervisi_oleh}` : ''}{b.catatan ? ` · ${b.catatan}` : ''}
                </div>
              )}
            </div>
            {b.supervisi_selesai ? (
              <Button size="sm" variant="ghost" className="h-8 gap-1 shrink-0" onClick={() => batalkan(b)} disabled={membatalkan === b.penilai.id} data-testid={`pkg-supervisi-batal-${b.penilai.id}`}>
                {membatalkan === b.penilai.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />} Batalkan
              </Button>
            ) : (
              <Button size="sm" className="h-8 gap-1 shrink-0 bg-[#006837] hover:bg-[#005830]" onClick={() => setTandai(b)} data-testid={`pkg-supervisi-tandai-${b.penilai.id}`}>
                <ShieldCheck className="h-3.5 w-3.5" /> Tandai disupervisi
              </Button>
            )}
          </div>
        ))}
      </CardContent>

      <DialogTandai baris={tandai} onClose={() => setTandai(null)} onTersimpan={async () => { setTandai(null); await muat(); }} />
    </Card>
  );
}

// Penandaan supervisi penilai (khusus kepala madrasah) sebagai gerbang pembukaan lembar penilaian.
// Data dari lib/pkgKelola (/pkg/supervisi).
export default function PkgSupervisiPage() {
  return (
    <PenjagaMenuPkg menuKey="supervisi">
      <IsiHalamanSupervisi />
    </PenjagaMenuPkg>
  );
}
