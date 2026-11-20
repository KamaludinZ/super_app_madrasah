import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Lock, Save } from 'lucide-react';
import { pesanGalat } from '@/lib/ujian';
import { galatNilai, muatNilaiKelas, simpanNilaiKelas } from '@/lib/ujianNilai';

/**
 * Form edit nilai UAS satu kelas & mapel. Bila terkunci (di luar masa ujian/remidi atau pengguna hanya memantau), semua
 * isian dinonaktifkan dan alasan kunci ditampilkan. Nilai yang disimpan langsung tampil di kolom UAS rapor & akun guru.
 * `sasaran` = { kelas, mapel } atau null.
 */
export default function FormEditNilaiKelas({ ujianId, sasaran, onTutup, onTersimpan }) {
  const [data, setData] = useState(null);
  const [nilai, setNilai] = useState({});
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (!sasaran) { setData(null); return undefined; }
    let hidup = true;
    muatNilaiKelas(ujianId, sasaran.kelas.kelas_id || sasaran.kelas.id, sasaran.mapel.id).then((d) => {
      if (!hidup) return;
      setData(d);
      setNilai(Object.fromEntries(d.items.map((x) => [x.siswa_id, x.nilai ?? ''])));
    }).catch((e) => toast.error(pesanGalat(e, 'Gagal memuat nilai kelas.')));
    return () => { hidup = false; };
  }, [ujianId, sasaran]);

  const terkunci = data && !data.boleh_ubah;
  const berubah = (data?.items || []).filter((x) => String(nilai[x.siswa_id] ?? '') !== String(x.nilai ?? ''));
  const adaGalat = berubah.some((x) => galatNilai(nilai[x.siswa_id]));

  const simpan = async () => {
    setMenyimpan(true);
    try {
      const h = await simpanNilaiKelas(ujianId, sasaran.kelas.kelas_id || sasaran.kelas.id, sasaran.mapel.id,
        berubah.map((x) => ({ siswa_id: x.siswa_id, nilai: nilai[x.siswa_id] === '' ? null : Number(nilai[x.siswa_id]) })));
      toast.success(`${h.disimpan} nilai UAS disimpan${h.tiruan ? ' (contoh)' : ''}`);
      onTersimpan?.();
    } catch (e) {
      toast.error(pesanGalat(e, 'Gagal menyimpan nilai.'));
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Dialog open={!!sasaran} onOpenChange={(o) => { if (!o && !menyimpan) onTutup(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl" data-testid="form-edit-nilai">
        <DialogHeader>
          <DialogTitle>Nilai UAS {sasaran?.mapel?.nama} · Kelas {sasaran?.kelas?.nama}</DialogTitle>
          <DialogDescription>Skala 0–100. Kosongkan untuk menghapus nilai.</DialogDescription>
        </DialogHeader>
        {terkunci && (
          <p className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700" role="status" data-testid="nilai-terkunci">
            <Lock className="h-4 w-4 shrink-0" /> Nilai terkunci{data.alasan_kunci ? `: ${data.alasan_kunci}` : '.'}
          </p>
        )}
        {!data ? <div className="p-6 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-[#006837]" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2 font-semibold">No</th><th className="py-2 pr-2 font-semibold">Nama</th>
                  <th className="py-2 pr-2 font-semibold">Nilai UAS</th><th className="py-2 font-semibold">Sumber</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((x, i) => {
                  const galat = galatNilai(nilai[x.siswa_id]);
                  return (
                    <tr key={x.siswa_id} className="border-b border-slate-100 last:border-0">
                      <td className="py-1.5 pr-2 text-slate-500">{i + 1}</td>
                      <td className="py-1.5 pr-2">{x.nama}{x.nis && <span className="ml-1 text-xs text-slate-400">· {x.nis}</span>}</td>
                      <td className="py-1.5 pr-2">
                        <Input type="number" min={0} max={100} step="0.5" value={nilai[x.siswa_id] ?? ''} disabled={terkunci || menyimpan}
                          onChange={(e) => setNilai((n) => ({ ...n, [x.siswa_id]: e.target.value }))} aria-invalid={!!galat}
                          aria-label={`Nilai UAS ${x.nama}`} className={`h-9 w-24 ${galat ? 'border-red-500' : ''}`} />
                        {galat && <span className="ml-1 text-xs text-red-600">{galat}</span>}
                      </td>
                      <td className="py-1.5 text-xs text-slate-500">{x.sumber ? `${x.sumber}${x.diedit_oleh_nama ? ` · ${x.diedit_oleh_nama}` : ''}` : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onTutup} disabled={menyimpan}>Tutup</Button>
          {!terkunci && (
            <Button onClick={simpan} disabled={menyimpan || !berubah.length || adaGalat} className="gap-2 bg-[#006837] hover:bg-[#00552d]" data-testid="btn-simpan-nilai-kelas">
              {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan {berubah.length ? `(${berubah.length})` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
