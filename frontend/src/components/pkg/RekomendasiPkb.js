import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GraduationCap, Lightbulb, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import BadgeStatusPenilaian from '@/components/pkg/BadgeStatusPenilaian';
import { ambilRekomendasiGuru, opsiPkb, ringkasanPkb, simpanRekomendasi } from '@/lib/pkgRekomendasi';

const PERAN = { kepala: 'Kepala madrasah', penilai: 'Penilai' };

// Dialog pilih opsi baku / isi bebas rekomendasi PKB satu guru; saran opsi disesuaikan level guru.
function DialogRekomendasi({ guru, periodeId, opsi, onTutup, onTersimpan }) {
  const [data, setData] = useState(null);
  const [pilihan, setPilihan] = useState([]);
  const [fokus, setFokus] = useState([]);
  const [catatan, setCatatan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  useEffect(() => {
    if (!guru) return;
    setData(null);
    ambilRekomendasiGuru(guru.guru_id, periodeId).then((d) => {
      setData(d);
      setPilihan(d.rekomendasi?.pilihan_pkb || []);
      setFokus(d.rekomendasi?.fokus_kompetensi || []);
      setCatatan(d.rekomendasi?.catatan || '');
    }).catch((e) => { toast.error(e.message); onTutup(); });
  }, [guru, periodeId, onTutup]);

  const alih = (daftar, setDaftar, kode) => setDaftar(daftar.includes(kode) ? daftar.filter((k) => k !== kode) : [...daftar, kode]);
  const bolehUbah = data?.periode?.status === 'berjalan';
  const simpan = async () => {
    setMenyimpan(true);
    try {
      await simpanRekomendasi(guru.guru_id, { periodeId: data.periode.id, pilihan, fokus, catatan });
      toast.success('Rekomendasi PKB disimpan');
      onTersimpan();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <Dialog open={!!guru} onOpenChange={(buka) => !buka && onTutup()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="pkg-dialog-pkb">
        <DialogHeader>
          <DialogTitle>Rekomendasi PKB · {guru?.nama}</DialogTitle>
          <DialogDescription>Pilih opsi baku dan/atau tulis rekomendasi bebas; teks tampil di rekap dan berkas laporan PKG.</DialogDescription>
        </DialogHeader>
        {!data ? <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-[#006837]" /></div> : (
          <div className="space-y-4">
            {data.level_acuan && (
              <p className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                Level guru {data.level_acuan}; opsi bertanda "disarankan" sesuai rubrik capaian (level rendah dibimbing, level tinggi mengimbaskan).
              </p>
            )}
            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-semibold text-slate-900">Kegiatan PKB</legend>
              {opsi.opsi.map((o) => (
                <label key={o.kode} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2 text-sm hover:bg-slate-50">
                  <Checkbox checked={pilihan.includes(o.kode)} disabled={!bolehUbah} onCheckedChange={() => alih(pilihan, setPilihan, o.kode)}
                    data-testid={`pkg-pkb-opsi-${o.kode}`} className="mt-0.5" />
                  <span className="flex-1 text-slate-800">{o.label}</span>
                  {data.saran.includes(o.kode) && <Badge variant="outline" className="shrink-0 border-emerald-300 text-emerald-700">disarankan</Badge>}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend className="mb-1 text-sm font-semibold text-slate-900">Fokus kompetensi</legend>
              <div className="flex flex-wrap gap-3">
                {opsi.fokus.map((f) => (
                  <label key={f.kode} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={fokus.includes(f.kode)} disabled={!bolehUbah} onCheckedChange={() => alih(fokus, setFokus, f.kode)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="pkb-catatan" className="mb-1 block text-sm font-semibold text-slate-900">Rekomendasi bebas</label>
              <Textarea id="pkb-catatan" value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={1000} rows={3} disabled={!bolehUbah}
                placeholder="Mis. mengikuti pelatihan asesmen diagnostik pada semester berikutnya" />
              <div className="mt-1 text-right text-xs text-slate-400">{catatan.length}/1000</div>
            </div>
            {data.rekomendasi && (
              <p className="text-xs text-slate-500">Terakhir disusun {data.rekomendasi.disusun_oleh_nama || '-'} ({PERAN[data.rekomendasi.peran_penyusun] || '-'}).</p>
            )}
            {!bolehUbah && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">Periode tidak sedang berjalan; rekomendasi hanya dapat dilihat.</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onTutup}>Tutup</Button>
          {bolehUbah && (
            <Button onClick={simpan} disabled={menyimpan || (!pilihan.length && !catatan.trim())} className="gap-1 bg-[#006837] hover:bg-[#005830]" data-testid="pkg-simpan-pkb">
              {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Tab "Rekomendasi PKB" menu Komponen: status & teks rekomendasi tiap guru dalam cakupan, dan dialog penyusunannya.
export default function DaftarRekomendasiPkb({ periodeId }) {
  const [data, setData] = useState(null);
  const [opsi, setOpsi] = useState(null);
  const [aktif, setAktif] = useState(null);

  const muat = useCallback(async () => {
    try {
      const [r, o] = await Promise.all([ringkasanPkb(periodeId), opsi ? Promise.resolve(opsi) : opsiPkb()]);
      setData(r);
      setOpsi(o);
    } catch (e) {
      toast.error(e.message);
      setData({ guru: [] });
    }
  }, [periodeId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { muat(); }, [muat]);
  const tutup = useCallback(() => setAktif(null), []);

  if (!data) return <div className="p-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-[#006837]" /></div>;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><GraduationCap className="h-4 w-4 text-[#006837]" /> Rekomendasi Pengembangan Keprofesian Berkelanjutan</CardTitle>
        <p className="text-xs text-slate-500">Disusun penilai atau kepala madrasah untuk setiap guru yang dinilai; tampil di rekap dan laporan hasil PKG.</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.guru.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Belum ada guru dalam cakupan Anda pada periode ini.</p>}
        {data.guru.map((g) => (
          <div key={g.guru_id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center" data-testid={`pkg-pkb-guru-${g.guru_id}`}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">{g.nama}</span>
                <BadgeStatusPenilaian status={g.status} />
                {g.level_capaian && <Badge variant="outline">{g.level_capaian}</Badge>}
              </div>
              <p className={`mt-1 text-xs ${g.rekomendasi ? 'text-slate-600' : 'text-amber-700'}`}>{g.rekomendasi?.teks || 'Belum ada rekomendasi'}</p>
            </div>
            <Button size="sm" variant={g.rekomendasi ? 'outline' : 'default'} className={`h-8 ${g.rekomendasi ? '' : 'bg-[#006837] hover:bg-[#005830]'}`}
              disabled={!opsi} onClick={() => setAktif(g)} data-testid={`pkg-pkb-buka-${g.guru_id}`}>
              {g.rekomendasi ? 'Ubah' : 'Susun'} rekomendasi
            </Button>
          </div>
        ))}
      </CardContent>
      {opsi && <DialogRekomendasi guru={aktif} periodeId={periodeId} opsi={opsi} onTutup={tutup} onTersimpan={() => { tutup(); muat(); }} />}
    </Card>
  );
}
