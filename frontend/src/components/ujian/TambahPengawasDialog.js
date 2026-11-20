import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { ROLE_LABELS } from '@/lib/api';
import { muatGtkPilihan, pesanGalat } from '@/lib/ujian';
import { tambahPengawas } from '@/lib/ujianPengawas';

/**
 * Dialog tambah guru pengawas: centang beberapa akun GTK sekaligus. GTK yang sudah menjadi pengawas ditandai dan
 * tidak dapat dipilih lagi. `sudah` = Set user_id pengawas yang ada. `onTersimpan()`.
 */
export default function TambahPengawasDialog({ buka, sudah, onTutup, onTersimpan }) {
  const [gtk, setGtk] = useState([]);
  const [memuat, setMemuat] = useState(false);
  const [cari, setCari] = useState('');
  const [dipilih, setDipilih] = useState(new Set());
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (!buka) return undefined;
    let hidup = true;
    setDipilih(new Set());
    setCari('');
    setMemuat(true);
    muatGtkPilihan()
      .then((h) => { if (hidup) setGtk(h.items); })
      .catch((e) => { if (hidup) toast.error(pesanGalat(e, 'Gagal memuat daftar GTK.')); })
      .finally(() => { if (hidup) setMemuat(false); });
    return () => { hidup = false; };
  }, [buka]);

  const tampil = useMemo(() => {
    const q = cari.toLowerCase().trim();
    return q ? gtk.filter((g) => `${g.nama} ${g.nip}`.toLowerCase().includes(q)) : gtk;
  }, [gtk, cari]);

  const ubah = (uid) => setDipilih((s) => { const n = new Set(s); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; });

  const simpan = async () => {
    setMenyimpan(true);
    try {
      const h = await tambahPengawas([...dipilih]);
      toast.success(`${h.ditambahkan} guru ditambahkan sebagai pengawas${h.dilewati?.length ? `, ${h.dilewati.length} dilewati` : ''}${h.tiruan ? ' (contoh)' : ''}`);
      onTersimpan?.();
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menambah pengawas.'));
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Dialog open={buka} onOpenChange={(o) => { if (!o && !menyimpan) onTutup?.(); }}>
      <DialogContent className="sm:max-w-lg" data-testid="dialog-tambah-pengawas">
        <DialogHeader>
          <DialogTitle>Tambah Guru Pengawas</DialogTitle>
          <DialogDescription>Pilih dari akun GTK yang sudah ada. Pengawas tidak diplot per ruang; mereka memilih namanya sendiri saat mengisi berita acara.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama atau NIP…" className="pl-9" aria-label="Cari GTK" data-testid="cari-gtk-pengawas" />
        </div>
        <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200" role="group" aria-label="Daftar akun GTK">
          {memuat ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat GTK…</div>
          ) : tampil.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">GTK tidak ditemukan.</p>
          ) : tampil.map((g) => {
            const ada = sudah?.has(g.user_id);
            return (
              <label key={g.user_id} className={`flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0 ${ada ? 'opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}>
                <input type="checkbox" className="h-4 w-4 accent-[#006837]" disabled={ada} checked={ada || dipilih.has(g.user_id)} onChange={() => ubah(g.user_id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-900">{g.nama}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {[g.nip && g.nip !== '-' ? `NIP ${g.nip}` : null, ROLE_LABELS[g.peran] || g.peran, ada ? 'sudah pengawas' : null].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <DialogFooter className="gap-2 sm:items-center sm:justify-between">
          <span className="text-xs text-slate-500">{dipilih.size} dipilih</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onTutup} disabled={menyimpan}>Batal</Button>
            <Button onClick={simpan} disabled={menyimpan || dipilih.size === 0} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-pengawas">
              {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Tambahkan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
