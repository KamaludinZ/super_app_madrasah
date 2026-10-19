import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';

// Ceklist akun guru untuk anggota SK (tim penilai / guru yang dinilai).
// `guru` = [{ id, full_name, nip, mapel? }]; `terkunci` = { [id]: keterangan } selalu tercentang & tidak bisa
// dilepas (mis. kepala madrasah sebagai penilai); `perluAlasan` = penilaian sudah berjalan sehingga perubahan
// wajib disertai alasan; `onSimpan(ids, alasan)` mengembalikan Promise.
export default function CeklistGuruDialog({
  open, judul, deskripsi, icon: Icon, guru = [], terpilih = [], terkunci = {}, perluAlasan = false, onClose, onSimpan, testid,
}) {
  const [pilih, setPilih] = useState(new Set());
  const [cari, setCari] = useState('');
  const [alasan, setAlasan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (open) {
      setPilih(new Set([...terpilih, ...Object.keys(terkunci)]));
      setCari('');
      setAlasan('');
    }
  }, [open, terpilih, terkunci]);

  const tampil = useMemo(() => {
    const kata = cari.trim().toLowerCase();
    return guru.filter((g) => !kata || [g.full_name, g.nip, g.mapel].some((v) => (v || '').toLowerCase().includes(kata)));
  }, [guru, cari]);

  const semuaTampilTerpilih = tampil.length > 0 && tampil.every((g) => pilih.has(g.id));

  const alih = (id) => {
    if (terkunci[id]) return;
    setPilih((p) => {
      const baru = new Set(p);
      if (baru.has(id)) baru.delete(id); else baru.add(id);
      return baru;
    });
  };

  const alihSemua = () => {
    setPilih((p) => {
      const baru = new Set(p);
      tampil.forEach((g) => {
        if (terkunci[g.id]) return;
        if (semuaTampilTerpilih) baru.delete(g.id); else baru.add(g.id);
      });
      return baru;
    });
  };

  const simpan = async () => {
    if (perluAlasan && !alasan.trim()) {
      toast.error('Penilaian sudah berjalan: isi alasan perubahan.');
      return;
    }
    setMenyimpan(true);
    try {
      await onSimpan([...pilih], alasan.trim());
    } catch (e) {
      toast.error(e.message || 'Gagal menyimpan');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col" data-testid={testid}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-[#006837]" />} {judul}
          </DialogTitle>
          {deskripsi && <DialogDescription className="text-left">{deskripsi}</DialogDescription>}
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, NIP, atau mapel" className="pl-8 h-9" />
          </div>
          <Badge variant="outline" className="shrink-0 tabular-nums" data-testid={`${testid}-jumlah`}>{pilih.size} dipilih</Badge>
        </div>

        <label className="flex items-center gap-2 border-b border-slate-100 px-1 pb-2 text-sm text-slate-600">
          <Checkbox checked={semuaTampilTerpilih} onCheckedChange={alihSemua} disabled={tampil.length === 0} />
          Pilih semua {cari ? 'hasil pencarian' : ''} ({tampil.length})
        </label>

        <div className="-mx-1 flex-1 overflow-y-auto px-1 min-h-[160px]">
          {guru.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Belum ada akun guru aktif.</p>}
          {guru.length > 0 && tampil.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Tidak ada guru yang cocok.</p>}
          {tampil.map((g) => (
            <label
              key={g.id}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 ${terkunci[g.id] ? 'cursor-default' : 'cursor-pointer hover:bg-slate-50'}`}
              data-testid={`${testid}-guru-${g.id}`}
            >
              <Checkbox checked={pilih.has(g.id)} onCheckedChange={() => alih(g.id)} disabled={!!terkunci[g.id]} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-900 truncate">{g.full_name}</div>
                <div className="text-xs text-slate-500">{g.mapel ? `${g.mapel} · ` : ''}NIP {g.nip || '-'}</div>
              </div>
              {terkunci[g.id] && (
                <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-slate-500"><Lock className="h-3 w-3" /> {terkunci[g.id]}</span>
              )}
            </label>
          ))}
        </div>

        {perluAlasan && (
          <div className="space-y-1">
            <label htmlFor={`${testid}-alasan`} className="text-xs font-medium text-amber-800">
              Penilaian sudah berjalan — alasan perubahan (tercatat di jejak audit)
            </label>
            <Textarea id={`${testid}-alasan`} value={alasan} onChange={(e) => setAlasan(e.target.value)} rows={2} maxLength={300} />
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>Batal</Button>
          <Button type="button" onClick={simpan} disabled={menyimpan} className="bg-[#006837] hover:bg-[#005830]" data-testid={`${testid}-simpan`}>
            {menyimpan && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
