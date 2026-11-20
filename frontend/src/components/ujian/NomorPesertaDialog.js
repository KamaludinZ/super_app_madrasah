import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hash, ListOrdered, Loader2, Save, IdCard } from 'lucide-react';
import { pesanGalat } from '@/lib/ujian';
import {
  NOMOR_PESERTA_MAKS, galatFormatNomor, galatNomorGanda, nomorBerurutan, simpanNomorPeserta,
} from '@/lib/ujianPeserta';

/**
 * Dialog input nomor peserta untuk semua peserta satu ruang. Validasi langsung: format, nomor ganda dalam ruang, dan
 * nomor yang sudah dipakai ruang lain (`nomorLain` = { NOMOR: nama }); server memvalidasi ulang keunikan per ujian.
 * Bantuan: isi berurutan (awalan + nomor urut) dan ambil "Nomor Peserta UM" dari data siswa bila ada.
 * `sasaran` = { ruang, peserta: [Peserta] } atau null.
 */
export default function NomorPesertaDialog({ ujianId, sasaran, nomorLain = {}, onTutup, onTersimpan }) {
  const [nomor, setNomor] = useState({});
  const [awalan, setAwalan] = useState('');
  const [mulai, setMulai] = useState(1);
  const [digit, setDigit] = useState(3);
  const [galatServer, setGalatServer] = useState({});
  const [menyimpan, setMenyimpan] = useState(false);
  const peserta = useMemo(() => sasaran?.peserta || [], [sasaran]);

  useEffect(() => {
    if (!sasaran) return;
    setNomor(Object.fromEntries(peserta.map((p) => [p.id, p.nomor_peserta || ''])));
    setGalatServer({});
    setAwalan(`${sasaran.ruang?.nama_ruang || ''}-`);
  }, [sasaran, peserta]);

  const isian = peserta.map((p) => ({ peserta_id: p.id, nomor_peserta: nomor[p.id] || '', nama: p.nama }));
  const ganda = galatNomorGanda(isian, nomorLain);
  const galatBaris = (id) => galatFormatNomor(nomor[id]) || ganda[id] || galatServer[id] || '';
  const adaGalat = peserta.some((p) => galatFormatNomor(nomor[p.id]) || ganda[p.id]);
  const berubah = peserta.filter((p) => (nomor[p.id] || '') !== (p.nomor_peserta || ''));
  const adaNomorUm = peserta.some((p) => p.nomor_peserta_um);

  const isiBerurutan = () => {
    const usul = nomorBerurutan(peserta.length, { awalan, mulai, digit });
    setNomor(Object.fromEntries(peserta.map((p, i) => [p.id, usul[i]])));
    setGalatServer({});
  };
  const pakaiNomorUm = () => {
    setNomor((n) => ({ ...n, ...Object.fromEntries(peserta.filter((p) => p.nomor_peserta_um).map((p) => [p.id, p.nomor_peserta_um])) }));
    setGalatServer({});
  };

  const simpan = async () => {
    setMenyimpan(true);
    try {
      const h = await simpanNomorPeserta(ujianId, sasaran.ruang.id, berubah.map((p) => ({ peserta_id: p.id, nomor_peserta: (nomor[p.id] || '').trim() })));
      if (h.disimpan) toast.success(`${h.disimpan} nomor peserta disimpan${h.tiruan ? ' (contoh)' : ''}`);
      if (h.galat?.length) {
        setGalatServer(Object.fromEntries(h.galat.map((g) => [g.peserta_id, g.pesan])));
        toast.warning(`${h.galat.length} nomor tidak disimpan — periksa baris bertanda merah`);
        onTersimpan?.({ tutup: false });
      } else {
        onTersimpan?.({ tutup: true });
      }
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menyimpan nomor peserta.'));
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Dialog open={!!sasaran} onOpenChange={(o) => { if (!o && !menyimpan) onTutup?.(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" data-testid="dialog-nomor-peserta">
        <DialogHeader>
          <DialogTitle>Nomor Peserta Ruang {sasaran?.ruang?.nama_ruang}</DialogTitle>
          <DialogDescription>Nomor peserta unik untuk satu ujian dan dipakai di daftar hadir, berita acara, serta lembar cetak.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500"><ListOrdered className="h-3.5 w-3.5" /> Isi berurutan</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-[1fr_6rem_6rem_auto] sm:items-end">
            <div className="col-span-3 space-y-1 sm:col-span-1">
              <Label htmlFor="nomor-awalan" className="text-xs">Awalan</Label>
              <Input id="nomor-awalan" value={awalan} maxLength={20} onChange={(e) => setAwalan(e.target.value)} placeholder="Mis. 01-" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nomor-mulai" className="text-xs">Mulai</Label>
              <Input id="nomor-mulai" type="number" min={0} value={mulai} onChange={(e) => setMulai(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nomor-digit" className="text-xs">Digit</Label>
              <Input id="nomor-digit" type="number" min={1} max={6} value={digit} onChange={(e) => setDigit(e.target.value)} />
            </div>
            <Button type="button" variant="outline" onClick={isiBerurutan} disabled={!peserta.length} className="gap-1" data-testid="btn-isi-berurutan">
              <Hash className="h-4 w-4" /> Isi
            </Button>
          </div>
          <p className="text-xs text-slate-500">Contoh hasil: {nomorBerurutan(2, { awalan, mulai, digit }).join(', ')}, …</p>
          {adaNomorUm && (
            <Button type="button" variant="ghost" size="sm" onClick={pakaiNomorUm} className="gap-1 px-2 text-[#006837]" data-testid="btn-pakai-nomor-um">
              <IdCard className="h-4 w-4" /> Pakai Nomor Peserta Ujian Madrasah dari data siswa
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-2 font-semibold">No</th>
                <th className="py-2 pr-2 font-semibold">Nama</th>
                <th className="py-2 pr-2 font-semibold">Kelas</th>
                <th className="py-2 font-semibold">No. Peserta</th>
              </tr>
            </thead>
            <tbody>
              {peserta.map((p, i) => {
                const galat = galatBaris(p.id);
                return (
                  <tr key={p.id} className="border-b border-slate-100 align-top last:border-0">
                    <td className="py-2 pr-2 text-slate-500">{i + 1}</td>
                    <td className="py-2 pr-2 text-slate-900">{p.nama}</td>
                    <td className="py-2 pr-2">{p.kelas}</td>
                    <td className="py-2">
                      <Input value={nomor[p.id] || ''} maxLength={NOMOR_PESERTA_MAKS}
                        onChange={(e) => { const v = e.target.value; setNomor((n) => ({ ...n, [p.id]: v })); setGalatServer((g) => ({ ...g, [p.id]: '' })); }}
                        aria-label={`Nomor peserta ${p.nama}`} aria-invalid={!!galat} aria-describedby={galat ? `galat-nomor-${p.id}` : undefined}
                        className={`h-9 min-w-[9rem] font-mono ${galat ? 'border-red-500' : ''}`} data-testid={`input-nomor-${p.id}`} />
                      {galat && <p id={`galat-nomor-${p.id}`} className="mt-1 text-xs text-red-600">{galat}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter className="gap-2 sm:items-center sm:justify-between">
          <span className="text-xs text-slate-500">{berubah.length} nomor berubah</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onTutup} disabled={menyimpan}>Batal</Button>
            <Button onClick={simpan} disabled={menyimpan || adaGalat || berubah.length === 0} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-nomor">
              {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan Nomor
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
