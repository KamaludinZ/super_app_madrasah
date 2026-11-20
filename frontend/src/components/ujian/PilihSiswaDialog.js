import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { pesanGalat } from '@/lib/ujian';
import { labelJenjang } from '@/lib/ujianRuang';
import { muatKandidat, tambahPeserta } from '@/lib/ujianPeserta';

/**
 * Dialog pilih siswa untuk satu ruang: pilih kelas (hanya rombel berjenjang sama dengan ruang), lalu centang siswa
 * dari data siswa yang sudah ada. Siswa yang sudah ditempatkan di ruang lain ditandai dan tidak dapat dipilih.
 * `ruang` = Ruang atau null (tertutup). `onTersimpan(hasil)`.
 */
export default function PilihSiswaDialog({ ujianId, ruang, sisaKapasitas, onTutup, onTersimpan }) {
  const [kelas, setKelas] = useState([]);
  const [kelasId, setKelasId] = useState('');
  const [siswa, setSiswa] = useState([]);
  const [memuat, setMemuat] = useState(false);
  const [cari, setCari] = useState('');
  const [dipilih, setDipilih] = useState(new Set());
  const [menyimpan, setMenyimpan] = useState(false);

  // Kelas yang jenjangnya ada di ruang ini.
  useEffect(() => {
    if (!ruang) return undefined;
    let hidup = true;
    setKelasId('');
    setSiswa([]);
    setDipilih(new Set());
    setCari('');
    muatKandidat(ujianId)
      .then((h) => {
        if (!hidup) return;
        const cocok = h.kelas.filter((k) => ruang.jenjang.includes(k.jenjang));
        setKelas(cocok);
        if (cocok.length) setKelasId(cocok[0].id);
      })
      .catch((e) => { if (hidup) toast.error(pesanGalat(e, 'Gagal memuat daftar kelas.')); });
    return () => { hidup = false; };
  }, [ruang, ujianId]);

  useEffect(() => {
    if (!kelasId) return undefined;
    let hidup = true;
    setMemuat(true);
    muatKandidat(ujianId, kelasId)
      .then((h) => { if (hidup) setSiswa(h.items); })
      .catch((e) => { if (hidup) toast.error(pesanGalat(e, 'Gagal memuat siswa.')); })
      .finally(() => { if (hidup) setMemuat(false); });
    return () => { hidup = false; };
  }, [kelasId, ujianId]);

  const tampil = useMemo(() => {
    const q = cari.toLowerCase().trim();
    return q ? siswa.filter((s) => `${s.nama} ${s.nis} ${s.nisn}`.toLowerCase().includes(q)) : siswa;
  }, [siswa, cari]);
  const bebas = tampil.filter((s) => !s.ruang_id);
  const semuaDipilih = bebas.length > 0 && bebas.every((s) => dipilih.has(s.siswa_id));

  const ubah = (sid) => setDipilih((d) => { const n = new Set(d); if (n.has(sid)) n.delete(sid); else n.add(sid); return n; });
  const pilihSemua = () => setDipilih((d) => {
    const n = new Set(d);
    bebas.forEach((s) => (semuaDipilih ? n.delete(s.siswa_id) : n.add(s.siswa_id)));
    return n;
  });

  const simpan = async () => {
    setMenyimpan(true);
    try {
      const h = await tambahPeserta(ujianId, ruang.id, [...dipilih]);
      if (h.ditambahkan) toast.success(`${h.ditambahkan} siswa ditempatkan di Ruang ${ruang.nama_ruang}${h.tiruan ? ' (contoh)' : ''}`);
      if (h.dilewati?.length) toast.warning(`${h.dilewati.length} siswa dilewati: ${h.dilewati.slice(0, 3).map((d) => `${d.nama} (${d.alasan})`).join('; ')}${h.dilewati.length > 3 ? '; …' : ''}`);
      onTersimpan?.(h);
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menempatkan siswa.'));
    } finally {
      setMenyimpan(false);
    }
  };

  const melebihi = sisaKapasitas !== undefined && dipilih.size > sisaKapasitas;

  return (
    <Dialog open={!!ruang} onOpenChange={(o) => { if (!o && !menyimpan) onTutup?.(); }}>
      <DialogContent className="sm:max-w-xl" data-testid="dialog-pilih-siswa">
        <DialogHeader>
          <DialogTitle>Tambah Peserta Ruang {ruang?.nama_ruang}</DialogTitle>
          <DialogDescription>
            {ruang ? `${labelJenjang(ruang.jenjang)} · sisa kapasitas ${sisaKapasitas ?? '-'} kursi.` : ''} Pilih kelas lalu centang siswanya.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="pilih-kelas-peserta" className="sr-only">Kelas</label>
          <select id="pilih-kelas-peserta" value={kelasId} onChange={(e) => { setKelasId(e.target.value); setDipilih(new Set()); }}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] sm:w-44"
            data-testid="pilih-kelas-peserta">
            {kelas.length === 0 && <option value="">Tidak ada kelas</option>}
            {kelas.map((k) => <option key={k.id} value={k.id}>Kelas {k.nama} ({k.jumlah_siswa})</option>)}
          </select>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari nama, NIS, atau NISN…" className="pl-9" aria-label="Cari siswa" />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
          {bebas.length > 0 && (
            <label className="sticky top-0 z-10 flex cursor-pointer items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <input type="checkbox" className="h-4 w-4 accent-[#006837]" checked={semuaDipilih} onChange={pilihSemua} data-testid="cek-semua-siswa" />
              Pilih semua yang belum ditempatkan ({bebas.length})
            </label>
          )}
          {memuat ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Memuat siswa…</div>
          ) : tampil.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">{kelasId ? 'Siswa tidak ditemukan.' : 'Pilih kelas terlebih dahulu.'}</p>
          ) : tampil.map((s) => {
            const sudah = !!s.ruang_id;
            return (
              <label key={s.siswa_id} className={`flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0 ${sudah ? 'opacity-60' : 'cursor-pointer hover:bg-slate-50'}`}>
                <input type="checkbox" className="h-4 w-4 accent-[#006837]" disabled={sudah} checked={sudah || dipilih.has(s.siswa_id)} onChange={() => ubah(s.siswa_id)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-slate-900">{s.nama}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {[`Kelas ${s.kelas}`, s.nis && `NIS ${s.nis}`, sudah && `sudah di Ruang ${s.ruang_nama}`].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        <DialogFooter className="gap-2 sm:items-center sm:justify-between">
          <span className={`text-xs ${melebihi ? 'font-medium text-amber-700' : 'text-slate-500'}`}>
            {dipilih.size} dipilih{melebihi ? ` — melebihi sisa kapasitas (${sisaKapasitas})` : ''}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onTutup} disabled={menyimpan}>Batal</Button>
            <Button onClick={simpan} disabled={menyimpan || dipilih.size === 0} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-peserta">
              {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Tempatkan
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
